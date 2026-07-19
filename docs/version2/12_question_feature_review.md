# 12. Question 機能 設計レビュー（Sprint2-3 / Phase2 設計方針）

- ステータス: 設計方針決定（実装前）。本ドキュメントは方針の確定記録であり、アプリコード・DB は未変更。
- 前提資料: 現状調査（Sprint2-3 Phase1、チャット報告）。
- スコープ: 来週の第二回講義向け Question MVP の設計方針。**Compass Version2 全体の UI アーキテクチャは `docs/version2/13_ui_architecture.md`（Compass Workspace Design System / CWDS）に分離した。** 本書は CWDS に準拠する。
- 禁止事項（本フェーズ）: アプリコード変更・DB 変更・migration・commit・push は行わない。

> 改訂履歴
> - 初版: Question を独立縦セクションとして常設（撤回済み）。
> - 第2版: Question 専用のモーダル／シート（`QuestionSheet`）（撤回済み）。
> - 第3版: Question 専用 UI を作らず、**Workspace Inspector** という Version2 共通 UI を採用し、Question はその最初のパネルとする。
> - 第4版（本版）: Question 固有でない UI アーキテクチャを `13_ui_architecture.md`（CWDS）へ分離。本書は Question 固有仕様のみを残し、UI 基盤は CWDS を参照する。

---

## 0. 前提: UI アーキテクチャは CWDS に従う

Compass Version2 の UI 基盤（Design Philosophy / Workspace First / Workspace Inspector / Information Hierarchy / Navigation / Component Rules / Design Language / Future Expansion / Non-goals）は、独立設計書に定義した。

- **参照必須**: `docs/version2/13_ui_architecture.md` — **Compass Workspace Design System（CWDS）**

本書における Question の UI は上記 CWDS の一適用であり、要点は次のとおり（詳細は CWDS を正とする）。

- Question 専用 UI（`QuestionSheet` 等）は作らない。**Workspace Inspector** の最初のパネル `<QuestionPanel />` として表示する。
- Inspector は Workspace の文脈・状態を保持したまま開閉する共通の器。PC=右サイドパネル／iPad=下シート。
- 情報階層上、Question（Inspector）は Level 5 の補助であり、Timeline/Conversation/Evidence/Form2（Level 1〜4）の主役性を奪わない。
- Non-goals（CWDS §10）を厳守: Question を答え・診断・完成質問文に変えない。

以降の章は、この前提の上で **Question 固有の仕様**（定義・Coach との分担・分類・MVP 内容・ケース質問データ・トリガー配置・QuestionPanel の中身）を定める。

---

## 1. Question の正式定義

> Question は、学生が **電子カルテ・患者との会話・観察・Evidence・様式2** を見ながら、
> 「次に **確認・観察・質問・考察** すべきこと」に自分で気づき、
> **自分の言葉で次の行動を選ぶ** ための、行動方向の足場かけ（scaffolding）である。

Question が提示するのは「行動の方向」であって、答え・事実・解釈ではない。

**直接提示してはならないもの（厳守）**
- 診断
- 正解
- 完成済みアセスメント
- 患者理解の結論
- 様式2へ転記できる完成文章

学生が **自分の言葉に言い換える余地** を必ず残す（Question は問いの「種」であり、完成質問文ではない）。

---

## 2. Compass Coach との役割分担

| | Compass Coach | Question |
|---|---|---|
| 位置づけ | 会話中の **問い返し**（対話を通じた思考の深化） | カルテ／会話／Evidence を横断した **行動ガイド** |
| 起動 | 会話パネルを開いている間（会話状態依存・ephemeral） | 会話を開いていなくても開ける（横断的） |
| 入力 | 会話状態（`getCoachFocus`） | ケース固定（MVP。§4） |
| 出力 | direction ＋ 質問例（1視点） | 確認する／観察する／考える の少数項目 |

**決定: 別コンポーネント・別概念とする。** MVP では両者のロジックを共有しない。Compass Coach は現状のまま **不変**。Question は静的・独立に新設する。

理由: 現状の `WorkspaceCoachPanel` は会話パネルを開いている間だけ表示される会話状態依存の UI。Question は会話前・会話なしでもカルテ・Evidence・様式2 を横断して「次の行動」を示す必要があり、Coach 内一区画にすると会話に縛られ役割が混ざる。

---

## 3. Question の分類

**採用: 3分類（確認する / 観察する / 考える）。Gap は MVP では不採用。**

