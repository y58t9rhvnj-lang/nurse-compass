# Compass Relationship Model（概念関係モデル）

- 文書種別: **概念間の依存・参照・責務**（ER図ではない）
- 上位文書: `00_compass_vision.md` / `01_compass_core_architecture.md` / `02_domain_language.md`
- ブランチ前提: `feature/version2-form3`
- 状態: **設計ドラフト（レビュー待ち）**
- 制約: 本ドキュメント作成時にアプリコード・DB・Migration・TypeScript型・UI・`.cursor/rules` は変更しない

**正本宣言:** 以降の Information Model / Assessment Model / Clinical Reasoning Model / Artifact Model は、本文書の Relationship 定義を正として設計する。

用語は `02_domain_language.md` に従う。

---

## 1. 目的

Compass Core に存在する概念同士の **Relationship** を定義する。

- 何が何を参照するか  
- 参照の向き  
- 多重度  
- 更新責任  
- 削除時の扱い  
- Single Source of Truth（SSOT）の所在  

テーブル設計やカラム定義は本文書の範囲外（後続の各 Model 文書）。

---

## 2. 設計原則（最優先）

### 2.1 Single Source of Truth

同じ意味の情報を複数の場所に保持しない。

| 意味 | 正本の所在 | 他場所での扱い |
| --- | --- | --- |
| 患者の一次情報 | **Patient**（Source Record） | コピー禁止。Information は参照＋学生の切り出し |
| 事実 | **Information**（Information Card） | Assessment / Artifact は ID 参照。本文の二重保持はしない |
| 思考 | **Assessment**（Assessment Card） | Artifact の提出文は学生が統合した別表現。自動同期しない |
| 事実根拠リンク | **Assessment.`evidenceInformationIds`** | `supports` Edge は導出表示のみ（Related Map 本格まで永続正本にしない） |
| Knowledge Evidence | **Evidence Link（Module）** | Assessment を支える。Network Node にしない。Information に付けない |
| 関係 | **Clinical Reasoning Network**（Edge） | Related Map は座標等のみ。関係意味のコピー正本にしない |
| 作業用優先 | **Clinical Reasoning Network**（メタ／表現は後決） | Assessment に priority フィールドを置かない |
| 提出用優先 | **Artifact** | 学生が記述。自動転記しない |
| 援助の必要性（Care Need） | **Artifact** | Assessment / Network Core に置かない |
| 振り返り（patient_understanding） | **Reflection Artifact** | Patient / Network Core ではない |
| 提出物 | **Artifacts** | Core の全文をコピーし続けない。Draft は参照、Submission は Snapshot |

Modules は Core を **参照して利用**する。コピー同期を基本としない。

### 2.2 参照優先・コピー例外

| 許可 | 禁止（原則） |
| --- | --- |
| ID 参照（`informationId`, `assessmentId`, `sourceRecordId`） | Form2 本文を Form3 に自動転記 |
| 提出時の **Submission Snapshot**（固定写し） | 編集中に Core 全文を Artifact へ常時コピー |
| UI 表示用の一時キャッシュ（揮発） | Module 状態を Core フィールドに埋め込む |

### 2.3 依存方向

```
Modules → Core   （許可）
Core ─X→ Modules （禁止）
```

---

## 3. 全体構造

### 3.1 主系列（学習の流れ＝参照の骨格）

```
Patient
  ↓  owns / contains
Source Record
  ↓  referenced by (student extracts)
Information
  ↓  evidenced by (1..N → Assessment)
Assessment
  ↓  related via
Clinical Reasoning
  ↓  expressed as / referenced by
Artifact
```

矢印は「上流の正本 → 下流が参照する」方向。下流は上流の意味を所有しない。

### 3.2 横断・補助系列

```
Information ──────────────► Assessment     （根拠参照・必須）
Assessment ◄─────────────► Assessment     （任意・薄い／または Reasoning へ委譲）
Assessment ───────────────► Clinical Reasoning
Clinical Reasoning ───────► Artifact       （提出物が関係を参照／表現）
Information ─(optional)───► Artifact       （直接参照・転記ではない）
Evidence ─────────────────► Assessment     （知識・根拠の支え。Information には付けない）
Coach ─reads──────────────► Information / Assessment / Clinical Reasoning
Coach ─emits──────────────► Coach Question
Coach ─X──────────────────► Artifact 完成
```

### 3.3 テキスト全体図

