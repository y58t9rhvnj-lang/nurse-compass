# Compass Domain Language（共通用語）

- 文書種別: **Ubiquitous Language**（設計・コード・DB・UI・教育・AI・ドキュメントの共通語）
- 上位文書: `00_compass_vision.md` / `01_compass_core_architecture.md`
- ブランチ前提: `feature/version2-form3`
- 状態: **設計ドラフト（レビュー待ち）**
- 制約: 本ドキュメント作成時にアプリコード・DB・Migration・`.cursor/rules` は変更しない

---

## 0. 基本方針

この文書は Compass の **Ubiquitous Language** である。単なる用語集ではなく、次で同じ意味で使う正式な言葉を定義する。

- 設計
- コード
- DB
- UI
- 教育説明
- AI
- ドキュメント

### 0.1 運用ルール

1. **同じ概念に複数の正式名称を付けない。**  
2. 類似語は「避ける語」として理由付きで列挙する。  
3. 学校指定様式の**印刷・提出上の正式名称**は学校資料を優先する（Compass 内部用語と混同しない）。  
4. 未決の語は推測で確定せず §17 に残す。  
5. Vision / Core Architecture と矛盾する場合は Vision → Core → 本言語の順で整合する。

### 0.2 各用語の記載形式

各用語は次の項目で記載する。

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Canonical English |
| 正式日本語名 | Canonical Japanese |
| 定義 | 一文〜短い段落 |
| 含むもの | 範囲内 |
| 含まないもの | 範囲外 |
| 他概念との関係 | 参照・所属 |
| UI表示名の候補 | 画面用（学校様式名と区別） |
| コード上の推奨名 | TypeScript / 識別子 |
| 使用を避ける類似語・理由 | 禁止・非推奨 |

---

## 1. 最上位概念

### Compass

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Compass |
| 正式日本語名 | Compass（コンパス） |
| 定義 | 患者理解を育て、臨床推論を支援し、その結果として成果物を生み出す Clinical Reasoning Platform。 |
| 含むもの | Core・Modules・教育導線・Coach・Artifact 支援 |
| 含まないもの | 電子カルテそのもの、看護記録ソフト、自動採点システム |
| 他概念との関係 | Vision の主体。Product Version のブランド名 |
| UI表示名の候補 | Nurse Compass / Compass |
| コード上の推奨名 | （プロダクト名。識別子に無理に埋め込まない） |
| 避ける類似語 | 「看護記録アプリ」「様式入力システム」— 目的を成果物作成に矮小化する |

### Clinical Reasoning Platform

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Clinical Reasoning Platform |
| 正式日本語名 | 臨床推論プラットフォーム |
| 定義 | Compass の製品カテゴリ。思考過程（Information→Assessment→Reasoning）を支え、成果物は結果として扱う。 |
| 含むもの | Core 5層とそれを使う Modules |
| 含まないもの | 単なる LMS、単なる EHR ビューア |
| 他概念との関係 | Compass の種別定義 |
| UI表示名の候補 | （学生向けには「Compass」で足りる） |
| コード上の推奨名 | （ドキュメント用語。コード定数化は任意） |
| 避ける類似語 | 「記録プラットフォーム」— Artifact 中心に聞こえる |

### Learning Workspace

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Learning Workspace |
| 正式日本語名 | ラーニング・ワークスペース |
| 定義 | 学生が患者理解を深めるための作業空間。提出様式そのものではない。 |
| 含むもの | Information / Assessment の編集、一次情報参照、問い |
| 含まないもの | 学校提出の最終様式画面そのもの（それは Artifact UI） |
| 他概念との関係 | Module が提供する体験の総称。Core の上に載る。製品カテゴリは Clinical Reasoning Platform |
| UI表示名の候補 | ワークスペース / 思考ワークスペース / アセスメント・ワークスペース |
| コード上の推奨名 | `LearningWorkspace` / `*Workspace` |
| 避ける類似語 | 「入力フォーム」「提出画面」— Workspace と Artifact の混同；**Learning Platform**（旧 Vision 表現・非推奨。Learning Workspace に統一）；**Clinical Workspace**（正式名にしない） |

