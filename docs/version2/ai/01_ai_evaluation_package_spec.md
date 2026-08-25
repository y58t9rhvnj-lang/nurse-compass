# AI Evaluation Package Spec（初期版）

Status: **仕様固定（設計のみ）**  
Scope: 文書・JSON Schema・サンプルのみ。アプリコード / DB / Server Action / UI は変更しない。  
`package_schema_version`: **1**

---

## 1. 目的

匿名化提出データ（Sprint 5A）に、Compass の教育思想・評価基準・Gold Standard・症例コンテキストを付与し、外部 AI が **臨床推論過程を形成的に評価**するための入力パッケージと、その出力結果の形を固定する。

本仕様は実装前の契約である。将来の staging 取り込み・教員採用フローの前提とする。

---

## 2. 非目標（初期版）

- DB migration / staging テーブル実装
- 既存 `assessment_reviews` への直接書き込み
- Teacher Insight の同梱
- 合格基準（pass/fail）の定義
- AI の自動確定評価・自動返却
- `private_note` の AI 送信または学生向け出力

---

## 3. 設計判断（確定）

| # | 判断 |
|---|------|
| 1 | Gold Standard / `case_context` にも Sprint 5A と同等の匿名化を適用する |
| 2 | Teacher Insight は初期版パッケージに含めない |
| 3 | 合格基準は定義しない（1–5 の形成評価のみ。将来拡張余地を残す） |
| 4 | **1 package = 1 提出**。一括生成時も提出ごとに独立 package |
| 5 | AI 結果は将来の新規 staging テーブルへ保存。既存 review へ直接反映しない |
| 6 | 引用は `field_path` と `anonymous_object_id` の両方。配列番号のみを永続識別子にしない |
| 7 | `case_context` は症例正本・Gold 根拠情報・提出時点で学生が参照可能だった範囲に限定 |
| 8 | package 生成権限は teacher / admin。教育的採用・修正・返却は原則 teacher |
| 9 | 多症例 version は安定 case key（例: `patient-a/1`） |
| 10 | AI 出力は日本語・教育的・非断定。正解／不正解の単純判定・代筆・Gold 文章への書き換え禁止 |

---

## 4. 文書と Schema の関係

| 成果物 | 役割 |
|--------|------|
| 本ファイル | パッケージ／結果の構造・version・運用境界 |
| `02_ai_evaluation_policy.md` | Compass 理念・禁止事項・トーン・Gold 宣言 |
| `schemas/ai-evaluation-package.schema.json` | **入力** package の JSON Schema |
| `schemas/ai-evaluation-result.schema.json` | **出力** result の JSON Schema（分離） |
| `samples/*.sample.json` | 正規例 |

package と result の schema は分離する。result は元 package の `metadata.evaluation_request_id` を必須参照する。

---

## 5. Package 最終構造

ルート型名: `AiEvaluationPackage`（`package_schema_version: 1`）

```
ai_evaluation_package
├── metadata
├── compass_policy
├── rubric
├── gold_standard
├── case_context
├── student_submission
├── evaluation_instructions
└── output_schema_hint          # AI への期待出力の要約（結果 schema への参照）
```

### 5.1 `metadata`（必須）

| フィールド | 型 | 説明 |
|------------|-----|------|
| `package_schema_version` | integer | 初期値 **1** |
| `compass_policy_version` | string | 例: `"2026.1"` |
| `rubric_version` | string | 例: `"1"`（Sprint 4B 固定ルーブリック） |
| `gold_standard_version` | string | 安定 case key。例: `"patient-a/1"` |
| `case_version` | string | 症例正本版。例: `"patient-a/1"` |
| `export_schema_version` | integer | Sprint 5A `AI_EXPORT_SCHEMA_VERSION`（現状 1） |
| `generated_at` | string (ISO 8601) | package 生成時刻 |
| `evaluation_request_id` | string (uuid) | 匿名リクエスト ID。user/org を含めない |
| `generated_by_role` | `"teacher"` \| `"admin"` | 生成権限ロール |
| `locale` | string | 初期固定 `"ja-JP"` |

