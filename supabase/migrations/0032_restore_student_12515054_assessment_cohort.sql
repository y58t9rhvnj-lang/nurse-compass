-- =====================================================================
-- Compass Version 2.2
-- 0032_restore_student_12515054_assessment_cohort.sql
--
-- 0029 第2 UPDATE が実学生 login_id=12515054 を検証用として誤マークした訂正。
-- 0029 は変更しない・再実行しない。19810719 には触れない。
-- schema / RLS 変更なし。
--
-- 冪等: exclude_from_assessment=true の当該1 login だけ false にする。
-- 既に false なら 0 行（Hotfix 先行適用後の再適用は no-op）。
-- =====================================================================

update public.profiles
set exclude_from_assessment = false
where role = 'student'
  and login_id = '12515054'
  and exclude_from_assessment = true;