### Patient Understanding

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Patient Understanding |
| 正式日本語名 | 患者理解 |
| 定義 | 学生が患者について形成していく理解そのもの。一度で完成せず、更新され続ける学習対象。 |
| 含むもの | Information・Assessment・Clinical Reasoning を通じた理解の深化 |
| 含まないもの | 特定の DB テーブル名、単一テキスト欄への固定 |
| 他概念との関係 | Compass の目的語。Artifact はその表現の一部 |
| UI表示名の候補 | 患者理解 / （振り返り Artifact のタイトル例は Module） |
| コード上の推奨名 | `PatientUnderstanding`（概念）。特定テーブルと1:1固定しない |
| 避ける類似語 | 「患者理解度スコア」— 点数化は Vision に反する |

### Clinical Reasoning

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Clinical Reasoning（層名）／**Clinical Reasoning Network**（同層の構造名） |
| 正式日本語名 | 臨床推論／臨床推論ネットワーク |
| 定義 | Assessment 同士や Information との関係を構造化し、優先・病態理解・看護問題につながる推論の層（Core）。構造としては Node＋Edge の Network。 |
| 含むもの | Reasoning Node / Edge、関係の種類、短い rationale、Network としての関係集合 |
| 含まないもの | 関連図の座標・色・折りたたみ、完成した看護問題文（Artifact） |
| 他概念との関係 | Core 第4層。**Related Map Module** が表示する。層名と Network は同一層の呼び分けであり別層ではない |
| UI表示名の候補 | 臨床推論 / 患者理解を関連付ける |
| コード上の推奨名 | `ClinicalReasoning` / `ClinicalReasoningNetwork` / `ClinicalReasoningEdge` |
| 避ける類似語 | 「関連図」を Core 名に使うこと — Module と混同する；Assessment を Clinical Reasoning と呼ぶこと — 点と関係の混同 |

### Learning Process

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Learning Process |
| 正式日本語名 | 学習過程 |
| 定義 | 途中の気付き・修正・迷いを含む、患者理解が深まる過程。完成記録だけが評価対象ではない。 |
| 含むもの | Draft、再考、未整理のカード、Coach への応答 |
| 含まないもの | 順位・偏差値・自動合否 |
| 他概念との関係 | Education Principles「学習プロセスの尊重」と一致 |
| UI表示名の候補 | 学習の過程 / 途中の整理 |
| コード上の推奨名 | （概念語） |
| 避ける類似語 | 「未完成＝失敗」— 未完成を否定する表現 |

### Core

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Core（Compass Core） |
| 正式日本語名 | コア |
| 定義 | Patient / Information / Assessment / Clinical Reasoning / Artifacts の5層からなる推論の骨格。 |
| 含むもの | 層の責務・ID・参照・所有 |
| 含まないもの | 特定様式のレイアウト、Module の UI 状態 |
| 他概念との関係 | Modules が依存する。Core Version の対象 |
| UI表示名の候補 | （学生向けに「コア」と出さないことが多い） |
| コード上の推奨名 | `core/` 名前空間の概念 |
| 避ける類似語 | 「バックエンド全部」— インフラと混同しない |

### Module

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Module（Compass Module） |
| 正式日本語名 | モジュール |
| 定義 | Core の上に載る具体機能（様式2、様式3、関連図UI、Coach 等）。Core を置換しない。 |
| 含むもの | UI、テンプレート、印刷、提出フロー |
| 含まないもの | Core の意味の再定義 |
| 他概念との関係 | Modules → Core のみ依存 |
| UI表示名の候補 | 機能名そのもの（様式3 等） |
| コード上の推奨名 | `modules/*` または既存 `components/v2/*` の論理 Module |
| 避ける類似語 | 「プラグインが Core を上書きする」表現 |

### Artifact

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Artifact |
| 正式日本語名 | 成果物（アーティファクト） |
| 定義 | 患者理解の結果として作る提出・共有用の表現。学校指定様式を含む。 |
| 含むもの | Form2 / Form3 Final / 提出関連図 / 看護計画 等 |
| 含まないもの | Workspace 上の未統合カードそのもの |
| 他概念との関係 | Core 第5層。Institution-defined Form の入れ物 |
| UI表示名の候補 | 学校様式 / 提出物 / （具体名：様式2） |
| コード上の推奨名 | `Artifact` / `ArtifactRecord` |
| 避ける類似語 | 「成果物＝学習の目的」— 目的は患者理解 |