### 5.2 `compass_policy`（必須）

理念・教育原則・AI の役割・禁止事項の構造化要約。詳細文言は `02_ai_evaluation_policy.md` と同一内容を `version` 付きで埋め込む。

必須サブキー:

- `version`
- `mission`
- `education_principles`（array of string）
- `ai_role`（array of string）
- `prohibitions`（array of string）
- `evaluation_target`（臨床推論過程を評価する旨）
- `authority`（AI は教員の確定評価ではない旨）

### 5.3 `rubric`（必須）

Sprint 4B `assessmentRubric.ts` と対応。

| フィールド | 説明 |
|------------|------|
| `version` | `metadata.rubric_version` と一致 |
| `scale` | `{ min: 1, max: 5, levels: [...] }` |
| `items[]` | 7 項目。各 `key` / `label` / `focus`（評価観点） |
| `pass_criteria` | 初期版は **`null`**。将来学校・課題単位の拡張用スロット |

項目 key（固定）:

1. `information_gathering`
2. `relating_information`
3. `interpretation_analysis`
4. `clarity_of_evidence`
5. `awareness_of_gaps`
6. `patient_understanding`
7. `overall_integration`

段階ラベル: 到達していない / 一部到達 / 概ね到達 / 十分到達 / 高い水準で到達

### 5.4 `gold_standard`（必須）

匿名化済みの評価参照。

| フィールド | 説明 |
|------------|------|
| `version` | 安定 key。例 `"patient-a/1"` |
| `schema_version` | Gold ドキュメント schema（現状 1） |
| `declaration` | **必須宣言**（下記） |
| `purpose` | 教材目的 |
| `framework` | Patient Understanding First / facts→meaning→missing→update 等 |
| `initial_understanding` | 初期仮説（匿名化テキスト） |
| `critical_thinking_points[]` | CTP（assumption / facts / lenses / meaning / missing / update / next_question / evidence_information_ids） |
| `integrated_understanding` | 統合理解 |
| `remaining_unknowns` | 残る未知 |
| `assessment_criteria` | Gold 側の評価観点テキスト |
| `not_for_verbatim_matching` | 恒等 `true` |
| `teacher_insight_included` | 初期版恒等 `false` |

#### Gold Standard 必須宣言（固定文）

> Gold Standardは、重要情報・根拠・臨床推論の可能性・不足情報を確認する評価参照である。学生の記述が同じ文章、同じ順序、同じ結論であることを要求してはならない。事例情報に基づく妥当な別解を認めること。

`evidence_information_ids` は症例カタログの安定 ID を **匿名化**した値（例: `cinfo_<hmac>`）とし、学生 Form3 の card UUID 生値は載せない。

### 5.5 `case_context`（必須）

| フィールド | 説明 |
|------------|------|
| `case_key` | 安定 key（例: `patient-a`） |
| `case_version` | `metadata.case_version` と一致 |
| `evaluation_moment` | 匿名ラベル（例: 評価時点1）と種別 |
| `canonical_case` | 症例正本の要約／許可された事実ブロック（匿名化） |
| `gold_referenced_information[]` | Gold が参照する根拠情報（匿名 id + 内容） |
| `student_visible_scope` | 提出時点で学生が参照可能だった情報範囲の宣言 |
| `excluded_from_evaluation` | 教員のみ後日情報・非公開情報は評価に使わない旨 |

**含めないもの:** 教員専用メモ、後日開示情報、Teacher Insight、未公開カルテ拡張。

### 5.6 `student_submission`（必須）

Sprint 5A の `AiAnonymizedAssessmentRecord` を **1 件だけ** 含む。

- `schema_version` / `export_kind` / `anonymous_ids` / `meta`
- `form2` / `form3` / `information_cards` / `evidence_links`
- `field_reflections` / `patient_understanding` / `source_versions` / `included_artifacts`

`private_note`・教員コメント・内部 user/org ID は含めない。

