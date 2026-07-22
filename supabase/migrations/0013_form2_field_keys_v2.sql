-- =====================================================================
-- Compass Version2 — Learning Layer
-- 0013_form2_field_keys_v2.sql : 様式2 の項目構成刷新（受け持つまでの経過／医師の治療方針・内容）
-- =====================================================================
-- 目的:
--   ・「受け持つまでの経過」を新 9 項目へ整理（旧項目は削除せず互換温存）。
--   ・「医師の治療方針・内容」を 1 欄（treatment.policyAndContent）から 4 項目
--     （treatment.policy / goal / medication / program）へ分割。
--   ・form2_records.payload（jsonb）はスキーマ変更不要。ここで扱うのは、固定キーを参照する
--     2 つのテーブルの CHECK 制約更新と、reflection の安全なデータ移行のみ。
--
-- 非破壊の原則:
--   ・旧キーは互換目的で CHECK に残す（既存の form2_evidence_links / form2_field_reflections 行を
--     制約違反にしない）。
--   ・reflection の移行は破壊的な一括 UPDATE を行わず、INSERT ... SELECT ... ON CONFLICT DO NOTHING で
--     「新 treatment.policy の reflection が無い場合だけ」旧 treatment.policyAndContent からコピーする。
--     既存の reflection 本文は上書きしない。旧 treatment.policyAndContent 行も削除しない。
--   ・削除 4 項目（history.firstAdmission / insight / medicationRecognition / dischargeThoughts）の
--     reflection は他項目へ自動統合しない（そのまま残す）。
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. form2_evidence_links の項目キー CHECK を新旧併存の集合へ更新
-- =====================================================================
alter table public.form2_evidence_links
  drop constraint if exists form2_evidence_links_field_key_valid;

alter table public.form2_evidence_links
  add constraint form2_evidence_links_field_key_valid check (
    form2_field_key in (
      -- basicInformation.*
      'basicInformation.patientName',
      'basicInformation.age',
      'basicInformation.sex',
      'basicInformation.diagnosis',
      'basicInformation.pastHistory',
      'basicInformation.admissionType',
      'basicInformation.chiefComplaint',
      -- history.*（新 9 項目）
      'history.developmentalHistory',
      'history.familyBackground',
      'history.schoolHistory',
      'history.employmentHistory',
      'history.beforeOnset',
      'history.subsequentCourse',
      'history.currentAdmissionCourse',
      'history.currentCondition',
      'history.currentLife',
      -- history.*（旧項目・互換温存。UI 非表示・新規保存対象外だが既存行を守る）
      'history.firstAdmission',
      'history.insight',
      'history.medicationRecognition',
      'history.dischargeThoughts',
      -- treatment（新 4 項目）
      'treatment.policy',
      'treatment.goal',
      'treatment.medication',
      'treatment.program',
      -- treatment（旧 1 欄・互換温存）
      'treatment.policyAndContent'
    )
  );

-- =====================================================================
-- 2. form2_field_reflections の項目キー CHECK を新旧併存の集合へ更新（0010 と同一集合）
-- =====================================================================
alter table public.form2_field_reflections
  drop constraint if exists form2_field_reflections_field_key_valid;

alter table public.form2_field_reflections
  add constraint form2_field_reflections_field_key_valid check (
    form2_field_key in (
      -- basicInformation.*
      'basicInformation.patientName',
      'basicInformation.age',
      'basicInformation.sex',
      'basicInformation.diagnosis',
      'basicInformation.pastHistory',
      'basicInformation.admissionType',
      'basicInformation.chiefComplaint',
      -- history.*（新 9 項目）
      'history.developmentalHistory',
      'history.familyBackground',
      'history.schoolHistory',
      'history.employmentHistory',
      'history.beforeOnset',
      'history.subsequentCourse',
      'history.currentAdmissionCourse',
      'history.currentCondition',
      'history.currentLife',
      -- history.*（旧項目・互換温存）
      'history.firstAdmission',
      'history.insight',
      'history.medicationRecognition',
      'history.dischargeThoughts',
      -- treatment（新 4 項目）
      'treatment.policy',
      'treatment.goal',
      'treatment.medication',
      'treatment.program',
      -- treatment（旧 1 欄・互換温存）
      'treatment.policyAndContent'
    )
  );

-- =====================================================================
-- 3. reflection の安全な移行（旧 treatment.policyAndContent → 新 treatment.policy）
-- =====================================================================
-- 破壊的な一括 UPDATE ではなく、INSERT ... SELECT ... ON CONFLICT DO NOTHING を用いる。
--   ・コピー元: form2_field_key = 'treatment.policyAndContent' で本文が空でない行。
--   ・コピー先: 同一 (user_id, case_id) の 'treatment.policy' 行が「まだ無い」場合だけ新規作成。
--     （uq_form2_field_reflection_owner = (user_id, case_id, form2_field_key) の競合は DO NOTHING）
--   ・既存の 'treatment.policy' 本文は保持（上書きしない）。
--   ・旧 'treatment.policyAndContent' 行は削除しない（そのまま残す）。
insert into public.form2_field_reflections
  (user_id, organization_id, academic_year, case_id, patient_id, form2_field_key, reflection_text)
select
  user_id, organization_id, academic_year, case_id, patient_id,
  'treatment.policy' as form2_field_key,
  reflection_text
from public.form2_field_reflections
where form2_field_key = 'treatment.policyAndContent'
  and btrim(reflection_text) <> ''
on conflict (user_id, case_id, form2_field_key) do nothing;

-- =====================================================================
-- COMMENT
-- =====================================================================
comment on column public.form2_evidence_links.form2_field_key is
  '様式2 の固定フィールドキー（section.field のドットパス。lib/form2/form2FieldKeys.ts の許可集合と一致）。0013 で治療を 4 項目へ分割。旧キー（history 旧4項目・treatment.policyAndContent）は互換目的で保持。';
comment on column public.form2_field_reflections.form2_field_key is
  '様式2 の固定フィールドキー（section.field のドットパス。lib/form2/form2FieldKeys.ts の許可集合と一致）。0013 で治療を 4 項目へ分割。旧キーは互換目的で保持。';
