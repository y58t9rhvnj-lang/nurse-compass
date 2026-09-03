# Form3 AI Evaluation — 実装準備設計（StaticContent / Required Scope / Pattern Filter）

Status: **実装仕様（設計のみ・未実装）**  
正本政策: `07_form3_ai_evaluation_policy.md`（教育設計を再解釈しない）  
Form2 正本: `02_ai_evaluation_policy.md`（**変更しない**）  
関連: `../21_assessment_artifact_registry.md`、`01` / `03`〜`06`、`architecture.md`

本書は V2.2 Form3 AI 評価の **実装準備**として、次の 3 点のみを設計する。

1. Form3 専用 StaticContent  
2. Form3 required scope  
3. Form3 pattern filter  

**非目標（本書では実装・変更しない）:** コード、DB、migration、JSON Schema、既存テスト実行による本番操作、production 既存 AI 評価 67 件、関連図、新 rubric key、新入力フィールド、result への上位三軸追加。

---

## 1. 推奨実装構造

```text
Export / Batch
  → resolveScopeForAiEvaluationPackage(milestoneType, dbScope)
       ├─ form2      → FORM2_AI_EVAL_REQUIRED_SCOPE（現行・不変）
       └─ form3_*    → FORM3_AI_EVAL_*_SCOPE（新・本書）
  → prepareAiEvaluationPackageStudentSubmission(record, scope)
       └─ form3 内部投影 + pattern filter（本書で仕様確定）
  → buildAiEvaluationPackage(...)
       └─ selectStaticContent(milestoneType)  // 最小切替点
            ├─ form2 → aiEvaluationPackageStaticContent.ts（現行・不変）
            └─ form3_* → aiEvaluationPackageStaticContentForm3.ts（新）
                 └─ instructions に progress / complete の段階オーバーレイ
```

### 依存方向

- Form2 StaticContent ファイルを Form3 から **import して上書きしない**
- Form3 は新規モジュール。共通化は **Gold 宣言文などの共有定数のみ**
- PackageBuilder が `milestone_type` で切替（単一分岐）

### production 67 件への影響方針

既存 67 は Form2 milestone。切替条件を `milestoneType === "form2"`（および現行どおりの Form2 経路）に固定すれば、**Form3 実装後も Form2 package 内容は不変**。

---

## 2. 変更が必要になる予定ファイル（実装時）

| ファイル | 変更内容（予定） |
|----------|------------------|
| `lib/v2/assessment/aiEvaluationPackageBuilder.ts` | StaticContent 選択を milestone で分岐 |
| `lib/v2/assessment/aiEvaluationPackageStaticContentForm3.ts` | **新規** Form3 policy / rubric focus / instructions |
| `lib/v2/assessment/submissionScope.ts` | `FORM3_AI_EVAL_*_SCOPE` + `resolveScope` の form3 分岐 |
| `lib/v2/assessment/aiEvaluationPackageSubmission.ts` | pattern filter 仕様どおり修正 + Form3 内部投影 |
| （任意）`aiEvaluationPackageExport.ts` / ExportCore | milestone を Builder に確実に渡す確認のみ |
| 新規テスト | §9 matrix |

共有定数候補（任意・小）:

- Gold 宣言を `AI_EVAL_GOLD_DECLARATION` のまま Form3 からも参照（Form2 ファイルから **再エクスポートのみ**、文言変更なし）

---

## 3. 変更不要なファイル（方針）

| 領域 | 理由 |
|------|------|
| `02_ai_evaluation_policy.md` / Form2 StaticContent 本文 | Form2 正本・文字列を不変 |
| `aiEvaluationPackageStaticContent.ts` の Form2 文言 | 上書き禁止。分岐で迂回 |
| package / result JSON Schema | 7 key・ルート形を維持 |
| staging / adoption / audit / Import Core | 政策文が package 内で変わるだけ |
| DB / migrations / Form3 入力 UI | 07 §12 |
| production staging 67 件 | 触らない |
| `07` 教育政策本文 | 再解釈しない |

