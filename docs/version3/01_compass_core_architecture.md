# Compass Core Architecture

- 文書種別: **Core Architecture 設計**（実装仕様の直前段階。コード変更は行わない）
- 前提 Vision: `docs/version3/00_compass_vision.md`（承認済・`f916a29`）
- ブランチ前提: `feature/version2-form3`
- 状態: **設計ドラフト（レビュー待ち）**

---

## 1. 目的

`00_compass_vision.md` で定義した Clinical Reasoning Learning Model を、今後の実装判断に使える **Core Architecture** へ具体化する。

対象は次の5層である。

1. Patient  
2. Information  
3. Assessment  
4. Clinical Reasoning  
5. Artifacts  

各層について、責務・所有・参照方向・ID・更新／削除／履歴・保存方式・Version2資産との関係を定義する。

本ドキュメントは Vision の下位に位置する。Vision と衝突する場合は Vision を優先する（学校指定様式は変更しない）。

---

## 2. 設計原則

1. **Clinical Reasoning Platform** — 成果物先作りをしない。  
2. **層の責務を混在させない** — 事実／思考／関係／提出物を同じオブジェクトに詰め込まない。  
3. **参照を優先し、コピーを避ける** — 特に Information → Assessment → Reasoning → Artifacts。  
4. **学校指定様式は変更しない** — Artifacts のテンプレート意味は学校の共通言語。  
5. **自動転記・AI完成文をしない** — 学生自身が統合する。  
6. **Modules → Core のみ依存** — Core は Module UI／様式固有を知らない。  
7. **Version2 から段階移行** — 理想の正規化を一挙に強制しない。  
8. **Golden Rule** — 「患者理解を深めるか」が NO なら採用しない。

参照方向（許可）:

```
Patient  →（参照される）
Information → Assessment → Clinical Reasoning → Artifacts
         ↖________________／（再収集・再考で戻ることは学習上許可）
```

禁止例:

- Artifacts が Information を「転記生成」すること  
- Assessment が Patient 一次情報を本文コピーで抱え込むこと（参照切れ時のスナップショットは例外として後述）  
- Core が「様式3画面の開閉状態」を持つこと  

---

## 3. 全体構造図

```
┌──────────────────────────────────────────────────────────┐
│                    Compass Modules                        │
│  様式2 / 様式3 / 関連図UI / Coach / Evidence / 看護問題…   │
└───────────────────────────┬──────────────────────────────┘
                            │ 依存（読む・書くは Core API）
                            ▼
┌──────────────────────────────────────────────────────────┐
│                      Compass Core                         │
│                                                          │
│  Patient ──► Information ──► Assessment                  │
│                 │                │                       │
│                 └──────► Clinical Reasoning ◄────────────┤
│                                   │                      │
│                                   ▼                      │
│                               Artifacts                  │
└──────────────────────────────────────────────────────────┘
                            ▲
                            │ 所有軸（学生思考系）
              user_id / organization_id / academic_year / case_id
```

---

## 4. Patient Layer

### 4.1 責務

Patient Layer は、**患者（教材ケース）に関する一次情報の保管・参照元**である。  
学生の解釈・判断・提出文はここに置かない。

### 4.2 保持するもの（概念）

- 患者基本情報  
- 入院までの経過  
- 電子カルテ（診療録・看護記録・医師記録等）  
- 検査値・バイタル・薬剤・治療  
- 患者との会話ログ（教材）  
- 家族情報・生活背景  

### 4.3 保持しないもの

- 学生の解釈・判断  
- 看護問題（学生が立てたもの）  
- アセスメント本文  
- 学校提出文（様式2/3等）  
- Coach の問い／学生の回答ログ（思考過程側）

### 4.4 Patient と Case

| 概念 | 定義 |
| --- | --- |
| **Patient** | 教材上の「人」。表示名・基本属性・静的カルテ一式の束ね役 |
| **Case** | 教育上の受け持ち単位。学年・講義回・課題セットに紐づく |

Version2 現状:

- UI `patientId`（例: `"A"`）  
- DB `case_id`（例: `"SP-001"`）は `caseIdForPatient` でサーバ解決  

**設計方針:**

- 論理上は **1 Patient : N Case** を許容する（学年・課題の違い）。  
- Version2／講義当面は **1 Patient : 1 Case（固定写像）** で運用する。  
- 所有の主キーは学生思考データでは **`case_id`**（＋ user / org / year）。  
- `patient_id` は表示・教材解決・監査の補助キー。クライアント申告の case は信用しない（現行どおりサーバ解決）。