- **確認する（confirm）**: 患者・カルテで追加確認すること
- **観察する（observe）**: 学生が自分の目で観察すること
- **考える（think）**: 学生自身が考察すること
- ~~Gap（不足情報領域）~~: **除外**。
  - 理由1: Gap は「学生の行動」ではなく「情報状態の判定」で、他3つ（行動動詞）と性質が異なる。
  - 理由2: 不足の機械判定は「授業段階でまだ／該当情報が存在しない／確認済みだが未記載」を区別できず誤誘導リスクが高く、"欠けているものを名指しする"＝答えの提示に近づく。
  - 将来、確認状態を安全に判定できる基盤ができた段階で再検討。

学生向けラベルは日本語、内部キーは英語（`confirm` / `observe` / `think`）。

---

## 4. カルテ記録の扱い（MVP）

**推奨: C（ケースごとに、カルテ内容を踏まえた固定 Question を教員が定義）。**

| 案 | 安全性 | 実装範囲 | 教育効果 | 判定 |
|---|---|---|---|---|
| A: Timeline 表示分のみ利用 | 中 | 中 | 中 | △ |
| B: V1 カルテ全体を読取 | 低 | 大 | 中 | ✗ |
| **C: ケース固定 Question** | **高** | **小** | **高** | **◎** |
| D: カルテ非入力＋Coach のみ | 高 | 最小 | 低 | △ |

理由: C は実行時にカルテを解析しないため誤誘導が構造的に起こらず、完全に再現的。カルテは学生が Timeline で「読む対象」として残り、Question は「カルテを踏まえて教員が用意した行動の種」を指す（カルテ内容を Question 生成へ直接渡さない）。工数最小で講義前に安全に間に合う。

---

## 5. Evidence・様式2 の扱い（MVP）

**Evidence: Question の入力にしない（内容を読まない）。表示上のみ明確に分離する。**
- MVP の Question は静的（案C）のため、Evidence の事実／様式2 の解釈／システムの問いを同一処理に流し込まない＝混ざらない。
- UI 上も「これは事実ではなく次にやること」と一目で分かるよう、Evidence（Workspace 本体）とは別の Inspector・別ラベルにする。

**様式2: Question の入力にしない（空欄判定しない）。**
- 空欄が「授業段階でまだ／該当情報が存在しない／確認済みだが未記載」のどれかを判別できず、機械的な情報不足判定は誤誘導になるため。
- 様式2 は「学生が書く出力」のまま据え置く。将来、根拠リンクや確認状態基盤ができてから入力化を検討。

---

## 6. 来週向け MVP の第一推奨

**第一推奨: 案2（独立 Question ＋ ケース固定 確認する／観察する／考える）。静的・決定論・AI/DB/永続化なし。**

| 観点 | 案1 Coach拡張 | **案2 固定** | 案3 決定論ルール | 案4 AI動的 |
|---|---|---|---|---|
| 講義前に安全実装 | △ | ◎ | △ | ✗ |
| 再現性 | △ | ◎ | ○ | ✗ |
| 誤誘導リスク | 中 | 低 | 中 | 高 |
| 思考を奪わない | ○ | ○ | ○ | ✗ |
| Direct Diagnosis 回避 | ○ | ◎ | ○ | ✗ |
| 現行コード再利用 | 高 | 中 | 高 | 低 |
| 実装・QA 工数 | 小 | 小 | 中 | 大 |
| iPad 操作性 | ○ | ◎ | ○ | ○ |

任意の小さな組み合わせ（工数に余裕がある場合のみ）: 案2 を土台に、Coach の既存質問例を Question から参照して「自分の言葉で言い換えてみよう」と促す（案1 の軽い融合）。動的化（案3/案4）は講義後。時間が厳しければ案2 単体で出荷。

---

## 7. UI 方針（正式・改訂）

### 7.1 撤回する方針

以下はすべて撤回する。
- Evidence 直前に独立 Question セクションを常設する
- Workspace 縦フロー内に Question 本文を配置する
- 折りたたみセクションとして縦方向に追加する
- Question 専用のモーダル／シート（`QuestionSheet`）を単体で設ける

### 7.2 新しい正式方針（Inspector 採用）

> **Question は専用 UI を持たず、Version2 共通の Workspace Inspector に載せる。
> Workspace 本体の高さは増やさず、トリガーボタンから Inspector を開き、その中に `<QuestionPanel />` を表示する。**

- Inspector・その表示仕様（PC=右サイドパネル／iPad=下シート、文脈・状態保持、no-print など）は CWDS（`13_ui_architecture.md` §4）に定める共通仕様に従う。
- Workspace 本体には Question 本文や分類カードを常時表示しない。トリガーをタップした時だけ Inspector を開く。

