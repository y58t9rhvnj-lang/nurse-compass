# 21. Assessment 成果物レジストリ契約（Snapshot / Scope）

Status: **契約（Version 2.2・実装前の設計固定）**  
Scope: `AssessmentSubmissionSnapshot` と `AssessmentSubmissionScope` における学習成果物（artifact）の扱い  
非対象: 関連図 UI、関連図 graph schema、AI 関連図評価、DB migration、TypeScript 実装

関連:

- 全体アーキテクチャ: `01_architecture.md`
- UI / Workspace: `13_ui_architecture.md`
- Form3 と関連図の原子: `20_form3_v2_redesign.md` §8（Information Card = ノード候補。本契約は Assessment 側の格納・配信境界）
- AI パッケージ: `ai/01_ai_evaluation_package_spec.md`
- AI 方針: `ai/02_ai_evaluation_policy.md`
- AI アーキテクチャ: `ai/architecture.md`

現行コード正本（参照のみ・本契約は破壊しない）:

- `lib/v2/assessment/types.ts`（`AssessmentSubmissionSnapshot` / `AssessmentSubmissionScope`）
- `lib/v2/assessment/snapshotBuilder.ts`
- `lib/v2/assessment/aiEvaluationPackageSubmission.ts`

---

## 1. 基本原則

1. **snapshot は提出時点の学習成果物を保持する**  
   `assessment_submissions.snapshot` は、提出操作時点の各成果物ヘッド（または提出時に確定した写し）を残す。後からのノート編集で過去提出を書き換えない。

2. **UI 表示対象と AI 評価対象は submission scope で制御する**  
   マイルストーンに紐づく `AssessmentSubmissionScope` が、教員レビュー UI で何を主表示するか、および AI Package に何を載せるかの制御面である。

3. **「snapshot に格納する」ことと「AI package に含める」ことを同義にしない**  
   格納（storage）と配信（delivery / AI export）は別レイヤとする。格納されていても scope 外なら AI に送らない。AI に送るものは、原則として snapshot に存在する既知 artifact からのみ取り出す。

4. **既存 snapshot 互換性を壊さない**  
   既に提出された JSON の既知キー・意味を変更・削除・型破壊しない。追加は後方互換（optional キー）に限る。

5. **既存提出データの破壊的 migration は禁止**  
   本番・学期中データの一括変換、キー改名、必須化による読取不能化は行わない。必要なら読取側で欠落を許容する。

---

## 2. Artifact レジストリ

### 2.1 用語

| 用語 | 意味 |
|------|------|
| artifact | Assessment が独立した学習成果物として扱う単位 |
| domain owner | 編集・永続の主モジュール（Assessment は提出時に写しを取る） |
| snapshot key | `AssessmentSubmissionSnapshot` 上のキー（camelCase） |
| AI package key | `student_submission` 上のキー（snake_case） |
| scope flag | `AssessmentSubmissionScope` 上の include フラグ |
| citation namespace | AI Result の `citations[].field_path` の接頭辞 |

### 2.2 一覧（現行 + 将来）

| artifact | domain owner（現行想定） | snapshot key | AI package key | scope flag | citation namespace |
|----------|--------------------------|--------------|----------------|------------|-------------------|
| 様式2 | `lib/form2` + `lib/v2/notebook/form2*` | `form2` | `form2` | `includeForm2` | `student_submission.form2.*` |
| 様式3 | `lib/form3` + `lib/v2/notebook/form3*` | `form3` | `form3` | `includeForm3`（+ 任意 `form3Scope`） | `student_submission.form3.*` |
| 情報カード | Information Notebook / Form3 周辺のカード永続 | `informationCards` | `information_cards` | `includeInformationCards` | `student_submission.information_cards`（+ `anonymous_object_id` 等） |
| フィールド振り返り | Form2 フィールド振り返り（キーは Form2 フィールド） | `fieldReflections` | `field_reflections` | `includeFieldReflections` | `student_submission.field_reflections` |
| 患者理解 | 患者理解モジュール | `patientUnderstanding` | `patient_understanding` | `includePatientUnderstanding` | `student_submission.patient_understanding.*` |
| 様式2 Evidence リンク | Form2↔Evidence リンク | `form2EvidenceLinks` | `evidence_links` | `includeEvidenceLinks` | （現行 Form2 AI 方針では評価根拠に使わず、package 上は空配列維持） |
| **関連図（将来）** | 関連図ドメイン（未実装・独立モジュール想定） | `relatedDiagram`（予定） | `related_diagram`（予定） | `includeRelatedDiagram`（予定） | `related_diagram.*` または `student_submission.related_diagram.*`（実装時に一方へ固定） |

