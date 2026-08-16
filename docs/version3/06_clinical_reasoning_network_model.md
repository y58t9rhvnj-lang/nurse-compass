# Compass Clinical Reasoning Network Model（Phase M3）

- 文書種別: **Clinical Reasoning Network（思考ネットワーク）設計**
- 正本前提（Concept Freeze）:
  - `00_compass_vision.md`
  - `01_compass_core_architecture.md`
  - `02_domain_language.md`
  - `03_relationship_model.md`
  - `04_information_model.md`
  - `05_assessment_model.md`
- ブランチ前提: `feature/version2-form3`
- 状態: **設計ドラフト（レビュー待ち）**
- 制約: コード・DB・Migration・TypeScript型・UI・`.cursor/rules` は変更しない

本文書は Clinical Reasoning Layer の設計正本とする。Related Map・看護問題・様式提出は Module / Artifact であり、本 Network の代替ではない。

用語は `02_domain_language.md` に従う。Domain の「Clinical Reasoning」を、実装・教育説明上 **Clinical Reasoning Network** として明確化する（意味の正本は同じ層）。

---

## 1. 目的

Clinical Reasoning を「線（Edge）の集まり」だけと見ず、**学生の思考ネットワーク（Clinical Reasoning Network）** として設計する。

Compass は看護問題を書くシステムではない。  
Information と Assessment の関係を構築することで、看護問題・優先順位・看護計画・様式・関連図が **自然に見えてくる（Emergence：創発）** ことを支援する。

---

## 2. 最重要原則

1. Clinical Reasoning Network は、**学生が患者をどう理解したか**という思考構造である。  
2. **Related Map（関連図）はその一つの表現方法**であり、Clinical Reasoning そのものではない。  
3. Network の正本は Core。座標・色・折りたたみ等は Module。  
4. 看護問題・優先の正式提出表現は **Artifact**（入力の起点にしない）。  
5. Coach は Network を読み **Question のみ**返す。答え・看護問題を提示しない。  
6. Evidence（知識）は Assessment を支える。Network の Node にはしない。  

---

## 3. Clinical Reasoning Network の定義

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Clinical Reasoning Network |
| 正式日本語名 | 臨床推論ネットワーク（思考ネットワーク） |
| 定義 | ある学生・Case における Information / Assessment を Node、その意味的関係を Edge とした **思考構造の全体** |
| 含むもの | Node 参照、Edge、（任意）Network メタ、導出ビュー |
| 含まないもの | Related Map のレイアウト、学校提出文、看護問題の正式文、Evidence オブジェクト本体 |

**一文:** Assessment＝点（解釈）。Network＝点と点の関係の総体。Related Map＝その可視化 Module。Artifact＝学校言語での提出表現。

```
Case + Student
  └── Clinical Reasoning Network
        ├── Nodes  (references → Information | Assessment)
        ├── Edges  (relationType + rationale …)
        └── Views  (孤立、未接続、密度 … ※多くは導出)
```

---

## 4. Emergence（創発）

### 4.1 定義

十分な Patient → Information → Assessment → **Clinical Reasoning Network** が構築されると、次が **結果として** 見えてくる。

| 創発されるもの | 性質 |
| --- | --- |
| 看護問題 | Artifact。Network から学生が言語化する |
| 優先順位 | Network 上の見通し → 提出表現は Artifact |
| 看護計画 | Artifact |
| 様式3（Final Text） | Artifact。Workspace カードの自動結合ではない |
| 関連図（提出・印刷） | Related Map Module の表現／提出 Artifact |

### 4.2 入力の起点にしない

| やってはいけない | 理由 |
| --- | --- |
| 先に看護問題名を決め、後から事実を当てる | Compass の逆流。Vision 違反 |
| 先に様式3を埋め、Network を省略する | 成果物先作り |
| 関連図の見た目から Core 関係を推測して自動生成する | Module → Core の意味逆流 |

### 4.3 創発の支援（システムがやってよいこと）

- 孤立 Assessment / 未接続 Information を **問う**（Coach）  
- 関係密度や未結合を **可視化のヒント**にする（Module）  
- 看護問題文・優先リスト・様式文を **自動完成しない**  

---

## 5. Network の構成

### 5.1 Node

Node は **実体の複製ではない**。Information / Assessment への参照である。

| Node 種別 | 参照先 | 役割 |
| --- | --- | --- |
| Information Node | Information Card | 事実側の端点 |
| Assessment Node | Assessment Card | 解釈側の端点 |

将来オプション: Patient Source 直接 Node（当面は Information 化してから Node 化を推奨 — Core Architecture）。

```
ReasoningNodeReference {
  nodeType  // "information" | "assessment"
  nodeId    // Information ID | Assessment ID（ULID）
}
```