---

## 4. StaticContent 設計

### 4.1 現状の組み込み経路

1. `buildPackagesForExport` / 個別 Export が anonymize → scope 適用 →  
2. `buildAiEvaluationPackage`（`aiEvaluationPackageBuilder.ts`）が常に  

   - `buildAiEvaluationCompassPolicy()`  
   - `buildAiEvaluationRubricBlock()`  
   - `buildAiEvaluationInstructions()`  
   - `buildAiEvaluationOutputSchemaHint()`  

   を **Form2 専用モジュールから無条件呼び出し**。  
3. `student_submission.meta.milestone_type` は package に入るが、StaticContent 選択には未使用。

### 4.2 最小変更の切替点

**推奨:** `buildAiEvaluationPackage` 内の 4 呼び出しを  
`resolveAiEvaluationStaticContent(milestoneType)` に置換。

```text
milestone_type ∈ {form3_progress, form3_complete}
  → Form3 StaticContent
それ以外（form2 / final※ / custom※ / 欠落）
  → 現行 Form2 StaticContent（不変）
```

※ `final` / `custom` で Form3 を主評価にする運用が将来ある場合は未決。当面は **明示の form3_* のみ Form3 政策**とし、それ以外は Form2 経路を維持（67 件安全側）。

### 4.3 Form2 StaticContent を完全不変に保つ方法

- `aiEvaluationPackageStaticContent.ts` の既存関数・文字列・`RUBRIC_FOCUS` を **編集しない**
- Form3 は別ファイル（例: `aiEvaluationPackageStaticContentForm3.ts`）
- Form2 回帰テスト（`aiEvaluationPolicy2026_4.test.ts`）を実装後も **同一アサーションで緑**をゲートにする

### 4.4 Form3 rubric focus（07 §4 正本）

7 key **名・ラベル・score 1–5 は不変。** `focus` 文のみ Form3 用に定義する。

| key | Form3 focus（設計） |
|-----|---------------------|
| `information_gathering` | ①情報整理。11 パターンを患者を見るレンズとして必要情報を整理しているか。情報量・分類完全一致・①だけで深い解釈を求めない。複数パターンにまたがる情報を許容。 |
| `relating_information` | ②。複数情報を関連づけているか。同一文面内の併記だけでは関連づけとしない。 |
| `interpretation_analysis` | ②。現在起きていること・なぜ起きている可能性・意味を、断定に固定せず考えているか。今後の可能性への言及もここに含み得る。 |
| `clarity_of_evidence` | ②。解釈・判断が提出された患者情報（主に Final、補助として Cards）に基づいているか。 |
| `awareness_of_gaps` | ②および深化。不足情報・別可能性・不確実性・「判断に追加情報が必要」の適切な認識。 |
| `patient_understanding` | ②。関連づけた情報から患者の状態を捉えているか。空欄は能力断定禁止。 |
| `overall_integration` | ③および深化。**患者理解から必要な看護へ論理的に展開**し、必要に応じて理解を更新できているか。看護行為・教科書的看護の羅列だけでは高評価にしない。 |

Form2 側の focus 文字列は **一字も変更しない。**

### 4.5 Form3 prohibited / allowed（feedback）

**Allowed（学生 FB / Coach）**

- 学生が書いた看護・援助の必要性の **根拠を問い返す**
- 必要な看護を考えるための **問い**
- 不足情報・別可能性・不確実性への気づき促進
- 「提出からは確認できない」表現

**Prohibited（学生向け出力）**

- AI が看護計画を完成させる  
- 具体的援助・観察項目の **正解一覧**  
- 教員模範 / Gold 不足項目の学生転記  
- 単一解釈を唯一の正解とする断定  
- 空欄＝能力不足の断定  
- 文章量・用語数・カード数・看護行為数による加点示唆  

**教員向け `teacher_observation`:** Gold 比較・横断観察は可（学生返却対象外は共通アーキテクチャどおり）。