### 4.5 静的 fixture と DB

| 形態 | 扱い |
| --- | --- |
| 静的 fixture（現行のカルテ／会話） | Patient Layer の **読取専用 Source Catalog**。コード同梱またはコンテンツDB |
| DB保存 | 将来の教材CMS。同じ Source Record ID 体系を維持 |

学生が「事実として切り出した」結果は Information Layer へ行く。Patient Layer を直接書き換えない（教材改変権限は別）。

### 4.6 Source Record

Patient Layer 内の個別記録（カルテ1行、会話1ターン、検査1件等）には **安定した Source Record ID** を付ける。

推奨メタ:

- `sourceRecordId`  
- `sourceType`（chart / conversation / lab / …）  
- `occurredAt`（臨床上の日時があれば）  
- `authorRole`（医師／看護師／患者 等・教材上の役割）  
- `label`（UI表示用短名）  

機密の生データ丸写しを Source Reference に持ち込まない（§15）。

---

## 5. Information Layer

### 5.1 責務

Information Card は、学生が Patient Layer から選び出した **事実の原子** である。

必須原則:

- 1カードに1つの情報  
- **解釈を書かない**  
- 可能な限り Patient の元情報へ参照を持つ  
- コピーより参照を優先  
- 複数 Assessment から同一 Card を参照できる  
- 関連図ノードの候補になる  
- 学生の独自観察（手入力）も扱える  

### 5.2 論理モデル（設計候補）

```
InformationCard {
  id
  userId
  organizationId
  academicYear
  caseId
  soType                 // "S" | "O"  （主観/客観）※情報源と混同しない
  content                // 事実テキスト
  sourceType             // chart | conversation | lab | vital | medication |
                         // treatment | family | social | observation | other
  sourceReference        // 構造化参照（下記）
  sourceLabel            // 表示用（「看護記録 6/1」等）
  observedAt             // 任意。いつ観察・記録されたか
  patternKeys[]          // 0..N の健康パターン紐付け
  order
  status                 // active | archived | deleted(soft)
  createdAt
  updatedAt
}
```

**S/O と sourceType は別軸:**

- `soType`: 情報の性質（主観／客観）  
- `sourceType`: どこから来たか  

`informationType` に両方を混ぜない。旧案の `laboratory` 等は **sourceType** 側に置く。

### 5.3 sourceReference（構造化の深さ）

当面の推奨（浅く安定）:

```
sourceReference: {
  kind: "fixture" | "manual" | "db",
  sourceType: "...",
  sourceRecordId?: string,   // あれば必須級
  path?: string,             // 教材内パス（過度に長くしない）
  note?: string              // 手入力時の出所メモ（短文）
}
```

手入力（`sourceType: observation | other`, `kind: manual`）は `sourceRecordId` なしを許容。`sourceLabel` で「自分の観察」等を示す。

### 5.4 検討事項への方針

| 論点 | 方針 |
| --- | --- |
| 複数パターン所属 | **許可**（`patternKeys[]`）。関連図・横断アセスメントに必要 |
| 重複カード防止 | 同一 `sourceRecordId`＋同一 user/case で「既存を提案」。強制マージはしない（教育上の再記述を許す） |
| 元情報変更 | fixture は不変前提。将来DB教材が変わったら参照は残し、内容は学生カード側が正（必要なら「元が更新された」警告を Module が出す） |
| soft delete | **採用**。Assessment／Reasoning 参照中は hard delete 禁止 |
| 並び順 | `order`（パターン・リスト UI 用）。IDに順序を埋め込まない |
| 学生間共有 | **しない**（所有は user 単位） |
| 教員参照 | 同組織 RLS で SELECT（編集はしない） |

---

## 6. Assessment Layer

### 6.1 責務

Assessment Card は、Information を根拠に学生が考えた内容である。  
**学校提出文ではない。**

必須原則:

- 事実ではなく思考  
- 1健康パターンに複数可  
- 正常・強み・問題・リスク・情報不足が併存可  
- **1件以上の Information Card ID を根拠参照**（コピーしない）  
- 修正・再考可能  
- 思考変化を将来追跡可能（履歴は段階導入）

### 6.2 論理モデル（設計候補）

