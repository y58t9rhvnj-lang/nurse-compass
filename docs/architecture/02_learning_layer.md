# Compass Learning Layer Architecture

> 本書は Compass 恒久アーキテクチャの第2層 **Learning Layer** を定義する。
> Learning Layer は Core（`01_compass_core.md`）を**置き換えず**、その上に重畳される学習支援能力の集合である。
> Core への重畳の契約は `03_core_learning_integration.md` を参照。

---

## 1. Purpose

Compass Learning Layer は、次のための**追加能力**である。

- **学習者の思考を支援する** — 患者理解へ向かう思考の過程に寄り添う。
- **正解を提示するのではなく、考える過程を支える** — 診断名・結論・様式2 の転記文を与えない。学習者自身が観察・比較・根拠確認に気づくことを促す。
- **Core の臨床体験を邪魔しない** — Core の画面・状態・文脈を壊さず、静かに補助する。
- **必要なときだけ開く** — 常時前面に出ず、学習者が求めたときにだけ現れる（Inspector 等）。
- **学習者ごとの記録を保持する** — 学習者本人の入力（様式2・Evidence 等）を、本人だけのものとして安全に永続化する。

---

## 2. Learning Layer Definition

**Learning Layer は「画面」や「別アプリ」ではなく、Core 上で有効化される学習能力の集合である。**

- 学生ログイン後も、利用者が見るのは **Core の UI そのもの**である（病棟・患者・電子カルテ・会話・気づきメモ）。
- Learning Layer は、その Core に対して「学習者識別」「様式2の学習者保存」「Inspector（問い等）の重畳」「Evidence 整理」などの**能力を足す**。
- したがって Learning Layer は「別ナビゲーション」「別シェル」「学生専用画面」ではない。Core を丸ごと差し替える設計（旧 `mode="v2"` の早期 return）は**恒久アーキテクチャでは採らない**。

---

## 3. Capabilities（能力群と実装状況）

| Capability | 説明 | 状況 |
|---|---|---|
| **Learner Identity** | 学習者識別（ログイン・学籍番号・ロール） | ✅ 実装済み |
| **Learning Navigation** | Core ナビへ学習導線（様式2 等）を**追加** | 🟡 一部（様式2導線は実装、恒久統合は移行中） |
| **Form2** | 様式2「受け持ち対象記録」を学習者が入力・保存・再編集（Supabase 版） | ✅ 実装済み |
| **Inspector** | Core 上に開く学習支援レイヤー（器） | ✅ 実装済み |
| **Question** | 静的・決定論の「問い」を Inspector 内に提示 | ✅ 実装済み（静的） |
| **Evidence** | 事実（根拠）の収集・整理 | 🟡 実装あり・Core への恒久統合は未（移行中） |
| **Reflection** | 振り返り支援 | ⛔ 未実装（計画） |
| **Story** | 患者理解の文章化（Patient Story） | ⛔ 未実装（計画） |
| **Learning Persistence** | 学習者別の永続化（Supabase + RLS） | ✅ 実装済み（様式2・Evidence 用テーブル） |
| **Teacher Support** | 教員向け支援（一覧・指導ガイド等） | ⛔ 未実装（`app/v2/teacher` はプレースホルダ） |
| **AI Learning Support** | AI による学習支援 | ⛔ 未実装（計画。MVP では非採用） |

> 凡例: ✅ 実装済み / 🟡 実装済みだが Core への恒久統合が移行中 / ⛔ 未実装（計画中）

---

## 4. Responsibilities

Learning Layer が責任を持つこと:

- **学習者識別**（誰の学習かを確定する）。
- **学習機能の有効化**（どの能力を使えるかを決める）。
- **学習データの保存**（学習者別に、本人のみが読み書きできる形で永続化）。
- **問いの提示**（Question。答えではなく手がかり）。
- **Evidence の整理**（事実の収集・整理。解釈の押し付けはしない）。
- **様式2への学習者自身による整理**（自動転記はせず、学習者が自分の言葉でまとめる）。
- **振り返り支援**（Reflection。将来）。
- **学習状態の保持**（Inspector 開閉・Question 選択/状態などを、Core 状態と分離して保持）。

---

## 5. Non-Responsibilities

Learning Layer は以下を**所有しない**（＝これらは Core の関心事）:

- 病棟レイアウト
- 患者データそのもの
- 電子カルテ UI
- 患者会話 UI
- Core Navigation そのもの
- Core の臨床状態（選択中患者・カルテ閲覧状態・会話状態の一次管理）

Learning Layer はこれらを**読む／その上に重ねる**ことはできるが、**所有・置換**はしない。

---

## 6. Capability Model

将来的な設定モデル（概念設計）。Core は次の設定を外から受け取り、有効時のみ能力を重畳する。

```ts
interface LearningLayerConfig {
  enabled: boolean;
  role: "student" | "teacher";
  userId: string;
  identity?: {
    name: string;
    subtitle?: string;
  };
  capabilities: {
    form2: boolean;
    inspector: boolean;
    question: boolean;
    evidence: boolean;
    reflection: boolean;
    story: boolean;
  };
  persistence?: {
    provider: "supabase";
  };
}
```