---

## 2. Patient 領域

### Patient

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Patient |
| 正式日本語名 | 患者 |
| 定義 | 教材上の「人」。思考の主役。 |
| 含むもの | 基本属性、教材としての人格・病いの文脈 |
| 含まないもの | 学生の解釈、提出文 |
| 他概念との関係 | Case の対象。Patient Source Record の束ね役 |
| UI表示名の候補 | 患者名（Aさん 等） |
| コード上の推奨名 | `Patient` / `patientId` |
| 避ける類似語 | Case と同一視する呼び方 |

### Case

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Case |
| 正式日本語名 | ケース（教育ケース） |
| 定義 | 教育上の受け持ち・課題単位。学生思考データの主スコープキー。 |
| 含むもの | `case_id`（例 SP-001）、学年・課題との結び |
| 含まないもの | カルテ本文そのもの |
| 他概念との関係 | 1 Patient に複数 Case を将来許容。当面は固定写像 |
| UI表示名の候補 | （学生には出さず内部／教員向け） |
| コード上の推奨名 | `Case` / `caseId` / DB `case_id` |
| 避ける類似語 | patientId を case の代わりに DB キーにすること |

### Educational Case

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Educational Case |
| 正式日本語名 | 教材ケース |
| 定義 | 実患者ではなく学習用に設計された Case / Patient の総称。 |
| 含むもの | fixture カルテ・会話・架空属性 |
| 含まないもの | 実臨床の個人情報 |
| 他概念との関係 | Patient Layer の運用形態 |
| UI表示名の候補 | 受け持ち患者（教材） |
| コード上の推奨名 | `EducationalCase`（文書）。実装は Case で足りることが多い |
| 避ける類似語 | 「本番患者データ」と混ぜる表現 |

### Patient と Case の違い（要約）

- **Patient** = 誰か（人）  
- **Case** = どの教育課題として受け持つか（スコープ）  
- 現在: UI `patientId`（"A"）⇔ サーバ `case_id`（"SP-001"）は写像。**所有・保存の主キーは case_id**。

### Patient Source Record

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Patient Source Record |
| 正式日本語名 | 患者ソースレコード |
| 定義 | Patient Layer 内の個別一次記録（カルテ1件、会話1ターン、検査1件等）。 |
| 含むもの | 日時・役割・本文または参照・Source Record ID |
| 含まないもの | 学生の Information Card |
| 他概念との関係 | Information Card が参照する元 |
| UI表示名の候補 | カルテの記録 / 会話の発言 等 |
| コード上の推奨名 | `PatientSourceRecord` / `sourceRecordId` |
| 避ける類似語 | Information Card を「ソース」と呼ぶこと |

### Source Record ID

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Source Record ID |
| 正式日本語名 | ソースレコードID |
| 定義 | Patient Source Record の安定識別子。 |
| 含むもの | 教材・CMS で不変な ID |
| 含まないもの | 表示順番号、パターン名 |
| 他概念との関係 | Source Reference に格納 |
| UI表示名の候補 | （非表示） |
| コード上の推奨名 | `sourceRecordId` |
| 避ける類似語 | 一時的な配列 index |

### Patient Context

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Patient Context |
| 正式日本語名 | 患者コンテキスト |
| 定義 | いま学生が考えている Patient + Case + 参照可能な Source のまとまり。 |
| UI表示名の候補 | 受け持ち患者 |
| コード上の推奨名 | `PatientContext` |
| 避ける類似語 | 「セッション全部」 |

### Patient Timeline

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Patient Timeline |
| 正式日本語名 | 患者タイムライン |
| 定義 | Source Record を時系列に並べた患者の経過ビュー（概念／将来UI）。 |
| コード上の推奨名 | `PatientTimeline` |
| 避ける類似語 | Learning Process との混同 |

### Patient Information Source

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Patient Information Source |
| 正式日本語名 | 患者情報源 |
| 定義 | 情報がどこから来たか（カルテ、会話、検査、家族等）の分類。**S/O とは別軸。** |
| コード上の推奨名 | `sourceType`（Information 側） / Source catalog |
| 避ける類似語 | 「情報タイプ」だけで S/O とソースを兼ねること |