```
AssessmentCard {
  id
  userId
  organizationId
  academicYear
  caseId
  patternKey                 // 主所属。原則1つ
  interpretation
  classification             // functioning_normally | strength | problem |
                             // risk | insufficient_information | null
  evidenceInformationIds[]   // 1..N
  careNeed?                  // 任意。看護上のニーズメモ（提出問題文ではない）
  additionalInformationNeeded?
  relatedAssessmentIds[]     // 任意。弱いリンク。本関係は Reasoning へ寄せる
  status                     // draft | active | archived | deleted(soft)
  order
  createdAt
  updatedAt
}
```

### 6.3 検討事項への方針

| 論点 | 方針 |
| --- | --- |
| 根拠 Information 削除 | soft delete。参照切れは `missing_evidence` 状態として UI 警告。Assessment を自動削除しない |
| Assessment 間参照 | 本格関係は **Clinical Reasoning Edge**。`relatedAssessmentIds` は暫定・薄く |
| 複数パターンにまたがる Assessment | 原則 **1 patternKey**。またがりは Reasoning で表現 |
| careNeed の位置 | Assessment に **短いメモとして任意**。正式な看護問題文は Artifacts |
| 整理済み条件 | Module（様式3 Final 等）が定義。Core は `status` と必須根拠数などの最小制約のみ |
| 履歴 | V3初期は `updatedAt`。思考履歴テーブルは V3後半 |
| Coach 問いと回答 | **Coach Module のログ**（Core Assessment 本文に混ぜない） |
| Evidence 紐付け | Vision どおり Evidence は Assessment を支える。`evidenceInformationIds` が最小実装。別 Evidence オブジェクトは Module 拡張 |
| 教員コメント | Artifact／レビュー Module。Assessment 本文と分離 |

---

## 7. Clinical Reasoning Layer

### 7.1 責務

画面の関連図そのものではなく、**関係性を保持する Core**。

主な役割:

- Assessment 同士の関係  
- Information → Assessment の根拠関係（Assessment 内 ID 配列と二重化しない方針は下記）  
- 原因・結果、影響、強化・抑制、時系列、優先、看護上の重要性  
- 看護問題につながる推論の骨格  

### 7.2 論理モデル

```
ReasoningNodeReference {
  nodeType  // "information" | "assessment" | "patient_source"（将来）
  nodeId
}

ClinicalReasoningEdge {
  id
  userId
  organizationId
  academicYear
  caseId
  from: ReasoningNodeReference
  to: ReasoningNodeReference
  relationType
  label?          // 短い表示語
  rationale?      // なぜこの関係か（学生の言葉・短文）
  createdAt
  updatedAt
  status          // active | deleted(soft)
}
```

### 7.3 relationType（初期は少数）

初期セット（推奨）:

- `supports`（根拠・支え）  
- `contributes_to`  
- `worsens` / `improves`  
- `relates_to`（その他）  
- `requires_more_information`  

後期追加候補: `causes`, `protects`, `conflicts_with`, `precedes`

**初期実装で種類を増やしすぎない。** UI が選ばない関係は作らない。

### 7.4 方針

| 論点 | 方針 |
| --- | --- |
| ノード複製 | **しない**。Core ID 参照のみ |
| Information / Assessment ノード | **両方可** |
| Patient Source 直接ノード | 将来オプション。当面は Information 化してからノード化を推奨 |
| レイアウト座標 | **関連図 Module 固有**（Core に持たない） |
| 見た目とデータ分離 | Core=関係、Module=座標・色・折りたたみ |
| 優先順位・看護問題 | 優先度スコアは Reasoning または専用 Artifact。正式「看護問題」文は Artifacts |
| エッジ削除 | soft delete。参照先ノード削除時はエッジも soft |
| Coach 参照範囲 | Edge＋端点の Information/Assessment（成果物本文は見ない） |

**Information→Assessment の根拠**は、当面 Assessment の `evidenceInformationIds` を正とし、Reasoning Edge の `supports` は関連図・高度推論用に段階追加（二重管理を避ける移行順は §17）。

---

## 8. Artifacts Layer

### 8.1 責務

患者理解を **学校指定様式・提出物として表現**する層。

例: 様式2、様式3、関連図（提出物）、看護問題、看護計画、実習記録、振り返り。

必須原則:

- 学校指定様式を変更しない  
- Core を学生自身が統合して記述  
- 自動転記しない／AI が完成文を生成しない  
- Core と Artifact の責務を混在させない  
- 提出物はその時点の学生の表現として保存  

### 8.2 Artifact 保存方式の比較