```
┌─────────────────────────────────────────────────────────────┐
│                         Modules                              │
│  Form2 / Form3 / Related Map / Coach / Evidence UI / …       │
│                         │ reads/writes via                   │
│                         ▼                                    │
│  Patient ─► Source Record                                    │
│                 │                                            │
│                 ▼                                            │
│            Information ◄──── Evidence (supports Assessment)  │
│                 │                                            │
│                 ▼                                            │
│            Assessment ◄─────► Assessment (optional / thin)   │
│                 │                                            │
│                 ▼                                            │
│         Clinical Reasoning (Edges = 関係の正本)               │
│                 │                                            │
│                 ▼                                            │
│              Artifact  (Draft: refs / Submission: Snapshot)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Relationship 一覧

各 Relationship の記載形式:

| 項目 | 意味 |
| --- | --- |
| 主体 | 関係の起点概念 |
| 相手 | 関係の終点概念 |
| 関係 | 関係の意味 |
| 多重度 | 1:1 / 1:N / N:N |
| 参照方向 | 誰が誰の ID を持つか |
| 更新責任 | 誰が更新するか |
| 削除時の扱い | soft delete・参照切れ・連鎖 |

---

### R1. Patient → Source Record

| 項目 | 内容 |
| --- | --- |
| 主体 | Patient |
| 相手 | Patient Source Record |
| 関係 | 患者が持つ一次記録の集合 |
| 多重度 | 1:N |
| 参照方向 | Source Record が `patientId` / Case スコープを持つ。または Patient カタログが Source 一覧を所有 |
| 更新責任 | 教材管理者（シード／CMS）。学生は更新しない |
| 削除時の扱い | 教材側ポリシー。学生思考が参照中なら hard delete 禁止。Source は不変前提が基本 |

---

### R2. Source Record → Information

| 項目 | 内容 |
| --- | --- |
| 主体 | Information Card |
| 相手 | Patient Source Record |
| 関係 | 事実カードが元記録を参照する（切り出し） |
| 多重度 | N:1（複数カードが同一 Source を参照可）。1 Source から N Information |
| 参照方向 | Information → Source（`sourceReference` / `sourceRecordId`） |
| 更新責任 | Information は学生。Source は教材管理者 |
| 削除時の扱い | Source 削除（将来）時: Information 参照は残し、Module が「元更新／欠損」警告。Information soft delete は R3 へ |

**SSOT:** カルテ本文の正本は Source。Information は学生の事実表現＋参照。

---

### R3. Information → Assessment（根拠）

| 項目 | 内容 |
| --- | --- |
| 主体 | Assessment Card |
| 相手 | Information Card |
| 関係 | Assessment の根拠（Evidence Information） |
| 多重度 | N:N（1 Information を複数 Assessment が参照可。1 Assessment は **最低 1** Information） |
| 参照方向 | **Assessment → Information**（`evidenceInformationIds[]` が **唯一正本**） |
| 更新責任 | 学生（Assessment 所有者） |
| 削除時の扱い | Information は **soft delete**。Assessment は自動削除しない。参照切れは `missing_evidence` 等として UI 警告。hard delete は参照ゼロかつ期間経過後のみ検討 |

**SSOT（Core Patch）:**

1. 事実根拠の唯一正本＝`evidenceInformationIds`  
2. Related Map 本格化まで `supports` Edge は **永続正本にしない**（配列から導出表示可）  
3. 一本化時は移行ジョブで Edge 生成→配列 deprecated。同時必須正本にしない  
4. Evidence Link（Knowledge Evidence）は Module。本 R3 の代替ではない 

---

### R4. Assessment ↔ Assessment（任意・薄い）

| 項目 | 内容 |
| --- | --- |
| 主体 | Assessment Card |
| 相手 | Assessment Card |
| 関係 | 思考同士の直接リンク（暫定または補助） |
| 多重度 | N:N（任意） |
| 参照方向 | 双方向または片方向 ID 配列（例 `relatedAssessmentIds`） |
| 更新責任 | 学生 |
| 削除時の扱い | soft delete。相手側リンクは dangling 許容＋UI 警告、または相互 soft |

**Clinical Reasoning との責務分離（必須）:**

| 置き場所 | 向いているもの | 向かないもの |
| --- | --- | --- |
| Assessment ↔ Assessment（薄い） | 「同じパターン内の関連メモ」「一時的なまとめ」程度 | 原因／結果／補強／対立／派生の本格構造 |
| Clinical Reasoning Edge | 原因・結果・補強・対立・派生・時間・保護など **関係の意味** | Assessment 本文のコピー |

**方針:** 本格な Assessment 間関係（原因・結果・補強・対立・派生）は **Clinical Reasoning の責務**。Assessment 直リンクは暫定・薄く、Related Map／Reasoning 本格化後は Edge へ寄せ、二重正本を解消する。

許可しうる意味ラベル（Edge 側の例）:

- causal（原因／結果）  
- supports / reinforces（補強）  
- conflicts（対立）  
- derives_from（派生）  
- temporal（前後）  

これらを Assessment フィールドに恒久正本として持たない。

---

### R5. Assessment → Clinical Reasoning

| 項目 | 内容 |
| --- | --- |
| 主体 | Clinical Reasoning Edge |
| 相手 | Assessment（および必要に応じ Information）を Node として参照 |
| 関係 | 思考・事実を関係づける |
| 多重度 | 1 Assessment : N Edge（端点として）。Edge は 2 Node |
| 参照方向 | Edge → Node IDs |
| 更新責任 | 学生 |
| 削除時の扱い | Node soft delete 時、接続 Edge も soft delete。Edge 単独 soft delete 可 |

**Core に含めないもの（Module）:** 座標、色、折りたたみ、ズーム、選択状態、アニメーション。

---

### R6. Clinical Reasoning → Artifact

| 項目 | 内容 |
| --- | --- |
| 主体 | Artifact |
| 相手 | Clinical Reasoning（Edge 集合）および／または提出用 Related Map 表現 |
| 関係 | 推論関係を成果物として参照・表現する |
| 多重度 | 1 Case スコープ内で 1..N Artifact : 0..N Edge 参照 |
| 参照方向 | Artifact → Edge IDs（Draft）。Submission 時は Snapshot に固定 |
| 更新責任 | 学生（提出）。教員はコメント等の付帯（本文所有ではない） |
| 削除時の扱い | 提出済 Snapshot は Core 削除の影響を受けない。Draft 参照は dangling 警告 |

---

### R7. Information → Artifact（直接参照ケース）

| 項目 | 内容 |
| --- | --- |
| 主体 | Artifact |
| 相手 | Information Card |
| 関係 | 成果物が事実カードを **参照**する（例：様式上の根拠表示、提出 Snapshot 内の ID） |
| 多重度 | N:N（任意） |
| 参照方向 | Artifact → Information IDs |
| 更新責任 | 学生が Artifact 側の参照を選ぶ／統合文を書く |
| 削除時の扱い | Draft: 警告。Submission Snapshot: 提出時点の写しを維持 |

**禁止:** Information 本文を Artifact に常時コピーして SSOT を崩すこと。許可されるのは (1) 学生が書いた学校様式テキスト (2) 提出 Snapshot。

---

### R8. Evidence → Assessment

| 項目 | 内容 |
| --- | --- |
| 主体 | Evidence（知識・根拠オブジェクト／リンク） |
| 相手 | Assessment |
| 関係 | Assessment を支える知識・根拠（**患者の生情報そのものではない**） |
| 多重度 | N:N |
| 参照方向 | Evidence → Assessment（および必要なら知識 ID）。Information には **直接付けない** |
| 更新責任 | 学生（リンク作成）。知識カタログは教材／管理者 |
| 削除時の扱い | Evidence Link soft delete。Assessment は残す |

**Evidence vs Information（責務差）:**

| | Information | Evidence |
| --- | --- | --- |
| 何か | この患者について切り出した **事実** | Assessment を支える **知識・根拠の結び** |
| 付く先 | Assessment の根拠集合の一方（事実側） | Assessment（支え側） |
| 付かない先 | （Evidence と呼ばない） | Information に直接付けない |

最小実装では `evidenceInformationIds`（事実根拠）が Assessment に付き、Knowledge Evidence は **Evidence Link（Module）**。Evidence Card は採用しない（Core Patch）。

---

### R9. Coach → Information / Assessment / Clinical Reasoning

| 項目 | 内容 |
| --- | --- |
| 主体 | Compass Coach（Module） |
| 相手 | Information / Assessment / Clinical Reasoning |
| 関係 | 読み取り → Coach Question を返す |
| 多重度 | 1 セッションが N カード／Edge を参照可 |
| 参照方向 | Coach → Core（read）。Core は Coach を知らない |
| 更新責任 | Coach ログは Coach Module。Core 本文は学生のみ |
| 削除時の扱い | Coach ログ削除は Module。Core に影響しない |

**禁止関係:** Coach → Artifact 完成（書込・自動生成）。Coach は Artifact を学生の代わりに埋めない。

---

### R10. Case スコープ → 学生思考 Core

| 項目 | 内容 |
| --- | --- |
| 主体 | Case |
| 相手 | Information / Assessment / Clinical Reasoning / 学生 Artifact |
| 関係 | 教育課題単位の所有・分離キー |
| 多重度 | 1 Case : N 各 Core エンティティ（学生ごと） |
| 参照方向 | 各レコードが `case_id`（＋ user / org / year）を持つ |
| 更新責任 | スコープキーはシステム／課題定義。中身は学生 |
| 削除時の扱い | Case 終了は論理アーカイブ。思考データの一括 hard delete はしない |

---

### R11. Institution-defined Form → Artifact Template → Artifact

| 項目 | 内容 |
| --- | --- |
| 主体 | Institution-defined Form |
| 相手 | Artifact（via Template） |
| 関係 | 学校指定様式が成果物の型を決める |
| 多重度 | 1 Template : N Artifact インスタンス |
| 参照方向 | Artifact → templateId / formKind |
| 更新責任 | 様式定義は学校／管理者。記入は学生 |
| 削除時の扱い | 様式定義変更は既存提出 Snapshot を壊さない |

---

### R12. Related Map Module → Clinical Reasoning

| 項目 | 内容 |
| --- | --- |
| 主体 | Related Map Module |
| 相手 | Clinical Reasoning Edge |
| 関係 | 関係の表示・編集 UI |
| 多重度 | 1 UI ビュー : N Edge |
| 参照方向 | Module → Core。レイアウト状態は Module 専用ストア |
| 更新責任 | 関係意味は学生が Core 更新。座標は Module |
| 削除時の扱い | レイアウト削除 ≠ Edge 削除。Edge soft delete 時は Module が非表示 |

---

## 5. Information → Assessment（詳細）

### 5.1 規則

1. Information Card は **複数 Assessment から参照可能**（N:N）。  
2. Assessment は **最低 1 件以上**の Information を根拠とする。  
3. 根拠の正本参照は Assessment 側（`evidenceInformationIds`）。  
4. Information は Assessment の存在を知らなくてよい（逆参照索引は実装最適化であり概念正本ではない）。

### 5.2 Information 削除時

| 段階 | 扱い |
| --- | --- |
| soft delete | 標準。参照中でも可 |
| Assessment | 残す。自動削除しない |
| UI | 根拠欠けを明示（再選択・再考を促す） |
| Clinical Reasoning | 端点が Information の Edge は soft |
| Artifact Draft | 参照警告 |
| Artifact Submission | Snapshot 維持（提出時の写し） |
| hard delete | 参照ゼロ＋ポリシー満たす場合のみ（当面必須にしない） |

---

## 6. Assessment ↔ Assessment と Clinical Reasoning（責務境界）

```
Assessment Card ──(thin related ids, optional)── Assessment Card
        │                                              │
        └──────────── Clinical Reasoning Edge ─────────┘
                     （原因・結果・補強・対立・派生 等の正本）
