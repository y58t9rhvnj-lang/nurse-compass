# Compass Version3 Core Design Review（Architecture Audit）

- 文書種別: **設計監査（レビューのみ）**
- 対象ブランチ: `feature/version2-form3`
- レビュー対象（正本）:
  - `00_compass_vision.md`
  - `01_compass_core_architecture.md`
  - `02_domain_language.md`
  - `03_relationship_model.md`
  - `04_information_model.md`
  - `05_assessment_model.md`
  - `06_clinical_reasoning_network_model.md`
- 状態: **監査結果（レビュー待ち）**
- 制約: 本監査ではコード・DB・Migration・UI・TypeScript・`.cursor/rules` を変更しない

判定凡例: **OK** / **要修正** / **保留**

---

## 1. 目的

Compass Version3 Core を設計監査し、次を確認する。

- 概念の矛盾  
- 責務の重複  
- 依存関係  
- 教育思想との整合性  

最終判断: **Core Design Freeze が可能か**。

---

## 2. レビュー結果（観点別）

### 2.1 Vision

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| Vision と Architecture の一致 | **OK** | Patient → Information → Assessment → Clinical Reasoning → Artifacts の骨格は一致。Modules→Core、成果物先作り禁止も Architecture に継承されている。 |
| Clinical Reasoning Platform 定義との矛盾 | **OK** | Platform＝製品カテゴリ、思考過程を支え成果物は結果、という定義は全文書で維持。 |
| Learning Workspace 思想の維持 | **保留** | Domain は `Learning Workspace` を正式定義。Vision は `Learning Platform` と呼ぶ。意味は近いが名称が揃っていない。 |

**所見:** 北極星としての Vision は十分。後続文書は方向を崩していない。命名の微差のみ。

---

### 2.2 Core Architecture（層責務）

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| Patient / Information / Assessment / Clinical Reasoning Network / Artifact の責務重複 | **要修正** | 一行定義は明確。境界上に未収束フィールドが残る（`careNeed`、`relatedAssessmentIds`、working priority、移行期 `form3_records` の Workspace＋Artifact 混在）。 |

**層ごとの健全性（要約）:**

| Layer | 責務の明確さ | 備考 |
| --- | --- | --- |
| Patient | 高い | Source Record＝一次情報正本。学生思考を置かないことは一貫。 |
| Information | 高い | Atomic Fact。解釈禁止。 |
| Assessment | 高い | Atomic Interpretation。提出文ではない。 |
| Clinical Reasoning Network | 高い | 関係の正本。Related Map ではない。 |
| Artifact | 高い | 学校様式・提出。自動転記禁止。 |

---

### 2.3 Domain Language

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| 同一概念の複数名称 | **要修正** | 避ける語表は強い。一方で並行候補が残る（下記命名揺れ）。 |
| Information / Evidence / Assessment / Reasoning / Artifact の一貫性 | **要修正** | 定義自体は良い。Evidence 系・CR 層名の揺れが実装・教育で再混同しやすい。 |

---

### 2.4 Relationship

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| 依存の循環 | **OK** | 概念依存にサイクルはない。`Modules → Core` のみ。 |
| Core → Modules になっていないか | **OK** | 禁止例（座標・様式タブ状態等）が Architecture / Relationship / Network で繰り返し固定。 |

**注意（循環ではないが移行リスク）:** `evidenceInformationIds` と `supports` Edge、`relatedAssessmentIds` と Edge、`needMoreInformation` と `requires_more_information` は **二重正本候補**。規則上は「同時必須化しない」と書かれているが、一本化条件が未書き切り。

---

### 2.5 Information

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| Atomic Unit（1 Card = 1 Fact） | **OK** | Vision〜Information Model まで最も一貫。分割推奨（案B）も Assessment／Network と整合。 |

---

### 2.6 Assessment

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| 1 Card = 1 Interpretation | **OK** | Assessment Model で固定。分割推奨も Network Edge 前提と整合。 |
| Assessment が看護問題になっていないか | **OK** | Domain / Assessment / Network で `problem` ≠ Nursing Problem、正式文は Artifact と明記。 |
| 層混同を誘発する文言 | **要修正** | Assessment Model §2: 「Assessment は… Clinical Reasoning（思考の単位）」— 同文書 §17 の「点＝Assessment／関係＝CR」と緊張する。 |

