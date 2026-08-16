# Compass Artifact Model（Phase B1）

- 文書種別: **Artifact Layer 正式設計**
- 正本前提: **Core Design Freeze v1**（Commit `fb0d990`）
  - `00`〜`06`、`99_core_design_review.md`
- ブランチ前提: `feature/version2-form3`
- 状態: **設計ドラフト（レビュー待ち）**
- 制約: コード・DB・Migration・TypeScript型・UI・`.cursor/rules` は変更しない

本文書は Artifact Layer の設計正本とする。Core（Patient / Information / Assessment / Clinical Reasoning Network）の意味を再定義しない。

用語は `02_domain_language.md` に従う。

---

## 1. 目的

Artifact Layer を正式設計する。

Artifact は、Core から **学生自身が統合して作成する成果物**である。

| 原則 | 内容 |
| --- | --- |
| 学校指定様式は変更しない | 項目名・順序・意味は学校資料優先 |
| 自動生成しない | Core からの自動転記・AI による完成をしない |
| Core ではない | 思考の正本は Core。Artifact は学校・教育機関向けの表現 |
| Emergence | 看護問題・優先・計画・様式・提出関連図は Network 等が育った **結果** |

---

## 2. Artifact の定義

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Artifact |
| 正式日本語名 | 成果物（アーティファクト） |
| 定義 | 学生が Clinical Reasoning（思考過程・Network を含む患者理解）を、**学校・教育機関が求める形式**で表現した成果物 |
| 層 | Core 第5層（Artifacts）。学習の目的そのものではない |
| 含むもの | Form2 / Form3 Final / 提出関連図 / 看護問題 / 看護計画 / Reflection / 教員提出向け様式 等 |
| 含まないもの | Information Card・Assessment Card・Reasoning Edge の正本、Related Map の作業用レイアウト単独 |

**一文:** Core＝考えたこと。Artifact＝それを学校の言葉・様式で書いたもの。

---

## 3. Artifact 分類

| kind（候補） | 正式概念 | 概要 | Core との関係 |
| --- | --- | --- | --- |
| `form2` | Form2 Artifact | 精神様式2（学校指定）。全体像の提出表現 | Patient／一部 Information 参照。自動転記しない |
| `form3` | Form3 Final Artifact | 精神様式3の **Final Form Text のみ** | Workspace（Core）を見て学生が統合 |
| `related_map_submission` | 提出版関連図 | Network の提出・印刷表現 | Edge 参照＋任意でレイアウト Snapshot |
| `nursing_problem` | 看護問題 Artifact | 正式な看護問題表現 | Network／Assessment から創発。Assessment に戻さない |
| `nursing_plan` | 看護計画 Artifact | 問題に基づく計画 | 看護問題 Artifact を参照・統合 |
| `reflection` | Reflection Artifact | 振り返り（「私が捉えた患者さん」等） | V2 `patient_understanding_records` |
| `teacher_submission` | 教員提出物 | 学校が求める教員向け提出パッケージ | 上記 Artifact の束ね／提出状態 |
| （将来） | 拡張 Artifact | 実習記録・OSCE 記録等 | Institution-defined Form＋Template |

**将来追加:** `artifactKind` / `templateId` で学校差異を吸収。Core 推論モデルは変えない。

---

## 4. Draft と Submission

### 4.1 比較

| | Draft Artifact | Submission |
| --- | --- | --- |
| 定義 | 編集中の成果物 | 提出確定した成果物 |
| 編集 | **可能** | **原則不可**（再提出フローは Module） |
| Core との関係 | **ID 参照**（追従しうる） | **Submission Snapshot** で固定 |
| 保存 | オートセーブ・途中保存 | 提出イベントで確定 |
| 更新 | 学生が更新可 | Snapshot 不変。メタ（受付日時等）のみ Module 可 |
| 監査 | 弱い〜中（過程） | **監査対象**（提出時点の表現） |
| 楽観ロック | DB `version`（行） | 提出後はロック／新リビジョン |

### 4.2 状態（論理）

```
draft → (submit) → submitted
                  ↘ (withdraw / revise は Module 定義)
```

`reviewed` / `isReviewed`（V2 Form3）は **提出確定（Submission）とは別**。整理済みの Module フラグであり、Submission Snapshot の代替ではない（§15）。

---

## 5. Snapshot

Core Architecture 案Cに従う。

### 5.1 何を保存するか（Submission 時）