```

| やりたいこと | 置く場所 |
| --- | --- |
| この事実でこう考えた | Assessment（＋ Information 根拠） |
| この考えとあの考えは因果／対立 | **Clinical Reasoning Edge** |
| 画面上の位置・色 | Related Map Module |
| 提出用の関連図画像／様式記載 | Artifact |

---

## 7. Clinical Reasoning（関係そのもの）

### 7.1 Core が保持する

- Reasoning Node 参照（Information / Assessment 等の ID）  
- Reasoning Edge  
- Relation Type  
- Rationale（短い理由）  
- soft delete / Case スコープ / 所有  

### 7.2 Module が保持する（Core 禁止）

- 座標・レイアウト・ズーム  
- 色・アイコン・折りたたみ  
- 一時的な表示フィルタ・選択状態  

### 7.3 Artifact との関係

Related Map の「見た目」を提出する場合でも、**関係の意味の正本は Edge**。提出 Snapshot は提出時点の Edge 集合（および必要なら Module レイアウトの写し）を固定する。レイアウト写しの要否は未決。

---

## 8. Artifact：Draft・Submission・Snapshot

### 8.1 役割

Artifact は Core を利用して作る成果物。Core の代替ではない。

### 8.2 Draft vs Submission

| | Draft Artifact | Submission |
| --- | --- | --- |
| 状態 | 編集中・オートセーブ | 提出確定 |
| Core との関係 | **ID 参照**を基本。Core 変更に追従しうる | **Submission Snapshot** で固定 |
| 学校様式本文 | 学生が統合して記述（自動転記しない） | 提出時点の本文を固定 |
| 変更 | 学生が更新可 | 原則ロック。再提出フローは Module |

### 8.3 Snapshot の考え方

```
提出時:
  Artifact Draft
    + 解決済み参照（Information / Assessment / Edge IDs）
    + その時点で必要な表示用要約（任意・粒度未決）
  → Submission Snapshot（不変）