---

### 2.7 Clinical Reasoning

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| Network＝Core、Related Map＝Module | **OK** | Architecture / Domain / Relationship / Network で最も繰り返し固定されている原則。 |

---

### 2.8 Artifacts

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| 学校指定様式を変更しない | **OK** | Vision・Architecture・Domain・Assessment・Network で一貫。Final Text は学校資料優先。 |
| Artifacts の Core への逆依存 | **OK** | 概念上、Core は様式実装を知らない。 |

**移行期の物理実態:** `form3_records` が Workspace（Core 論理）と Final（Artifact）を同一 payload に内包。依存方向は Module→Core だが、**SSOT の物理境界が曖昧**（§4.6）。

---

### 2.9 Single Source of Truth

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| 層間の意味重複 | **要修正** | SSOT 宣言（Relationship §2.1）は優秀。未収束の二重候補が Freeze 阻害。 |

| 意味 | 宣言上の正本 | 緊張 |
| --- | --- | --- |
| 一次情報 | Patient Source | 低 |
| 事実 | Information | 低 |
| 思考 | Assessment | 低（文言混同のみ） |
| 関係 | Clinical Reasoning Network | 中（`supports` 段階導入） |
| 提出物 | Artifact | 中（form3 混在） |
| 事実根拠リンク | `evidenceInformationIds`（当面） | 高（Edge との将来二重） |
| 情報不足メモ | Assessment `needMoreInformation` | 中（Edge 型との関係） |
| 作業優先 | Network（推奨） | 中（表現未決） |
| 提出優先 | Artifact | 低（意図的分離） |

---

### 2.10 Emergence

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| 看護問題・優先・計画・関連図・様式3が Network から導かれる設計か | **OK** | Network §4 の創発表と Vision §3.4 が一致。入力起点禁止・自動完成禁止も一貫。 |

---

### 2.11 Version2 移行

| 確認項目 | 判定 | 要約 |
| --- | --- | --- |
| 破壊せず段階移行できるか | **保留** | 方針（案C・すぐ削除しない・同一 ID 維持）は非破壊。分類未決資産が並行稼働リスク。 |

---

## 3. 重大事項（必須抽出）

### 3.1 設計矛盾・緊張

| # | 内容 | 深刻度 | 扱い |
| --- | --- | --- | --- |
| 1 | `evidenceInformationIds`（当面正本）と Reasoning `supports` Edge の将来二重化 | 高 | 一本化条件を文書に書き切るまで Freeze 条件 |
| 2 | Assessment §2 の「Clinical Reasoning（思考の単位）」表記と Network＝関係層の定義が衝突 | 高 | 文言修正で解消可能 |
| 3 | `careNeed` が未決のまま論理モデルに先行搭載 | 高 | 残す／外すを決めて未決から下ろす |
| 4 | `form3_records` の Workspace＋Artifact 物理混在の長期化 | 高 | Phase B 完了定義（論理境界）を契約化 |
| 5 | `patient_understanding_records` の正式分類未決 | 高（移行） | Artifact/Reflection 仮分類でも可。Patient/Network 禁止は維持 |
| 6 | working priority（Network）の具体表現未決 | 中 | SSOT に「作業用／提出用」2行を追加し表現は後決可 |
| 7 | `needMoreInformation` と `requires_more_information` の編集責務未定義 | 中 | 運用1行で固定 |
| 8 | パターン単一 `judgment` 廃止と Final `judgment` 残存の移行ギャップ | 中〜高 | Artifact Model / Form3 契約でマトリクス化 |
| 9 | Vision「Learning Platform」と Domain「Learning Workspace」 | 低〜中 | Domain への追記または Vision 注記 |

### 3.2 責務重複