**実患者 vs 教材:** Compass 当面は Educational Case のみ。実患者は将来も別境界（Core Architecture §15）。

---

## 3. Information 領域

### Information

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Information |
| 正式日本語名 | 情報（事実情報） |
| 定義 | 患者から得られた事実。解釈を含まない。 |
| 含むもの | 観察・記載・数値・発言などの事実 |
| 含まないもの | 解釈、看護問題、提出文 |
| 他概念との関係 | Information Card として永続化される単位 |
| UI表示名の候補 | 関連する患者情報（事実） |
| コード上の推奨名 | `Information`（層名） |
| 避ける類似語 | Evidence、Observation（総称として曖昧に使う）、Patient Data（Patient Layer 全体と混同） |

### Information Card

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Information Card |
| 正式日本語名 | 情報カード |
| 定義 | 学生が切り出した事実の1単位。 |
| 含むもの | 1事実、S/O、source、参照、patternKeys |
| 含まないもの | 解釈文、classification |
| 他概念との関係 | 複数 Assessment から参照可。関連図ノード候補 |
| UI表示名の候補 | 情報カード / 事実カード |
| コード上の推奨名 | `InformationCard` / DB `information_cards` |
| 避ける類似語 | Evidence Card（**採用しない**。Knowledge Evidence は Evidence Link） |

**必須性質（再掲）:** 1カード1事実／解釈を書かない／元情報参照／複数 Assessment 参照可。

### Fact

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Fact |
| 正式日本語名 | 事実 |
| 定義 | Information の内容特性を説明する語。正式エンティティ名ではない。 |
| コード上の推奨名 | （説明用語。型名にしない） |
| 避ける類似語 | Fact を Information Card の別名にすること — 正式名は Information Card |

### Subjective Information / Objective Information

| 項目 | Subjective | Objective |
| --- | --- | --- |
| 正式英語名 | Subjective Information | Objective Information |
| 正式日本語名 | 主観的情報（S） | 客観的情報（O） |
| 定義 | 情報の**性質**（誰の主観か／観察・測定等の客観か） | 同上 |
| コード上の推奨名 | `soType: "S"` | `soType: "O"` |
| 避ける類似語 | sourceType に S/O を混ぜる |

### Source Type / Source Reference / Source Label

| 用語 | 定義の要約 | コード推奨 |
| --- | --- | --- |
| Source Type | 情報源分類（chart, conversation, lab, …） | `sourceType` |
| Source Reference | 元記録への構造化参照 | `sourceReference` |
| Source Label | UI 用の短い出所表示 | `sourceLabel` |

### Observation / Laboratory Result / Vital Sign / Medication Information / Treatment Information / Family Information / Social Information / Manual Information

これらは **Source Type または内容カテゴリの説明語**であり、Information Card の代替正式名ではない。

| 正式英語名 | 正式日本語名 | 位置付け |
| --- | --- | --- |
| Observation | 観察 | 多くは `sourceType: observation` の Manual／観察事実 |
| Laboratory Result | 検査結果 | `sourceType: lab` |
| Vital Sign | バイタル | `sourceType: vital` |
| Medication Information | 薬剤情報 | `sourceType: medication` |
| Treatment Information | 治療情報 | `sourceType: treatment` |
| Family Information | 家族からの情報 | `sourceType: family` |
| Social Information | 社会・生活背景情報 | `sourceType: social` |
| Manual Information | 手入力情報 | `sourceReference.kind: manual` |

**原則:** エンティティ名は常に **Information Card**。上記は分類ラベル。

---

## 4. Assessment 領域

### Assessment / Assessment Card

| 項目 | Assessment | Assessment Card |
| --- | --- | --- |
| 正式英語名 | Assessment | Assessment Card |
| 正式日本語名 | アセスメント | アセスメントカード |
| 定義 | 事実に基づく学生の思考（層） | その永続単位 |
| 含むもの | 解釈、classification、根拠 Information ID | 同左 |
| 含まないもの | 学校提出の完成文そのもの、看護問題の正式文 |
| コード上の推奨名 | （層） | `AssessmentCard` |

**必須性質:**

