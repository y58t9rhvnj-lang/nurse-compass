# Compass Core-Learning Integration

> 本書は Core（`01_compass_core.md`）と Learning Layer（`02_learning_layer.md`）の**境界と接続方法**を定める。
> 実装（AppShell 等）は本書に従う。既存 `docs/version2/13_ui_architecture.md` とは矛盾があり、末尾 `## Migration Notes` で整理する。

---

## 1. Purpose

本書の目的は、**Core と Learning Layer の境界と接続方法を定め、両者が相互に侵食しないための規約**を与えることである。

- Core は臨床世界を提供し、単独で成立する（`01`）。
- Learning Layer は Core 上で有効化される学習能力の集合である（`02`）。
- 本書は「どこで・どう接続するか」「何をしてはいけないか」を規約として固定し、Core の不変条件（`01` §5）を守りながら学習能力を重畳できるようにする。

---

## 2. Integration Principles（Rule 1〜10）

以下を統合の規約として明文化する。

- **Rule 1: Core は Learning Layer なしで成立する。** `learningLayer` 未指定の Core（`/`）は学習基盤なしで完結する。
- **Rule 2: Learning Layer は Core を利用するが、置き換えない。** Learning Layer は Core の患者・カルテ・会話を参照・重畳するが、Core の実体を差し替えない。
- **Rule 3: Learning Layer は Core の画面構造を複製しない。** 病棟・患者トップ・カルテ・会話の UI を Learning 側で再実装（コピー）しない。
- **Rule 4: 学生ログイン後も Core の病棟・患者・カルテ・会話 UI を使用する。** 学習利用でも表示されるのは Core そのものである。
- **Rule 5: Learning Layer は overlay / Inspector / sheet / 追加メニュー等として接続する。** 接続手段は加算的な重畳に限る（許容形は §4）。
- **Rule 6: Learning Layer の開閉で Core の main view を再マウントしない。** Inspector 等の開閉は Core メイン領域を unmount させない（sibling / overlay 配置）。
- **Rule 7: Core のスクロール・入力途中・選択状態を保持する。** 学習能力の開閉・保存で、カルテ位置・会話入力・選択患者・様式2 入力を失わせない。
- **Rule 8: 学習データの保存責務は Learning Layer に置く。** 学習者別の永続化（Supabase + RLS）は Learning Layer の責務。Core の localStorage に学習データを混在させない。
- **Rule 9: Core のグローバル feature flag を Learning Layer 都合で変更しない。** `lib/featureFlags.ts` 等を学習機能の都合で書き換えない。
- **Rule 10: Core と Learning Layer の責務境界を越える大規模な条件分岐を AppShell に増やさない。** `mode` 全体分岐のような早期 return を作らず、接続点は限定・小さく保つ。

---

## 3. AppShell Role

- **AppShell は Core のシェルである。** 病棟・患者・カルテ・会話・ナビの一次描画と臨床文脈の保持を担う。
- **AppShell は Learning Layer の別シェルではない。** 学習利用でも同じ AppShell を描画する。
- **`mode="v2"` で別 return する構造は移行対象である。** Core を丸ごと差し替える早期 return は廃止する（§ Migration Notes）。
- **AppShell は Learning Layer の接続点を提供する。** 唯一の結合点として `learningLayer` prop を受け取り、有効時のみ重畳を許可する。
- **Learning Layer の実体は専用コンポーネントへ分離する。** Inspector / Question / Supabase 様式2 等は `components/v2/*`・`hooks/v2/*`・`app/v2/actions/*`・`lib/v2/*` に閉じ込め、AppShell は「呼び出し・配置」だけを担う。

### 接続契約（単一の入口）

```ts
// AppShell の唯一の Learning 結合点（概念）
interface AppShellProps {
  learningLayer?: LearningLayer; // 未指定 = 素の Core（現行 "/" と同一）
}

interface LearningLayer {
  enabled: boolean;
  userId: string;
  identity?: { name: string; subtitle?: string };
  form2?: { enabled: boolean; initial: Form2Snapshot | null };
  inspector?: { enabled: boolean };
  // 将来: question / evidence / reflection / story / role / persistence を
  // 02_learning_layer.md の LearningLayerConfig に沿って拡張する
}
```

派生フラグは AppShell 冒頭で算出し、以降の**描画側**でのみ分岐する（Hooks は無条件に呼ぶ = Rule 6 / 10 の担保）。