### 7.3 QuestionPanel の中身仕様

- Inspector 内に表示する Question の内容パネル（`<QuestionPanel />`）。
- 表示件数: 各分類 1〜2件、合計最大5件程度。
- チェックリスト化しない（完了チェック・進捗率・自動送信は実装しない）。
- 静かなリスト表示（§7.4）。診断語・断定表現・完成質問文を使わない。

### 7.4 分類の見せ方

派手な3色カードではなく、静かなリスト／小さなグループとして表示する。

```
確認する
・睡眠の変化が始まった時期を、自分の言葉で確かめてみましょう

観察する
・会話中の表情や視線の変化に注目してみましょう

考える
・カルテと患者の語りに違いがないか整理してみましょう
```

- 診断語・断定表現・完成質問文は使用しない。
- 分類は色だけで区別しない。色 ＋ ラベル ＋ アイコンで区別する（医療的意味を持つ色＝赤=警告／緑=正常の装飾流用を避ける）。

### 7.5 Inspector トリガーボタンの推奨位置

Inspector（Question パネルを開く）を呼び出すトリガーボタンの位置。

**推奨: A（Patient Workspace ヘッダー右側）。**

候補ボタン文言（学生向け）: 「次に考えること」（第一候補）／「Question」／「学習ガイド」。文言は教員確認事項。将来 Inspector が複数パネルを持つ場合、トリガーは「Inspector を開く」共通ボタン＋パネル切替、あるいはパネルごとのボタンとする（§13）。

| 位置 | 縦長化 | 見つけやすさ | 会話非依存 | Evidence/様式2 を邪魔しない | iPad 誤タップ | V1 整合 | 判定 |
|---|---|---|---|---|---|---|---|
| **A: Workspace ヘッダー右** | しない | 高（最初に目に入る） | ◎ | ◎ | 低 | 高（pill ボタン） | **推奨** |
| B: 会話・Coach 領域ヘッダー右 | しない | 高（作業ゾーン内） | ○（Section ヘッダーに置けば会話開閉に非依存） | ○ | 低 | 高（`FacingPatient` の pill 群と同系） | 代替 |
| C: 右下フローティング | しない | 高 | ◎ | △ | 中（内容に被る） | 低（V1 に FAB パターンなし） | 不採用 |
| D: Evidence 見出し付近 | しない | 低（ページ下方に埋没） | ○ | ✗ | 低 | 中 | 不採用 |

- C はフローティングボタンだが、V1 に同種の UI パターンが存在しないため不採用。
- 補足（未決定・§13）: Workspace ヘッダーは現状スティッキーではなくスクロールで隠れるため、ページ下方で作業中に到達しづらくなる懸念がある。必要に応じて B（会話・Coach セクションのヘッダー右にも同じトリガーを配置）を併設するか、ヘッダーのスティッキー化を検討する。

---

## 8. PC / iPad の表示方法

Inspector の PC=右サイドパネル／iPad=下シートという共通表示仕様は **CWDS（`13_ui_architecture.md` §4）** を正とする。ここでは Question 固有の補足のみ記す。

- 切替ブレークポイントは未確定（§13）。iPad ポートレート幅（768）で確実に下シートになるよう、切替は `lg`（1024px）基準を推奨。
- Question の内容量は少数（各分類 1〜2件・最大5件程度）のため、サイドパネル・下シートのどちらでもスクロールはほぼ発生しない想定。

---

## 9. デザイン要素

視覚言語・V1 からの再利用トークン（オーバーレイ・パネル・角丸・影・タイポグラフィ・タップ領域等）は **CWDS（`13_ui_architecture.md` §8）** を正とする。参照実装: `components/collection/CollectionDialog.tsx`, `components/patient/FirstAssignmentSheet.tsx`。

Question 固有の視覚指定のみ:

- 分類見出し: `text-[12px]〜[13px] font-semibold text-[#6E6E73]`（または淡い青見出し `#0A5FCC`）。本文リスト: `・` ＋ `text-[13px] leading-relaxed text-[#3A3A3C]`。
- 分類アイコン案: 確認する=`Search`、観察する=`Eye`、考える=`Lightbulb`（医療的意味を持つ色を装飾流用しない）。
- 分類は色だけで区別せず、色＋ラベル＋アイコンで区別する。

---

## 10. 新規コンポーネント構成案（MVP）

MVP では **Inspector（共通の器）＋ QuestionPanel（最初の中身）** を実装する。`QuestionSheet` は作らない。