- 事実ではなく学生の思考  
- 学校提出文ではない  
- 1パターンに複数可  
- 正常・強み・問題・リスク・情報不足が併存可  
- **必ず Information Card を根拠参照**  
- **看護問題（Nursing Problem）と同じではない**

### Interpretation / Analysis

| 用語 | 定義 | コード |
| --- | --- | --- |
| Interpretation | 情報から考えた意味づけ（学生の言葉） | `interpretation` |
| Analysis | Interpretation と同義で使わず、**説明用語に留める**か、UIで「解釈・分析」と併記する学校用語へ合わせる | 学校様式のラベルは学校資料優先 |

### Classification と5区分

| 正式英語名 | 正式日本語名 | コード値 |
| --- | --- | --- |
| Classification | 分類（判断区分） | `classification` |
| Functioning Normally | 正常に機能している | `functioning_normally` |
| Strength | 強みがある | `strength` |
| Problem | 問題がある | `problem` |
| Risk | 問題が生じる可能性がある | `risk` |
| Insufficient Information | 情報不足で判断できない | `insufficient_information` |

色は状態識別用（緑／青／赤／オレンジ／グレー）。テキスト必須。

### Evidence Information

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Evidence Information（参照集合） |
| 正式日本語名 | 根拠情報 |
| 定義 | Assessment が根拠とする Information Card の集合。 |
| コード上の推奨名 | `evidenceInformationIds` |
| 避ける類似語 | Evidence 単体と混同（§5） |

### Care Need / Additional Information Needed / Assessment Status

| 用語 | 定義 | 備考 |
| --- | --- | --- |
| Care Need | 援助の必要性に関する学生の記述 | **Artifact 責務**（学校様式の「援助の必要性」等）。Assessment / Clinical Reasoning Core には置かない（Core Patch） |
| Additional Information Needed | 不足情報・今後確認したいこと（Need More Information） | Assessment 任意フィールド。情報不足時に特に重要 |
| Assessment Status | draft / active / archived / deleted 等 | Module の「整理済み」と混同注意 |

---

## 5. Clinical Reasoning 領域

### Clinical Reasoning（再掲）

Core の関係構造。Related Map ではない。

### Reasoning Node / Reasoning Edge / Relation Type / Rationale

| 用語 | 定義 | コード |
| --- | --- | --- |
| Reasoning Node | 関係の端点参照（Information / Assessment 等の ID） | `ReasoningNodeReference` |
| Reasoning Edge | ノード間の関係1本 | `ClinicalReasoningEdge` |
| Relation Type | 関係の種類 | `relationType` |
| Rationale | その関係を結んだ短い理由 | `rationale` |

### Causal / Temporal / Protective Relationship

説明カテゴリ。初期実装では少数の `relationType` にマップする（supports, contributes_to, worsens, improves, relates_to, requires_more_information 等）。

### Priority / Nursing Relevance

| 用語 | 定義 | 位置 |
| --- | --- | --- |
| Priority | 優先の置き方 | **作業用**＝Clinical Reasoning Network／**提出用**＝Artifact（Core Patch）。Assessment に priority フィールドは置かない |
| Nursing Relevance | 看護上の重要性の認識 | 同上 |

### Reasoning Map / Related Map

| 項目 | Reasoning Map | Related Map |
| --- | --- | --- |
| 正式英語名 | （非推奨・説明用） | Related Map |
| 正式日本語名 | （使わない） | 関連図 |
| 定義 | Clinical Reasoning Network の俗称になりやすいため **正式名にしない** | 関係を表示・編集する **Module** |
| 含むもの | — | 座標・色・折りたたみ・ジェスチャ |
| 含まないもの | — | Core の関係意味の再定義 |
| コード上の推奨名 | — | `RelatedMap` Module |
| 避ける類似語 | Reasoning Map／関連図＝Clinical Reasoning Core | |

**明記:** 座標・色・折りたたみは Module。Clinical Reasoning Network Core には含めない。  
**日本語 UI:** 「関連図」を Related Map の正式日本語 UI 名とする（Core Patch）。

---

## 6. Artifact 領域

### Artifact / Draft Artifact / Final Artifact