| 案 | 内容 | 教育 | 監査 | 実装難易度 |
| --- | --- | --- | --- | --- |
| **A. 文章のみ** | 提出テキストだけ | Coreとの追跡が弱い | 弱い | 低（現行に近い） |
| **B. 文章＋参照Core ID** | 参照した Information/Assessment ID を保持 | 追跡可。提出後のCore変更で意味がズレうる | 中 | 中 |
| **C. 文章＋参照ID＋提出時スナップショット** | 提出確定時に参照先の要約／版を固定 | 学習過程と提出物の両方を説明可能 | 強 | 中〜高 |

**推奨: 案C（段階導入）**

- 編集中（下書き Artifact）: 案B（文章＋参照 ID）でよい。  
- **提出・印刷確定時**: 案C（スナップショット固定）。  
- Version2 当面の様式2/3オートセーブは「下書き Artifact」相当として案B寄りで開始可能。

### 8.3 Version2 の form2_records / form3_records

- **Module の Artifact 永続化**として維持。  
- 中身は徐々に「Final Form（学校指定欄）＋ optional 参照 ID」へ寄せる。  
- Core Information/Assessment が育ったら、様式3 Workspace は Core を編集し、Final Form だけが Artifact。

### 8.4 その他

- 学校テンプレート差異は Artifact テンプレートIDで吸収（Coreは不変）。  
- 提出状態・差し戻し・教員コメントは Artifact Module の付帯データ。  
- Artifact 完成後の Core 変更: 下書きは追従可／提出済はスナップショット優先で「提出後にCoreが変わった」表示。

---

## 9. 所有・スコープ

### 9.1 学生思考系 Core（Information / Assessment / Reasoning / 学生Artifact）

現行 Version2 と同じ所有軸を標準とする。

- `user_id`  
- `organization_id`  
- `academic_year`  
- `case_id`  
- （補助）`patient_id`  

### 9.2 Patient / Case の所有

| データ | 所有者 |
| --- | --- |
| 教材 Patient / Source Catalog | 組織（またはシステム）。学生は読取 |
| Case 定義（課題） | 組織／教員 |
| 学生の Information 以降 | **学生ユーザー** |

### 9.3 方針

| 論点 | 方針 |
| --- | --- |
| 学生データ単位 | **ユーザー単位**（同一Caseでも学生ごとに分離） |
| 教員閲覧 | 同 `organization_id` の SELECT（現行 staff ポリシー踏襲）。編集しない |
| 複数学生が同じ患者ケース | Case は共有、思考 Core は user 分離 |
| Patient と思考の分離 | Patient=教材、思考=学生所有。権限も分離 |
| 学年更新 | `academic_year` で論理分離。過年度は読取中心 |
| 卒業・停止 | hard delete せず保持／アーカイブ（法務詳細は将来） |

---

## 10. ID・参照

### 10.1 ID 一覧

| ID | 生成 | 備考 |
| --- | --- | --- |
| Patient ID | 教材定義（例 `"A"`） | 表示用短ID可 |
| Case ID | サーバ定義（例 `"SP-001"`） | クライアント申告を信用しない |
| Source Record ID | 教材／CMS | 安定。パス変更に耐える |
| Information Card ID | ULID 推奨 | クライアント仮ID→サーバ確定の二段可 |
| Assessment Card ID | ULID | 同上 |
| Reasoning Edge ID | ULID | 同上 |
| Artifact ID | DB uuid または ULID | form2/form3 の row id と対応可 |

### 10.2 原則

- 表示順・パターン名を ID に含めない  
- ID 変更を前提にしない  
- コピー時は新 ID、参照時は同一 ID  
- **クライアント生成 ULID を許容**（オフライン／オートセーブ体験のため）。衝突は極めて稀。サーバは重複拒否  

### 10.3 一時 ID（オートセーブ前）

1. UI 作成瞬間にクライアント ULID を付与  
2. 楽観的にリスト表示・Assessment 根拠に使用  
3. 初回保存成功でそのまま確定（付け替えない）  
4. 保存失敗時も同一 ID を維持（下書きと一致）

DB 採番のみにすると、未保存カードを根拠参照できず教育UXが壊れる。

---

## 11. 更新・削除・履歴

### 11.1 更新

| 対象 | 方針 |
| --- | --- |
| Patient 元情報 | 教材更新。学生思考を自動書き換えしない |
| Information | 学生が編集可。根拠として使われている場合も編集可（Assessment 側に「根拠が変わった」は将来通知） |
| Assessment | 自由に再考。`updatedAt` 更新 |
| Artifact 下書き | オートセーブ。提出後は原則ロック＋再提出フロー |

### 11.2 削除

