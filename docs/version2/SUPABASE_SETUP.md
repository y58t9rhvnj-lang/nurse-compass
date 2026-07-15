# Compass Version2 β — Supabase 接続セットアップ（Phase 1）

このドキュメントは **Version2（/v2 配下）** の Supabase 接続基盤を動かすための手順です。
Version1（`/`）はここで説明する設定が未設定でも従来どおり動作します。

> Phase 1 の範囲は「接続基盤と環境設定」のみです。
> ログイン・DB保存・RLS・学習ログ・教員画面などは Phase 2 以降で実装します。

---

## 1. 依存パッケージ

Phase 1 で追加済み（`package.json`）:

- `@supabase/supabase-js`
- `@supabase/ssr`
- `server-only`

---

## 2. 環境変数

`.env.local`（Git 管理外）に設定します。雛形は `.env.example` を参照してください。

| 変数名 | 用途 | ブラウザ露出 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | 可（公開値） |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 公開鍵（新方式 `sb_publishable_...`） | 可（公開値） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 既存プロジェクト用の anon key（publishable が無い場合のフォールバック） | 可（公開値） |
| `SUPABASE_SERVICE_ROLE_KEY` | 秘密鍵（サーバー専用・RLS 回避可） | **不可（秘密）** |
| `V2_AUTH_EMAIL_DOMAIN` | 個人ID→内部Auth識別子の内部ドメイン（既定 `students.compass.invalid`） | 不可 |

### service role key の取り扱い（厳守）

- `NEXT_PUBLIC_` を付けない
- Client Component から参照しない / ブラウザ用 client へ渡さない
- ログ・エラーメッセージへ出力しない
- Git へコミットしない（`.env.local` に置く。`.gitignore` で除外済み）

`SUPABASE_SERVICE_ROLE_KEY` は `lib/v2/env.server.ts`（`import "server-only"`）でのみ読み込みます。
Client Component から間接的にでも import するとビルドが失敗します。

---

## 3. Supabase クライアントの分離構造

| ファイル | 用途 | 使用キー | 実行環境 |
| --- | --- | --- | --- |
| `lib/v2/supabase/browserClient.ts` | Client Component 用 | publishable(anon) | ブラウザ |
| `lib/v2/supabase/serverClient.ts` | Server Component / Route Handler / Server Action 用（Cookie 連携、RLS はユーザー権限で作用） | publishable(anon) | サーバー |
| `lib/v2/supabase/adminClient.ts` | シード等の管理処理専用（**RLS 回避**）。`server-only` で隔離 | service role | サーバー（限定） |
| `lib/v2/supabase/proxy.ts` | `proxy` からのセッション Cookie 更新（`updateV2Session`） | publishable(anon) | サーバー(proxy) |

- `proxy.ts`（ルート直下）の matcher は `/v2` と `/v2/:path*` のみ。Version1（`/`）へは影響しません。
- 認可判断では `getSession()` の user を信用せず、`getClaims()`（高速なローカル検証）を優先、
  厳密さが必要な変更系では `getUser()` を使う方針です（Phase 2 で実装）。

---

## 4. 動作確認（/v2）

1. `.env.local` を設定する。
2. `npm run dev` で起動する。
3. ブラウザで `/v2` を開く。
   - 公開環境変数の設定状況
   - service role key の設定有無（値は表示しません）
   - Supabase への到達確認（Auth ヘルスチェック）
   - 内部Authドメイン
   が表示されます。
4. 未設定の場合は「未設定」と表示され、接続成功を装いません。

---

## 5. あなた（管理者）が Supabase 側で手動で行う作業（Phase 1）

Phase 1 では **プロジェクト作成と鍵取得・環境変数設定まで** を手動で行っていただきます。
テーブル作成・RLS・アカウント作成は Phase 2 以降で扱います。

1. Supabase でプロジェクトを新規作成（**リージョンは Tokyo (ap-northeast-1) 推奨**）。
2. Project Settings → API から以下を取得:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key（または anon key）→ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（または `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
   - service role（secret）key → `SUPABASE_SERVICE_ROLE_KEY`
3. ローカル `.env.local` に上記を設定（`V2_AUTH_EMAIL_DOMAIN` も設定）。
4. Vercel の Preview 環境変数にも同じキーを設定（Production はまだ設定しなくて構いません）。

> 秘密鍵の値をチャット・GitHub・スクリーンショットへ貼らないでください。
> 具体的な画面操作は Phase を進める段階で 1 画面ずつ案内します。