| 用語 | 定義 |
| --- | --- |
| Artifact | 成果物全般 |
| Draft Artifact | 編集中・オートセーブ対象の成果物 |
| Final Artifact | 提出・印刷に耐える完成表現（学校様式上の完成に近い状態） |

※「Final Form Text」（様式3内の学校欄）と「Final Artifact」は近いが、後者は提出物一般。

### Submission / Submission Snapshot / Template / Institution-defined Form

| 用語 | 定義 | コード |
| --- | --- | --- |
| Submission | 提出行為・提出状態 | `Submission` |
| Submission Snapshot | 提出時点で Core 参照を固定した写し | `SubmissionSnapshot` |
| Template | 成果物の型 | `ArtifactTemplate` |
| Institution-defined Form | 学校指定様式 | （学校名＋様式名を優先表示） |

**原則:** 学校指定様式は変更しない／自動転記しない／学生が統合／提出時は Snapshot 固定。

### Form2 / Form3

| 用語 | 定義 | 位置 |
| --- | --- | --- |
| Form2 | 精神様式2（学校指定）。全体像の Artifact Module | Artifact |
| Form3 | 精神様式3（学校指定）。Final 欄は Artifact。Workspace は Core 編集 | Module＝Workspace＋Artifact |

### Nursing Problem / Nursing Plan / Reflection Record

| 用語 | 定義 | 注意 |
| --- | --- | --- |
| Nursing Problem | 看護問題（提出・計画に載る表現） | Assessment や classification=problem と同一視しない |
| Nursing Plan | 看護計画 Artifact | |
| Reflection Record | 振り返り記録（Reflection Artifact） | Version2 `patient_understanding_records` の正式位置（Core Patch） |

---

## 7. Evidence と Coach

### Evidence / Evidence Information / Evidence Link

| 用語 | 定義 |
| --- | --- |
| Evidence（Knowledge Evidence） | **Assessment を支える**知識・根拠の結び。Patient の生情報そのものではない |
| Evidence Information | Assessment が根拠とする **Information Card** の集合（`evidenceInformationIds`）。事実側 |
| Evidence Link | Knowledge Evidence と Assessment を結ぶ Module 側リンク |
| Evidence Card | **採用しない**（Core Patch）。UI／オブジェクト名に使わない |

**重要:** Information を Evidence と呼ばない。Evidence（知識）は Information に付けない。  
事実根拠の SSOT は `evidenceInformationIds`（`supports` Edge は導出表示のみ→Related Map 本格時に一本化）。

### Compass Coach / Coach Prompt / Coach Hint / Coach Question

| 用語 | 定義 |
| --- | --- |
| Compass Coach | 問い返す学習支援 Module。答えを書かない |
| Coach Prompt | システムが Coach に与える指示・文脈設定 |
| Coach Hint | ヒント（答えにならない範囲）。多用しすぎない |
| Coach Question | 学生への問い |

参照範囲: Information / Assessment / Clinical Reasoning。  
**Artifact を学生の代わりに完成させない。**

### Learning State / Intervention Level

| 用語 | 定義 | 状態 |
| --- | --- | --- |
| Learning State | 学習の状態表現（過程のどこにいるか） | 詳細スキーマは未決 |
| Intervention Level | Coach／教員介入の強さ | 未決 |

---

## 8. Gordon・様式3用語

### Functional Health Pattern / Pattern Key / Pattern Guide / Assessment Perspective / Information Checklist / Thinking Prompt

| 用語 | 定義 | コード |
| --- | --- | --- |
| Functional Health Pattern | ゴードンの機能的健康パターン | （ガイド用語） |
| Pattern Key | 11パターンの安定キー | `Form3PatternKey` / `patternKey` |
| Pattern Guide | 定義・視点・収集項目の静的ガイド | `Form3PatternDefinition` |
| Assessment Perspective | アセスメントの視点（ガイド） | `assessmentPerspectives` |
| Information Checklist | 情報収集の手がかり（ガイド） | `informationChecklist` |
| Thinking Prompt | 考えるヒント（答えを書かない） | `ThinkingPrompt` |

### Final Information Text / Final Assessment Text

| 用語 | 定義 |
| --- | --- |
| Final Information Text | 学校様式上の「情報（S・O）」欄など、提出用の情報記述 |
| Final Assessment Text | 学校様式上の「解釈・分析・援助の必要性」等の提出用記述 |

