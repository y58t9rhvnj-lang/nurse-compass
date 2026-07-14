# 06 Component Library（コンポーネントライブラリ）

## 1. 方針

## 2. 基本コンポーネント（Primitives）

### 2.1 Button

### 2.2 Card / Panel

### 2.3 Badge / Chip

### 2.4 Icon

## 3. レイアウトコンポーネント

### 3.1 SideNav

### 3.2 StatusBar

### 3.3 RightPanel

## 4. 病棟ホーム関連コンポーネント

### 4.1 WardMap

### 4.2 WardHomeTopBar

### 4.3 OutsideWardArea

### 4.4 WardRightPanel

## 5. 患者・データ表示コンポーネント

患者トップ（Sprint6）で使用。患者を「ひとりの人」として理解するための物語中心の構成。

### 5.1 AppShell

- 役割：アプリ全体のシェル。`activeView: "ward" | "patient"` と `selectedId` を上位管理し、中央メイン・右ペインを切り替える（クライアントのビュー状態方式）。
- 配下：StatusBar / SideNav / 中央メイン（WardHome または PatientTop）/ 右ペイン（WardRightPanel または PatientAside）。

### 5.2 PatientTop

- 役割：患者トップの中央画面。「病棟ホームへ戻る」導線＋`PatientHero`＋2ゾーンで構成。
- ゾーン設計：意味のまとまりを見出し＋キャプション＋アクセントバーで表現。
  - ゾーン1「その人を知る」：`StoryCard` / `ValuesCard` / `PersonCard`
  - ゾーン2「回復に向けて」：`StrengthsCard` / `WorriesCard` / `DischargeHopeCard`

### 5.3 PatientHero

- 役割：主役ヘッダー。名前を最大サイズ、現在地チップ、受け持ち★を表示。診断名は小さな補助表示に留める。

### 5.4 プロフィールカード群

すべて共通ラッパ `ProfileCard`（白・角丸16px・控えめな影・Line Icon）と `EmptyNote`（未入力表示）を使用。データ未設定時は自動的に「未入力」を表示する。

- `StoryCard`：これまでの歩み（生活歴・入院までの経緯）
- `ValuesCard`：大切にしていること（価値観をチップ表示）
- `PersonCard`：人物像（性格・家族/キーパーソン・趣味・入院前の生活リズムをまとめる）
- `StrengthsCard`：強み・できていること（ストレングス視点）
- `WorriesCard`：本人の困りごと（主観の声）
- `DischargeHopeCard`：退院への思い
- `PatientInfoCard`：基本情報（診断名・入院日・主治医など事務情報。補助的な位置づけ）

### 5.5 PatientAside（患者トップ右ペイン）

- 役割：看護に接続する視点の右ペイン。
- 構成：Compass Coach の問い（患者別 `coachQuestions`、未入力時は汎用フォールバック）→ 情報BOX／電子カルテ導線 → 補助の基本情報カード（最下部）。

### 5.6 データモデル（`lib/wardData.ts`）

- `PatientProfile`（任意フィールド）：`lifeHistory` / `story` / `values` / `worries` / `dischargeHope` / `hobbies` / `personality` / `family` / `dailyRhythm` / `strengths` / `coachQuestions`。
- 記述範囲：受け持ち3名（A・E・F）を詳細記述で先行。他患者は未設定とし、各カードが「未入力」フォールバックを表示する。
- 方針：医学的正確さより「人となりが伝わるか」を優先。

### 5.7 気づきメモ（Sprint7）

患者トップ中央の第3ゾーン「気づきメモ」。学生が患者理解のための気づきを自由記述で残す。Priority A では自由記述のみ（カテゴリ分類は将来）。

- `NoteZone`：第3ゾーンのコンテナ。`useNotes(patientId)` を使用し、見出し（気づきメモ）＋件数バッジ＋`NoteComposer`＋`NoteList` を構成。`hydrated` までは「読み込み中」表示。
- `NoteComposer`：新規メモ入力（テキストエリア＋「メモを追加」、⌘/Ctrl+Enter で保存）。
- `NoteList` / `NoteItem`：一覧（更新日時の降順）と1件表示。インライン編集・削除、日時と「編集済み」表示。空状態あり。
- スタイル：Design System 準拠（白カード・角丸16px・Very Soft Shadow・Line Icon）。

**データ・永続化・状態管理**

- 型：`lib/notes.ts` の `Note`（`id` / `patientId` / `text` / `createdAt` / `updatedAt`）。
- 永続化：`lib/notesStore.ts` に抽象化。`getNotes` / `addNote` / `updateNote` / `deleteNote` ＋購読 API（`subscribe` / `getSnapshot` / `getServerSnapshot`）。`localStorage` 実装、キーは患者別 `nc:notes:{patientId}`。`typeof window` ガード・破損データ検証・別タブ `storage` イベント追従。将来はこの層のみ差し替えでバックエンド化可能。
- フック：`hooks/useNotes.ts`。`useSyncExternalStore` で外部ストアを購読（`getServerSnapshot` は空配列の安定参照）。`useEffect` での setState を避けることでハイドレーション不整合・フラッシュ・lint ルール `react-hooks/set-state-in-effect` を回避しつつ即時反映。
- 動作：追加・編集・削除・リロード後保持（localStorage）。CRUD／永続化はユニット検証済み。
- 未実装（B・C）：カテゴリ分類、Compass 問いからのメモ導線、フィルタ／ピン留め、バックエンド永続化。

## 6. 状態・フィードバックコンポーネント

## 7. 命名・配置ルール