| 項目 | 必須／任意 | 説明 |
| --- | --- | --- |
| 提出本文（学校様式フィールド） | 必須 | 学生が書いた文章・選択値 |
| 参照 Core ID 集合 | 推奨〜必須 | Information / Assessment / Edge 等の ID |
| 参照先の要約写し | 任意（段階導入） | 提出時点の短文要約。全文永久二重保管が目的ではない |
| 提出日時 | 必須 | `submittedAt` |
| 提出者 | 必須 | `userId`（所有軸と一致） |
| Case / org / year | 必須 | スコープ |
| Product Version | 推奨 | 例 Compass 2.1（学生・学校に見える版） |
| Core Version | 任意 | 設計世代の記録 |
| Schema Version | 必須級 | Artifact payload 構造番号 |
| Optimistic Lock Version | 行の話 | Snapshot 内容ではなく DB 行競合用。混同しない |
| Related Map レイアウト写し | 任意・未決 | 提出関連図のみ検討 |

### 5.2 何を Snapshot の目的にしないか

- Core 全文の常時ミラー  
- 提出後の Core 再考を禁止すること（学習は続く。Snapshot は提出表現のみ固定）  
- 自動生成された「正しい」様式文  

### 5.3 Version 語の区別（Domain Language）

| 用語 | Snapshot での使い方 |
| --- | --- |
| Product Version | 製品版を記録 |
| Core Version | 任意メタ |
| Schema Version | payload 互換 |
| DB `version` | 楽観ロック。Snapshot フィールド名に曖昧に `version` だけを使わない |

---

## 6. Core との関係

### 6.1 原則

| Draft | Submission |
| --- | --- |
| Core を **コピーして保持しない**。ID 参照 | 提出時点の表現＋参照 ID（＋任意要約）を **Snapshot** |
| Core 更新に追従しうる | Core 更新しても Snapshot は不変 |
| UI は「Core を見ながら書く」 | UI は「提出後に Core が変わった」を示しうる |

### 6.2 責務境界

| 層 | 責務 |
| --- | --- |
| Information / Assessment / Network | 事実・思考・関係の正本 |
| Artifact Draft | 学校様式文＋参照 ID |
| Artifact Submission | 提出確定表現＋Snapshot |
| Related Map Module | 作業レイアウト。提出版のみ Artifact |

### 6.3 禁止

- Form2 → Form3 自動転記  
- Assessment → Final 自動文章生成  
- Coach / AI による Artifact 完成  
- Artifact 本文を Assessment Core に書き戻す  

---

## 7. 学校指定様式

1. Compass は学校指定様式の **項目名・順序・構成・意味を変更しない**。  
2. Compass が変えるのは、様式を埋める前の **患者理解・思考の支援**（Learning Workspace / Core）。  
3. 学校資料の正式名称は学校資料を優先する（Domain Language）。  
4. テンプレート差異は `templateId` / 学校設定で吸収。Core は不変。  

```
Institution-defined Form
  → Artifact Template
    → Artifact インスタンス（Draft / Submission）
```

---

## 8. Care Need（Core Patch 反映）

| 項目 | 内容 |
| --- | --- |
| 正式位置 | **Artifact** |
| 典型の置き場 | Form3 Final の学校欄（解釈・分析・**援助の必要性** 等）、看護計画前段の記述 |
| Assessment | **置かない** |
| Network | **置かない** |
| V2 移行 | 既存 Assessment 側 `careNeed` 値は Final／Artifact 欄へマッピング（自動転記 UI は作らない） |

Care Need ≠ 看護問題の正式文。看護問題 Artifact は別 kind。

---

## 9. Reflection / patient_understanding

| 項目 | 内容 |
| --- | --- |
| 正式分類 | **Reflection Artifact** |
| V2 資産 | `patient_understanding_records`（テーブル名は当面維持） |
| 定義 | 学生が患者理解を振り返り・統合して記述する成果物 |
| Patient Core | **ではない** |
| Assessment | **ではない**（1 Interpretation ではない） |
| Network | **ではない** |

詳細は §14。

---

## 10. Form2

### 10.1 比較

| 見方 | 内容 | 判定 |
| --- | --- | --- |
| Artifact のみ | 学校様式2の提出・保存 | Version3 の正式位置 |
| Workspace のみ | 思考編集空間 | Form2 全体を Workspace と呼ぶのは不適切 |
| 両方 | V2 実装が「書きながら考える」UI を持つ | **移行期の実態**。概念上は Artifact。深い思考は Core／他 Workspace へ寄せる |

### 10.2 Version3 位置付け

