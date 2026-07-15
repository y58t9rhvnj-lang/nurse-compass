# Compass Version2 β — Phase 1: 認証基盤の初期化

Phase 1 で行ったのは **Supabase 接続基盤と環境設定のみ** です。
ログイン・DB保存・RLS・学習ログ・教員画面などは Phase 2 以降で実装します。

---

## Phase 1 の概要

- Version2 は `/v2` 配下の専用ルートとして構築（Version1 の `/` は不変更）。
- Supabase（Auth / PostgreSQL / RLS）を採用する前提の「接続の土台」を用意。
- ブラウザ用・サーバー用・管理用の Supabase クライアントを役割ごとに分離。
- 秘密鍵（service role key）は `server-only` でサーバーに隔離。
- Next.js 16 の `proxy`（旧 middleware）で `/v2` のみセッション Cookie を更新（認証リダイレクトは Phase 2）。
- `/v2` に暫定の「接続確認」画面を用意。未設定時は接続成功を装わない。

---

## 追加した依存関係

| パッケージ | 用途 |
| --- | --- |
| `@supabase/supabase-js` | Supabase クライアント本体 |
| `@supabase/ssr` | SSR 向け Browser/Server クライアント＋Cookie連携 |
| `server-only` | 秘密環境変数・Adminクライアントのブラウザ混入をビルド時に防止 |

---

## ディレクトリ構成（Phase 1 追加分）

```
proxy.ts                          # Next.js 16 proxy（matcher: /v2 のみ）
app/
  v2/
    layout.tsx                    # V2 共通レイアウト（最小）
    page.tsx                      # /v2 暫定接続確認画面
lib/
  v2/
    env.ts                        # 公開env（型安全読込・秘密は扱わない）
    env.server.ts                 # 秘密env（server-only）
    supabase/
      browserClient.ts           # Client Component 用（publishable key）
      serverClient.ts            # Server 用（Cookie連携・RLSはユーザー権限）
      adminClient.ts             # 管理用（service role・server-only隔離）
      proxy.ts                   # updateV2Session（セッションCookie更新）
      status.ts                  # 接続診断（server-only）
docs/
  version2/
    SUPABASE_SETUP.md            # Supabase 設定手順
    PHASE1_AUTH_INFRA.md         # 本ドキュメント
.env.example                      # V2 セクション追記（値は含めない）
```

V1 のコード（`app/page.tsx`・`lib/*` の既存ファイル等）は変更していません。

---

## Supabase 設定手順（要約）

詳細は [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) を参照。

1. Supabase プロジェクトを作成（リージョン: **Tokyo (ap-northeast-1) 推奨**）。
2. Settings → API から取得し `.env.local` に設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（または既存の `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
   - `SUPABASE_SERVICE_ROLE_KEY`（**秘密・サーバー専用**）
   - `V2_AUTH_EMAIL_DOMAIN`（既定 `students.compass.invalid`）
3. Vercel の **Preview** 環境変数にも同じキーを設定（Production はまだ不要）。
4. `npm run dev` → `/v2` で「設定済み / 到達OK」を確認。

### 秘密鍵の取り扱い（厳守）
- `NEXT_PUBLIC_` を付けない / Client Component から参照しない / ブラウザ client へ渡さない
- ログ・エラーメッセージへ出さない / Git へコミットしない（`.env.local` に置く）

---

## V1 へ影響しない理由

- **ルート分離**: 追加したのは `/v2` 配下と `lib/v2/**` のみ。V1 の `app/page.tsx` や既存 `lib/*` は未変更。
- **proxy の限定**: `matcher: ["/v2", "/v2/:path*"]` のみ。V1 の `/`・`_next/*`・`public/*` は proxy 対象外。
- **ビルド影響なし**: `/` は従来どおり静的（Static）、`/v2` のみ動的（Dynamic）。
- **環境変数の任意性**: Supabase 環境変数が未設定でも V1 は従来どおり動作し、`/v2` もクラッシュせず「未設定」を表示する（接続成功を装わない）。
- **秘密の隔離**: service role key は `server-only` によりクライアントバンドルへ混入しない。