補足:

- `fieldReflections` は **独立 artifact** とする。内容のキー空間は Form2 由来でも、Form2 本体に埋め込まない。
- `informationCards` は関連図ノードの原子候補になり得る（`20_form3_v2_redesign.md`）が、**関連図そのものではない**。
- `sourceVersions` は成果物本体ではなく、提出時の版メタデータ（現行: `form2` / `form3` / `patientUnderstanding`）。将来 artifact 追加時は **optional 拡張**とし、破壊的必須化はしない。

### 2.3 命名規則

| 層 | 規則 | 例 |
|----|------|-----|
| TypeScript snapshot | camelCase | `patientUnderstanding`, `relatedDiagram` |
| AI package JSON | snake_case | `patient_understanding`, `related_diagram` |
| Scope flags | `include` + PascalCase artifact | `includePatientUnderstanding`, `includeRelatedDiagram` |
| Citation | package キーに整合する path | `student_submission.form2.basicInformation.chiefComplaint` |

未知の snapshot キーを見つけても、**レジストリ未登録のまま AI package へ自動転送しない**（§4）。

---

## 3. relatedDiagram（将来・仮契約）

関連図は **Form3 の一部ではない**。Form2 / Form3 / 情報カードと並ぶ **第一級 artifact** とする。

### 3.1 仮契約（スキーマ未定義）

```text
snapshot:
  relatedDiagram?: <RelatedDiagramSnapshot | null>  // 形状は未定義

scope:
  includeRelatedDiagram?: boolean                   // 欠落時は false 扱い

AI package student_submission:
  related_diagram?: <anonymized related diagram | null>

citation namespace:
  related_diagram.*
  （または student_submission.related_diagram.* — 実装時に単一化）
```

### 3.2 固定する判断

- 関連図データを `form3` JSON の内部フィールドとして格納しない。
- 関連図マイルストーンでも、必要なら Form2/Form3 を **参照用に scope で含める**ことは許すが、関連図本体の正本は `relatedDiagram` とする。
- Information Card ID をノード参照に使うことは設計上あり得るが、カード一覧の格納先は引き続き `informationCards`（または Form3 内カード）であり、グラフ構造の格納先は `relatedDiagram` とする。

### 3.3 いま定義しないこと

- ノード / エッジの graph schema
- Canvas UI / Workspace
- AI による関連図評価ルーブリック
- DB テーブル設計・migration

---

## 4. Storage / Delivery 原則

| 関心 | 原則 |
|------|------|
| Storage（snapshot） | 提出時点の状態を保持する。現行実装はマイルストーン種別に依らず、ビルダーが収集した既知成果物を写してよい（「全部入れる」方針と両立）。 |
| Delivery — AI Export | `submissionScope`（および Form2 AI 等の政策補正後 scope）に従い、**許可された既知 artifact のみ**を `student_submission` へ投影する。 |
| Delivery — Teacher UI | マイルストーン scope に従い主タブ・主表示を決める。snapshot に存在しても scope 外は主評価対象にしない（参照表示の可否は UI 仕様で別途）。 |
| Private / 除外 | `private_note`、学生非公開メモ、検証用アカウント、PII 生値は AI package に載せない（既存 AI 方針に従う）。 |
| 未知 artifact | レジストリ未登録キーは AI へ送らない。読み飛ばしまたは警告に留め、黙って転送しない。 |
| Evidence links | snapshot には `form2EvidenceLinks` を保持し得る。現行 Form2 AI では package の `evidence_links` を **常に空配列**としキー形のみ維持する（政策）。 |

図式:

```text
Notebook / Learning domain
        │ 提出時コピー
        ▼
AssessmentSubmissionSnapshot   ←── storage（互換必須）
        │
        │  scope + 政策フィルタ
        ▼
AI student_submission / Teacher UI  ←── delivery
```

---

## 5. Milestone との関係（例）

例は **教育上の既定イメージ**であり、DB 上の個別マイルストーン scope が最終正である。

| milestone 種別（例） | 主 artifact（scope on を想定） | 参照として on にし得るもの | 備考 |
|----------------------|--------------------------------|----------------------------|------|
| `form2` | `form2`, `fieldReflections`, `patientUnderstanding` | （通常）Form3 / cards / evidence は AI 政策で off になり得る | 現行 Form2 AI required scope と整合する想定 |
| `form3_progress` / `form3_complete` | `form3`, `patientUnderstanding` | 必要なら `form2` | Form3 AI 政策は未正式化。本契約は差し込み口のみ固定 |
| `final` / `custom` | マイルストーン scope に従う | 同上 | 種別名だけで成果物を断定しない |
| 関連図マイルストーン（将来） | `relatedDiagram` | 必要なら `form2` / `form3` / `informationCards` | **関連図は常に独立 artifact** |

