# Compass Version3 Core Design Review（Architecture Audit）

- 文書種別: **設計監査＋ Core Patch Sprint 結果**
- 対象ブランチ: `feature/version2-form3`
- レビュー対象（正本）:
  - `00_compass_vision.md`
  - `01_compass_core_architecture.md`
  - `02_domain_language.md`
  - `03_relationship_model.md`
  - `04_information_model.md`
  - `05_assessment_model.md`
  - `06_clinical_reasoning_network_model.md`
- 状態: **Core Patch Sprint 反映済み（Conditional Freeze 再判定）**
- 制約: コード・DB・Migration・UI・TypeScript・`.cursor/rules` は変更しない

判定凡例: **OK** / **要修正** / **保留**

---

## 0. Core Patch Sprint 結果（本更新）

Review で抽出した CONDITIONAL Freeze 条件のうち、今回スプリントで扱った4点と、Review 全体 CONDITIONS の状態。

### 0.1 今回の4条件

| # | 条件 | 状態 | 決定内容 |
| --- | --- | --- | --- |
| ① | careNeed | **Resolved** | **Artifact 責務**。Assessment / Network Core から外す。V2 値は Artifact「援助の必要性」等へ移行マッピング |
| ② | patient_understanding | **Resolved** | **Reflection Artifact**。Patient / Information / Assessment / Network ではない。V2 テーブル名は当面維持 |
| ③ | SSOT（根拠） | **Resolved** | 事実根拠＝`evidenceInformationIds` 唯一正本。`supports`＝導出表示のみ→Related Map 本格時に移行ジョブで一本化。Evidence Link＝Knowledge Evidence（Module）。Evidence Card 不採用 |
| ④ | Domain Language 命名 | **Resolved** | Learning Workspace 正式化。CR＝層名／CR Network＝構造名。Related Map＝関連図 Module。統一表を Domain §14.1 に追加 |

### 0.2 Review CONDITIONS（1–7）全体

| CONDITION | 状態 | 備考 |
| --- | --- | --- |
| 1. 根拠 SSOT | **Resolved** | ①と同一パッチ |
| 2. 命名（CR／Related Map／Assessment 文言） | **Resolved** | Vision・Domain・Assessment §2 修正 |
| 3. Care Need | **Resolved** | ①と同一 |
| 4. patient_understanding | **Resolved** | ②と同一 |
| 5. Priority SSOT 2行 | **Resolved** | Relationship SSOT 表・Domain Priority に作業用＝Network／提出用＝Artifact を追加。**具体表現は Remaining** |
| 6. Evidence Card | **Resolved** | 不採用。Evidence Link のみ |
| 7. Form3 Workspace／Final 論理境界（Phase B） | **Remaining** | Artifact Model / Form3 Phase B 契約で詳細化。方針（概念分離）は既存文書で維持 |

### 0.3 Remaining（Patch 後も残るもの）

- Form3 payload の Workspace＋Artifact **物理混在**の Phase B 契約詳細・judgment 移行マトリクス  
- working priority の **具体表現**（順序／重み／Edge）  
- `relatedAssessmentIds` の廃止時期  
- `needMoreInformation` と `requires_more_information` の編集 UI 運用詳細  
- 既存ノート `information_cards` と Form3 Information の統合時期  
- Submission Snapshot 粒度／提出関連図にレイアウトを含めるか  
- Nursing Problem の Artifact 正本の細部（方針は Artifact 寄りで既存）  
- 教員コメント Entity 詳細  

これらは **新概念ではなく後続 Model／実装 Phase の詳細**であり、Core 方向のブロッカーではない。

---

## 1. 目的

Compass Version3 Core を設計監査し、Core Design Freeze の可否を判断する。  
本ファイルは初回監査後、**Core Patch Sprint** により CONDITIONS の大半を Resolved に更新した。

---

## 2. レビュー結果（観点別・Patch 後）

### 2.1 Vision — **OK**

Learning Workspace に統一。Platform＝製品カテゴリ（Clinical Reasoning Platform）と整合。

### 2.2 Core Architecture — **OK**（境界フィールドは Patch 済み）

careNeed を Assessment から除去。根拠 SSOT・patient_understanding＝Reflection Artifact を明記。

### 2.3 Domain Language — **OK**