### 5.2 Edge

Edge は **関係のみ**を保持する。

```
ClinicalReasoningEdge {
  id                      // ULID
  userId
  organizationId
  academicYear
  caseId

  from: ReasoningNodeReference
  to:   ReasoningNodeReference
  relationType            // §6
  rationale?              // なぜこの関係か（学生の短文）
  label?                  // 短い表示語（任意・本文の代替にしない）

  // confidence?          // 将来。本 Phase は保留（Assessment と同様）

  status                  // active | deleted(soft)
  createdAt
  updatedAt
}
```

### 5.3 Network（集合）

永続の最小単位は **Edge の集合**（同一所有軸・Case）。  
「Network ドキュメント」を必須行として持つかは実装選択（未決）。論理上は常に1学生1 Case に1 Network。

---

## 6. Relation Type

### 6.1 候補一覧（概念セット）

| relationType | 意味（要約） | 典型 from → to |
| --- | --- | --- |
| `contributes_to` | 寄与する | Assessment/Info → Assessment |
| `causes` | 原因となる | 同上（強い因果） |
| `worsens` | 悪化させる | 同上 |
| `improves` | 改善する／良い方向に働く | 同上 |
| `protects` | 保護・緩衝する | 強み → 問題／リスク |
| `supports` | 根拠・支える | Information → Assessment（※下記二重管理注意） |
| `conflicts_with` | 対立・矛盾する | Assessment ↔ Assessment |
| `precedes` | 時間的に先行する | 任意 |
| `requires_more_information` | 追加情報が必要という関係的明示 | Assessment →（ギャップ）または Node 間 |

### 6.2 初期実装の絞り込み比較

| 案 | 初期セット | 利点 | 欠点 |
| --- | --- | --- | --- |
| **A. フルセット** | 上表すべて | 表現力最大 | UI 選択が重い。誤用増 |
| **B. 少数（推奨）** | Core Architecture 初期セットに近い | 学習・実装が安定 | 因果の強弱が粗い |
| **C. 超少数** | `relates_to` + `supports` のみ | 最短 | 創発支援が弱い |

### 6.3 推奨案：**B（初期少数）＋後期拡張**

**初期（実装・教育の第一線）:**

| 採用 | 理由 |
| --- | --- |
| `contributes_to` | 寄与・影響の基本 |
| `worsens` / `improves` | 悪化・改善の方向 |
| `supports` | 根拠関係（**段階導入** — 下記） |
| `relates_to` | その他・未整理の関係の受け皿 |
| `requires_more_information` | 情報不足を Network 視点で示す（Assessment の `needMoreInformation` と二重正本にしない運用は §11） |

**後期追加候補:**

- `causes`（`contributes_to` より強い因果が必要になったら）  
- `protects`  
- `conflicts_with`  
- `precedes`  

**原則:** UI が選ばない関係は作らない。種類を増やしすぎない。

### 6.4 `supports` と Assessment.evidenceInformationIds

| 根拠の表現 | 当面の正本 | 備考 |
| --- | --- | --- |
| Assessment → Information | **`evidenceInformationIds`** | Assessment Model / Relationship R3 |
| Reasoning Edge `supports` | 関連図・高度推論の段階追加 | **同時期に両方を必須正本にしない** |

Network 上で Information→Assessment を描く UI は、初期は evidenceInformationIds から **導出表示**してよい。Edge として永続化する時期は移行計画（未決の詳細あり）。

---

## 7. Node の責務

### 7.1 Information Node

| 保持する（参照経由） | 保持しない |
| --- | --- |
| Information Card ID | content / soType のコピー正本 |
| nodeType = information | classification、interpretation |
| | 座標・色・サイズ・折りたたみ |
| | Evidence オブジェクト |
| | 看護問題文 |

事実の正本は常に Information Card（`04_information_model.md`）。

### 7.2 Assessment Node

| 保持する（参照経由） | 保持しない |
| --- | --- |
| Assessment Card ID | interpretation / classification のコピー正本 |
| nodeType = assessment | 優先度スコアを Node 必須化すること（§12） |
| | UI レイアウト情報 |
| | 正式看護問題文 |
| | 教員コメント |

思考の正本は常に Assessment Card（`05_assessment_model.md`）。

### 7.3 共通禁止

**Node 自体に UI 情報を持たせない。**  
（x, y, color, collapsed, selected, zIndex, zoom 等は Related Map Module）

---

## 8. Edge の責務

Edge は **関係のみ**。

