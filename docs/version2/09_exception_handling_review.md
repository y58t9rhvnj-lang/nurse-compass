# 09. Exception Handling レビュー — Sprint2-1 事前調査

Version 1.0
Last Update: 2026-07-17
Status: Review（実装前・Sprint2-1 で対応）

> 本書は Sprint2-1「Exception Handling 共通化」の事前調査である。
> 現在の例外処理の実装状況を層ごとに整理し、重複・改善方針・推奨アーキテクチャ・修正対象ファイルを提示する。
> **本ターンではアプリコードを変更していない。** 実装は Sprint2-1 で行う。
>
> 関連: `06_sprint2_technical_debt.md`（TD-002）、`08_sprint1_review.md`、`09_Design_Log.md`(DL-013)。
> （注）ファイル名は指示では `07_exception_handling_review.md` だが、`07_evidence_source_reference.md` が既存のため連番規約を保ち `09_` とした。

---

## 0. 前提：Supabase JS のエラー挙動

`@supabase/supabase-js` のクエリ（`.select/.insert/.update` や `auth.getClaims` 等）は、DB/PostgREST エラーを **throw せず `{ data, error }` の `error` に返す**。したがって Repository・Server Action 内の DB 呼び出しは通常 throw しない。
**throw（Promise reject）が起きるのは主にクライアント→Server Action 呼び出しの境界**（ネットワーク断・サーバ停止・シリアライズ不能な例外）である。この境界が現状で未保護なのが本課題の中心（TD-002）。

---

## 1. 現在の例外処理一覧（層別）

### 1.1 Server Actions（`app/v2/actions/`）
| 項目 | 現状 |
|---|---|
| 対象 | `form2.ts`（`loadForm2Action`/`saveForm2Action`）、`informationCards.ts`（`listCardsAction`/`createCardAction`/`updateCardAction`/`releaseCardAction`） |
| try/catch | **なし**。ただし DB 呼び出しは throw しないため、正常系＋DBエラーは `{data,error}` で処理される |
| 返り値 | **Result 判別共用体**（`{ok:true,...}` / `{ok:false, kind, message}`）。`ActionErrorKind`＝`unauthorized/validation/conflict/duplicate/not_configured/not_found/db_error` |
| エラーメッセージ | 固定の英語短文（`"failed to save form2"` 等）。**DB 生エラーは返さない**（`classifyDbError` で code→kind 変換） |
| throw の仕方 | 明示 throw はしない。**間接 throw の可能性**：`createServerSupabaseClient()` は未設定時に throw（`requireStudentContext` が `isSupabaseConfigured()` で事前ガード済み）。`cookies()`/`getClaims()` の予期せぬ例外は未捕捉 |
| redirect | **なし**（Server Action では使わない。認可失敗は `unauthorized` を返す） |

参照：`app/v2/actions/form2.ts`（`requireStudentContext` L40-50、`classifyDbError` 利用 L62-63,97-109,122-133）、`app/v2/actions/informationCards.ts`（`requireStudentCase` L47-59、各 Action）。

### 1.2 Repository / Supabase アクセス層（`lib/v2/`）
| 項目 | 現状 |
|---|---|
| `form2Repository.ts` / `informationCardsRepository.ts` | 全関数が `{ row/rows, error }` を返す。**try/catch なし・throw なし**（設計として「投げずに返す」を明記） |
| `serverClient.ts` | 未設定キー時のみ `throw new Error(...)`（それ以外は throw しない）。`setAll` の Cookie 書込失敗は握りつぶし（Server Component 用・意図的） |
| `currentUser.ts` | `getAuthUserId`/`getCurrentProfile` は **失敗時すべて `null` を返す**（`getClaims` の error も null 化）。`requireUser`/`requireRole` は `redirect()`（Server Component 用） |
| `types.ts` | `classifyDbError(PgLikeError)`＝Postgres code→`ActionErrorKind` の共通分類器（`23505→duplicate`, `42501→unauthorized`, `23514/23502/22P02→validation`, その他→`db_error`）。**共通エラー処理の中核候補** |

参照：`lib/v2/notebook/form2Repository.ts` L5「ここでは投げず {row,error} を返す」、`lib/v2/notebook/types.ts` L104-120（`classifyDbError`）、`lib/v2/auth/currentUser.ts` L38-68。

### 1.3 hooks（`hooks/v2/`）
| 項目 | 現状 |
|---|---|
| `useForm2Supabase.ts` | `doSave` が `await saveForm2Action(...)` を **try/catch なし**で呼ぶ。`ok` 分岐・`conflict`・`error`（下書き退避＋自動再試行8s）は実装済み。**reject 時**：`inFlightRef.current = false`（L145）に到達せず、`inFlightRef` が true・status が `saving` のまま固定 |
| `useEvidenceSupabase.ts` | `collectUtterance`/`collectMemo`/`updateContent`/`release` が Server Action を **try/catch なし**で呼ぶ。`ok`/`conflict`/`duplicate`/`error` 分岐は実装済み。**reject 時**：`setStatus("working")` 後に中断し、status が `working` のまま固定 |
| toast | **不使用**（プロジェクト全体で toast ライブラリなし） |
| console.error | **不使用**（V2 client/hooks に console 出力なし） |
| エラー表示 | `status`＋`message`（文字列）を state で保持し、コンポーネントが表示 |

