# Compass Learning Flow

> 本書は Core（`01`）の臨床世界の上で、Learning Layer（`02`）がどう学習過程を支えるかの**流れ**を定義する。
> 統合の契約は `03`、原則は `05` を参照。本書は体験の流れの設計であり、画面の実装仕様ではない。

---

## 1. Purpose

Compass は**学生に答えを与えるのではなく、患者理解の過程を支援する**。

- 診断名・結論・様式2 の完成文を提示しない。
- 学生自身が「見て・理解し・考え・整理し・振り返る」過程を、Learning Layer が静かに支える。
- Core は臨床世界を提供し、その中で学習が進む。学習は Core の外の別画面へ移動して行うものではない。

---

## 2. Learning Cycle（学習サイクル）

Compass の正式な学習サイクルは次の5段階である（英語・日本語併記）。

```
Observe（見る）
   ↓
Understand（理解する）
   ↓
Think（考える）
   ↓
Organize（整理する）
   ↓
Reflect（振り返る）
```

- **Observe（見る）** — 患者・病棟・電子カルテを観察し、一次情報に触れる。
- **Understand（理解する）** — 会話・記録・気づきを通じて、情報の意味を捉える。
- **Think（考える）** — 問い（Question）を手がかりに、観察・比較・理由・根拠確認を行う。
- **Organize（整理する）** — 根拠（Evidence）を選び、様式2 へ自分の言葉で構造化する。
- **Reflect（振り返る）** — 自らの理解と過程を振り返る（Reflection / Story）。

> この5段階は正式名称である。学習は一方向に進むとは限らず、段階間を**螺旋状に行き来する**が、その場合も上記5段階の名称を維持して記述する。

---

## 3. Feature Mapping

各学習段階と主な機能の対応。

| 学習段階 | 主な機能 |
|---|---|
| Observe | 病棟、患者、電子カルテ |
| Understand | 患者との会話、カルテ、気づきメモ |
| Think | Question、Inspector、Coach |
| Organize | Evidence、様式2 |
| Reflect | Reflection、Story |

- Observe / Understand は主に **Core** の能力で成立する。
- Think 以降で **Learning Layer**（Inspector / Question / Evidence / 様式2 / Reflection / Story）が重畳される。
- Coach は現状 Core にあるが、Think を支える性質を持ち、将来 Learning Layer との責務整理対象（`01` §4 / `03` §Migration Notes）。

---

## 4. Intended Student Flow

想定する学生の流れ（順序は推奨であり強制ではない）。

```
病棟で患者を選ぶ
   ↓
患者を確認する
   ↓
電子カルテを読む
   ↓
患者と会話する
   ↓
気づきを残す
   ↓
問いを通して考える
   ↓
根拠を整理する
   ↓
様式2へ自分の言葉で整理する
   ↓
振り返る
```

### 不変条件

- **学習順序を強制しない。** 上記は推奨であり、段階の飛ばし・戻りを許す。
- **Core 内を自由に行き来できる。** 患者・カルテ・会話・メモを何度でも往復してよい。
- **Learning Layer は必要な時だけ使う。** 問い・根拠・様式2 は求めたときに開く。
- **自動転記しない。** 会話・記録・Evidence を様式2 へ自動で埋め込まない。
- **AI は正解を提示しない。** AI は答えを完成させない（現段階では AI 生成を用いない）。
- **学生自身の言葉を残す。** 整理・振り返りは学生本人の言葉で行う。

---

## 5. Form2 Position

- 様式2 は**単独の最終目的ではない**。
- 様式2 は、患者理解を**構造化するための Learning Capability**である。
- 到達点は「様式2 を埋めること」ではなく、「患者を理解する過程を、様式2 という器で整理・言語化すること」。埋めた結果ではなく、埋める過程に学習価値がある。

---

## 6. Evidence Position

- Evidence は**自動収集箱ではない**。
- Evidence は、学生が**根拠として選び、意味づける対象**である。
- 事実（会話・記録・観察）から「これは自分の理解の根拠だ」と学生が判断して集める。集めること自体が Think の一部であり、システムが自動で溜める箱にしない。

---

## 7. Question Position

- Question は**正答を要求するテストではない**。
- Question は、**観察・比較・理由・根拠確認を促す問い**である。
- 答え合わせをするのではなく、「次に何を見るか」「何と比べるか」「なぜそう考えるか」「根拠は何か」に学生の注意を向けるための手がかりとして機能する。

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
- 「答えを与えず過程を支える」「自動転記しない」「AI を主役にしない」（CWDS §2 / §10）。
- 学生の視線導線（患者 → カルテ → 会話 → 根拠 → 様式2）の連続性。

### 名称・位置付けを変更
- CWDS の「Workspace 縦フロー（Timeline→Conversation→Evidence→Form2）」→ 本書の **Learning Cycle（Observe→Understand→Think→Organize→Reflect）** を正式な学習過程の枠組みとする。
- 「Workspace 内の Evidence/Form2」→ **Learning Layer の Capability**（Organize 段階）として再定義。

### 廃止予定
- 学習を独立 Workspace 画面内で完結させる前提（Core 内での往復を前提に置き換え）。
- V2 専用ナビによる学習導線の固定化。

### 実装移行が必要
- Learning Cycle を実装導線（Core view ＋ Inspector ＋ 様式2）へ対応づけ。
- Evidence を「学生が選び意味づける」操作として Core 会話/記録から接続（Supabase・患者文脈）。

> 既存 `docs/version2/12_question_feature_review.md` / `14_architecture_principles.md` の学習思想（問いは正解でない・根拠優先）は本書と整合する。矛盾は「Workspace 中心」の枠組み名のみで、既存文書は変更しない。

---

## 関連文書
- `01_compass_core.md` / `02_learning_layer.md` / `03_core_learning_integration.md` / `05_design_principles.md`
- 学習思想の詳細（保持）: `docs/version2/12_question_feature_review.md`, `docs/version2/14_architecture_principles.md`