| 保持してよい | 保持しない |
| --- | --- |
| from / to | 端点 Card の本文コピー |
| relationType | レイアウト・矢印の見た目詳細（太さの装飾は Module） |
| rationale（短文） | 学校提出の長文 |
| label?（短い表示語） | Evidence 論文本文 |
| status / 所有軸 / 日時 | confidence（**本 Phase 保留**） |

### 8.1 削除

- Edge: soft delete 標準  
- 端点 Node の Card が soft delete → 接続 Edge も soft（Relationship Model）  
- hard delete は参照ポリシー満たす場合のみ（当面必須にしない）  

### 8.2 Assessment ↔ Assessment の薄いリンク

`relatedAssessmentIds` は暫定。本格関係は **本 Edge** へ寄せる（Assessment Model）。Network 本格化後に薄いリンクを縮小・廃止するかは未決。

---

## 9. Reasoning Network 全体として扱うもの

### 9.1 格納 vs 導出

| 関心事 | 推奨 | 説明 |
| --- | --- | --- |
| Edge 集合 | **格納** | Network の正本 |
| 孤立 Assessment | **導出** | 次数0（または有意 Edge なし）の Assessment Node |
| 未接続 Information | **導出** | Case 内 Information のうち、evidence にも Edge 端点にも出ていないもの |
| 関係密度 | **導出** | 例: Edge数 / 可能な Node 対数。閾値は Module／Coach 用 |
| 推論不足 | **導出＋問い** | 密度低・孤立多・`requires_more_information` 多い等。スコア化して順位付けしない |
| 優先順位 | **§12** | 作業用は Network、提出用は Artifact |

### 9.2 Network メタ（任意・将来）

永続メタの例（必須にしない）:

```
ClinicalReasoningNetworkMeta {
  caseId
  userId
  // workingPriorityAssessmentIds[]?  // §12 推奨を採る場合
  updatedAt
}
```

関係密度・孤立一覧を DB にキャッシュするかは実装最適化であり、概念正本は導出でよい。

---

## 10. Related Map Module（責務分離）

Related Map は **Module**。Network Core の別名ではない。

### 10.1 Core に保持しないもの（明示）

| Module 側 | 理由 |
| --- | --- |
| 座標（x, y） | 表示状態 |
| 色 | 装飾・強調（Classification 色と混同しうるが Module） |
| ノードサイズ | 表示 |
| 折りたたみ | 表示状態 |
| 選択・ホバー状態 | 一時 UI |
| ズーム・パン | ビューポート |
| 自動レイアウト結果 | アルゴリズム出力。関係意味ではない |
| 印刷余白・用紙設定 | 提出 Artifact／印刷 Module |

### 10.2 Module がしてよいこと

- Network（Edge + 端点参照）を読み、編集 UI を提供する  
- Edge の作成・relationType・rationale を **Core に書き戻す**  
- レイアウトを学生デバイスに保存する（Core 外）  
- 提出用関連図 Artifact を生成する（学生操作・Snapshot）  

### 10.3 禁止

- レイアウト変更だけで関係意味が変わったことにする  
- Core なしに「見た目だけの関連図」を Clinical Reasoning の正本にする  

---

## 11. Coach

Coach は Network を **読み**、学生へ **Question のみ**返す。

| してよい | してはならない |
| --- | --- |
| 孤立 Assessment を問う | 看護問題を提示する |
| 未接続 Information を問う | 「正解の関連」を描く |
| 根拠の十分性を問う | Assessment / Edge を代筆する |
| 別解釈の可能性を問う | Artifact を完成させる |
| `requires_more_information` 周辺を問う | 優先順位の正解を宣言する |

**問いの例（方向性）:**

- この Assessment の根拠は十分ですか  
- この Information から別の解釈はありますか  
- 孤立した Assessment はありませんか  
- つながっていない Information はありませんか  

ログは Coach Module。Network Core に問い文を埋め込まない。

### 11.1 `needMoreInformation`（Assessment）との関係

- Assessment 上の不足メモは **Assessment Model の正本**  
- Network の `requires_more_information` Edge は **関係としての明示**（段階導入）  
- 両方を必須同期しない。Coach は両方を読んで問ってよい  

---

## 12. Evidence

| 規則 | 内容 |
| --- | --- |
| Evidence の対象 | **Assessment を支える**知識・結び |
| Network への組込み | **Node / Edge として組み込まない** |
| Reasoning からの参照 | Assessment 経由、または Module が Assessment ID で Evidence を開く |
| Information への直付け | 禁止（Information / Relationship Model） |

事実根拠（Evidence Information）は Assessment の `evidenceInformationIds`。知識 Evidence は別。混同しない。

---

## 13. 看護問題

### 13.1 位置付け

看護問題は Clinical Reasoning Network の **途中データではない**。  
Network が十分に育った結果、学生が言語化する **Artifact** である。