| 方式 | 用途 |
| --- | --- |
| soft delete | 学生思考 Core の標準 |
| archive | 学年末・提出済みの整理 |
| hard delete | 原則なし（管理・法令対応時のみ service_role） |

参照中削除:

- Information soft delete → Assessment は残し、根拠欠けを表示  
- Assessment soft delete → Edge soft、Artifact 参照は欠け表示  
- 提出済 Artifact は参照欠けでもスナップショットで読める（案C）

### 11.3 履歴

| 段階 | 内容 |
| --- | --- |
| 今すぐ（V2/V3初期） | `created_at` / `updated_at`、楽観ロック `version` |
| 次 | Artifact 提出スナップショット |
| 将来 | Assessment 改訂履歴（思考変化の学習分析） |

---

## 12. 保存方式比較

### 案A: Core 個別テーブル

`information_cards` / `assessment_cards` / `reasoning_edges` / `artifacts`

| 項目 | 評価 |
| --- | --- |
| 実装速度 | 遅い（初期） |
| RLS | 明確（行単位） |
| 楽観ロック | 行単位。ドキュメント横断編集は複雑 |
| オートセーブ | 部分更新向き |
| 関連図・Coach・検索・分析 | 強い |
| 移行 | form3 payload からの分解が必要 |

### 案B: ケース単位 JSONB

例: `clinical_reasoning_records.payload`

| 項目 | 評価 |
| --- | --- |
| 実装速度 | 速い |
| RLS | レコード単位で単純（現行 form3 と同型） |
| 楽観ロック | ドキュメント version で単純 |
| オートセーブ | 現行 Hook を再利用しやすい |
| 部分更新・検索・分析 | 弱い |
| 関連図・Coach | payload 内参照で当面可 |

### 案C: 段階的ハイブリッド（推奨）

| 段階 | 内容 |
| --- | --- |
| 今 | Form3 等は **JSONB payload**（schemaVersion 進化）。所有軸・RLS・autosave・conflict を維持 |
| 次 | Information / Assessment を **論理モデルとして明確化**（型・sanitize・UI） |
| その次 | 利用が安定したら `information_cards` / `assessment_cards` へ **昇格**（参照IDは維持） |
| Reasoning | 関連図 Module 本格化時に `reasoning_edges` テーブル化を優先検討 |
| Artifacts | `form2_records` / `form3_records` を Artifact として維持 |

**現状の Compass への推奨: 案C。**  
理由: Day2–5 の永続化資産を壊さず Vision へ近づける。関連図・分析が必要になった地点でだけ正規化する。

---

## 13. Version2資産との関係

### 13.1 そのまま Core へ利用可能（概念・基盤）

- 所有軸（user / org / year / case）  
- RLS・GRANT パターン  
- 楽観ロック `version`  
- Server Actions + `callAction`  
- Autosave / draft / conflict UI 思想  
- `source_reference` の考え方（Evidence／ノート系）  
- 既存 `information_cards` テーブル（ノート Evidence）→ **Information Core の先祖**として整理・統合候補  

### 13.2 Module として維持

- Form2（Artifact）  
- Form3 Final Form（Artifact）  
- Evidence Review UI  
- 関連図 UI（未実装／将来 Module）  
- Coach UI（将来 Module）  

### 13.3 段階移行が必要

| 資産 | 移行 |
| --- | --- |
| `form3_records` schemaVersion 1 | → v2 論理（カード）→ Core 分離 |
| `form3_records` schemaVersion 2（設計中） | Workspace=Core的、Final=Artifact |
| `patient_understanding_records` | 「私が捉えた患者さん」は Artifact／振り返り寄り。Patient Core ではない |
| `form2_evidence_links` | Evidence Module。Assessment 根拠モデルへ将来接続 |

### 13.4 廃止候補（すぐ削除せず段階）

| 候補 | 移行 |
| --- | --- |
| 様式3「患者理解の手がかり」必須導線 | 一次情報参照へ置換後に外す |
| パターン全体の単一 judgment | Assessment 複数化後、Final のみ残す |
| Workspace 長文 `relatedInformation` | Information Card 化後、Final 欄のみ学校指定として残す |

---

## 14. Core／Module 依存ルール

### 14.1 許可

```
Modules → Core
```

例:

- 様式3 Module は Information / Assessment Core を使う  
- 関連図 Module は Clinical Reasoning Core を使う  
- Coach Module は Core を読む（Artifacts 本文は書かない）  

### 14.2 禁止

```
Core ─X→ Modules
```