**混同禁止:**

| Workspace（内部） | 学校様式（Artifact） |
| --- | --- |
| Information Card | 情報（S・O）欄 |
| Assessment Card | 解釈・分析・援助の必要性 等 |

同じものではない。学生が Workspace を見て様式へ**統合して書く**関係。

---

## 9. 状態・保存用語

| 正式英語名 | 正式日本語名 | 定義 |
| --- | --- | --- |
| Draft | 下書き | 未提出・編集中 |
| Dirty | 未保存の変更あり | ローカル変更がサーバ未確定 |
| Saving | 保存中 | 送信中 |
| Saved | 保存済み | サーバ確定 |
| Error | 保存エラー | 失敗（生DBエラーは出さない） |
| Conflict | 競合 | 楽観ロック不一致 |
| Reviewed | 整理済み／確認済み | Module 定義の一区切り（提出確定と混同注意） |
| Archived | アーカイブ | 論理的に退場 |
| Soft Deleted | 論理削除 | 復元・参照整合用 |

### Version 語の厳格な区別

| 用語 | 意味 | 例 |
| --- | --- | --- |
| **Product Version** | 学生・学校に見える製品版 | Compass 2.1 |
| **Core Version** | 5層内部設計の版 | Core v1 |
| **Schema Version** | JSON／payload 構造の移行番号 | `schemaVersion: 2` |
| **DB version（Optimistic Lock）** | 行の更新回数。競合検出用 | `form3_records.version` |

**同じ「version」を曖昧に使わない。** 文書・コードコメントでは上表のどれかを明示する。

関連:

- Optimistic Lock = DB version による競合制御  
- Schema Version ≠ Optimistic Lock  

---

## 10. 所有・権限用語

| 正式英語名 | 正式日本語名 | 定義 |
| --- | --- | --- |
| User | ユーザー | 認証主体 |
| Student | 学生 | 思考 Core の所有者・編集者 |
| Teacher | 教員 | 同組織閲覧（形成的支援） |
| Staff | 職員 | teacher/admin 等の総称（文脈依存） |
| Administrator | 管理者 | 運用・シード |
| Organization | 組織 | 学校単位 |
| Academic Year | 年度 | 論理分離キー |
| Owner | 所有者 | 通常は学生 user |
| Viewer | 閲覧者 | 教員など |
| Editor | 編集者 | 所有者学生 |
| RLS | 行レベルセキュリティ | DB 強制 |
| Service Role | サービスロール | 管理・移行専用。ブラウザ禁止 |

**明記:** 学生思考データ（Information 以降）と Patient Layer（教材）の権限は異なる。学生は教材を読み、思考を自分だけが編集する。

---

## 11. 避ける表現

| 避ける表現 | 理由 | 推奨表現 |
| --- | --- | --- |
| AIが判断する | 思考の代替 | Coach が問い返す |
| AIがアセスメントする | Assessment の代行 | 学生が Assessment Card を書く |
| 自動で完成する | 未完成の否定・学習過程の否定 | 途中保存しながら深める |
| 正解を表示する | Vision 違反 | 考えるヒント／問い |
| 様式2から様式3へ転記する | 転記禁止 | 一次情報を参照し再整理する |
| 患者理解度を点数化する | 選別・スコア化 | 学習過程を支える |
| InformationをEvidenceと呼ぶ | 層の混同 | Information Card／根拠情報（Assessment の） |
| Assessmentを看護問題と呼ぶ | 概念の飛躍 | Assessment Card／看護問題（Artifact） |
| 関連図そのものを Clinical Reasoning Core と呼ぶ | Module と Core の混同 | Related Map Module／Clinical Reasoning Edge |
| 入力システム | Mission に反する | Learning Workspace / Clinical Reasoning Platform |

---

## 12. 命名規則

### コード（TypeScript）

- `InformationCard`, `AssessmentCard`, `ClinicalReasoningEdge`, `ArtifactRecord`
- `patternKey`, `sourceType`, `soType`, `evidenceInformationIds`
- `schemaVersion`（payload）, 楽観ロックは `recordVersion` またはコメントで `dbVersion` と明示

### DB