```ts
const learningEnabled  = !!learningLayer?.enabled;
const inspectorEnabled = learningEnabled && !!learningLayer?.inspector?.enabled;
const form2Supabase    = learningEnabled && !!learningLayer?.form2?.enabled;
const userId           = learningLayer?.userId;
```

---

## 4. Allowed Integration Patterns（許容する接続形）

Learning Layer が Core に接続してよい形は以下に限る。

- **overlay** — Core view の上に重ねる薄い層。
- **right panel** — PC で Core view の右に共存するサイドパネル（Core 本体は消えない）。
- **bottom sheet** — 狭幅（iPad 縦）で下から出るシート。
- **floating toggle** — Learning を開くための控えめなトグル（Core ヘッダを書き換えない）。
- **learning navigation section** — Core Navigation とは別枠の学習導線セクション（§6）。
- **Core view 内の限定的 slot** — Core view が明示的に許可した限定領域への差し込み（例: 様式2 view の中身差し替え）。
- **学習専用 view の追加** — Core 画面の**複製ではなく**、Learning Layer 固有機能に限定した view の追加。

> 補足: 「学習専用 view の追加」は、病棟・患者トップ・カルテ・会話といった Core 画面を複製することを意味しない。**様式2 のような Learning Layer 固有機能**に限って新規 view を持ってよい、という意味である。Core にすでにある体験は Core view をそのまま使う（Rule 3 / 4）。

---

## 5. Prohibited Patterns（禁止する接続形）

以下は統合規約に反するため禁止する。

- **V2 専用 AppShell**（Core とは別のシェルを学習用に作る）。
- **Core 画面のコピー**（病棟・患者トップ・カルテ・会話の再実装）。
- **学生用の別カルテ UI**（Core の電子カルテとは別の学生専用カルテ）。
- **mode による AppShell 全体の早期 return**。
- **学習支援開閉による Core 再マウント**。
- **学習データの Core localStorage への混在**。
- **AI による様式2 への自動記入**。
- **Core UI の無条件なレスポンシブ変更**（Learning 都合で Core の全レイアウトを変えること）。

---

## 6. Navigation Integration

Core Navigation と Learning Navigation を**分離**する。両者は同じ SideNav 上に共存しうるが、責務と項目群は別である。

### Core Navigation（Core が所有）
- 病棟ホーム
- 患者トップ
- 電子カルテ
- その他 Core 機能（会話・気づきメモ 等）

### Learning Navigation（Learning Layer が加算）
- 様式2
- Evidence（将来）
- Reflection（将来）
- Story（将来）

- 現在の実装対象は **様式2 のみ**だが、上記の将来 Learning セクションを前提に「Core 導線に 1 項目足す」のではなく「**Learning 導線セクション**として拡張できる」構造で設計する。
- SideNav は `items` / `identity` の props に対応済み。Learning 有効時のみ Learning セクションを含む `items` と学習者 `identity` を渡し、無効時は Core 既定（undefined）で完全一致させる。

---

## 7. Patient Context

- **`selectedPatientId` は Core が所有する。** 患者選択の一次状態は Core（AppShell）にある。
- **Learning Layer は患者文脈を参照する。** Learning は現在の患者を読み取り、自分の能力の有効性を判断する。
- **学習機能の利用可能性を患者ごとに判定する。** 判定は `caseIdForPatient(selectedPatientId)`（`lib/v2/notebook/caseId.ts`）が非 null かで行う。
- **現状は患者 A / `SP-001` が受け持ちケース。** 受け持ちケースでのみ Supabase 保存・様式2（Supabase 版）を有効化する。
- **Core 上で他患者を見ることと、学習記録を保存できることは別概念。** 他患者の閲覧は Core として自由に行える（WardMap 全表示）。学習記録の保存可否は受け持ちケースかで別途決まる。受け持ち以外では様式2 は Core の localStorage 版へフォールバックし、Supabase 保存は行わない。

---

## 8. State Preservation

Learning Layer の開閉・保存で、少なくとも以下を保持する（Rule 6 / 7 の具体化）。

- 電子カルテのタブ
- 選択記録
- スクロール位置
- 会話履歴
- 会話入力途中
- 気づきメモ
- 様式2 入力
- 保存状態
- Inspector 状態（開閉・アクティブパネル）
- Question 状態（選択・確認状態）

原則: Learning の状態は Core 状態と**別に保持**し、Inspector 等は Core メイン領域の **sibling / overlay** として配置することで、開閉時の再マウント・状態喪失を防ぐ。