- `components/v2/workspace/WorkspaceInspector.tsx`（**CWDS の共通コンポーネント**。器の責務・登録型 `InspectorPanelId`・PC/iPad 表示は `13_ui_architecture.md` §4/§7 を正とする。Question 実装時に Inspector 基盤も同時に新設する）
- `components/v2/workspace/panels/QuestionPanel.tsx`（最初のパネル・Question 固有）
  - client。props: `questions`。純表示。Inspector の中身として描画される。V1 デザイン言語で実装。
- `lib/v2/question/questionTypes.ts`
  - `type QuestionCategory = "confirm" | "observe" | "think"`
  - `interface Question { id: string; category: QuestionCategory; text: string }`
- `lib/v2/question/caseQuestions.ts`
  - `const caseQuestions: Record<CaseId, Question[]>`（`SP-001` から着手。教員監修の少数リスト）
  - `getCaseQuestions(caseId: string): Question[]`（既存 `caseIdForPatient(patientId)` を利用）
- `PatientWorkspace.tsx`（配線）
  - ヘッダー右に Inspector トリガーボタン（位置 A）を追加。
  - `const [inspectorPanel, setInspectorPanel] = useState<InspectorPanelId | null>(null)` を持ち、`WorkspaceInspector` を条件描画（MVP は `"question"` のみ）。会話・Evidence・様式2 の state は同じ親に保持されるため、開閉で失われない。
- 将来パネル（`ReflectionPanel` / `StoryPanel` / `TeacherGuidePanel` / `AiAssistantPanel` / `ClinicalNotebookPanel`）は同じ Inspector に `activePanel` を切り替えて差し込むだけで追加できる。
- MVP ではフック・Server Action・localStorage は不要。

---

## 11. DB / Server Action / AI の要否

**いずれも不要（MVP はクライアント静的のみ）。** Supabase テーブル追加なし、Server Action なし、AI なし、migration なし。QA は表示・開閉・iPad 幅・印刷除外・V1／既存セクション非干渉・状態保持の確認で足りる。

---

## 12. MVP で実装しない（講義後へ）

すべて講義後へ延期可能。
- Question の Supabase 保存
- 学生の質問履歴保存
- 会話全文の永続化（別途プライバシー／RLS 検討が要る）
- AI による動的 Question 生成（強く延期推奨）
- Question → 患者質問欄への自動送信（学生が問いを組み立てる過程を奪う懸念もあり慎重に）
- カルテ記録から Evidence を収集する機能
- Evidence–Form2 根拠リンク（`docs/version2/10`）
- Question の完了チェック（チェックリスト化＝機械判定リスクのため作らない）
- Teacher Guide への可視化
- Reflection 連携

---

## 13. 未決定事項

- Inspector トリガーボタンの文言確定（「次に考えること」を第一候補として教員確認）。
- Inspector サイドパネル／下シートの切替ブレークポイント（`sm` / `lg` / カスタム）。推奨は `lg`。
- PC サイドパネルの幅（約 380–440px 案）と、本体との共存レイアウト（本体を圧縮するか重ねるか）。
- 将来 Inspector が複数パネルを持つ場合の切替 UI（共通トリガー＋タブ／セグメント切替 か、パネルごとのトリガー か）。
- Inspector open/close・activePanel の状態を Supabase に持つか（MVP は親 state のみ）。
- 分類ごとのアイコン確定（`Search` / `Eye` / `Lightbulb` は暫定）。
- SP-001 の Question 文面（教員監修・診断語/断定/完成質問文を避けた文言）。
- QuestionPanel 冒頭に「これは答えではない」旨の短い前置きを置くか。

---

## 14. リスク

- 最大の教育的リスク: Question が「答え／チェックリスト」に転化すること（丸写し・診断示唆＝Direct Diagnosis）。緩和: 行動動詞で終える／件数を絞る／言い換えを促す／完了チェック・自動送信を作らない／診断語を含めない教員レビュー。
- 最大の技術的リスク: Inspector 化により本体レイアウトへの影響は小さいが、PC サイドパネルと本体の共存（横幅・z-index）／`no-print`／iPad Safari のソフトキーボードとスクロール挙動、開閉時の子 state 保持を要検証。緩和: V1 の `CollectionDialog` 実装パターンを踏襲し、状態は親 `PatientWorkspace` に保持し、Inspector は器・パネルは中身と責務分離する。
- 設計上のリスク: Inspector を「何でも入る万能パネル」にすると責務が肥大化する。緩和: Inspector は開閉・配置・オーバーレイのみを担い、ドメイン知識は各 Panel に閉じ込める（登録型 I/F）。