```

- Snapshot は「コピー同期の常態」ではなく **提出というイベントの固定**。  
- 提出後に Core が変わっても Snapshot は変わらない。UI は「提出後に Core が更新された」を示しうる。  
- Core 全文の永久二重保管を目的としない。

### 8.4 Form3 における関係（概念）

| 部分 | 層 |
| --- | --- |
| Information Card / Assessment Card（Workspace） | Core（または Core 論理を内包する移行期 payload） |
| Final Information Text / Final Assessment Text | Artifact |
| 学校項目名・順序 | Institution-defined Form（変更しない） |

---

## 9. Evidence Relationship（再整理）

```
Patient Source ──► Information ──► Assessment ◄── Evidence
                      （事実）         （思考）     （知識・支え）
```

- Evidence は Information に直接付けない。  
- Assessment の「根拠情報」集合（事実 ID）と、Evidence（知識リンク）は混同しない。  
- 名称 **Evidence Card は採用しない**。Knowledge Evidence は Evidence Link（Module）。Relationship 上の責務は上図で固定（Core Patch）。

---

## 10. Coach Relationship（再整理）

```
Coach Module
  │ read
  ├─► Information
  ├─► Assessment
  └─► Clinical Reasoning
  │ emit
  └─► Coach Question / (optional) Coach Hint
  │ forbid
  └─X► Artifact 自動完成