原則:

- milestone type は「どの既定 scope を勧めるか」のヒントである。
- 実データ上の include フラグが Delivery の正本である。
- ある成果物を参照表示するために、それを他成果物の内部へ埋め込まない。

---

## 6. Versioning 方針（方針のみ）

| 対象 | 現行 | 方針 |
|------|------|------|
| Snapshot 全体 | `ASSESSMENT_SNAPSHOT_SCHEMA_VERSION = 1`（`schemaVersion`） | **いまは変更しない**。後方互換な optional キー追加は schemaVersion を上げずに許容する。 |
| 個別 artifact | `sourceVersions` の一部のみ | 将来、artifact ごとに独立した schema/version が必要なら `sourceVersions` の optional 拡張または artifact 内 `schemaVersion` で表現する。一括破壊的 bump はしない。 |
| AI package / result | `package_schema_version` / `result_schema_version` = 1 | 関連図を AI に載せる段階で必要なら package schema を **明示 bump**する。snapshot schema と自動同一視しない。 |
| Policy / rubric | compass 2026.4 / rubric 3 | artifact 追加と政策版は独立。政策変更時は既存 AI 版管理に従う。 |

互換ルール:

- 古い snapshot（`relatedDiagram` なし）を読めること。
- 新しい読取コードは欠落キーを `null` / 空 / 非表示として扱うこと。
- 「キー改名」は schemaVersion メジャー相当であり、本契約では禁止（alias 層が無い限り）。

---

## 7. 非目標（いま行わない）

- graph DB 導入
- 関連図 UI / Canvas 設計の詳細
- AI 関連図評価（ルーブリック・Export/Import）
- DB migration（列追加・データ変換）
- TypeScript の型追加・ビルダー実装・scope フラグ実装

本ドキュメントは **契約の固定**のみを目的とする。

---

## 8. 決定事項 / 未決定事項

### 8.1 決定事項

1. Snapshot storage と AI/UI delivery は分離する。
2. 成果物は第一級 artifact としてレジストリ管理する。
3. 関連図は Form3 埋め込みではなく独立 artifact とする。
4. 既存 snapshot の破壊的変更・破壊的 migration は禁止する。
5. 未知 artifact を AI へ自動送信しない。
6. 当面 `ASSESSMENT_SNAPSHOT_SCHEMA_VERSION` は 1 のままとする。

### 8.2 未決定事項

1. `relatedDiagram` の具体的 JSON / graph schema
2. citation を `related_diagram.*` にするか `student_submission.related_diagram.*` に統一するか
3. 関連図マイルストーンの `AssessmentMilestoneType` 値（新 enum vs `custom`）
4. `sourceVersions.relatedDiagram` の型（number / string / object）
5. Teacher UI で scope 外 artifact を「参照タブ」として出すか隠すか
6. snapshot ビルダーを「常に全既知成果物収集」から「登録制コレクタ」へ何時切り替えるか
7. Form3 AI / 関連図 AI の政策本文と required scope

---

## 9. 今後コードへ反映が必要な箇所（実装時チェックリスト）

実装は別タスク。反映時の主な接点:

| 領域 | ファイル（現行） | 反映内容 |
|------|------------------|----------|
| 型 | `lib/v2/assessment/types.ts` | optional `relatedDiagram` / `includeRelatedDiagram`（追加時） |
| 構築 | `snapshotBuilder.ts` | レジストリに沿った収集。Form3 内へ関連図を埋め込まない |
| 読取 | `snapshotReadModel.ts` | 欠落許容。included artifacts 表示 |
| UI | `SnapshotReadonlyPanels.tsx`, Teacher/Student review | scope に応じたタブ。関連図は独立タブ |
| AI 投影 | `aiEvaluationPackageSubmission.ts` | known keys のみ。`related_diagram` はフラグ ON 時のみ |
| 匿名化 | `aiExportAnonymize.ts` | 関連図用 anonymize（導入時） |
| 政策補正 | `submissionScope.ts` | milestone 種別ごとの required scope（Form3/関連図は将来） |
| Citation | `aiEvaluationCandidateUiLabels.ts` 等 | namespace 表示名 |
| Docs / schema | `docs/version2/ai/*`, package schema / samples | package に載せる段階で更新 |
| テスト | scope×milestone 行列、未知キー非転送、旧 snapshot 読取 | 回帰 |

---

## 10. 改訂

| 版 | 日付 | 内容 |
|----|------|------|
| 2026.4-contract-1 | 2026-09-02 | 初版。関連図仮契約と storage/delivery 分離を固定 |
