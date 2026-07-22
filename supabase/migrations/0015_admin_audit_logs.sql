-- =====================================================================
-- Compass Version2 — Sprint D-3C
-- 0015_admin_audit_logs.sql : 管理者操作の監査ログ基盤
-- =====================================================================
-- 目的:
--   管理者（role=admin）による書き込み系操作（ユーザー作成・更新・無効化・
--   有効化・パスワードリセット・CSV一括登録 等）を、後から追跡できる形で
--   1操作=1レコードとして記録する土台を用意する。
--   この Sprint では実機能は実装せず、テーブル・RLS・共通 writer までを整える。
--
-- 履歴保持の方針:
--   ・監査ログは「そのときの事実」を残すことが最優先。後から profiles が
--     変更・無効化されても内容が書き換わらないよう、actor / target は
--     スナップショット値（login_id / role 等）を必ず保存する。
--   ・actor_user_id / target_id には外部キーを張らない（将来ユーザーが物理削除
--     されても監査記録を残せるようにするため。整合性は writer 側で担保する）。
--   ・organization_id のみ organizations への参照とする（組織は削除しない運用。
--     監査行が存在する組織は RESTRICT により誤削除を防げる＝保持に有利）。
-- ---------------------------------------------------------------------

-- gen_random_uuid は 0001 で作成済みの pgcrypto 由来（保険で再作成）。
create extension if not exists pgcrypto;

create table if not exists public.admin_audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  -- 実行者（外部キーは張らない。スナップショットで永続化する）。
  actor_user_id    uuid not null,
  actor_login_id   text,                 -- 実行時点の login_id（スナップショット）
  actor_role       text not null,        -- 実行時点の role（スナップショット）
  -- 操作内容。
  action           text not null,        -- 例: 'user.create'（アプリ側の定数で管理）
  target_type      text not null,        -- 例: 'user' / 'csv_import' / 'system'
  target_id        text,                 -- 対象ID（uuid や学籍番号等。文字列で保持）
  target_login_id  text,                 -- 対象の login_id（スナップショット）
  summary          text not null,        -- 人間可読の要約（秘密情報を含めない）
  metadata         jsonb not null default '{}'::jsonb,  -- 補足（秘密情報を含めない）
  created_at       timestamptz not null default now()
);

-- よく使う検索軸のみ最小限の index を張る。
create index if not exists admin_audit_logs_org_created_at_idx
  on public.admin_audit_logs (organization_id, created_at desc);
create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_user_id);
create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs (action);

-- ---------------------------------------------------------------------
-- RLS / 権限
--   ・RLS を有効化し、ポリシーは一切作らない → authenticated / anon からは
--     SELECT/INSERT/UPDATE/DELETE いずれも既定拒否となる。
--   ・service_role は RLS をバイパスするため、server-only の writer から
--     service role client で INSERT する（閲覧機能は将来、管理者専用の
--     サーバー処理として別途追加する）。
-- ---------------------------------------------------------------------
alter table public.admin_audit_logs enable row level security;

-- 明示的な権限剥奪（D-3A の Default ACL 修正に加え、二重の保険）。
revoke all on public.admin_audit_logs from public;
revoke all on public.admin_audit_logs from anon;
revoke all on public.admin_audit_logs from authenticated;

-- 管理・記録用（RLS 回避）。
grant all on public.admin_audit_logs to service_role;

-- ---------------------------------------------------------------------
-- ロールバック時の考慮:
--   drop table public.admin_audit_logs; を実行すると、蓄積済みの監査記録は
--   すべて失われる。運用開始後のロールバックは原則行わない。
--   （index / policy は table drop に追従して消える。）
-- ---------------------------------------------------------------------