| 層 | 役割 |
| --- | --- |
| Assessment `classification=problem` | 「問題がある」という **解釈区分**（看護問題文ではない） |
| Clinical Reasoning Network | 問題どうしの関係・寄与・悪化など **見通し** |
| Nursing Problem Artifact | 学校・計画で使う **正式な看護問題表現** |

### 13.2 Artifact である理由

1. 学校・施設の言語・様式に依存する（Institution-defined）。  
2. 提出・評価・計画の単位になる（Snapshot が必要）。  
3. Network に埋め込むと、思考過程が「問題名当て」に矮小化される。  
4. Emergence: 問題は関係構築の **結果**として現れる。  

自動決定・AI による看護問題の提示は禁止（Vision）。

---

## 14. 優先順位

### 14.1 比較

| 案 | 置き場所 | 利点 | 欠点 |
| --- | --- | --- | --- |
| **A. Assessment へ** | `priority: 1..n` フィールド | 実装が単純 | Atomic Interpretation が「順位付き提出物」化。複数文脈の優先と衝突 |
| **B. Clinical Reasoning Network へ** | 作業用順序／重み（メタまたは優先 Edge） | 関係と一体で見直せる。創発と一致 | 提出様式の文言とは別管理が必要 |
| **C. Artifact のみ** | 様式・看護計画の優先欄 | 学校提出に直結 | Workspace での試行錯誤がしにくい |

### 14.2 推奨案：**B（Network で作業）＋ C（提出は Artifact）**

```
作業中の優先の見通し  →  Clinical Reasoning Network（working priority）
提出・計画上の正式優先 →  Artifact（学生が自分で書く。自動転記しない）
```

- Assessment に恒久の `priority` フィールドは **採用しない**（Assessment Model の Classification 混入禁止と一致）。  
- Network の working priority 表現（順序配列 vs 重み vs 専用 relationType）の詳細は **未決**（§17）。  
- 採点・偏差値化しない。  

---

## 15. Lifecycle（要約）

```
Information / Assessment が存在する
  ↓
Edge を作成・編集（relationType + rationale）
  ↓
Network が育つ（孤立解消・密度向上は目的ではなく過程の兆候）
  ↓
Coach が問い、学生が再考
  ↓
看護問題・優先・様式・関連図提出が Artifact として創発
  ↓
Submission Snapshot（Artifact）
```

Network Edge も soft delete / archive 方針は他 Core に準拠。

---

## 16. Version2 との対応

| Version2 資産 | 本モデルでの位置 |
| --- | --- |
| 関連図 UI（将来・既存構想） | **Related Map Module**。座標等は Module。関係は本 Network |
| 「関連図＝推論そのもの」という運用理解 | **否定**。表現と Core を分離 |
| Form3 Workspace（Information / Assessment Cards） | Network の **Node 供給源**。Form3 は Module |
| Form3 Final（judgment 等） | **Artifact**。Network から自動生成しない |
| パターン全体の単一 `judgment` | 廃止方向（Assessment 複数化）。Network の代替ではない |
| `patient_understanding_records` | Patient / Network Core ではない。Artifact／Reflection 候補（分類未決） |
| Evidence / `form2_evidence_links` | Assessment を支える Module。Network Node にしない |
| `relatedAssessmentIds`（薄い） | Network Edge へ寄せる移行対象 |
| `form3_records` payload | 当面 Artifact＋Workspace。Network Edge テーブル化は関連図本格化時（Core Architecture 案C） |

---

## 17. 未決事項

推測で確定しない。

1. Network を「Edge 集合のみ」とするか、明示的 Network 行／メタを持つか  
2. working priority の具体表現（順序配列 / 重み / 専用 Edge）  
3. `supports` Edge を evidenceInformationIds からいつ永続二重化／一本化するか  
4. `requires_more_information` Edge と Assessment.`needMoreInformation` の運用ルール詳細  
5. Patient Source 直接 Node の許可時期  
6. `relatedAssessmentIds` の廃止時期  
7. 関係密度などの導出指標の教育利用ガイドライン（数値の見せ方）  
8. Edge の `confidence` 導入可否（Assessment Confidence 保留と揃えるか）  
9. 提出用関連図 Snapshot に Module レイアウトを含めるか（Relationship / Artifact 未決と連動）  

---

## 18. 改訂方針

- Network の意味変更は本ファイルを更新し、Concept Freeze と矛盾がないか確認する。  
- Assessment / Information の Atomic 規則と衝突する場合は、カード側文書を優先し、関係は Edge に落とす。  
- Related Map の UI 都合で Core の relationType を増やしすぎない。  
- 後続 Artifact Model は、本文書の Emergence 定義を入力起点にしないこと。