参照：`hooks/v2/useForm2Supabase.ts`（`doSave` L128-178・`inFlightRef` 解除 L145）、`hooks/v2/useEvidenceSupabase.ts`（`collectMemo` L?・`collectUtterance`・各 mutation）。

### 1.4 components（`components/v2/`）
| 対象 | 現状 |
|---|---|
| Form2 保存（`Form2SupabaseWorkspace.tsx` / `WorkspaceForm2Section.tsx`） | `saveStatus` から `saveLabel`/`saveTone` を算出し表示。`error`/`dirty` 時に「再試行」「今すぐ保存」ボタン、`conflict` バナー（最新を読み込む）、下書き復元バナー。**同等ロジックが2コンポーネントに重複** |
| Evidence 保存（`EvidencePane.tsx`） | `status`＝`error`/`conflict` のとき `message` を `aria-live` で表示。**明示的な「再試行」ボタンは無し**（メッセージ表示のみ） |
| Workspace 取得（`app/v2/student/workspace/page.tsx` / `app/v2/student/form2/page.tsx`） | Server Component が `getForm2`/`listActiveCards` を呼ぶが `error` を**破棄**（`row`/`rows` のみ使用）。取得失敗時は**初期データ空で静かに描画**（ユーザーへ通知なし） |
| Timeline 取得（`WorkspaceTimeline.tsx`） | V1 の同期データ（`getChartData`）を利用。**非同期・例外面なし**（DB 非経由） |
| 認証系（`LoginForm.tsx` / `LogoutButton.tsx`） | **fetch を try/catch で保護**（`LoginForm` は catch で一般エラー表示）。**望ましいクライアント側の参照実装** |

参照：`components/v2/form2/Form2SupabaseWorkspace.tsx`・`components/v2/workspace/WorkspaceForm2Section.tsx`（`saveLabel`/`saveTone`）、`components/v2/workspace/EvidencePane.tsx` L72-84、`app/v2/login/LoginForm.tsx` L18-29。

### 1.5 Route Handler（`app/v2/api/auth/`）
- `login/route.ts`：body 解析・login_id 変換は try/catch。ただし `createServerSupabaseClient()`・`signInWithPassword`・profile 取得は try/catch外（未設定は事前ガードあり／ネットワーク例外時は 500 応答）。失敗理由は一般化（`GENERIC_ERROR`）。
- `logout/route.ts`：`signOut` 実行（例外時は 500）。

---

## 2. 重複箇所

1. **保存状態→ラベル/トーン変換の重複**：`Form2SupabaseWorkspace.tsx` と `WorkspaceForm2Section.tsx` に `saveLabel`/`saveTone`/`formatTime` 相当がほぼ同一で存在。
2. **状態機械の語彙不一致**：Form2＝`idle/dirty/saving/saved/error/conflict`、Evidence＝`idle/working/error/conflict`。同種概念が別語彙。
3. **Action 呼び出し後の分岐の重複**：各 hook が `res.ok`／`res.kind`（conflict/duplicate/…）分岐を個別に実装。共通化余地。
4. **ユーザー向けメッセージの分散**：`"収集に失敗しました…"`, `"修正の保存に失敗しました。"`, `"保存に失敗しました"` 等が各所に散在。中央カタログなし。
5. **未 try/catch の同型欠陥**：Form2・Evidence の両 hook が同じ「未保護 await → 固定化」問題を別実装で抱える（TD-002）。

---

## 3. 改善方針

1. **クライアント呼び出しの必ずの保護**：hooks の全 Server Action 呼び出しを try/catch で包み、reject を**正規化された失敗結果**へ落とす。
   - `finally` で進行フラグ（`inFlightRef`／`working`）を必ず解除する。
   - status を `error` に更新（`saving`/`working` に留めない）。
   - 入力は保持（成功時のみクリア／Form2 は既存の下書き退避を維持）。
   - **再試行可能**にする（Evidence は手動再試行で十分＝正式方針）。