| 重複候補 | 現状 | 望ましい整理 |
| --- | --- | --- |
| 根拠関係 | 配列正本＋`supports` 段階 | Related Map 本格まで配列唯一。Edge 化時に移行ジョブ |
| Assessment↔Assessment | 薄い ID＋ Edge | Network 本格化で薄いリンク縮小 |
| 情報不足 | Assessment フィールド＋ Edge 型 | 編集 UI の正本を1つに決める |
| Evidence | 事実根拠 ID／知識 Evidence／V2 links | 「Evidence Information」と「Knowledge Evidence」を Domain で固定 |
| Care Need | Assessment メモ候補／様式・看護問題 | 位置を確定 |

### 3.3 命名揺れ

| 揺れ | 文書 |
| --- | --- |
| Learning Platform vs Learning Workspace | Vision vs Domain |
| Clinical Reasoning vs Clinical Reasoning Network vs Reasoning Map | Vision/Arch/Domain vs Network |
| Evidence / Evidence Information / Evidence Card / Evidence Link | Domain・Assessment・未決 |
| `additionalInformationNeeded` vs `needMoreInformation` | V2 互換 vs 正式概念 |
| sourceType 列挙の細分差 | Architecture vs Information Model（エイリアス可と明記済） |
| Related Map 日本語 UI 名 | Domain 未決 |

### 3.4 循環依存

| 種別 | 判定 |
| --- | --- |
| Modules ↔ Core（概念） | **循環なし** |
| データ正本の相互更新 | **擬似循環リスク**（二重候補が同時必須化された場合） |
| form3 payload 入れ子 | 依存方向は Module→Core。所有境界の濁り |

### 3.5 教育思想との不一致

| 項目 | 判定 |
| --- | --- |
| 成果物先作り禁止 / Golden Rule / Coach は問いのみ | **整合** |
| Assessment は正解ではない／複数併存 | **整合** |
| Confidence 保留（点数化忌避） | **整合** |
| Emergence（問題・優先は結果） | **整合** |
| 危険点 | Assessment＝「Clinical Reasoning」呼びは、関連図完成＝推論完成に見えやすい |
| 危険点 | `careNeed` の早置は「援助の必要性」様式先取りを誘発しうる |

### 3.6 Version2 移行リスク

| リスク | 内容 |
| --- | --- |
| judgment 二重期間 | パターン全体 judgment 廃止と Final 残存の共存契約が薄い |
| form3 schemaVersion | ID 維持方針はあるが並行読取・ロールバック契約が薄い |
| `information_cards`（ノート系）と Form3 Information | 二重テーブル長期化 |
| `patient_understanding_records` | Patient 誤分類で権限・Coach 範囲が壊れる |
| `form2_evidence_links` | Information 直付け運用が残ると Evidence 規則と衝突 |
| 案C JSONB 長期化 | Network Edge が payload 内アドホックに生えやすい |

---

## 4. 文書別クイックレーティング

| 文書 | 主評価 | 一言 |
| --- | --- | --- |
| 00 Vision | **OK** | 北極星として十分 |
| 01 Architecture | **要修正** | 骨格優秀。未決と二重管理が Freeze 阻害 |
| 02 Domain Language | **要修正** | 避ける語は強い。未決・CR 改名の追記が必要 |
| 03 Relationship | **OK** | SSOT／依存方向の正本。一本化条件の明文化が残る |
| 04 Information | **OK** | 最も凍結可能 |
| 05 Assessment | **要修正** | Atomic／看護問題分離は良い。§2 文言と careNeed が傷 |
| 06 CR Network | **OK** | Emergence と Related Map 分離は良い。supports／priority 未決は条件付き |

---

## 5. 総評と Core Design Freeze 判定

### 5.1 総評

Version3 Core セットは、**患者理解 → 事実 → 解釈 → 関係 → 提出**という教育哲学と、Modules→Core・SSOT・Atomic Unit・Emergence・非破壊移行というアーキテクチャ原則において、すでに「方向の正本」になりうる水準にある。

一方で、**根拠関係の二重候補・不足情報の二重候補・Care Need の未決先行・Evidence 名称・Clinical Reasoning 層の呼び方・form3 物理混在・V2 judgment / patient_understanding 分類**が未収束のまま残る。ここが全面 Freeze の実質ブロッカーである。

