# 08. Sprint1 レビュー資料 — Patient Workspace（Compass Version2 β）

Version 1.0
Last Update: 2026-07-17
Status: Sprint1 完了・Architecture Freeze 中（第二回講義で利用）

> 本書は Sprint1（Patient Workspace 統合）の構成・データフロー・保守観点を、
> 今後の保守者が理解できるレベルでまとめた資料である。
> Sprint1 は第二回講義で利用するため凍結（Architecture Freeze）中であり、Sprint2 実装は未着手。
> 関連: `06_sprint2_technical_debt.md`、`07_evidence_source_reference.md`、`09_Design_Log.md`(DL-013)。

---

## 1. アーキテクチャ概要

- **ルーティング**：V2 は `/v2` 配下（V1 の `/` は不変）。学生ワークスペースは `/v2/student/workspace`。
- **認可**：`proxy.ts`（`/v2/:path*`）でセッション更新＋未認証リダイレクト。ページ側は `requireRole("student")` で学生に限定。ロールは `profiles` テーブルで判定（`getClaims()` ベース）。
- **保存基盤**：Supabase（PostgreSQL + RLS）が正。V1 の localStorage には依存しない。
- **描画モデル**：
  - **Server Component**（`app/v2/student/workspace/page.tsx`）が初期データを **Repository 直接呼び出し**で取得。
  - **Client Component**（`PatientWorkspace` 以下）が編集・保存を担当。**保存のみ Server Action** を使う。
- **One Workspace 原則**：学生の思考が 1 画面（縦フロー）で完結。画面遷移を増やさない。

縦フロー構成：

```
Header（受け持ち対象の基本表示）
  ↓
Timeline（Clinical Timeline：診療録＋看護記録・読取専用）
  ↓
患者さんと話す（会話：Evidence 収集経路） ＋ Compass Coach（問いのみ）
  ↓
Evidence（会話／一時メモから収集した事実・Supabase 永続）
  ↓
精神様式2（Form2：Supabase 保存・自動保存）
```

Sprint1 スコープ：Timeline / Evidence / Compass Coach / Form2。
**Sprint2 送り**：Question / Reflection / Story Workspace / Patient Story。

---

## 2. Patient Workspace 構成

エントリは `app/v2/student/workspace/page.tsx`（Server）。

- `requireRole("student")` で認可 → `PATIENTS["A"]`（教育ケース SP-001）を固定対象に。
- `createServerSupabaseClient()` で `getForm2` / `listActiveCards` を実行（RLS で自分の行のみ）。
- 取得行を `rowToForm2Snapshot` / `rowToInformationCard` で DTO へ変換し、`PatientWorkspace`（Client）へ props 供給。

`PatientWorkspace`（Client）が UI を合成：

- `facingState`：会話状態（`FacingConvoState`）を **`useState` でメモリ保持**（永続しない・正式方針）。
- `evidence`：`useEvidenceSupabase({ patientId, initial })`。
- 各セクションを `Section`（ローカルの見出し付きカード）で囲む。Header/Timeline/会話/Evidence には `no-print` を付与し、印刷は Form2 のみが対象になる。

---

## 3. 再利用コンポーネント / ロジック一覧（V1・改変しない）

| 対象 | パス | 用途 |
|---|---|---|
| FacingPatient | `components/patient/facing/FacingPatient.tsx` | 患者との対話（Evidence 収集経路の一つ） |
| 会話エンジン | `lib/patientFacingData.ts` | `advanceConversation`・`getCoachFocus`・`shouldShowCoachHint`・`requestCoachConsultation`・`requestHint`（ルールベース。外部AIなし） |
| Form2EditForm / Form2SheetView | `components/form2/` | 精神様式2 の編集フォーム・様式表示（印刷レイアウト） |
| CollectionDialog | `components/collection/CollectionDialog.tsx` | Evidence の追加・本文修正ダイアログ |
| Clinical Timeline | `lib/chartTimeline.ts`（`buildClinicalTimeline`・`RECORD_TYPE_LABEL`）＋ `lib/chartData.ts`（`getChartData`） | 診療録＋看護記録の表示時変換（読取専用） |
| InformationCard モデル | `lib/information/informationCard.ts` | Evidence の型・出所種別・検証 |
| 患者マスタ | `lib/wardData.ts`（`PATIENTS`） | 受け持ち対象の基本情報 |