2. **共通ヘルパ導入**：`callAction(fn): Promise<Result>` を新設し、`try { return await fn() } catch { return {ok:false, kind:"unexpected", message} }` に正規化（Server Action は元々 Result を返すので、reject のみ吸収）。全 hook がこれ経由で呼ぶ。
3. **エラー種別の追加検討**：クライアント reject（通信断）を表す `kind:"network"`（または `"unexpected"`）を `ActionErrorKind` へ追加し、`unauthorized` と区別する。あわせて `getCurrentProfile` が**一時障害を `null`＝`unauthorized` に丸めている**点を見直す（任意・影響範囲を確認のうえ）。
4. **メッセージ・状態語彙の統一**：ユーザー向け文言を中央カタログ化し、保存状態の語彙を Form2/Evidence で揃える（`working`↔`saving` の統一など。UI 文言は現行を尊重）。
5. **Server Action 設定処理の防御**（任意・多層防御）：`createServerSupabaseClient()`/`getClaims()` を try/catch で包み、throw ではなく `{ok:false, kind}` を返す。
6. **Server Component 取得失敗の可視化（任意）**：`workspace/page.tsx`・`form2/page.tsx` が握りつぶす `error` を、最小限のフォールバック表示 or ソフト通知にする（現状の「静かに空表示」を許容とするかを決める）。

**非対象（正式方針）**：Form2 専用の下書き保存・自動再試行を Evidence へ移植しない（Evidence は短文＝手動再試行で十分）。会話全文の永続化は行わない。

---

## 4. 推奨アーキテクチャ

層責務を維持しつつ、クライアント境界の保護と正規化を追加する。

```
[Repository]  {row/rows, error} を返す・throw しない（現状維持）
     ↓
[Server Action]  Result 判別共用体・classifyDbError で分類・生エラー非返却
                 （任意）設定処理を try/catch し reject を Result 化（多層防御）
     ↓  ← ここが未保護（クライアント fetch が reject し得る）
[callAction()]   新設・クライアント側の薄いラッパ
                 try/catch で reject を {ok:false, kind:"network|unexpected"} へ正規化
                 hooks は必ず callAction 経由で Action を呼ぶ
     ↓
[hooks]  状態機械（共通語彙）＋ finally で進行フラグ解除＋ error/retry＋入力保持
     ↓
[components]  status→ラベル/トーン（共通ヘルパ）＋再試行ボタン＋conflict/draft バナー
```

要点：
- **単一の失敗正規化点**（`callAction`）を設け、hooks は「絶対に reject で固定化しない」ことを保証。
- `classifyDbError` を DB エラー分類の唯一の情報源として維持。クライアント reject は `network/unexpected` として別扱い。
- Form2 の高機能（下書き退避・自動再試行・conflict 同梱）は温存し、**共通化するのは「Action 呼び出し＋失敗正規化＋状態語彙」の核**のみ。

---

## 5. Sprint2 で修正対象となるファイル一覧

**必須（TD-002 の解消）**
- `hooks/v2/useEvidenceSupabase.ts` — 全 mutation を try/catch（callAction 経由）へ。`working` 固定解消・`error`＋手動再試行。
- `hooks/v2/useForm2Supabase.ts` — `doSave` の await を try/catch（`finally` で `inFlightRef` 解除）。`saving` 固定解消。
- `components/v2/workspace/EvidencePane.tsx` — `error` 時の**再試行ボタン**追加（現状はメッセージのみ）。

**共通化のための新規/更新**
- （新規）`lib/v2/notebook/actionClient.ts`（または `lib/v2/actionClient.ts`）— `callAction()` と共通の状態語彙・ラベルヘルパ。
- `lib/v2/notebook/types.ts` — `ActionErrorKind` に `network`/`unexpected` を追加（採用時）。共通 Result 型・ヘルパ型の集約。
- `components/v2/form2/Form2SupabaseWorkspace.tsx` / `components/v2/workspace/WorkspaceForm2Section.tsx` — 保存ラベル/トーン算出を共通ヘルパへ寄せ、重複を解消。

**任意（多層防御・品質向上）**
- `app/v2/actions/form2.ts` / `app/v2/actions/informationCards.ts` — 設定処理（`createServerSupabaseClient`/`getCurrentProfile`）を try/catch し reject を Result 化。`network`/`unexpected` 導入時の分岐追加。
- `lib/v2/auth/currentUser.ts` — 一時障害と `unauthorized` の区別（`getCurrentProfile` の null 丸め見直し）。
- `app/v2/student/workspace/page.tsx` / `app/v2/student/form2/page.tsx` — 初期ロード失敗の可視化（握りつぶし解消）。
- `app/v2/api/auth/login/route.ts` — `signInWithPassword`/profile 取得を try/catch（ネットワーク例外時の 500 を一般エラー JSON 化）。

**対象外**
- `components/v2/workspace/WorkspaceTimeline.tsx`（同期・例外面なし）。
- V1 コード全般（Architecture Freeze・変更しない）。

---

## 関連ドキュメント

- `docs/version2/06_sprint2_technical_debt.md` — TD-002（未ハンドル例外）
- `docs/version2/07_evidence_source_reference.md` — TD-001（sourceReference）
- `docs/version2/08_sprint1_review.md` — Sprint1 構成・データフロー
- `docs/09_Design_Log.md` — DL-013