骨格を否定する矛盾は見当たらない。見つかった問題の多くは **文書パッチと一本化条件の明文化**で解消可能である。

### 5.2 判定: **条件付き Core Design Freeze 推奨（Conditional Freeze）**

**全面無条件 Freeze はまだ推奨しない。**  
次の条件を短文化して反映したうえで、**Conditional Freeze** を宣言することを推奨する。

#### 部分 Freeze してよいもの（すでに十分）

1. 5層の責務一行定義と `Modules → Core` のみ依存  
2. Information: 1カード1事実、解釈禁止、参照優先、soft delete  
3. Assessment: 1カード1解釈、最低1根拠 ID、classification 5区分、≠看護問題  
4. Related Map＝Module／座標等は Core 禁止  
5. Artifact: 学校様式不変、自動転記禁止、Draft 参照／Submission Snapshot  
6. Emergence: 問題・優先・計画・様式・関連図提出は結果であり入力起点にしない  
7. 非破壊移行原則（すぐ削除しない、案C、同一 ID 維持）  

#### Freeze 前の必須条件（CONDITIONS）

1. **根拠 SSOT:** Related Map 本格まで `evidenceInformationIds` 唯一正本。`supports` は導出表示のみ。一本化時は移行手順を書く。  
2. **命名:** Domain に「Clinical Reasoning（層）＝ Clinical Reasoning Network（同層の構造名）。Related Map＝Module」を追記。Assessment §2 の層混同文言を修正。  
3. **Care Need:** Core から外すか、「任意メモ・提出文にしない・様式非同期」で確定し未決から下ろす。  
4. **`patient_understanding_records`:** Artifact（Reflection）候補として仮分類。Patient/Network 禁止を強調。  
5. **Priority:** SSOT に作業用＝Network／提出用＝Artifact の2行を追加（表現詳細は後決可）。  
6. **Evidence Card:** 採用しない／Evidence Link（Module）など仮決定し、V2 `information_cards` との関係方針だけ固定。  
7. **Form3 混在:** Phase B 完了＝型・sanitize 上で Workspace と Final の境界が区別可能（物理分離は後続可）。  

---

## 6. 推奨する次フェーズ

| 順 | Phase | 内容 |
| --- | --- | --- |
| 0 | **Core Patch（文書のみ）** | 上記 CONDITIONS を `01`/`02`/`03`/`05`/`06` に短文化 → Conditional Freeze 宣言 |
| 1 | **Artifact Model** | Form2/Form3 Final、Snapshot 粒度、Nursing Problem/Plan、Reflection、judgment 正本 |
| 2 | **Form3 Phase B 契約** | schemaVersion 2：Workspace＝Information/Assessment、Final＝Artifact。judgment 移行マトリクス |
| 3 | **Evidence 方針メモ** | Knowledge Evidence＝Module；事実根拠＝配列；V2 links／ノート cards の統合ロードマップ |
| 4 | **実装入口** | コード変更は Phase B 承認後。テーブル新設は急がない（案C） |
| 5 | **Reasoning 最小** | 配列正本のまま Related Map 準備。`supports` 永続化は後続 |

**今やらない方がよいこと**

- 未決のまま `reasoning_edges` と `evidenceInformationIds` を同時必須化  
- Care Need / Evidence Card / Network メタを実装フィールドとして先行追加  
- 未決事項を推測で確定  

---

## 7. 監査サマリ表

| 観点 | 判定 |
| --- | --- |
| Vision | OK（Workspace 名称は保留） |
| Core Architecture 責務 | 要修正 |
| Domain Language | 要修正 |
| Relationship 依存 | OK |
| Information Atomic | OK |
| Assessment Atomic／≠看護問題 | OK（文言1箇所は要修正） |
| CR Network vs Related Map | OK |
| Artifacts／学校様式 | OK |
| SSOT | 要修正 |
| Emergence | OK |
| Version2 移行 | 保留 |

**Core Design Freeze:** 条件付き推奨（Conditional Freeze）  
**次:** Core Patch（文書）→ Artifact Model → Form3 Phase B 契約
