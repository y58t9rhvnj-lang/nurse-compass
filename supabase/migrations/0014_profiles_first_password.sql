-- =====================================================================
-- Compass Version2 — Sprint D-3A
-- 0014_profiles_first_password.sql : 初回パスワード変更状態
-- =====================================================================
-- 目的:
--   初回パスワード変更フロー / Admin ダッシュボード / 学生一括登録の共通基盤として、
--   profiles に「初回パスワード変更が未了か」を示す状態列を追加する。
--
-- 設計方針:
--   ・新規作成されるプロフィールは default により must_change_password = true
--     （＝初回ログイン後にパスワード変更を強制できる）。
--   ・この migration 適用時点で既に存在するプロフィール（student01 / teacher /
--     admin 等）は初回変更を強制しない → 既存行のみ false へ移行する。
--   ・1トランザクション内で安全に実行し、再適用時に意図しないデータ変更を
--     起こさない（列追加と既存行の false 移行は「初回追加時のみ」実行）。
--
-- RLS / ACL:
--   ・profiles の既存 SELECT ポリシーは変更しない。
--   ・authenticated 向けの UPDATE ポリシー/権限は追加しない
--     （学生がこのフラグ・role・organization_id を直接書き換える経路を作らない）。
--   ・状態更新は将来、service role のサーバー処理から auth.uid() 限定で行う。
-- ---------------------------------------------------------------------

begin;

-- 1) must_change_password
--    新規行の default は true。列追加は初回のみ。
--    既存行への false 移行も「列を新規追加したときだけ」実行するため、
--    再適用（列が既に存在）時は一切データを変更しない。
do $$
declare
  had_column boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'must_change_password'
  ) into had_column;

  if not had_column then
    alter table public.profiles
      add column must_change_password boolean not null default true;

    -- この時点の profiles は「適用前から存在する既存行」のみ。
    -- 既存ユーザーには初回パスワード変更を強制しない。
    update public.profiles
      set must_change_password = false;
  end if;
end
$$;

-- 2) password_changed_at
--    パスワード変更時刻の記録用（監査・状態確認）。null 許容。
--    既存行は null のまま（変更履歴が無いことを表す）。
--    冪等に追加でき、既存値は変更しない。
alter table public.profiles
  add column if not exists password_changed_at timestamptz;

commit;