- **正式:** Form2＝**Artifact**（`kind: form2`）  
- **Draft:** オートセーブ中の様式2本文＋任意 Core 参照  
- **Submission:** Snapshot  
- **Workspace ではない:** Information / Assessment Card 編集の正本場所ではない  
- V2 `form2_records`＝Artifact 永続化として維持。中身を「文章＋参照 ID」へ寄せる  

Form2 から Form3 への自動転記は禁止（Vision）。

---

## 11. Form3：Workspace と Final の分離

### 11.1 分離原則

```
Form3 Learning Workspace          Form3 Final Artifact
（Core を編集する Module UI）      （学校指定様式の成果物）
─────────────────────────────────────────────────────
Information Cards                 Final Information Text
Assessment Cards                  Final Assessment Text
（将来 Network 接続）             judgment / 援助の必要性 等
                                  isReviewed（Module 整理フラグ）
```

| | Workspace | Final |
| --- | --- | --- |
| 層 | Core（論理）＋ Module UI | **Artifact** |
| 目的 | 事実・解釈を原子単位で整理 | 学校様式へ学生が統合して記述 |
| 自動 | Card → Final の注入禁止 | — |
| V2 物理 | 当面 `form3_records.payload` に同居しうる | 同じ行の Final 部分。Phase B で型・sanitize 境界を契約 |

### 11.2 流れ

```
Workspace で Information / Assessment を育てる
  ↓
学生がカードを見ながら Final 欄へ自分の言葉でまとめる
  ↓
Draft Final → Submission Snapshot
```

### 11.3 judgment

- パターン全体の単一 `judgment`（Workspace）→ **廃止方向**  
- Final の学校欄 `judgment` → **Artifact に残す**（学校指定）  
- Assessment `classification` → Core（複数可）  

### 11.4 reviewed

- `isReviewed` / `reviewed`＝Module の整理済み。Submission の代替ではない  
- 提出確定は別操作（Submission）として定義する（詳細 UX は未決）  

---

## 12. 看護問題 Artifact

| 項目 | 内容 |
| --- | --- |
| 定義 | Clinical Reasoning Network が十分に育った結果、学生が言語化する **正式な看護問題表現** |
| 創発 | Emergence（Network Model）。入力の起点にしない |
| Assessment | `classification=problem` は解釈区分。**看護問題文を Assessment に戻さない** |
| 自動決定 | 禁止（Vision） |

Draft で問題文を試し、Submission で Snapshot。優先の提出表現は Artifact（作業用優先は Network）。

---

## 13. 看護計画 Artifact

| 項目 | 内容 |
| --- | --- |
| 定義 | 看護問題 Artifact をさらに統合した、援助・計画の成果物 |
| 参照 | 看護問題 ID、必要なら Assessment / Network（Draft は ID） |
| 自動生成 | 禁止 |
| Care Need | 計画・様式上の援助記述と近接しうるが、学校テンプレートに従う |

---

## 14. Reflection Artifact

### 14.1 定義

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Reflection Artifact |
| 正式日本語名 | 振り返り成果物 |
| 定義 | 患者理解の過程や全体像を、学生が振り返って記述する Artifact |
| V2 | `patient_understanding_records`（例:「私が捉えた患者さん」） |

### 14.2 違い

| | Reflection Artifact | Assessment | Patient Understanding（概念） |
| --- | --- | --- | --- |
| 何か | 振り返りの **提出・保存表現** | 1 Interpretation | Compass が育てる理解そのもの（層横断の目的語） |
| Atomic | 長文・統合文でありうる | 1カード1解釈 | エンティティではない |
| 層 | Artifact | Assessment Core | Vision の目的概念 |

### 14.3 移行

- すぐ削除しない。所有軸・RLS・autosave 維持  
- Artifact Model 上は `kind: reflection`  
- Coach は本文完成に使わない  

---

## 15. Teacher（教員コメント）

### 15.1 比較

| 案 | 内容 | 評価 |
| --- | --- | --- |
| A. Core（Assessment 等）に直接 | 思考正本が汚染される | 不採用（Assessment Model と一致） |
| B. Artifact／Review 付帯 | 提出物・整理単位にコメント | **推奨** |
| C. 独立 Review Entity が Artifact ID（と任意で Assessment ID）を参照 | スレッド・差し戻しに強い | **推奨の詳細形**（B の実装） |

### 15.2 推奨案

**教員コメントは Artifact／Review Module の別 Entity。**  
Assessment / Information / Network Core 本文には付けない。  
形成的支援であり、Artifact を「正解に上書き」しない。

差し戻し・再提出の状態機械は Module 詳細（未決）。

