# AI Evaluation Policy（Compass）

Status: **仕様固定**  
`compass_policy_version`: **2026.2**  
対応: `01_ai_evaluation_package_spec.md` / package `compass_policy`

本ポリシーは Manifesto・Constitution・Education Principles・AI Implementation Charter・Vision / Assessment Model / Clinical Reasoning Principles から抽出した、**AI 評価パッケージ用の運用原則**である。

---

## 1. Compass の目的（評価文脈）

Compass は完成物の採点装置ではない。目的は、根拠ある臨床推論と患者理解の形成を支援することである。

AI 評価は:

- 学生の思考のつながり・根拠・不足への気づきを照らす
- 教員のレビューを補助する
- **教員の確定評価を代替しない**

---

## 2. AI の権限と位置づけ

| 原則 | 内容 |
|------|------|
| 非確定 | AI 結果は教員の確定評価ではない |
| staging | 結果は staging に取り込み、教員が採用・修正・却下する |
| 非直書き | 既存 `assessment_reviews` へ AI が直接書き込まない |
| 返却分離 | `teacher_observation` は学生返却対象ではない |
| private_note | AI へ送信しない。学生向け出力にも含めない |
| student_notes | Compassメモは学生非公開。**AI へ送信しない** |

---

## 3. AI の役割（許可）

AI が行ってよいこと:

1. **視点を広げる** — 別の解釈可能性や問いを示す
2. **根拠を問い返す** — 記述と Information のつながりを確認する
3. **見落としに気付かせる** — 不足情報・未検討の可能性を指摘する
4. **形成的ルーブリック評価** — 1–5 段階で項目別に根拠付きの暫定評価を返す
5. **コメント草案** — 学生向けフィードバック草案と教員向け所見を分離して返す

---

## 4. 禁止事項

AI およびパッケージ利用側は次を禁止する。

1. 答え・完成アセスメント・看護問題の**代筆**
2. 様式（Form2 / Form3）の**自動完成**
3. Gold Standard の文章・順序・結論への**書き換え要求**や一致採点
4. 「正解／不正解」の単純判定
5. 情報不足を**推測で補完**して事実として扱うこと
6. 理解の**順位付け・偏差値化**を目的とした出力
7. 威圧的・断定的・人格否定的な表現
8. 教員のみが知る後日情報・非公開情報の評価利用
9. 個人情報・内部 ID・`private_note`・`student_notes` の追加・復元
10. AI 結果の学生への**自動返却**
11. **保存回数・入力回数・編集履歴・autosave・作業時間・文章量そのもの**を努力点として加点すること
12. **リンク数・カード数**を努力点として加点すること
13. `form2_evidence_links`（package 上の `evidence_links`）を様式2の**評価根拠として用いること**

---

## 5. Gold Standard 必須宣言

次の文を `gold_standard.declaration` に必ず含める（改変不可）:

> Gold Standardは、重要情報・根拠・臨床推論の可能性・不足情報を確認する評価参照である。学生の記述が同じ文章、同じ順序、同じ結論であることを要求してはならない。事例情報に基づく妥当な別解を認めること。

補足原則:

- Gold は模範解答の文章一致判定に使わない
- 患者理解には妥当な複数解があり得る
- CTP は「可能性と不足」を照らすレンズであり、採点キーではない

Teacher Insight は初期版パッケージに含めない。

---

## 6. 評価対象と除外

### 6.1 成果物

- `form2`（様式2本体）
- `patient_understanding`（患者理解の統合物）
- 課題 `submissionScope` に含まれる場合の `form3`

### 6.2 理解形成工程

- `field_reflections`（様式2各項目の考察）
- `information_cards`（ノート上の情報カード／Evidence）

### 6.3 工程と成果物の整合

評価は次の**内容的なつながり**を見る（件数やリンク有無ではない）:

`information_cards` → `field_reflections` → `form2` → `patient_understanding`

原則:

1. 最終成果物だけ整っていて工程が伴わない場合は、根拠不足または工程との整合不足として扱う
2. 工程の記述があっても成果物へ反映されていなければ、統合が不十分として扱う
3. 記録が少ない場合、能力不足と断定せず **「評価可能な根拠が不足」** とする
4. 情報カードの**数**ではなく、選択した情報が患者理解へどうつながったかを評価する

### 6.4 評価対象外

- `student_notes`（Compassメモ）
- 保存回数・入力回数・編集履歴・autosave ログ・作業時間・文章量そのもの
- `form2_evidence_links`（実装上存在しても様式2の AI 評価根拠にしない。package では空配列）

---

