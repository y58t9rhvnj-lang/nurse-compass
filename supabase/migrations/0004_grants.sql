-- =====================================================================
-- Compass Version2 β — Phase 2
-- 0004_grants.sql : テーブル権限の明示付与
-- =====================================================================
-- 近年の Supabase では public スキーマ上の新規テーブルに対する API ロールへの
-- 自動 GRANT に依存できない場合がある（secure by default）。そのため必要最小限の
-- 権限を明示的に付与する。行レベルの絞り込みは引き続き RLS が担う。
--
--   authenticated : RLS 前提で SELECT のみ（書込ポリシーは無いので付与しない）
--   service_role  : シード等の管理処理のため全権限（RLS はバイパス）
--   anon          : テーブル権限は付与しない（未認証はデータ参照不可）
-- ---------------------------------------------------------------------

grant usage on schema public to authenticated, service_role;

-- authenticated: 参照のみ（profiles/organizations とも RLS で行を絞り込む）
grant select on public.organizations to authenticated;
grant select on public.profiles      to authenticated;

-- service_role: 管理・シード用（RLS 回避）
grant all on public.organizations to service_role;
grant all on public.profiles      to service_role;