正式名称統一表（§14.1）追加。Evidence Card 不採用。Care Need＝Artifact。

### 2.4 Relationship — **OK**

SSOT 表拡充。根拠／優先／Care Need／Reflection の正本を固定。概念循環なし。

### 2.5 Information — **OK**

Atomic Unit 維持。Evidence Card 不採用を明記。

### 2.6 Assessment — **OK**

§2 の層混同文言を修正。careNeed 除去。1 Interpretation・≠看護問題を維持。

### 2.7 Clinical Reasoning — **OK**

Network＝Core、Related Map＝Module。supports は導出のみと固定。

### 2.8 Artifacts — **OK**

学校様式不変。Care Need／Reflection を Artifact 側に確定。

### 2.9 Single Source of Truth — **OK**（実装二重化は禁止ルールで封じ済み）

### 2.10 Emergence — **OK**

### 2.11 Version2 移行 — **保留→緩和（Remaining は Phase B）**

分類未決だった patient_understanding / careNeed / Evidence Card は Resolved。残は物理移行契約。

---

## 3. 重大事項（Patch 後）

| # | 内容 | Patch 後 |
| --- | --- | --- |
| 根拠二重化 | evidenceInformationIds vs supports | **Resolved（規則固定）** |
| Assessment＝CR 文言 | 層混同 | **Resolved** |
| careNeed 未決先行 | Assessment 搭載 | **Resolved（Artifact）** |
| form3 物理混在 | Workspace＋Artifact | **Remaining（Phase B）** |
| patient_understanding | 分類未決 | **Resolved（Reflection Artifact）** |
| Priority 表現 | 作業／提出の分離は Resolved、表現詳細は Remaining | |
| Evidence Card | 未決 | **Resolved（不採用）** |
| Learning Platform 揺れ | | **Resolved（Workspace）** |

---

## 4. 文書別クイックレーティング（Patch 後）

| 文書 | 主評価 |
| --- | --- |
| 00 Vision | OK |
| 01 Architecture | OK |
| 02 Domain Language | OK |
| 03 Relationship | OK |
| 04 Information | OK |
| 05 Assessment | OK |
| 06 CR Network | OK |

---

## 5. 総評と Core Design Freeze 判定

### 5.1 総評

Core Patch Sprint により、Conditional Freeze の主ブロッカー（careNeed・patient_understanding・根拠 SSOT・命名揺れ・Evidence Card）は **文書上 Resolved** した。  
残る Remaining は Form3 Phase B の物理境界契約と、優先表現などの **後続詳細**であり、5層の方向・Atomic・Modules→Core・Emergence・学校様式不変を覆すものではない。

### 5.2 判定: **Core Design Freeze 推奨（Conditional → 実質 Freeze 可）**

**Core Design Freeze を推奨する。**

条件付きで残すのは実装・Artifact Model 側のみ:

- Form3 Phase B（Workspace／Final の sanitize・型境界）は **次フェーズの契約文書**で固定する  
- working priority の具体表現は Network 実装前に決める  

Core 概念セット（00–06）は、これ以上の概念追加なしに実装入口へ進めてよい。

---

## 6. 推奨する次フェーズ

| 順 | Phase | 内容 |
| --- | --- | --- |
| 1 | **Artifact Model** | Form2/Form3 Final、Care Need／Reflection、Snapshot、judgment |
| 2 | **Form3 Phase B 契約** | Workspace＝Information/Assessment、Final＝Artifact。judgment 移行マトリクス |
| 3 | **実装入口** | 案C維持。テーブル新設は急がない |
| 4 | **Reasoning 最小** | 配列正本のまま Related Map 準備。`supports` 永続化は本格時＋移行ジョブ |

---

## 7. 監査サマリ表（Patch 後）

| 観点 | 判定 |
| --- | --- |
| Vision | OK |
| Core Architecture 責務 | OK |
| Domain Language | OK |
| Relationship 依存 | OK |
| Information Atomic | OK |
| Assessment Atomic／≠看護問題 | OK |
| CR Network vs Related Map | OK |
| Artifacts／学校様式 | OK |
| SSOT | OK |
| Emergence | OK |
| Version2 移行 | Remaining（Phase B 詳細） |

**Core Design Freeze:** **推奨**  
**次:** Artifact Model → Form3 Phase B 契約