---

## 名称と移行方針（全文書共通）

- **Version1** … 現在の Core 実装を指す歴史的・実装上の名称。
- **Version2** … Learning Layer 導入を進めてきた開発段階の名称。
- 恒久的な製品アーキテクチャは **Core / Learning Layer / Integration** で表現する（Version1 / Version2 は恒久名称に用いない）。
- `/v2` ルートと `docs/version2` は移行中の技術資産として当面残す。
- 今回はルート名変更・ファイル移動・コード変更を行わない。

---

## Migration Notes

`docs/version2/13_ui_architecture.md`（CWDS）との矛盾を含め、移行方針を4分類で整理する。既存文書は変更しない。

### 継続採用
- 静けさ・信頼性・思考支援・「AI を主役にしない」（CWDS §2 / §10 の Non-goals）。
- Workspace Inspector の**状態非破壊性**（CWDS §3 / §4 の「開閉で状態を壊さない」）。
- Inspector の器としての責務分離（開閉・レイアウト・overlay・`no-print` のみ持ち、ドメインは Panel に閉じる）。

### 名称・位置付けを変更
- CWDS「**Workspace First**」→ **Clinical World First / Core First**（主役は Core の臨床世界）。
- CWDS「**Workspace Inspector**」→ **Learning Layer Inspector**（Core view 上に開く Learning の器）。
- CWDS の情報階層 Level 1〜4（Timeline→Conversation→Evidence→Form2）→ Level 1〜2 は Core、Evidence/Form2 は Learning 能力、Inspector は Learning レイヤーとして再配置。

### 廃止予定
- **`mode="v2"` による AppShell 早期 return**（Core 置換）。
- **StudentShell** / `components/v2/student-shell/StudentPatientTop.tsx`。
- **独立 Workspace 中心構造**（`components/v2/workspace/PatientWorkspace.tsx` / `app/v2/student/workspace/page.tsx`）を主役とする構造。
- **V2 専用 4 項目ナビ**（Core Navigation ＋ Learning Navigation セクションへ再編）。

### 実装移行が必要
- **AppShell props の `learningLayer` 統合**（本書 §3）。
- **V1 return への加算接続**（早期 return を廃し、Core の既存 return に重畳）。
- **Learning Navigation セクション**（§6）。
- **Inspector overlay 化**（列内ドックから `fixed` overlay へ）。
- **Supabase 様式2 の患者文脈接続**（§7、`caseIdForPatient` による有効化）。

### 最小の移行手順（各ステップ後に Core 回帰 QA ＋ tsc/lint/build）
1. `learningLayer` prop と派生フラグを追加（型のみ。`<AppShell/>` は素の Core のまま）。
2. `mode="v2"` 早期 return と mode 依存 state・余分な view/handler・`StudentPatientTop` を撤去 → `/` が現行と同一か確認。
3. SideNav へ Core Navigation ＋ Learning Navigation セクション（Learning 有効時のみ）と `identity` を渡す。
4. 様式2 view の中身を Supabase / localStorage で切替（外枠不変）。
5. Inspector を overlay として重畳＋対象 view のみトグル表示（Chart 3列が無変化か確認）。
6. `/v2/student/page.tsx` を `<AppShell learningLayer={…} />` 形式へ。
7. 総合 QA: `/`（Core 回帰）＋ 学習導線（Core UI ＋ 学習者識別 ＋ 様式2 Supabase ＋ ChartSideNav/ChartAside 維持のまま Inspector overlay）。

### Core 回帰リスクと緩和
- SideNav が常に `items`/`identity` を受け取る → 無効時 undefined で Core と完全一致（スナップショット確認）。
- Inspector overlay の z-index / pointer-events → 閉時は何も描画せず Core 操作を阻害しない。
- 様式2 中身差し替え → 通常 Core は必ず localStorage 版へ落ちることを確認。
- Learning view メンバー削除 → SideNav 型参照が壊れないこと（型で検出）。
- floating トグル → `no-print`、Learning 無効・`/` では非表示。

---

## 関連文書
- `01_compass_core.md` / `02_learning_layer.md` / `04_learning_flow.md` / `05_design_principles.md`
- 移行段階の詳細（保持・本書が上位）: `docs/version2/13_ui_architecture.md`（CWDS）, `14_architecture_principles.md`, `12_question_feature_review.md`。