### 4.6 progress / complete で StaticContent を分けるか

| 層 | 推奨 |
|----|------|
| `compass_policy`（上位三軸・禁止・Gold） | **共通**（Form3 1 本） |
| `rubric.items[].focus` | **共通**（上表） |
| `evaluation_instructions` | **段階オーバーレイ**で差分 |
| 完全に別ファイルを 2 本 | 非推奨（重複とドリフト） |

オーバーレイ例:

- `form3_progress`: 形成的。未完成を過度減点しない。現到達の一つ先を問う。③は「芽が出ていれば認め、完成を強制しない」。  
- `form3_complete`: 総括寄り。①→②→③→深化の到達像を見る。

### 4.7 Gold 宣言の共通化

- `AI_EVAL_GOLD_DECLARATION`（現行 Form2 モジュールの定数）を **共有参照**可能。  
- 文言は `02` / `07` §9 と同趣旨のため **改変不要。**  
- Form3 StaticContent は当該定数を import するのみ（Form2 focus 等は触らない）。

### 4.8 package / result schema を変えずに可能か

**可能。**  
`compass_policy` / `rubric` / `evaluation_instructions` は既に自由形状のオブジェクトとして package に載る。7 `rubric_key` enum は維持。result の `item_evaluations` も現行のまま。

任意メタ（スキーマ必須化しない）:

- instructions 内に `evaluation_stage: "form3_progress" | "form3_complete"`  
- policy 内に `form3_policy_doc: "07"`  

**実装記録（S1）:** Form2 は `compass_policy_version` **2026.4**、Form3（`form3_progress` / `form3_complete`）は **2026.5**。package metadata・request・`compass_policy.version` は同一 helper で揃える。JSON Schema は変更しない。

---

## 5. Required scope 設計

### 5.1 原則（07 §5 + artifact registry）

- snapshot 保存は破壊しない。制御は **AI package 投影時**  
- Final = 主評価対象  
- Cards = 補助証拠  
- Form2 情報を **無条件に**評価対象へ混ぜない  
- 11 横断評価に必要な Final（対象パターン）を保持  
- 不必要データを送らない  

### 5.2 `AssessmentSubmissionScope` で表現できるもの / できないもの

既存フラグ:

`includeForm2`, `includeForm3`, `form3Scope`, `includeInformationCards`, `includeEvidenceLinks`, `includeFieldReflections`, `includePatientUnderstanding`

| 対象 | 既存 scope で表現 | 備考 |
|------|-------------------|------|
| Form3 全体の on/off | ✅ `includeForm3` | |
| パターン限定 | ✅ `form3Scope` | filter 仕様は §6 |
| トップレベル notebook `information_cards` | ✅ `includeInformationCards` | **Form3 内カードとは別物** |
| Form2 / reflections / PU / evidence_links | ✅ 各フラグ | |
| Form3 `finalForm` only vs cards only | ❌ | scope にサブフラグ無し |
| Assessment vs Information Cards の個別 on/off | ❌ | 同上 |
| Gold | （scope 外） | package 常時。教員比較。送信「学生提出」ではない |

**設計方針:**  
公開 scope は既存型のまま。Final=主 / Cards=補助は  

1. StaticContent で評価上の優先順位を指示し、  
2. 投影時は `includeForm3=true` のとき **finalForm + cards を両方残す**（Cards を落とさない＝補助証拠を保持）、  
3. Form3 内部の「主/補助」は政策文で固定する。  

Cards を物理削除するモードは **作らない**（07 の補助証拠と矛盾しやすい）。  
将来サブフラグが必要なら schema 拡張が要る → 当面 **不要（カテゴリ 2: 内部実装のみ）**。

### 5.3 推奨 FORM3 required scope

#### 共通（progress / complete）