### 5.7 `evaluation_instructions`（必須）

| 指示 | 内容 |
|------|------|
| 別解 | Gold との文章一致を求めない。妥当な別解を認める |
| つながり | 情報と解釈のつながりを評価する |
| 推測禁止 | 情報不足を推測で補完しない |
| 区別 | 事実・推論・評価を区別する |
| 不確実性 | 不確実な評価は明示する |
| 引用 | 各項目に `citations`（`field_path` + `anonymous_object_id`） |
| 出力分離 | `student_feedback_draft` と `teacher_observation` を分離 |
| 永続化 | 既存 `assessment_reviews` へ直接書き込まない |

### 5.8 `output_schema_hint`（必須）

結果 schema の識別子と必須セクション一覧。完全な制約は `ai-evaluation-result.schema.json` が正本。

---

## 6. Result 最終構造

ルート型名: `AiEvaluationResult`

```
ai_evaluation_result
├── metadata
├── item_evaluations[]
├── student_feedback_draft
├── teacher_observation
├── uncertainty
├── follow_up_checks
└── staging_hint
```

### 6.1 `metadata`（必須）

| フィールド | 説明 |
|------------|------|
| `result_schema_version` | 初期値 **1** |
| `evaluation_request_id` | **元 package と同一必須** |
| `package_schema_version` | 元 package の値を返す |
| `compass_policy_version` | 同上 |
| `rubric_version` | 同上 |
| `gold_standard_version` | 同上 |
| `case_version` | 推奨（追跡用） |
| `export_schema_version` | 推奨 |
| `generated_at` | AI 結果生成時刻 |
| `model_label` | 任意。モデル名の抽象ラベル（秘密・キーなし） |
| `locale` | `"ja-JP"` |

### 6.2 `item_evaluations[]`（必須・7件推奨）

各要素:

| フィールド | 説明 |
|------------|------|
| `rubric_key` | 7 key のいずれか |
| `score` | 1–5 の整数、または評価不能時 `null` |
| `level_label` | 段階ラベル（score に対応）。score null 時は null 可 |
| `rationale` | 評価根拠（非断定・日本語） |
| `citations[]` | 引用箇所（下記） |
| `uncertainty_note` | 当該項目の不確実性（任意だが推奨） |

#### 引用 `citations[]`

| フィールド | 必須 | 説明 |
|------------|------|------|
| `field_path` | 推奨* | 例: `student_submission.form3.assessmentCards` |
| `anonymous_object_id` | 推奨* | 例: `card_37bec5170489673d` |
| `excerpt` | 任意 | 短い引用（匿名化済み提出からの抜粋） |
| `note` | 任意 | なぜ引用したか |

\* 少なくとも `field_path` または `anonymous_object_id` のいずれかは必須。  
配列インデックス alone（例: `assessmentCards[2]` のみ）を永続識別子にしてはならない。インデックスを使う場合も `anonymous_object_id` を併記する。

### 6.3 `student_feedback_draft`（必須）

学生返却候補。**教員が採用・修正した場合のみ**返却対象になり得る。AI 結果の自動返却は禁止。

必須構造（4 ブロック）:

1. `strengths` — 学生が捉えられていること
2. `supporting_information` — その判断を支える情報
3. `next_questions` — 次に考えてほしい問い
4. `gaps_or_alternatives` — 不足情報または別の可能性

任意: `overall_tone_check`（自己点検メモ。学生非表示想定）

**含めない:** `private_note`、内部 ID、Gold 文章の丸写し、完成アセスメントの代筆。

### 6.4 `teacher_observation`（必須）

教員向け所見。**学生返却対象ではない。**

- `summary`
- `attention_points[]`
- `suggested_focus_for_feedback`
- ※ `private_note` フィールドは定義しない（送信・生成対象外）

### 6.5 `uncertainty`（必須）

| フィールド | 説明 |
|------------|------|
| `overall_confidence` | `"low"` \| `"medium"` \| `"high"` |
| `notes` | 不確実性の説明（必須・1文字以上） |
| `affected_rubric_keys` | 影響する項目 key の配列（空可） |