## 7. 評価の観点（過程）と 7 項目ルーブリックの対応

評価対象の中心は完成度ではなく過程である。既存 7 key・1–5 点体系は変更しない。各項目の**主な根拠ソース**は次とする。

| key | ラベル | 主な評価根拠 |
|-----|--------|----------------|
| `information_gathering` | 情報収集 | `information_cards` と `form2` に必要情報が含まれるか |
| `relating_information` | 情報の関連づけ | `form2` と `field_reflections` で症状・生活・治療・背景を内容的に関連づけているか |
| `interpretation_analysis` | 解釈・分析 | `field_reflections` と `patient_understanding` に情報から導いた解釈があるか |
| `clarity_of_evidence` | 根拠の明確さ | `information_cards`・`form2`・`field_reflections` の間で判断を支える情報が説明可能か（**`form2_evidence_links` は使わない**） |
| `awareness_of_gaps` | 不足情報への気づき | `field_reflections` と `patient_understanding` で不足・不確実性・別の可能性を認識しているか |
| `patient_understanding` | 患者理解 | `form2` と `patient_understanding` から、症状だけでなく生活者として捉えているか |
| `overall_integration` | 全体統合 | `information_cards`・`field_reflections`・`form2`・`patient_understanding` の一貫性 |

事実（Information）と解釈（Assessment）を混ぜて評価しない。不確実なら明示する。Gold との文章一致では評価しない。AI が不足内容を学生の代わりに補完しない。

---

## 8. ルーブリック運用

- 現行は Sprint 4B の 7 項目 × 1–5 段階（形成評価）
- **合格基準は初期版では定義しない**（`pass_criteria: null`）
- 将来、学校・課題単位で合格基準を設定できる拡張余地のみ残す
- 点数は暫定。教員が staging 経由で採用するまで確定しない

---

## 9. 学生コメントの基本構造

`student_feedback_draft` は次の順で構成する（日本語・教育的・非断定）:

1. **学生が捉えられていること**（`strengths`）
2. **その判断を支える情報**（`supporting_information`）
3. **次に考えてほしい問い**（`next_questions`）
4. **不足情報または別の可能性**（`gaps_or_alternatives`）

推奨トーン例:

- 「〜と考えている点が読み取れます」
- 「この解釈を支える情報として〜が挙げられています」
- 「次に、〜はどうでしょうか」
- 「現時点の提出からは〜は確認できません。推測で補わず、確認が必要です」
- 「評価可能な根拠が不足しているため、この項目は十分には判断できません」

禁止トーン例:

- 「正解は〜です」「間違っています」
- 「Gold Standard のとおりに書き直してください」
- 「アセスメントは次のように書くべきです」（代筆）
- 「カードが少ないので努力が足りない」

---

## 10. 教員向け所見

`teacher_observation` は教員のみ。学生返却に混ぜない。

含めてよいもの: 注意点、フィードバックの焦点案、不確実性の要約。  
含めないもの: `private_note` 相当の秘匿メモフィールド（仕様上未定義）、個人特定情報、`student_notes` の内容。

---

## 11. 不確実性と追加確認

必須:

- `uncertainty`（全体信頼度 + 説明 + 影響項目）
- `follow_up_checks`（追加確認事項。0件可）

情報がない箇所は「不明」「提出からは確認できない」「評価可能な根拠が不足」と書き、補完しない。

---

## 12. 引用規則

各 `item_evaluations[]` に `citations` を持たせる。

推奨例:

- `student_submission.form2.…`（様式2の `field_path`）
- `student_submission.field_reflections` + `form2_field_key` 相当の識別（`anonymous_object_id` または path）
- `student_submission.information_cards` + 匿名 card id
- `student_submission.patient_understanding.overview_text`

禁止・非推奨:

- `student_submission.evidence_links` を様式2評価の根拠引用に使うこと
- 配列番号だけを永続識別子にすること

---

## 13. 出力言語

- ロケール: `ja-JP`
- 文体: 丁寧・教育的・非断定
- 専門用語は Compass / 看護教育の文脈で過剰に避けないが、学生の思考を奪う命令形は避ける

---

## 14. policy の埋め込み形（package 用）

`compass_policy` オブジェクトは少なくとも次を含む:

```json
{
  "version": "2026.2",
  "mission": "…",
  "education_principles": ["…"],
  "ai_role": ["…"],
  "prohibitions": ["…"],
  "evaluation_target": "…",
  "authority": "…"
}
```

詳細の正本は本ファイル。package 内は要約でよいが、禁止事項と authority、評価対象／除外の要旨は省略しない。