- `information_cards`, `assessment_cards`, `clinical_reasoning_edges`, `artifacts`
- 所有列: `user_id`, `organization_id`, `academic_year`, `case_id`
- 楽観ロック列名は `version` 可。文書上は **Optimistic Lock Version** と呼ぶ

### UI（Workspace）

- 情報カードを追加する  
- 情報から考えたこと（Assessment）  
- 患者理解を関連付ける  
- 学校様式へまとめる  

### UI（学校様式）

- 学校資料の正式項目名を優先（例：情報（S・O）、解釈・分析・援助の必要性）

---

## 13. Product / Core / Schema Version（再掲・正式）

| 名称 | 対象 | 例 | 非対象 |
| --- | --- | --- | --- |
| Product Version | 製品リリース | Compass 2.1 | payload 中身 |
| Core Version | 5層設計の世代 | Core v1 | 画面の見た目だけ |
| Schema Version | payload/JSON 互換 | schemaVersion 2 | 楽観ロック |
| Optimistic Lock Version | 行競合 | DB `version` | 製品番号 |

---

## 14. 用語関係図

```
Patient
  → Patient Source Record
      → Information Card
          → Assessment Card
              → Clinical Reasoning (Edges)
                  → Artifact
                      ← Institution-defined Form (Template)

Evidence (Knowledge / Evidence Link) ──supports──► Assessment
  (Information に直接付けない)
  (事実根拠 SSOT は evidenceInformationIds)

Coach
  → reads Information / Assessment / Clinical Reasoning
  → emits Coach Question
  ✗ does not complete Artifact

Learning Workspace
  → edits Information / Assessment
  → may open Related Map Module (views Reasoning)

Form2 / Form3 Final Text
  → kinds of Artifact

Reflection Artifact（V2 patient_understanding_records）
  → Artifact（振り返り）。Patient Core ではない
```

---

## 14.1 正式名称統一表（Core Patch）

| 使う正式名 | 使わない／非推奨 | 備考 |
| --- | --- | --- |
| Learning Workspace | Learning Platform, Clinical Workspace | Platform＝製品カテゴリは Clinical Reasoning Platform |
| Clinical Reasoning Platform | （製品カテゴリとして維持） | Workspace と混同しない |
| Information Card | Fact（型名）, Patient Data（総称） | |
| Assessment Card | 看護問題, 正解アセスメント | |
| Clinical Reasoning / Clinical Reasoning Network | Reasoning Map（正式名にしない） | 層名／構造名。同一層 |
| Related Map（関連図） | 関連図＝Core と呼ぶこと | Module |
| Artifact | 成果物を学習目的と呼ぶこと | |
| Evidence Information（`evidenceInformationIds`） | Information を Evidence と呼ぶ | 事実根拠 |
| Evidence Link / Knowledge Evidence | Evidence Card | Module |
| Care Need | Assessment.careNeed | Artifact |
| Reflection Artifact | patient_understanding を Patient/Assessment と呼ぶ | V2 テーブル名は当面維持 |

---

## 15. 未決事項

1. ~~`patient_understanding_records`~~ → **Reflection Artifact**（Core Patch 確定）  
2. 既存ノート系 `information_cards` を Information Card へ統合するか、別名のまま並行するか。  
3. ~~Related Map の正式日本語 UI 名~~ → **「関連図」**（Core Patch 確定）  
4. Nursing Problem を Clinical Reasoning と Artifact のどちらで扱うか（本言語は Artifact 寄り、推論は Reasoning）。  
5. ~~Care Need~~ → **Artifact**（Core Patch 確定）  
6. ~~Evidence Card~~ → **採用しない**。Evidence Link（Module）のみ（Core Patch 確定）  
7. Learning State / Intervention Level の具体値域。  
8. Analysis を Interpretation の別名にするか、学校ラベル専用にするか。  
9. working priority の具体表現（順序／重み／Edge）。  
10. Form3 Workspace と Final の物理分離時期。  

---

## 16. 改訂方針

- 用語の追加・改名は本ファイルを更新し、Product / Core 文書と矛盾がないか確認する。  
- コードに残る旧名は「避ける類似語」へ移し、移行期間を明記する。  
- 学校様式の正式名称変更は学校資料更新時のみ（Compass 都合では変えない）。