### 6.6 `follow_up_checks`（必須）

追加確認事項の配列。0 件可だがキーは必須。各要素:

- `question` — 教員または学生に確認すべきこと
- `reason` — なぜ不足／曖昧か
- `related_rubric_keys` — 関連項目

### 6.7 `staging_hint`（必須）

将来 staging 実装向けの宣言のみ（初期版は永続化しない）。

```json
{
  "persist_to": "future_ai_evaluation_staging",
  "must_not_write_to": ["assessment_reviews"],
  "teacher_actions_expected": ["adopt", "edit", "reject"],
  "auto_apply_forbidden": true
}
```

---

## 7. Version 不一致時の扱い

取り込み側（将来の staging / 教員 UI）は次を必須とする。

| 条件 | 扱い |
|------|------|
| `evaluation_request_id` が不明・不一致 | **拒否** |
| `package_schema_version` または `result_schema_version` が非対応 | **拒否** |
| `rubric_version` が現行アプリ定数と不一致 | **自動採用せず警告**（教員が明示確認するまで採用不可） |
| `compass_policy_version` / `gold_standard_version` 不一致 | **自動採用せず警告** |
| `export_schema_version` 不一致 | **警告**（提出解釈の信頼度低下） |

**自動採用禁止:** version 不一致がある result を既存 `assessment_reviews` や学生返却へ自動反映してはならない。

---

## 8. 権限

| 操作 | teacher | admin |
|------|---------|-------|
| package 生成 | ○ | ○ |
| AI 呼び出し（将来） | ○ | ○（運用ポリシー次第） |
| staging 上の教育的採用・修正 | ○（原則） | △（監査・代行は別途定義。初期は原則 teacher） |
| 学生への返却 | ○（既存 review フロー経由） | 既存ロール方針に従う |

AI 結果の確定評価権限は教員にある。AI は確定しない。

---

## 9. 匿名化境界

Sprint 5A（`aiExportAnonymize.ts`）と同等:

**除去・変換**

- 氏名・ログイン・メール・学籍・organization / user ID
- Form2 学生ブロック・患者氏名
- case / cycle / milestone / submission / card / link / reflection の実 UUID → 匿名 ID
- 課題名・評価時点名 → `課題N` / `評価時点N`
- 自由記述の明確な PII パターンのみマスク（ID キーには適用しない）

**Gold / case_context**

- 同じ禁止キー除去・自由記述マスク
- カタログ Information ID・CTP id は安定だが外部送出時は匿名化または非個人の教材 ID のみ
- 内部受け入れテスト用 card UUID 等は載せない

**絶対に載せない**

- `private_note`
- Teacher Insight（初期版）
- 教員のみの後日情報
- 認証トークン・cookie

---

## 10. 一括生成

一括エクスポート時も **提出ごとに独立した package** を生成する。

- 各 package に固有の `evaluation_request_id`
- `student_submission` は常に 1 レコード
- バッチメタデータは package 外（将来のジョブ層）に置く

---

## 11. 将来の staging 実装に残す課題

本仕様では文書契約のみ。実装時に別途決めること:

1. staging テーブル設計（result JSON・status・version 警告フラグ）
2. adopt / edit / reject の RPC と既存 `assessment_reviews` への **明示的手動反映**
3. package 生成 Server Action と監査ログ（5A export audit との関係）
4. Gold / case_context 匿名化パイプラインの実装共有
5. 学校・課題単位の `pass_criteria` 拡張
6. Teacher Insight を任意同梱するかどうかの再検討
7. モデルプロバイダ・プロンプト保管・再実行ポリシー
8. version 不一致時の UI 警告文言と拒否コード

---

## 12. Schema / サンプル

- Package schema: `schemas/ai-evaluation-package.schema.json`
- Result schema: `schemas/ai-evaluation-result.schema.json`
- Samples: `samples/ai-evaluation-package.sample.json`, `samples/ai-evaluation-result.sample.json`