```

Coach ログ・Intervention Level・Learning State は Module／将来モデル。Core 5層の SSOT を汚さない。

---

## 11. Module 依存ルール

### 11.1 許可

```
Modules → Core
```

| Module（例） | 参照してよい Core |
| --- | --- |
| Form3 Workspace | Information, Assessment |
| Form3 Final / Form2 | Artifact（＋必要なら Core ID 参照） |
| Related Map | Clinical Reasoning, Assessment, Information |
| Coach | Information, Assessment, Clinical Reasoning（read） |
| Evidence UI | Assessment（＋知識カタログ） |
| 教員レビュー | Artifact / コメント付帯。思考 Core は閲覧ポリシーに従う |

### 11.2 禁止

```
Core → Modules
```

| 禁止例 |
| --- |
| Information が様式3タブ状態を持つ |
| Assessment が関連図 x,y を必須に持つ |
| Patient が Form2 保存ステータスに依存する |
| Core sanitize が特定 Module 文言に分岐する |
| Clinical Reasoning が印刷レイアウトを持つ |

### 11.3 Artifact 例外の位置づけ

学校様式の `templateId` は Artifact Module 設定であり、推論 Core の一部ではない。Core が Module 実装詳細に依存することにはならない。

---

## 12. 更新責任（Layer 別）

| Layer / 概念 | 主更新者 | 備考 |
| --- | --- | --- |
| Patient / Source Record | 教材管理者 | 学生は read |
| Case 定義 | 管理者／課題設計 | |
| Information | 学生 | |
| Assessment | 学生 | |
| Clinical Reasoning | 学生 | |
| Artifact Draft / Submission | 学生 | 提出操作も学生 |
| Evidence Link | 学生 | 知識マスタは管理者 |
| Coach ログ | システム（Coach Module） | Core 本文は書かない |
| Teacher Comment | 教員 | Artifact／レビュー付帯。Assessment 本文と分離 |
| Organization / Academic Year | 管理者 | |
| Related Map レイアウト | 学生（Module 状態） | 関係意味は Reasoning Core |

---

## 13. 将来 Module × Core 利用

| 将来 Module | 主に利用する Core | 備考 |
| --- | --- | --- |
| 関連図（Related Map） | Clinical Reasoning（＋端点の Information/Assessment） | 座標は Module |
| 看護問題 | Artifact が正本寄り。Reasoning は優先・関係 | Domain Language 未決を継承 |
| 看護計画 | Artifact。Assessment / Reasoning を参照 | 自動生成しない |
| Reflection | **Reflection Artifact**。Core は参照のみ | V2 `patient_understanding_records`＝本種（Core Patch） |
| 学習分析 | Information / Assessment / Reasoning のメタ（個人特定最小化） | 点数化・順位付けしない |
| OSCE | Case / Patient + Assessment / Reasoning の一部 | 教材境界を守る |
| 国家試験演習 | 原則 Core 外の学習 Module。必要なら一般知識 Evidence | 患者 SSOT を汚染しない |

---

## 14. Version2 資産との対応

| Version2 資産 | Relationship 上の位置づけ | 移行の方向 |
| --- | --- | --- |
| `form3_records` | **Artifact 永続化**（現状 payload に Workspace 論理も内包） | Workspace 部分 → Information / Assessment 関係へ分離。Final → Artifact。Draft 参照 → 提出時 Snapshot |
| `form3_records.payload` 内カード論理 | 移行期の **Information→Assessment** 関係の入れ物 | Core 昇格後も同一 ID 参照を維持 |
| `form2_records` | **Artifact**（Form2） | Core 参照＋Snapshot 方針へ寄せる |
| `patient_understanding_records` | **Reflection Artifact** | Patient / Network ではない。テーブル名は当面維持し、意味を振り返り成果物として扱う（Core Patch） |
| `information_cards`（ノート／Evidence 系） | Information Core の **先祖**、または Evidence Module 併存 | Form3 Information Card との統合は未決。統合するなら R2/R3 の Information 正本へ |
| `form2_evidence_links` / evidence_links | **Evidence → Assessment**（または Form2 Artifact 付帯） | Assessment 根拠モデル（R3/R8）へ接続。Information 直付けにしない |
| 関連図 UI（将来） | Module → Clinical Reasoning（R12） | |
| 所有軸・RLS・楽観ロック | Case スコープ関係（R10）の実装基盤 | 維持 |

**Reflection 分類比較（Core Patch）:**

| 案 | 判定 |
| --- | --- |
| Assessment | 不採用（解釈カードではない） |
| 独立 Module（Core 外の別層） | 不採用（成果物として Artifact に属する） |
| Reflection Artifact | **採用** |

**V2 移行:** `patient_understanding_records` をすぐ削除しない。所有軸・RLS・autosave を維持し、Artifact Model で Reflection テンプレートとして契約する。Coach は原則本文完成に使わない。

---

## 15. 削除・ライフサイクル（横断）

| イベント | 原則 |
| --- | --- |
| 学生思考の削除 | soft delete 標準 |
| 参照中の upstream 削除 | 下流を自動 hard delete しない |
| 参照切れ | UI 警告＋再考を促す |
| 提出済 Artifact | Snapshot 固定。Core soft delete の影響を受けない |
| Patient Source | 不変前提。変更時は参照維持＋警告 |

---

## 16. 未決事項

推測で確定しない。

1. ~~根拠の配列 vs `supports`~~ → **Core Patch 確定**（配列唯一正本。一本化は Related Map 本格時＋移行ジョブ）  
2. Assessment ↔ Assessment の薄いリンクを **残すか廃止か**（Reasoning へ完全委譲するか）。  
3. Submission Snapshot の粒度（ID のみ／カード要約を含むか／Related Map レイアウトを含むか）。  
4. ~~`patient_understanding_records`~~ → **Reflection Artifact**（Core Patch 確定）  
5. 既存 `information_cards` と Form3 Information の同一正本化時期。  
6. ~~Evidence オブジェクト第1級~~ → Knowledge Evidence は Module（Evidence Link）。Core 第1級にしない（Core Patch）  
7. Nursing Problem を Artifact のみとするか、Reasoning に「問題ノード」を許すか。  
8. 教員コメントの格納 Relationship（Review Module 詳細）。  
9. 1 Patient : N Case 有効化時の Source／思考スコープ境界の詳細。  
10. working priority の具体表現。  
11. Form3 Workspace／Final の物理分離時期（Phase B 論理境界は方針済み）。 

---

## 17. 改訂方針

- Relationship の変更は本ファイルを更新し、Vision / Core Architecture / Domain Language と矛盾がないか確認する。  
- 後続 Model 文書が本ファイルと衝突する場合は、**本ファイルを先に改訂**してから Model を合わせる。  
- Version2 物理テーブル名は移行完了まで併記してよいが、概念名は Domain Language を優先する。