| フラグ | 値 | 理由 |
|--------|-----|------|
| `includeForm3` | `true` | 必須 |
| `includeForm2` | `false` | 無条件混入防止。参照が必要な個別運用は DB scope で明示 ON＋政策で「参照」と書く（デフォルト強制は OFF） |
| `includeFieldReflections` | `false` | Form2 段階材料 |
| `includePatientUnderstanding` | `false` | Form3 主戦場は Final。PU はデフォルト除外（必要時のみ DB で ON） |
| `includeInformationCards` | `false` | ノートブック横断カード。Form3 内カードとは別 |
| `includeEvidenceLinks` | `false` | 現行どおり AI 根拠に使わない |
| `form3Scope` | マイルストーン設定に従う | progress は selected が多い。complete は all が多い（現行 default と整合） |

`resolveScopeForAiEvaluationPackage("form3_*")` は Form2 と同様、DB と required の差分を **補正＋警告**（黙って隠さない）。

**実装記録（S2）:** `FORM3_AI_EVAL_REQUIRED_SCOPE` を追加。`includeForm3` 必須 ON。notebook `includeInformationCards` / `includeEvidenceLinks` は AI 投影で常に OFF。`includeForm2` / `includeFieldReflections` / `includePatientUnderstanding` はデフォルト OFF・required ではなく、DB で true なら明示 opt-in として保持（警告付き）。`form3Scope` は DB を保持。`defaultScopeForType(form3_*)` も同方針に揃えた（milestone 作成デフォルト。snapshot 形式は不変）。

#### progress と complete の差

| | `form3_progress` | `form3_complete` |
|--|------------------|------------------|
| scope 必須セット | 上記共通 | 上記共通 |
| `form3Scope` 典型 | `selected_patterns`（課題がそう設定） | `all_patterns` |
| StaticContent | 形成的オーバーレイ | 総括オーバーレイ |
| Cards | 両方残す（補助） | 両方残す（補助） |
| Final | 主（選択パターン） | 主（全パターン） |

**結論:** scope の差は主に `form3Scope`（パターン範囲）。到達期待の差は **StaticContent 必須**。両方使う。

### 5.4 Form3 ペイロード内部（投影ルール）

`includeForm3=true` のとき `student_submission.form3` に含める既知キー（allowlist）:

- `schemaVersion`, `patientId`, `updatedAt`（匿名化済み）  
- `finalForm`（filter 後）  
- `informationCards`（filter 後）  
- `assessmentCards`（filter 後）  
- `workspacePatternFlags`（filter 後）  

含めない / strip:

- `migration`, `v1Backup`  
- 未知キー（artifact registry）  
- 選択外パターンの Final エントリ（selected 時）

---

## 6. Pattern filter 仕様

実装箇所（予定）: `aiEvaluationPackageSubmission.ts` の `filterForm3BySelectedPatterns`（全面見直し）。

### 6.1 モード

#### A. `form3Scope` なし / `all_patterns` / selected だが `patternIds` 空

→ Form3 既知構造を **全体対象**（ただし未知キーは strip）。  
意味: **11 パターン横断評価**（または課題が全パターン）。

#### B. `selected_patterns` かつ `patternIds.length >= 1`

→ 選択パターンに関連する情報のみ。  
意味: **限定評価**（途中提出・一部パターン課題）。横断は「選択集合の内側」でのみ見る。

### 6.2 要素別ルール（B のとき）

| 要素 | 保持条件 |
|------|----------|
| `informationCards` | `patternKeys[]`（V2）のいずれか ∈ selected。**または** 互換のため単数 `patternKey` / `pattern_key` ∈ selected |
| `assessmentCards` | `patternKey`（または `pattern_key`）∈ selected |
| `finalForm` | **selected の key のみ**を残す（他 key は削除）。オブジェクト形は維持 |
| `workspacePatternFlags` | selected の key のみ |

### 6.3 マルチタグ informationCard

`patternKeys` が `[sleep_rest, activity_exercise]` で selected が `[sleep_rest]` のみ → **保持**（いずれか一致）。

### 6.4 パターン情報を持たないデータ

| ケース | 方針 |
|--------|------|
| カードに `patternKeys` も `patternKey` も無い | **AI へ forward しない（落とす）** |
| `finalForm` の未知キー | 落とす |
| Form3 ルートの未知フィールド | allowlist 外は strip |

