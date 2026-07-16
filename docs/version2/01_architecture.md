# 01. アーキテクチャ設計 — Compass Version2 β

## 設計思想（最重要）

Compass は **教育支援システム** です。
学生を**評価・選別するため**ではなく、
**患者理解がどのように形成されていくか**を支え、その過程に寄り添うために存在します。

この思想は技術設計にも反映します。

- データは「成績を測る材料」ではなく「学びの足跡」として扱う。
- 患者理解は一度で完成しない。**更新され続けるもの**として履歴・バージョン・Journey を残す（上書きしない）。
- 学習は 情報収集 → 情報整理 → 患者理解 → **再び情報収集** と何度も行き来する。
  「現在位置を1つだけ持つ」ような直線的モデルは採用しない。
- 教員画面でも自動採点・順位付け・優劣の自動判定・学生間比較は行わない（形成的支援に徹する）。

## 全体構成

```
[ ブラウザ ]
    |  個人ID + パスワード
    v
/v2/login ──(POST)──> /v2/api/auth/login (Route Handler)
    |                        |  login_id 正規化 → 仮想メール変換
    |                        v
    |                   Supabase Auth (signInWithPassword)
    |                        |  セッション Cookie
    v                        v
  proxy.ts (Next.js 16) ── セッション更新 + 未認証を /v2/login へ
    |
    v
/v2 (role で振り分け) ──> /v2/student   （student）
                     └──> /v2/teacher   （teacher / admin）
```

- **ルート分離**: Version2 は `/v2` 配下のみ。Version1（`/`）と認証なし公開状態は不変更。
- **proxy**: matcher は `/v2` と `/v2/:path*` のみ。V1・静的アセットには一切影響しない。
- **認可の多層防御**: proxy は「未認証を弾く」optimistic ガード。role による厳密な認可は
  各サーバーコンポーネント（`requireRole`）で profiles を参照して判定する。
  クライアント表示制御だけに依存しない。

## Supabase クライアントの分離

| ファイル | 用途 | 使用キー | RLS |
| --- | --- | --- | --- |
| `lib/v2/supabase/browserClient.ts` | Client Component | publishable(anon) | 効く |
| `lib/v2/supabase/serverClient.ts` | Server Component / Route Handler | publishable(anon) + セッション | 効く |
| `lib/v2/supabase/adminClient.ts` | 管理処理（将来）・`server-only` | service role | **回避**（限定利用） |
| `lib/v2/supabase/proxy.ts` | proxy のセッション更新・認証リダイレクト | publishable(anon) | 効く |

- 認可判断では `getSession()` の user を信用しない。`getClaims()`（JWT ローカル検証）を優先し、
  厳密さが必要な変更系では `getUser()` を使う。
- service role は RLS を回避できるため、通常のデータ取得には使わない。シード等に限定する。

## 認証（個人IDのみ）

- 学生・教員は **個人ID + パスワード** のみでログイン。実メールは収集しない。
- Supabase Auth が要求するメール形式には、個人IDから内部専用の**仮想メール**を生成して充てる。
  例: `S001` → 正規化 `s001` → `s001@<V2_AUTH_EMAIL_DOMAIN>`（既定 `students.compass.invalid`）。
- 仮想メールは画面・URL・学習ログに一切出さない。

## role

`student` / `teacher` / `admin` の3種類。

- `student`: 自分の学びのスペース。自分のデータのみ。
- `teacher`: 学生の学習過程を閲覧し、途中の助言に活かす（閲覧中心）。
- `admin`: 今回は teacher 相当（admin 専用画面は未実装）。将来拡張用。

## 今後追加予定

- 情報整理ノート / 様式2 の DB 保存（Phase 3）
- 学習ログ・教員用学生一覧・学生ごとのログ確認（Phase 4）
- Teaching Guide β・Apple Pencil 書き込み（Phase 5）
- Patient Understanding（履歴・バージョン・Journey）は 04 / 03 参照（設計のみ）
- 複数学校（organizations 複数）・年度切替（academic_year）
