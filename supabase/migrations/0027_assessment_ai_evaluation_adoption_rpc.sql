-- =====================================================================
-- Compass Version 2.2 Sprint 5C
-- 0027_assessment_ai_evaluation_adoption_rpc.sql
-- AI評価候補: 警告 ack / 一部採用 RPC（SECURITY DEFINER）
-- =====================================================================
-- 方針:
--   ・teacher のみ ack / adopt（admin は拒否）
--   ・student 実行不可
--   ・completed / 返却中 review への adopt 禁止
--   ・optimistic locking（review.updated_at）
--   ・未 ack 警告があれば adopt 拒否
--   ・overall_comment / teacher_observation / private_note は自動投入しない
--   ・adopt 時は review 更新・adoption 履歴・staging 状態・audit を同一 TX
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. acknowledge_ai_evaluation_warning
-- =====================================================================
create or replace function public.acknowledge_ai_evaluation_warning(
  p_staging_id uuid,
  p_warning_family text,
  p_warning_code text,
  p_warning_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_org uuid;
  v_login text;
  v_staging public.assessment_ai_evaluation_staging%rowtype;
  v_ack_id uuid;
  v_now timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select role, organization_id, login_id
    into v_role, v_org, v_login
  from public.profiles
  where id = v_uid and is_active = true;

  if v_role is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if v_role <> 'teacher' then
    return jsonb_build_object('ok', false, 'error', 'teacher_only');
  end if;

  if p_staging_id is null
     or p_warning_family is null
     or btrim(coalesce(p_warning_code, '')) = ''
     or btrim(coalesce(p_warning_payload_hash, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  if p_warning_family not in ('version', 'pii') then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  select * into v_staging
  from public.assessment_ai_evaluation_staging
  where id = p_staging_id
    and organization_id = v_org;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_staging.review_status not in ('needs_review', 'partially_adopted') then
    return jsonb_build_object('ok', false, 'error', 'staging_not_active');
  end if;

  if v_staging.validation_status = 'invalid' then
    return jsonb_build_object('ok', false, 'error', 'invalid_candidate');
  end if;

  insert into public.assessment_ai_evaluation_warning_acknowledgements (
    organization_id,
    staging_id,
    warning_family,
    warning_code,
    warning_payload_hash,
    acknowledged_by,
    acknowledged_at
  ) values (
    v_org,
    p_staging_id,
    p_warning_family,
    btrim(p_warning_code),
    btrim(p_warning_payload_hash),
    v_uid,
    v_now
  )
  on conflict (staging_id, warning_code, warning_payload_hash)
  do update set
    acknowledged_by = excluded.acknowledged_by,
    acknowledged_at = excluded.acknowledged_at
  returning id into v_ack_id;

  insert into public.assessment_ai_evaluation_audit_logs (
    organization_id,
    actor_user_id,
    actor_login_id,
    actor_role,
    action,
    assessment_submission_id,
    staging_id,
    request_id,
    evaluation_request_id,
    result_hash,
    selection_summary,
    summary,
    metadata
  ) values (
    v_org,
    v_uid,
    v_login,
    'teacher',
    'warning_ack',
    v_staging.assessment_submission_id,
    v_staging.id,
    v_staging.request_id,
    v_staging.evaluation_request_id,
    v_staging.result_hash,
    jsonb_build_object(
      'warning_family', p_warning_family,
      'warning_code', btrim(p_warning_code)
    ),
    'AI評価警告を確認しました',
    jsonb_build_object(
      'warning_payload_hash', btrim(p_warning_payload_hash),
      'ack_id', v_ack_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'ackId', v_ack_id,
    'acknowledgedAt', v_now
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'db_error', 'message', SQLERRM);
end;
$$;

revoke all on function public.acknowledge_ai_evaluation_warning(uuid, text, text, text)
  from public;
revoke all on function public.acknowledge_ai_evaluation_warning(uuid, text, text, text)
  from anon;
grant execute on function public.acknowledge_ai_evaluation_warning(uuid, text, text, text)
  to authenticated;

comment on function public.acknowledge_ai_evaluation_warning(uuid, text, text, text) is
  'Sprint 5C: teacher のみ。警告単位 ack。payload_hash 不一致の旧 ack は別行として無効扱い。';

-- =====================================================================
-- 2. adopt_ai_evaluation_candidate
-- =====================================================================
-- p_selection_json:
-- {
--   "adopted_rubric_keys": ["information_gathering"],
--   "adopted_comment_blocks": ["strengths"],
--   "dismissed_rubric_keys": [],
--   "dismissed_comment_blocks": [],
--   "include_overall_comment": false,
--   "include_teacher_observation": false,
--   "applied_rubric_scores": { "information_gathering": 3 },
--   "applied_comments": { "strengths": "..." },
--   "overlay": { ... }  -- optional teacher_draft_overlay_json merge
-- }
create or replace function public.adopt_ai_evaluation_candidate(
  p_staging_id uuid,
  p_review_id uuid,
  p_base_updated_at timestamptz,
  p_selection_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_org uuid;
  v_login text;
  v_staging public.assessment_ai_evaluation_staging%rowtype;
  v_review public.assessment_reviews%rowtype;
  v_sel jsonb;
  v_adopted_keys text[];
  v_adopted_blocks text[];
  v_dismissed_keys text[];
  v_dismissed_blocks text[];
  v_applied_scores jsonb;
  v_applied_comments jsonb;
  v_new_scores jsonb;
  v_before_snap jsonb;
  v_applied_snap jsonb;
  v_seq int;
  v_adoption_id uuid;
  v_updated int;
  v_after timestamptz;
  v_warn jsonb;
  v_ack_count int;
  v_code text;
  v_hash text;
  v_key text;
  v_block text;
  v_val text;
  v_score numeric;
  v_overlay jsonb;
  v_strengths text;
  v_next_steps text;
  v_missing text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select role, organization_id, login_id
    into v_role, v_org, v_login
  from public.profiles
  where id = v_uid and is_active = true;

  if v_role is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if v_role <> 'teacher' then
    return jsonb_build_object('ok', false, 'error', 'teacher_only');
  end if;

  if p_staging_id is null
     or p_review_id is null
     or p_base_updated_at is null
     or p_selection_json is null
     or jsonb_typeof(p_selection_json) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  -- overall / observation 自動投入は常に拒否（クライアントが true を送っても無視）
  v_sel := p_selection_json
    || jsonb_build_object(
      'include_overall_comment', false,
      'include_teacher_observation', false
    );

  select coalesce(
    array(select jsonb_array_elements_text(coalesce(v_sel->'adopted_rubric_keys', '[]'::jsonb))),
    array[]::text[]
  ) into v_adopted_keys;
  select coalesce(
    array(select jsonb_array_elements_text(coalesce(v_sel->'adopted_comment_blocks', '[]'::jsonb))),
    array[]::text[]
  ) into v_adopted_blocks;
  select coalesce(
    array(select jsonb_array_elements_text(coalesce(v_sel->'dismissed_rubric_keys', '[]'::jsonb))),
    array[]::text[]
  ) into v_dismissed_keys;
  select coalesce(
    array(select jsonb_array_elements_text(coalesce(v_sel->'dismissed_comment_blocks', '[]'::jsonb))),
    array[]::text[]
  ) into v_dismissed_blocks;

  if coalesce(array_length(v_adopted_keys, 1), 0) = 0
     and coalesce(array_length(v_adopted_blocks, 1), 0) = 0
     and coalesce(array_length(v_dismissed_keys, 1), 0) = 0
     and coalesce(array_length(v_dismissed_blocks, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_selection');
  end if;

  -- dismiss のみは review 非更新でも可だが、Sprint 5C では adopt 反映を必須とする
  if coalesce(array_length(v_adopted_keys, 1), 0) = 0
     and coalesce(array_length(v_adopted_blocks, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_adoption');
  end if;

  select * into v_staging
  from public.assessment_ai_evaluation_staging
  where id = p_staging_id
    and organization_id = v_org
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_staging.review_status = 'superseded' then
    return jsonb_build_object('ok', false, 'error', 'staging_superseded');
  end if;

  if v_staging.review_status not in ('needs_review', 'partially_adopted') then
    return jsonb_build_object('ok', false, 'error', 'staging_not_active');
  end if;

  if v_staging.validation_status = 'invalid' then
    return jsonb_build_object('ok', false, 'error', 'invalid_candidate');
  end if;

  -- 未 ack 警告チェック（version + pii）
  for v_warn in
    select * from jsonb_array_elements(coalesce(v_staging.version_warnings, '[]'::jsonb))
  loop
    v_code := coalesce(v_warn->>'code', '');
    v_hash := coalesce(v_warn->>'payload_hash', '');
    if v_code = '' or v_hash = '' then
      continue;
    end if;
    select count(*) into v_ack_count
    from public.assessment_ai_evaluation_warning_acknowledgements
    where staging_id = v_staging.id
      and warning_family = 'version'
      and warning_code = v_code
      and warning_payload_hash = v_hash;
    if v_ack_count < 1 then
      return jsonb_build_object(
        'ok', false,
        'error', 'warnings_unacked',
        'family', 'version',
        'code', v_code
      );
    end if;
  end loop;

  for v_warn in
    select * from jsonb_array_elements(coalesce(v_staging.pii_warnings, '[]'::jsonb))
  loop
    v_code := coalesce(v_warn->>'code', '');
    v_hash := coalesce(v_warn->>'payload_hash', '');
    if v_code = '' or v_hash = '' then
      continue;
    end if;
    select count(*) into v_ack_count
    from public.assessment_ai_evaluation_warning_acknowledgements
    where staging_id = v_staging.id
      and warning_family = 'pii'
      and warning_code = v_code
      and warning_payload_hash = v_hash;
    if v_ack_count < 1 then
      return jsonb_build_object(
        'ok', false,
        'error', 'warnings_unacked',
        'family', 'pii',
        'code', v_code
      );
    end if;
  end loop;

  select * into v_review
  from public.assessment_reviews
  where id = p_review_id
    and organization_id = v_org
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'review_not_found');
  end if;

  if v_review.assessment_submission_id <> v_staging.assessment_submission_id then
    return jsonb_build_object('ok', false, 'error', 'submission_mismatch');
  end if;

  if v_review.status <> 'draft' then
    return jsonb_build_object('ok', false, 'error', 'review_completed');
  end if;

  if v_review.returned_at is not null and v_review.return_revoked_at is null then
    return jsonb_build_object('ok', false, 'error', 'review_returned');
  end if;

  if v_review.updated_at <> p_base_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  v_before_snap := jsonb_build_object(
    'rubric_scores', coalesce(v_review.rubric_scores, '{}'::jsonb),
    'overall_comment', coalesce(v_review.overall_comment, ''),
    'strengths_comment', coalesce(v_review.strengths_comment, ''),
    'next_steps_comment', coalesce(v_review.next_steps_comment, ''),
    'missing_information_comment', coalesce(v_review.missing_information_comment, ''),
    'status', v_review.status,
    'updated_at', v_review.updated_at
  );

  v_new_scores := coalesce(v_review.rubric_scores, '{}'::jsonb);
  v_applied_scores := coalesce(v_sel->'applied_rubric_scores', '{}'::jsonb);
  v_applied_comments := coalesce(v_sel->'applied_comments', '{}'::jsonb);
  v_applied_snap := jsonb_build_object('rubric_scores', '{}'::jsonb);
  v_strengths := coalesce(v_review.strengths_comment, '');
  v_next_steps := coalesce(v_review.next_steps_comment, '');
  v_missing := coalesce(v_review.missing_information_comment, '');

  foreach v_key in array v_adopted_keys
  loop
    if v_key not in (
      'information_gathering',
      'relating_information',
      'interpretation_analysis',
      'clarity_of_evidence',
      'awareness_of_gaps',
      'patient_understanding',
      'overall_integration'
    ) then
      return jsonb_build_object('ok', false, 'error', 'invalid_rubric_key', 'key', v_key);
    end if;
    if not (v_applied_scores ? v_key) then
      return jsonb_build_object('ok', false, 'error', 'missing_applied_score', 'key', v_key);
    end if;
    begin
      v_score := (v_applied_scores->>v_key)::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid_score', 'key', v_key);
    end;
    if v_score is null or v_score <> trunc(v_score) or v_score < 1 or v_score > 5 then
      return jsonb_build_object('ok', false, 'error', 'invalid_score', 'key', v_key);
    end if;
    v_new_scores := jsonb_set(v_new_scores, array[v_key], to_jsonb(v_score::int), true);
    v_applied_snap := jsonb_set(
      v_applied_snap,
      array['rubric_scores', v_key],
      to_jsonb(v_score::int),
      true
    );
  end loop;

  foreach v_block in array v_adopted_blocks
  loop
    if v_block = 'strengths' then
      v_strengths := left(coalesce(v_applied_comments->>'strengths', ''), 3000);
      v_applied_snap := jsonb_set(v_applied_snap, array['strengths_comment'], to_jsonb(v_strengths), true);
    elsif v_block = 'next_questions' then
      v_next_steps := left(coalesce(v_applied_comments->>'next_questions', ''), 3000);
      v_applied_snap := jsonb_set(v_applied_snap, array['next_steps_comment'], to_jsonb(v_next_steps), true);
    elsif v_block = 'gaps_or_alternatives' then
      v_missing := left(coalesce(v_applied_comments->>'gaps_or_alternatives', ''), 3000);
      v_applied_snap := jsonb_set(
        v_applied_snap,
        array['missing_information_comment'],
        to_jsonb(v_missing),
        true
      );
    elsif v_block = 'supporting_information' then
      return jsonb_build_object('ok', false, 'error', 'unsupported_comment_block');
    else
      return jsonb_build_object('ok', false, 'error', 'invalid_comment_block', 'block', v_block);
    end if;
  end loop;

  update public.assessment_reviews
  set
    rubric_scores = v_new_scores,
    strengths_comment = v_strengths,
    next_steps_comment = v_next_steps,
    missing_information_comment = v_missing,
    updated_by = v_uid
  where id = v_review.id
    and organization_id = v_org
    and updated_at = p_base_updated_at
    and status = 'draft'
    and (returned_at is null or return_revoked_at is not null);

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  select updated_at into v_after
  from public.assessment_reviews
  where id = v_review.id;

  select coalesce(max(adoption_sequence), 0) + 1 into v_seq
  from public.assessment_ai_evaluation_adoptions
  where staging_id = v_staging.id;

  insert into public.assessment_ai_evaluation_adoptions (
    organization_id,
    staging_id,
    assessment_review_id,
    adoption_sequence,
    adoption_selection_json,
    review_before_snapshot_json,
    applied_snapshot_json,
    review_updated_at_before,
    review_updated_at_after,
    adopted_at,
    adopted_by
  ) values (
    v_org,
    v_staging.id,
    v_review.id,
    v_seq,
    v_sel,
    v_before_snap,
    v_applied_snap,
    p_base_updated_at,
    v_after,
    now(),
    v_uid
  )
  returning id into v_adoption_id;

  v_overlay := coalesce(v_staging.teacher_draft_overlay_json, '{}'::jsonb);
  if jsonb_typeof(v_sel->'overlay') = 'object' then
    v_overlay := v_overlay || (v_sel->'overlay');
  end if;
  v_overlay := v_overlay || jsonb_build_object(
    'last_adoption_sequence', v_seq,
    'last_applied', v_applied_snap
  );

  update public.assessment_ai_evaluation_staging
  set
    review_status = 'partially_adopted',
    teacher_draft_overlay_json = v_overlay
  where id = v_staging.id
    and review_status in ('needs_review', 'partially_adopted');

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return jsonb_build_object('ok', false, 'error', 'staging_state_conflict');
  end if;

  insert into public.assessment_ai_evaluation_audit_logs (
    organization_id,
    actor_user_id,
    actor_login_id,
    actor_role,
    action,
    assessment_submission_id,
    staging_id,
    request_id,
    evaluation_request_id,
    result_hash,
    selection_summary,
    summary,
    metadata
  ) values (
    v_org,
    v_uid,
    v_login,
    'teacher',
    'partial_adopt',
    v_staging.assessment_submission_id,
    v_staging.id,
    v_staging.request_id,
    v_staging.evaluation_request_id,
    v_staging.result_hash,
    jsonb_build_object(
      'adopted_rubric_keys', to_jsonb(v_adopted_keys),
      'adopted_comment_blocks', to_jsonb(v_adopted_blocks),
      'dismissed_rubric_keys', to_jsonb(v_dismissed_keys),
      'dismissed_comment_blocks', to_jsonb(v_dismissed_blocks),
      'adoption_sequence', v_seq
    ),
    'AI評価候補を一部採用しました',
    jsonb_build_object(
      'adoption_id', v_adoption_id,
      'review_id', v_review.id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'adoptionId', v_adoption_id,
    'adoptionSequence', v_seq,
    'reviewUpdatedAt', v_after,
    'reviewStatus', 'partially_adopted',
    'appliedSnapshot', v_applied_snap
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'db_error', 'message', SQLERRM);
end;
$$;

revoke all on function public.adopt_ai_evaluation_candidate(uuid, uuid, timestamptz, jsonb)
  from public;
revoke all on function public.adopt_ai_evaluation_candidate(uuid, uuid, timestamptz, jsonb)
  from anon;
grant execute on function public.adopt_ai_evaluation_candidate(uuid, uuid, timestamptz, jsonb)
  to authenticated;

comment on function public.adopt_ai_evaluation_candidate(uuid, uuid, timestamptz, jsonb) is
  'Sprint 5C: teacher のみ。選択項目を draft review へマージし、adoption 履歴と staging を同一 TX で更新。';