### 補足（設計上の含意）

- `enabled: false` または `LearningLayerConfig` 未指定のとき、Core は**素の臨床世界**として動作する（Learning Layer は一切描画・保存しない）。
- `capabilities` は**能力単位のフラグ**であり、UI 全体を学生専用化するためのものではない。各能力は独立にオン/オフできる（例: `inspector` だけ有効・`evidence` は無効）。
- `role` と `userId` は「保存先」と「利用可能機能」を決めるために使う。**Core の UI をロール別に置換するためには使わない**（Core Invariant §5）。
- `persistence.provider` は現状 `"supabase"` のみ。Core 自体は永続化基盤に依存しないため、この設定は Learning Layer 側でのみ意味を持つ。
- Reflection / Story / Teacher Support / AI は本モデル上に席を確保するが、現時点では未実装（`false` 相当）。

### Current Implementation Mapping（Learning Layer 側）

| Capability | 主な実装ファイル |
|---|---|
| Learner Identity | `lib/v2/auth/currentUser.ts`（`AppProfile` / `requireRole`）, `lib/v2/auth/loginId.ts`, `app/v2/login/*`, `app/v2/api/auth/*` |
| Learning Persistence（基盤） | `lib/v2/supabase/*`（`serverClient` / `browserClient` / `adminClient` / `proxy` / `status`）, `lib/v2/env*.ts`, `lib/v2/callAction.ts` |
| Form2 | `components/v2/workspace/WorkspaceForm2Section.tsx`, `components/v2/form2/Form2SupabaseWorkspace.tsx`, `hooks/v2/useForm2Supabase.ts`, `app/v2/actions/form2.ts`, `lib/v2/notebook/form2Repository.ts`, `form2Mapper.ts`, `form2Draft.ts`, `caseId.ts` |
| Inspector | `components/v2/workspace/inspector/WorkspaceInspector.tsx`, `WorkspaceInspectorToggle.tsx`, `hooks/v2/useWorkspaceInspector.ts`, `inspector/inspectorTypes.ts` |
| Question | `components/v2/workspace/panels/QuestionPanel.tsx`, `hooks/v2/useQuestionPanel.ts`, `lib/v2/question/questionTypes.ts`, `questionFixtures.ts` |
| Evidence | `components/v2/workspace/EvidencePane.tsx`, `hooks/v2/useEvidenceSupabase.ts`, `app/v2/actions/informationCards.ts`, `lib/v2/notebook/informationCardsRepository.ts`, `informationCardMapper.ts`, `conversationSourceId.ts` |
| 学習者識別の表示（ログアウト等） | `components/v2/LogoutButton.tsx` |
| Teacher Support（プレースホルダ） | `app/v2/teacher/page.tsx` |

> 注: `components/v2/workspace/PatientWorkspace.tsx` および `app/v2/student/workspace/page.tsx`・`components/v2/student-shell/StudentPatientTop.tsx` は、移行段階で作られた「別シェル型」の実装であり、恒久アーキテクチャ（Core ＋ Learning Layer）への移行に伴い**整理対象**である（詳細は `03_core_learning_integration.md`）。

---

## 名称と移行方針（全文書共通）

- **Version1** … 現在の Core 実装を指す歴史的・実装上の名称。
- **Version2** … Learning Layer 導入を進めてきた開発段階の名称。
- 恒久的な製品アーキテクチャは **Core / Learning Layer / Integration** で表現する（Version1 / Version2 は恒久名称に用いない）。
- `/v2` ルートと `docs/version2` は移行中の技術資産として当面残す。
- 今回はルート名変更・ファイル移動・コード変更を行わない。

---

## Migration Notes

### 継続採用
- Inspector / Question / 様式2 Supabase / 学習者識別・保存基盤（`lib/v2/*`）。
- 「静けさ・信頼性・思考支援・AI を主役にしない」という学習支援の姿勢。
- Workspace Inspector の**状態非破壊性**（開閉で Core 状態を壊さない）。

### 名称・位置付けを変更
- 「Workspace Inspector」→ **Learning Layer Inspector**（Core の Workspace ではなく Learning Layer が Core view 上に開く器と位置づける）。
- Evidence/Question を「Workspace の縦フローの一部」→ **Learning Layer の能力**として再定義。

### 廃止予定
- 別シェル型 `PatientWorkspace` を主役とする構造（Core 上の重畳へ移す）。
- `StudentPatientTop` / V2 専用 4 項目ナビ（Core Navigation ＋ Learning Navigation セクションへ）。

### 実装移行が必要
- `LearningLayerConfig`（本書 §6）を AppShell の `learningLayer` prop として結線。
- 能力フラグ単位（form2/inspector/question/evidence…）での有効化。
- Inspector の overlay 化と Supabase 様式2 の患者文脈接続。

> 既存 `docs/version2/13_ui_architecture.md`（CWDS）は Inspector を「Workspace の支援」と定義するが、本アーキテクチャでは「Core view 上に開く Learning Layer の器」と位置づける。器としての責務（開閉・レイアウト・状態非破壊）は流用し、**帰属だけを Workspace → Learning Layer へ移す**。既存文書は変更しない。