※現行実装は「パターン未設定カードは残す」。本設計は artifact registry の unknown 方針に合わせ **落とす**へ変更する（仕様として明示。実装 Step で回帰テスト必須）。

**実装記録（S3）:** `aiEvaluationForm3PatternFilter.ts` の `filterForm3ForAiEvaluation` で投影時のみ絞る。`patternKeys[]` / `finalForm` / flags 対応。selected+[] は空（all と解釈しない）。入力 mutation なし。

**実装記録（S3.1）:** Form3 の `case_context.excluded_from_evaluation` を 2026.5 用に分離（Form2 配列は不変）。selected_patterns 時のみ `evaluation_stage.pattern_evaluation_scope` で限定評価を明示。

### 6.5 横断評価 vs 限定評価

| | 全体（A） | 限定（B） |
|--|-----------|-----------|
| 目的 | パターンを越えた患者理解の芽を見る（07 §8） | 指定パターンでの思考過程 |
| Final | 11 キー | 選択キーのみ |
| カード | 全（パターン付き） | 選択に関連するもの |
| 「関連図完成」 | 評価しない（07） | 評価しない |

### 6.6 現行バグとの差分（実装時に直す点）

1. V2 `patternKeys[]` 未対応 → 対応必須  
2. `finalForm` 未フィルタ → selected 時はフィルタ必須  
3. パターン無しカードを残す → **strip に変更**（契約優先）

---

## 7. progress / complete 差分（まとめ）

| 手段 | progress | complete | 必要か |
|------|----------|----------|--------|
| StaticContent instructions オーバーレイ | 形成・一つ先・未完成寛容 | ①→②→③→深化 | **必須** |
| required scope セット | 共通（Form3 ON、Form2/PU/notebook カード OFF） | 同じ | 共通で可 |
| `form3Scope` | 多くの場合 selected | 多くの場合 all | DB 設定＋補正 |
| 別 StaticContent ファイルを 2 本 | — | — | **不要** |

新しい milestone 種別の追加はしない。

---

## 8. Schema compatibility

| 対象 | 分類 | 説明 |
|------|------|------|
| AI package schema | **1. 変更不要** | 自由オブジェクト＋既存キーで足りる |
| AI result schema | **1. 変更不要** | 7 key 維持。上位三軸は schema に足さない（07） |
| Scope 型 / DB milestone scope | **1. 変更不要**（当面） | サブフラグ無しで政策＋投影で表現 |
| milestone enum | **1. 変更不要** | 既存 `form3_progress` / `form3_complete` |
| Validator（result） | **1. 変更不要** | milestone 非依存のまま可 |
| Batch export/import | **2. 内部実装のみ** | Builder/scope/filter 経由。ZIP 形不変 |
| Staging / adoption | **1. 変更不要** | |
| Form2 StaticContent / 02 | **1. 変更不要** | |
| compass_policy_version 文字列の Form3 専用化 | **2. 内部実装のみ**（S1 で 2026.5 採用・schema 不変） | request 相対照合のため schema/validator 変更なし |
| Scope に final/cards サブフラグ追加 | **3. が必要になる案**（不採用推奨） | 当面採用しない |

**後方互換最優先:** Form2 milestone の export バイト列・政策文・67 件 staging を変えない。

---

## 9. Regression test matrix（設計のみ・コードなし）