禁止例:

- InformationCard が「様式3のタブ状態」を持つ  
- Assessment が「関連図の x,y 座標」を必須フィールドに持つ  
- Patient Layer が「Form2 の保存ステータス」に依存する  
- Core sanitize が特定 Module の文言ラベルに分岐する  

### 14.3 例外

- Artifact テンプレートID（学校様式の識別）は Artifact Module 設定であり Core 推論モデルではない。

---

## 15. セキュリティ原則（アーキテクチャ）

1. 学生は自分の思考 Core のみ INSERT/UPDATE。  
2. 教員は同組織の学生データを SELECT（形成的支援）。自動採点・順位付けはしない。  
3. Patient Layer（教材）と学生思考の権限を分離する。  
4. `service_role` はシード・管理・移行に限定。ブラウザに出さない。  
5. Coach／AI に渡す情報は **当該 Case の Information / Assessment / Reasoning の必要最小**。Artifacts 全文や無関係患者を送らない。  
6. アプリログに患者の詳細本文・会話全文を出さない。  
7. `sourceReference` に機密の過剰保存をしない（IDと短い label）。  
8. 将来実患者を扱う場合は、教材ケースと実データ空間を完全分離する（別プロジェクト／別スキーマ想定）。  

---

## 16. 推奨アーキテクチャ

### 16.1 今すぐ（Version2.1 継続〜Version3 入口）

- Vision / 本 Core 文書を判断基準にする  
- Form3 は JSONB＋所有軸＋autosave を維持しつつ、**論理を Information / Assessment / Final(Artifact)** へ寄せる設計を承認する  
- 個別テーブル新設は急がない  

### 16.2 Version3 が目指す構造

- Core 5層が型・API・権限で説明可能  
- Information / Assessment が第一級  
- Reasoning Edge が関連図の正本  
- Artifacts は学校様式＋参照＋提出スナップショット  

### 16.3 当面 JSONB で維持

- `form3_records.payload`（カード論理を内包）  
- `form2_records.payload`（Artifact）  

### 16.4 個別テーブル化するもの（順）

1. （既存）ノート系 `information_cards` の意味整理  
2. `assessment_cards` または form3 からの抽出  
3. `reasoning_edges`（関連図本格化時）  
4. Artifact 提出スナップショット表（必要なら）  

### 16.5 Module 固有として残すもの

- 様式レイアウト、印刷、提出UI  
- 関連図の座標・見た目  
- Coach の問いテンプレートと会話UI  
- 教員レビューUI  

---

## 17. 段階移行ロードマップ

| Phase | 内容 | コード |
| --- | --- | --- |
| **A. 文書** | Vision + Core Architecture 承認 | 設計のみ |
| **B. Form3 論理 v2** | Information/Assessment/Final を payload 内で実現 | 既存 form3_records |
| **C. 一次情報参照** | 手がかりSheet依存を削減 | Module UI |
| **D. Reasoning 最小** | supports 関係または evidence IDs の厳密化 | JSONB or 表 |
| **E. 関連図 Module** | 座標は Module、Edge は Core | UI＋edges |
| **F. 正規化** | Information/Assessment テーブル昇格 | Migration |
| **G. 提出スナップショット** | Artifact 案C | Artifact Module |

既存機能は Phase 完了まで削除しない。フラグまたは導線置換で段階的に外す。

---

## 18. 未決事項

1. **既存ノート `information_cards` と Form3 Information Card の統合時期・同一テーブル可否**  
2. **Information→Assessment 根拠を Assessment 配列のみとするか、初期から Reasoning Edge と二重化するか**（本設計は当面配列正）  
3. **`patient_understanding_records` を Artifact（振り返り）と Core のどちらに正式分類するか**  
4. **クライアント ULID を全 Core で標準化するか、DB uuid のみにするか**（本設計は ULID 許容推奨）  
5. **提出スナップショットの保存粒度**（全文のみ／根拠カード要約を含むか）  
6. **教員が Assessment にコメントする場合の格納先**（レビュー Module の詳細）  
7. **1 Patient : N Case を講義でいつ有効化するか**  

---

## 付録: レイヤー責務の一行定義

| Layer | 一行 |
| --- | --- |
| Patient | 教材としての患者一次情報の参照元 |
| Information | 学生が切り出した事実（解釈しない） |
| Assessment | 事実に基づく学生の思考（提出文ではない） |
| Clinical Reasoning | 思考・事実の関係構造 |
| Artifacts | 学校指定の成果物表現（最後に作る） |