> 方針：V1 の実体は変更・複製しない。Coach は V1 の `FacingCoachPanel` を改変せず、**ロジックのみ再利用**する `WorkspaceCoachPanel` を新設した（チャート遷移リンクを持たないため）。

---

## 4. 新規コンポーネント / モジュール一覧（V2）

Sprint1 で追加・確定したもの：

| 対象 | パス | 役割 |
|---|---|---|
| Workspace ページ | `app/v2/student/workspace/page.tsx` | Server Component。認可＋初期ロード（Repository 直接） |
| PatientWorkspace | `components/v2/workspace/PatientWorkspace.tsx` | 画面合成（One Workspace 縦フロー） |
| WorkspaceTimeline | `components/v2/workspace/WorkspaceTimeline.tsx` | Clinical Timeline 表示（新しい順・読取専用） |
| EvidencePane | `components/v2/workspace/EvidencePane.tsx` | 会話／一時メモからの Evidence 収集・一覧・修正・収集解除 |
| WorkspaceCoachPanel | `components/v2/workspace/WorkspaceCoachPanel.tsx` | Compass Coach（問い・方向づけ・気づきのみ。チャートリンクなし） |
| WorkspaceForm2Section | `components/v2/workspace/WorkspaceForm2Section.tsx` | Workspace 内 Form2 セクション（編集/様式表示/印刷） |
| useEvidenceSupabase | `hooks/v2/useEvidenceSupabase.ts` | Evidence CRUD＋楽観ロック（`updated_at`） |

Phase 3-3 で先行導入し Sprint1 が依存するもの：

| 対象 | パス | 役割 |
|---|---|---|
| Form2SupabaseWorkspace | `components/v2/form2/Form2SupabaseWorkspace.tsx` | 全画面版 Form2（`/v2/student/form2`） |
| useForm2Supabase | `hooks/v2/useForm2Supabase.ts` | Form2 自動保存＋楽観ロック（`version`）＋下書き退避 |
| Form2 ページ | `app/v2/student/form2/page.tsx` | 全画面版 Form2 の Server Component |

データ層（Phase 3-1 / 3-2・Sprint1 が利用）：

- Server Actions：`app/v2/actions/form2.ts`、`app/v2/actions/informationCards.ts`（学生専用・サーバ側で識別情報決定）。
- Repository / Mapper / 型：`lib/v2/notebook/`（`form2Repository`・`informationCardsRepository`・`form2Mapper`・`informationCardMapper`・`types`・`caseId`）。
- マイグレーション：`supabase/migrations/0005`〜`0008`（`form2_records`・`information_cards`・RLS・整合性）。

---

## 5. データフロー

### 5.1 初期ロード（読み取り）
```
Server Component (workspace/page.tsx)
  → requireRole("student")               // 認可
  → createServerSupabaseClient()          // Cookie セッション
  → getForm2 / listActiveCards            // Repository（RLS で自分の行のみ）
  → rowToForm2Snapshot / rowToInformationCard  // DTO 変換
  → props → PatientWorkspace (Client)
```

### 5.2 Form2 保存（書き込み）
```
編集 → useForm2Supabase（debounce 1000ms / 手動 flush）
  → saveForm2Action(payload, expectedVersion)   // Server Action・学生専用
  → updateForm2WithVersion（version 楽観ロック）
  → ok: version 更新・下書きクリア / conflict: 最新同梱 / error: 下書き退避＋自動再試行
状態: idle → dirty → saving → {saved | error | conflict}
```

### 5.3 Evidence 収集・編集・解除（書き込み）
```
会話発言 or 一時メモ → useEvidenceSupabase
  collectUtterance / collectMemo → createCardAction         // created_by は常に student（サーバ決定）
  updateContent（expectedUpdatedAt）→ updateCardAction       // updated_at 楽観ロック
  release（expectedUpdatedAt）→ releaseCardAction            // 論理削除（deleted_at）
状態: idle → working → {idle | error | conflict}
```

### 5.4 会話・Coach（非永続）
```
入力 → advanceConversation(state)（ルールベース）→ FacingConvoState（メモリのみ）
Coach: getCoachFocus / shouldShowCoachHint → 問い・方向づけのみ（生成・保存なし）
```
会話は永続化しない。学生が残したい事実は Evidence として収集し、Evidence のみ Supabase に保存される。

---

## 6. Supabase との関係

