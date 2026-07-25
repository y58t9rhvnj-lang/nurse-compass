# Sprint D-3C — Admin ガード / 監査ログ基盤

Compass Version2 の管理者機能を実装する前提として、(1) `/v2/admin/*` を
管理者だけが利用できる状態にし、(2) 今後の管理者による書き込み操作を記録する
監査ログ基盤を用意した。本 Sprint では学生管理・CSV 一括登録・パスワード
リセット等の実機能は実装しない。

## 1. Admin ガードの責務

- `/v2/admin/*` 配下は `app/v2/admin/layout.tsx` の `requireRole("admin")`
  一箇所でガードする。各ページで role 判定を重複実装しない。
- `requireRole("admin")`（`lib/v2/auth/currentUser.ts`）が担保すること:
  - 未認証 → `/v2/login`（proxy と `requireActiveUser` による）
  - `is_active=false` → `/v2/login`
  - `must_change_password=true` → `/v2/change-password`（role 判定より先）
  - `role=student` / `role=teacher` → `/v2` へ戻し、自分の role 画面へ振り分け
  - `role=admin` → 通過
- クライアントの表示制御には依存しない。判定は必ずサーバー側（Server Component /
  サーバー認証関数）で行う。
- `/v2/admin/page.tsx` は最小プレースホルダ（「管理者ホーム / 管理者機能は準備中です」）。
  role 判定は layout に集約し、ページは表示用に `getCurrentProfile()` のみ使用する。

## 2. Audit Log の目的

- 管理者（`role=admin`）による書き込み系操作を「そのときの事実」として
  1操作=1レコードで残し、後から追跡可能にする。
- 後から `profiles` が変更・無効化されても内容が書き換わらないよう、
  actor / target は**スナップショット値**（`actor_login_id` / `actor_role` /
  `target_login_id` 等）を保存する。
- `actor_user_id` / `target_id` には外部キーを張らない（将来ユーザーが物理削除
  されても記録を残すため）。`organization_id` のみ `organizations` を参照する。

### テーブル: `public.admin_audit_logs`（migration `0015`）

`id, organization_id(FK organizations), actor_user_id, actor_login_id,
actor_role, action, target_type, target_id, target_login_id, summary,
metadata(jsonb), created_at`。RLS 有効・ポリシーなし（authenticated/anon は
既定拒否）。`service_role` のみ全権限。`anon`/`authenticated` は明示 REVOKE。

### action / target_type 語彙（`lib/v2/admin/auditTypes.ts`）

- `ADMIN_AUDIT_ACTIONS`: `user.create` / `user.update` / `user.deactivate` /
  `user.reactivate` / `user.password_reset` / `user.csv_import`
- `ADMIN_AUDIT_TARGET_TYPES`: `user` / `csv_import` / `system`
- D-3 で予定する操作に限定し、過剰に増やさない。今後使用予定のものは定義してよい。

## 3. 記録対象 / 記録しない情報

記録する（最小限）:

- 実行者のスナップショット（`actor_user_id` / `actor_login_id` / `actor_role`）
- 操作種別（`action` / `target_type`）と対象（`target_id` / `target_login_id`）
- 人間可読の要約（`summary`）と、追跡に必要な最小限の `metadata`
  （例: 処理件数、成功/失敗件数、対象の種別）

記録しない（厳禁）:

- パスワード / 初期パスワード
- Supabase Auth のトークン
- Cookie / セッション情報
- CSV ファイルの全内容
- 必要以上の個人情報

`summary` / `metadata` にも上記の秘密情報を含めない。writer 呼び出し側の責務。

## 4. Audit Log Writer（`lib/v2/admin/auditLog.ts`）

- `writeAdminAuditLog(input): Promise<AuditLogResult>`、`server-only`。
- `service role client`（`createAdminSupabaseClient`）で1件 INSERT する。
- 戻り値は成功/失敗を判定できる型:
  - `{ ok: true; auditLogId }` / `{ ok: false; errorCode: "not_configured" | "insert_failed" }`
- 生の DB エラーは戻り値へ出さない。サーバーログにも秘密情報を含まない一般
  メッセージのみ出力する。

## 5. 操作成功・監査ログ失敗時の扱い（失敗方針）

今後の管理者操作は「本体操作 → 監査ログ記録」の順で行う。Supabase Auth 操作と
DB 操作を完全な単一トランザクションにできない場合があるため、方針を明文化する。

- 本体操作が失敗 → 監査ログを「成功」として記録しない。
- 本体操作が成功 → 監査ログを記録する。
- 本体操作は成功したが監査ログの記録だけ失敗:
  - 操作自体を成功として扱うか、管理者へ警告するかは**操作ごとに判断**する。
    - 例: `password_reset` / `deactivate` 等の重要操作は、成功扱いとしつつ
      「記録に失敗した」旨を管理者へ警告表示する。
    - 例: 影響の小さい `update` は成功扱いのみでも可。
  - いずれの場合も、少なくともサーバー側で検知可能にする
    （`AuditLogResult.errorCode` とサーバーログ）。
- パスワードや秘密情報は失敗ログにも残さない。

## 6. 今後の学生管理機能との接続方法

- 学生管理・CSV 一括登録・パスワードリセット等の Server Action は、
  本体操作成功後に `writeAdminAuditLog()` を呼ぶ。
- actor 情報は `requireRole("admin")` が返す `AppProfile`（`id` / `loginId` /
  `role` / `organizationId`）から与える。target 情報は操作対象の
  `login_id` 等をスナップショットで渡す。
- 監査ログ閲覧機能は本 Sprint では実装しない。実装時は authenticated 向け
  SELECT ポリシーを足すのではなく、**管理者専用のサーバー処理**（service role）
  として追加する。
