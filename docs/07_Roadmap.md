# 07 Roadmap（ロードマップ）

## 1. 全体方針

## 2. Sprint計画

### Sprint1 Design System作成

### Sprint2 病棟ホーム初期実装

### Sprint3 精神科病棟らしい病棟マップへ修正

### Sprint4 患者が主役の病棟ホームへ改善

### Sprint5 患者タップで右パネル切替

### Sprint6 患者トップ画面

**目的**：患者を「診断名」ではなく「ひとりの人」として理解できる画面を完成させる。

**遷移方式**：クライアントのビュー状態方式。`AppShell` が `activeView: "ward" | "patient"` と `selectedId` を上位管理し、中央メインと右ペインを切り替える（Priority A で構築）。SideNav の「病棟ホーム／患者トップ」で相互遷移、WardRightPanel の「患者トップへ」からも遷移する。

**中央 `PatientTop` の構成（2ゾーン設計）**：Priority A のフラットな並びを、意味のまとまりで2ゾーンに再設計。各ゾーンに見出し＋キャプション＋アクセントバーを付与する。

- 上部：`PatientHero`（名前・年齢・現在地。診断名は小さく補助表示）
- ゾーン1「その人を知る」：`StoryCard`（これまでの歩み）／`ValuesCard`（大切にしていること）／`PersonCard`（人物像）
- ゾーン2「回復に向けて」：`StrengthsCard`（強み・できていること）／`WorriesCard`（困りごと）／`DischargeHopeCard`（退院への思い）

**右ペイン `PatientAside`**：看護に接続する視点。
- Compass Coach の問い＝患者別（`coachQuestions`）。A・E・F は手書きの問いを3つずつ用意。未入力の患者は汎用フォールバックの問いを表示。
- 情報BOX／電子カルテ導線（未実装は notice 表示）。
- 基本情報カード（診断名・入院日など事務情報）は補助として最下部に維持。

**データ拡張**：`PatientProfile` に任意フィールドを追加（`hobbies` / `personality` / `family` / `dailyRhythm` / `strengths` / `coachQuestions`）。受け持ち3名（A・E・F）を「人となりが伝わる」レベルで詳細記述し、他患者は未設定＝各カードが「未入力」フォールバック表示となる。

**設計方針**：Priority A の構造（`PatientHero`・各カード・`AppShell`・ナビ遷移）は壊さず、追加コンポーネントとゾーン見出し・患者別の問いによって「意味の設計」を仕上げた。状態カラーは Design System の5状態（`LOC`）を流用し整合。

**新規／変更（実装反映済み）**
- 新規：`components/patient/PersonCard.tsx`、`components/patient/StrengthsCard.tsx`
- 変更：`components/patient/PatientTop.tsx`（2ゾーン化）、`components/patient/PatientAside.tsx`（患者別の問い）、`lib/wardData.ts`（`PatientProfile` 拡張・A/E/F 記述）
- Priority A で作成済み：`components/AppShell.tsx`、`components/patient/{PatientTop,PatientHero,StoryCard,ValuesCard,WorriesCard,DischargeHopeCard,PatientInfoCard,ProfileCard}.tsx`、`components/SideNav.tsx`（遷移対応）

### Sprint7 記録・気づきメモ

**目的**：患者トップ上で、学生が「その人を理解するための気づき」を残せるメモ機能を提供する（Thinking First / Learning by Doing）。

**Priority A の範囲（今回実装）**：自由記述メモのみ。カテゴリ分類（観察/疑問/仮説 等）や Compass 問いからの導線などは対象外（B・C）。

**配置**：中央 `PatientTop` の最下部に第3ゾーン「気づきメモ」を追加。既存のゾーン1（その人を知る）・ゾーン2（回復に向けて）・`PatientHero`・`PatientAside`・`AppShell` は不変。

**データモデル**：`lib/notes.ts` の `Note` 型（`id` / `patientId` / `text` / `createdAt` / `updatedAt`）。自由記述のみで、拡張フィールドは将来。