---

## 16. 論理モデル（設計）

```
ArtifactRecord {
  id
  kind                    // form2 | form3 | related_map_submission |
                          // nursing_problem | nursing_plan | reflection | …
  templateId?             // Institution-defined Form
  userId
  organizationId
  academicYear
  caseId

  lifecycle               // draft | submitted | …
  schemaVersion
  productVersion?         // 記録用
  coreVersion?            // 任意

  // Draft: 学校様式フィールド + coreRefs
  body                    // 様式ごとの構造（学校欄を壊さない）
  coreRefs? {
    informationIds[]
    assessmentIds[]
    edgeIds[]
    nursingProblemIds[]?  // 計画など
  }

  // Submission 時
  submissionSnapshot? {
    submittedAt
    bodyFreeze            // 提出本文
    coreRefsFreeze
    summaries?            // 任意
    layoutFreeze?         // 提出関連図のみ・未決
  }

  moduleFlags? {          // 例: isReviewed（Final 整理）— Submission と混同しない
    isReviewed?
  }

  createdAt
  updatedAt
}
```

物理テーブルは当面 V2 行（`form2_records` 等）を kind 別に流用してよい（案C）。

---

## 17. Version2 対応

| Version2 | Version3 Artifact Model |
| --- | --- |
| `form2_records` | Form2 Artifact（Draft／将来 Submission） |
| `form3_records` | **混在行**: Workspace 論理＋ Final Artifact。Final 部分＝本モデルの Form3 Artifact |
| `form3` Final 欄 | `relatedInformation` / `interpretation` / `judgment` 等＝学校指定。変更しない |
| `isReviewed` / `reviewed` | Module 整理フラグ。Submission ではない |
| パターン全体 `judgment` | 廃止方向。Final `judgment` のみ Artifact |
| `patient_understanding_records` | Reflection Artifact |
| `careNeed`（旧 Assessment 寄り） | Form3 Final／Artifact の援助欄へマッピング |
| `form2_evidence_links` | Knowledge Evidence（Module）。Artifact 本文の代替ではない |

**非破壊:** すぐ削除しない。Phase B 契約で payload 内の Workspace／Final 境界を型・sanitize で区別可能にする（物理分離は後続可）。

---

## 18. 将来 Module の利用

| Module | Artifact の使い方 | 禁止 |
| --- | --- | --- |
| Coach | 原則 Artifact 全文を完成させない。必要なら最小参照 | 代筆・自動完成 |
| Evidence | Assessment を支える。Artifact の根拠欄を自動埋めしない | Information 直付け |
| Analytics | 提出有無・過程メタ（個人特定最小化）。点数化・順位付けしない | 理解度スコア |
| Teacher Review | Artifact／コメント Entity。形成的フィードバック | Core 本文の教員上書き |
| Related Map | 作業は Module。提出版のみ Artifact Snapshot | レイアウト＝Network 正本 |

---

## 19. Lifecycle（横断）

```
Core が育つ（Information / Assessment / Network）
  ↓
学生が Artifact Draft を書く（様式・問題・計画・振り返り）
  ↓
参照 ID を任意で結ぶ
  ↓
Submission → Snapshot 固定
  ↓
教員コメント（Review）
  ↓
必要なら再提出（新 Snapshot）。旧 Snapshot は監査用に残しうる
```

---

## 20. 未決事項

推測で確定しない。

1. Submission 操作と `isReviewed` の UX／状態機械の詳細  
2. Snapshot に含める要約の粒度（ID のみか短文写しか）  
3. 提出関連図に Module レイアウトを Snapshot するか  
4. 看護問題／看護計画の学校テンプレート項目の標準セット（学校ごとに異なる前提）  
5. Reflection の正式 UI タイトル（「私が捉えた患者さん」等）の学校別扱い  
6. `teacher_submission` を独立 kind にするか、既存 Artifact の提出バンドルにするか  
7. Form3 の物理行分割時期（論理境界は本モデル＋ Phase B 契約）  
8. 再提出時に旧 Snapshot を何世代保持するか  
9. 教員コメント Entity のスレッド／可視範囲／差し戻し詳細  

---

## 21. 改訂方針

- Artifact の意味変更は本ファイルを更新し、Core Freeze 文書と矛盾がないか確認する。  
- 学校様式の項目変更は学校資料更新時のみ。Compass 都合では変えない。  
- Core Patch 決定（Care Need＝Artifact、Reflection＝patient_understanding）を覆さない。  
- Form3 Workspace を Artifact に再統合しない（分離を維持）。