| ID | ケース | 期待 |
|----|--------|------|
| T1 | Form2 package 完全不変 | 2026.4 テスト・StaticContent 文字列・required scope が現行どおり |
| T2 | form3_progress StaticContent | Form3 focus / 形成的指示。Form2「看護評価しない」文言が混入しない |
| T3 | form3_complete StaticContent | 総括オーバーレイ。overall_integration が③の意味 |
| T4 | selected なし / all_patterns | Form3 全体。finalForm 11 キー |
| T5 | selected 1 件 | finalForm 1 キー。他パターン削除 |
| T6 | selected 複数 | 該当キーのみ |
| T7 | multi-tag informationCards | いずれか一致で保持 |
| T8 | assessmentCards filter | patternKey 一致のみ |
| T9 | finalForm filter | §6.2 |
| T10 | workspacePatternFlags filter | §6.2 |
| T11 | パターン無しカード | strip |
| T12 | 未知 Form3 ルートキー | strip |
| T13 | 11 パターン全体評価 | all_patterns で Cards+Final 残存 |
| T14 | Gold policy | 宣言共通。学生 FB に Gold 転記禁止が指示に含まれる |
| T15 | Coach が看護を答えない | 禁止リストに計画完成・援助一覧 |
| T16 | 学生の看護への展開は評価可 | overall_integration / ③の focus に明記。Form2 禁止との混同なし |
| T17 | package/result shape | assertAiEvaluationPackageShape / result validate 緑 |
| T18 | Form2 resolve 非干渉 | form3 milestone で FORM2_AI_EVAL_REQUIRED_SCOPE に上書きされない（既存 matrix 拡張） |
| T19 | Form2 include が false に補正 | form3 AI resolve 後 |

---

## 10. production 67 件への影響

| 項目 | 影響 |
|------|------|
| 既存 staging / request / audit | **なし**（実装してもデータ改変不要） |
| 再 Export しない限り package | **なし** |
| Form2 再 Export | StaticContent 分岐が form2 なら **現行と同一**であるべき（T1） |
| Form3 未使用学期 | コード追加のみで運用影響なし |

---

## 11. 実装時のリスク

1. PackageBuilder の分岐漏れで Form3 に Form2 政策が載る  
2. pattern filter 変更で progress のカードが消えすぎる / 残しすぎる  
3. 「パターン無しは残す」→「落とす」の挙動変更に対する教員期待差  
4. `includeForm2=false` 補正が、Form2 参照を望む個別マイルストーンと衝突（警告必須）  
5. Form3 focus が Form2 ファイルへ誤って書き込まれる  
6. compass_policy_version を不用意に変えて validator warning が増える  
7. top-level `includeInformationCards` と Form3 内 cards の混同  

---

## 12. 実装 Step 分割（推奨）

| Step | 内容 | 本番 67 |
|------|------|---------|
| **S1** | Form3 StaticContent 新ファイル + PackageBuilder 切替 + T1/T2/T3/T14–T17 | 影響なし（form2 不変確認） |
| **S2** | FORM3 required scope + resolve 分岐 + T18/T19 | 影響なし |
| **S3** | pattern filter 改修（patternKeys / finalForm / strip）+ T4–T13 | 影響なし |
| **S4** | progress/complete instructions オーバーレイの仕上げ + 文書リンク（architecture に 07/08 追記は任意） | 影響なし |
| **S5** |（別判断）実 Form3 コホートでの試験 Export。**67 件は触らない** | 別コホートのみ |

各 Step 後に Form2 回帰（policy 2026.4 + scope matrix）を必須ゲートとする。

---

## 付録. 報告サマリ（要求 G）

### 1. 推奨実装構造
PackageBuilder で StaticContent 切替。scope は `resolveScope` に Form3 枝。filter は `prepare` 内。Form2 モジュール不変。

### 2. 変更予定ファイル
Builder、新規 Form3 StaticContent、`submissionScope`、`aiEvaluationPackageSubmission`、新規テスト。

### 3. 変更不要
`02`、Form2 StaticContent 文言、JSON Schema、staging/adoption、DB、67 件、`07` 教育本文。

### 4–9
本文 §4〜§9。

### 10. production 67
設計上 **影響なし**（Form2 経路維持が前提）。

### 11–12
本文 §11〜§12。

---

## 確認

- **変更したコード：なし**（本ファイル＝設計文書の追加のみ）  
- **DB 変更：なし**  
- **production data 変更：なし**  

改訂: `form3-impl-design-1` / 2026-09-02