**保存方式**：`localStorage` 先行。ただし将来のバックエンド差し替えを見据え、永続化ロジックを `lib/notesStore.ts` に抽象化（`getNotes` / `addNote` / `updateNote` / `deleteNote` ＋購読 API `subscribe` / `getSnapshot` / `getServerSnapshot`）。キーは患者別 `nc:notes:{patientId}`。`typeof window` ガード、破損データのバリデーション、別タブの `storage` イベント追従を実装。UI/フックはこの層のインターフェースにのみ依存する。

**状態管理（`useSyncExternalStore` 採用理由）**：localStorage はサーバーで利用できず、`useEffect` での後追い更新はハイドレーション不整合やフラッシュ、および新 lint ルール `react-hooks/set-state-in-effect` に抵触する。そのため `hooks/useNotes.ts` は `useSyncExternalStore` で外部ストアを購読する方式を採用（`getServerSnapshot` は SSR 時に空配列の安定参照を返す）。これによりハイドレーション不整合を避けつつ、追加/編集/削除を即時反映できる。

**動作**：追加・編集（インライン）・削除に対応。並びは更新日時の降順。`localStorage` 永続化によりリロード後も保持。CRUD＋永続化ロジックは localStorage モックのユニット検証で確認済み。

**新規／変更**
- 新規：`lib/notes.ts`、`lib/notesStore.ts`、`hooks/useNotes.ts`、`components/patient/notes/{NoteZone,NoteComposer,NoteList,NoteItem}.tsx`
- 変更：`components/patient/PatientTop.tsx`（第3ゾーンの追加のみ）

**未実装（C）**：カテゴリ分類・`NoteCategoryPicker`、フィルタ／ピン留め、指導者共有、バックエンド API 永続化。

**Priority B（実装済み）: Compass 問いからメモへ誘導**

- Compass Coach の問いから中央の気づきメモへ自然につながる導線を実装。右ペイン `PatientAside` の各問いに「この問いをメモする」ボタンを追加。
- **問い文は本文に自動入力しない**。`NoteComposer` 上部に「この問いについて：〈問い〉」の**文脈バナー**として表示し、本文は空欄のまま textarea をフォーカスする。学生自身の言葉で気づきを書く設計（Thinking First）。
- 誘導時は気づきメモゾーンへスクロール（`scrollIntoView`）＋ textarea フォーカス（`focus({ preventScroll:true })`）。
- **文脈のクリア条件**：保存時／バナーのキャンセル（×）時／患者切替時／画面（ビュー）切替時。
- **状態管理**：`AppShell` に `pendingQuestion: { text; token } | null` を集中管理（Context 不使用）。`token` によりクリック毎に再フォーカス/スクロールを発火。受け渡しは `PatientAside → AppShell → PatientTop → NoteZone → NoteComposer` の props 経路。
- **未実装（今後）**：問いをメモに紐づける `sourceQuestion` の永続保存は未対応。次段階の Priority A もしくは C 候補とする（対応時は `Note` 型・`notesStore`・`NoteItem` 表示の拡張を伴う）。
- 変更ファイル：`components/AppShell.tsx`、`components/patient/PatientAside.tsx`、`components/patient/PatientTop.tsx`、`components/patient/notes/NoteZone.tsx`、`components/patient/notes/NoteComposer.tsx`。`lib/notes.ts` / `lib/notesStore.ts` / `hooks/useNotes.ts` は不変（メモ本文・保存方式は変更なし）。

> 備考：当初ロードマップでは Sprint7 を「電子カルテ画面」としていたが、実装順の見直しにより Sprint7 を「記録・気づきメモ」とした。電子カルテ画面は以降のスプリントで扱う。

### Sprint8 情報BOX

### Sprint9 Thinking Workspace

### Sprint10 様式2・様式3

### Sprint11 関連図

### Sprint12 Compass Coach高度化

## 3. 今後の拡張

## 4. 完了の定義（Definition of Done）

---

## iPad Safari対応

Next.js 16ではLAN経由(iPad実機)で開発サーバーへアクセスする場合、
next.config.ts の allowedDevOrigins にMacのLAN IPを追加する。

例

allowedDevOrigins: [
  "192.168.1.65"
]

設定変更後は

1. npm run dev を停止
2. rm -rf .next
3. npm run dev -- --hostname 0.0.0.0

で開発サーバーを再起動すること。

設定が無い場合、

・画面は表示される
・ボタンとして認識される
・Reactイベント(onClick)が動作しない

という現象が発生する。