| テーブル | 単位 | 競合制御 | 削除 | RLS |
|---|---|---|---|---|
| `form2_records` | (user, org, year, case) で1件 | `version`（楽観ロック） | なし | 学生=自分の行 R/W、教員/管理者=同一組織 SELECT のみ |
| `information_cards` | 1 Evidence=1行 | `updated_at`（楽観ロック） | 論理削除（`deleted_at`） | 同上 |

- **識別情報はサーバが決定**：`user_id`/`organization_id`/`academic_year`/`case_id`/`created_by`（常に `student`）はクライアント値を信用しない。
- **不変カラム**：identity・事実性カラム（`source_type`/`source_reference`/`original_text`/`observed_at` 等）は DB トリガーで UPDATE 不可。
- **一意制約**：`uq_information_cards_source`（会話由来の二重収集防止。※ TD-001 の見直し対象）。
- **教員閲覧**：同一組織の学生データを閲覧のみ（Phase 3-5、Sprint1 では未実装）。

---

## 7. Sprint2 で拡張する箇所

優先順位（`06_sprint2_technical_debt.md`・DL-013 と一致）：

1. **① 例外処理共通化（TD-002）**：`useEvidenceSupabase` / `useForm2Supabase` の Server Action 呼び出しを try/catch で保護し、`working`/`saving` 固定を解消。共通方針（inFlight 解除・status 更新・エラー表示・リトライ）。
2. **② Evidence sourceReference 見直し（TD-001）**：`07_evidence_source_reference.md` の比較に基づき、位置非依存の識別子（推奨：原文 content hash）へ。会話全文保存は不採用。
3. **③ Question**、**④ Reflection**、**⑤ Story Workspace**、**⑥ Patient Story**：ドメイン拡張。基盤品質（①②）を優先。
4. **Coach の文脈拡張**：Question/Reflection/Evidence を**読む**ことは可。ただし生成・書き込みは禁止（問い・方向づけ・気づきのみ）。

### リファクタ候補（Sprint2 で検討・今回は変更しない）
- **Form2 セクションの重複**：`WorkspaceForm2Section`（Workspace 埋め込み）と `Form2SupabaseWorkspace`（全画面）は、保存状態ラベル・競合/下書きバナー・編集/様式表示トグルがほぼ同一。共通の表示コアを抽出できる余地がある。
- **保存状態ラベル/時刻整形**：両者の `saveLabel`/`formatTime` 相当ロジックが重複。共通ヘルパ化の候補。
- **workspace/page.tsx の not-found ガード**：データ取得ブロックの後に `if (!patient) return` がある。早期 return へ整理すると可読性が上がる（機能影響なし）。

---

## 8. コード品質メモ（Sprint1 レビュー結果）

今ターンはコード変更を行わず、指摘のみ記録する（改善は Sprint2 の品質フェーズ or ①②着手時に併せて検討）。

- **重複コード**：上記「リファクタ候補」の2点（Form2 セクション重複・保存ラベル/時刻整形）。深刻度は低。
- **命名**：`Workspace*` 接頭辞で一貫。`byNewestFirst`・`collectUtterance`/`collectMemo` など明瞭。問題なし。
- **コメント**：各ファイル冒頭に方針コメントあり。誤り・陳腐化コメントは検出なし。
- **TODO/FIXME**：なし。
- **不要 import / 不要 state**：なし（ESLint クリーン。Sprint1 完了時に `timelineRef`/`useRef`/`FacingCoachPanel` の未使用を除去済み）。
- **console/debugger**：なし。
- **既知の技術的負債**：TD-001（sourceReference 衝突）・TD-002（例外未処理）。詳細は `06_sprint2_technical_debt.md`。

静的検証（今ターン・コード無変更で確認）：TypeScript OK、ESLint（v2 workspace/form2/hooks）エラー0・警告0。

---

## 関連ドキュメント

- `docs/version2/01_architecture.md` — V2 アーキテクチャ
- `docs/version2/02_database.md` — DB スキーマ・RLS・整合性
- `docs/version2/05_information_notebook.md` — Information Notebook（Evidence）設計
- `docs/version2/06_sprint2_technical_debt.md` — Sprint2 技術的負債
- `docs/version2/07_evidence_source_reference.md` — Evidence sourceReference 改善設計
- `docs/09_Design_Log.md` — 中央設計ログ（DL-013）
