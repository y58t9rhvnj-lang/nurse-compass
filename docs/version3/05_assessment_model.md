# Compass Assessment Model（Phase M2）

- 文書種別: **Assessment Layer 完全設計**
- 正本前提（Concept Freeze）:
  - `00_compass_vision.md`
  - `01_compass_core_architecture.md`
  - `02_domain_language.md`
  - `03_relationship_model.md`
  - `04_information_model.md`
- ブランチ前提: `feature/version2-form3`
- 状態: **設計ドラフト（レビュー待ち）**
- 制約: コード・DB・Migration・TypeScript型・UI・`.cursor/rules` は変更しない

本文書は Assessment Layer の設計正本とする。実装および後続の Clinical Reasoning / Artifact Model は、本モデルと Relationship Model に従う。

用語は `02_domain_language.md` に従う。

---

## 1. 目的

Assessment Layer を完全設計し、**Assessment Card を「学生の思考」の最小単位（Atomic Unit）** として固定する。

| | Information | Assessment |
| --- | --- | --- |
| 何か | 事実 | その事実から学生がどう考えたか |
| Atomic Unit | 1カード＝1事実 | 1カード＝1 Interpretation（1つの意味づけ） |
| 正解か | 事実の切り出し | **正解ではない**。その時点の思考 |

---

## 2. 最重要原則

1. **Assessment は正解ではない。**  
2. Assessment は、その時点での学生の **思考の単位（Assessment Card）** である。Clinical Reasoning Network（関係の層）とは別である。  
3. 教員との対話、Evidence（知識の支え）、追加情報の収集によって **変化してよい。**  
4. 学校提出文ではない。様式への自動文章生成は禁止。  
5. 事実のコピーは持たない。根拠は Information ID 参照。  

避ける表現（Domain Language）:

- 「AIがアセスメントする」  
- 「Assessment＝看護問題」  
- 「正解のアセスメントを表示する」  

---

## 3. Assessment Card

### 3.1 定義

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Assessment Card |
| 正式日本語名 | アセスメントカード |
| 定義 | Information を根拠に、学生が行った **1つの解釈（Interpretation）** を保存する永続単位 |
| Atomic Unit | Compass における「思考」の最小単位 |

### 3.2 責務

1. **1 Card = 1 Interpretation**  
2. Classification（判断区分）を持てる  
3. **最低1件**の Information Card を根拠参照する（コピー禁止）  
4. 1パターンに複数 Card を許す  
5. 正常・強み・問題・リスク・情報不足が **同時に併存**してよい  
6. 修正・再考可能  
7. Clinical Reasoning の Node 候補になる  
8. Artifact の材料になるが、Artifact そのものではない  

### 3.3 例

**例1**

- Information: 食欲低下 / 体重減少  
- Assessment: 低栄養状態が疑われる  

**例2**

- Information: 夜間覚醒 / 昼間傾眠  
- Assessment: 睡眠リズムが乱れている可能性  

### 3.4 書いてはならないもの

| 禁止 | 置き場所 |
| --- | --- |
| 事実の再掲のみ（解釈なし） | Information |
| 複数の独立した解釈の連結 | 複数 Assessment Card |
| 因果・優先・対立の本格構造 | Clinical Reasoning |
| 正式な看護問題文・計画文 | Artifact |
| 援助の必要性（Care Need） | **Artifact**（Assessment に置かない。Core Patch） |
| 学校様式の完成欄 | Final Assessment Text（Artifact） |
| 教員コメント本文 | Review Module（別 Entity） |
| Coach の問い／回答ログ | Coach Module |

---

### 3.5 Care Need（Core Patch 決定）

| 案 | 置き場所 | 判定 |
| --- | --- | --- |
| A. Assessment | 解釈カードに援助メモ | 様式「援助の必要性」の先取り・看護問題化リスク |
| B. Clinical Reasoning Network | 関係の途中データ | Emergence と矛盾（援助は結果表現） |
| C. Artifact | 学校様式・計画前段 | **採用** |

**正式責務:** Care Need は Artifact。Assessment / Network Core フィールドにしない。  
**V2:** 既存 `careNeed` は Final／Artifact 欄へ移行マッピング（自動転記 UI は作らない）。

---

## 4. Atomic Unit

### 4.1 比較

| 案 | 例 | 内容 |
| --- | --- | --- |
| **A** | 「低栄養で転倒リスクが高い」を **1 Card** | 2つの解釈（状態＋リスク）を1つに結合 |
| **B** | 「低栄養状態」「転倒リスク」を **2 Card** | 各1 Interpretation |

### 4.2 評価

| 観点 | A | B |
| --- | --- | --- |
| Atomic Unit | 弱い（分割可能） | 強い |
| Classification | 1区分に無理に寄せる | それぞれ `problem` / `risk` 等を付与可 |
| Clinical Reasoning | 「低栄養→転倒リスク」の Edge が張りにくい | Edge で因果・寄与を表現できる |
| Evidence Information | 根拠の対応が曖昧 | 解釈ごとに根拠を選べる |
| Coach | 問いが複合的になりすぎる | 解釈単位で問いやすい |
| Artifact 統合 | 学生が後で結合して書ける | 同じ |

### 4.3 推奨案：**B（分割）**

**採用方針:** 独立した解釈・分類になりうるものは **別 Assessment Card** にする。

- 「低栄養状態が疑われる」と「転倒リスクがある」→ **2 Card**  
- 両者の関係（低栄養が転倒リスクに寄与する等）→ **Clinical Reasoning Edge**  

**例外（1 Card のまま許容しうる場合）:**

- 学習初期で、まだ分割できない一塊の仮説として書いている途中（後から分割を推奨）  
- 同一 Classification のもと、言い回しが本質的に1解釈である場合  

Module は分割提案をしてよい。強制マージはしない（Information Model と同思想）。

---

## 5. Assessment 構成（論理モデル）

Concept Freeze（Core Architecture）と整合し、本 Phase でフィールド責務を固定する。

```
AssessmentCard {
  id                         // ULID（Information と同様。作成瞬間に確定）
  userId
  organizationId
  academicYear
  caseId

  interpretation             // 思考本文（1 Interpretation）— §7
  classification             // 5区分 + null（draft）— §6
  evidenceInformationIds[]   // 1..N — §8（事実根拠の唯一正本）
  needMoreInformation?       // 追加で欲しい情報 — §9
                             // （別名候補: additionalInformationNeeded）

  patternKey?                // 主所属。原則0..1（運用上は1）— §10
  order
  status                     // draft | active | archived | deleted
  deletedAt?

  // 任意・薄い（恒久正本にしない）
  relatedAssessmentIds[]     // 暫定。本格関係は Reasoning へ
  // careNeed は持たない（Artifact 責務。Core Patch）

  createdAt
  updatedAt
}
```

### 5.1 必須・任意

| フィールド | 必須 | 備考 |
| --- | --- | --- |
| `interpretation` | 実質必須（空の active は Module が拒否しうる） | Atomic の本体 |
| `classification` | active 時は推奨〜必須（Module 定義） | draft 中は `null` 可 |
| `evidenceInformationIds` | **最低1**（Core 規則） | 0件は incomplete |
| `needMoreInformation` | 任意。`insufficient_information` 時は Module が強く推奨 | |
| `patternKey` | Form3 Workspace では実質必須 | 所有ではない |
| `status` / `order` / 日時 | 必須 | |
| `careNeed` | **持たない** | Artifact（学校様式の援助の必要性等）へ。Core Patch |
| `relatedAssessmentIds` | 任意・薄い | Reasoning 本格化後に縮小 |

### 5.2 所有軸

Information と同じ:

```
userId + organizationId + academicYear + caseId
```

学生間共有しない。教員は同組織 SELECT（本文編集はしない）。

---

## 6. Classification

### 6.1 正式分類（採用）

| コード | 正式英語名 | 正式日本語名 | 意味 |
| --- | --- | --- | --- |
| `functioning_normally` | Functioning Normally | 正常に機能している | 当該観点では適応・安定しているという解釈 |
| `strength` | Strength | 強みがある | 資源・強みとして捉える解釈 |
| `problem` | Problem | 問題がある | 現に生じている問題という解釈 |
| `risk` | Risk | 問題が生じる可能性がある | リスクという解釈 |
| `insufficient_information` | Insufficient Information | 情報不足で判断できない | 判断を保留し、追加情報を求める |

色（UI識別・Constitution 整合）: 緑／青／赤／オレンジ／グレー。**色は Module。テキスト必須。**

### 6.2 規則

1. 1 Card に Classification は **最大1つ**（または draft 中 `null`）。  
2. 同一パターン内で複数区分が **併存**してよい（複数 Card）。  
3. `problem` ≠ 看護問題（Nursing Problem / Artifact）。  
4. `insufficient_information` のとき、根拠 Information が0件であってはならない（「何が不足かの前提事実」も事実）。不足の明示は `needMoreInformation`。  

### 6.3 追加候補の比較（今回は採用しない）

| 候補 | 利点 | 欠点 | 判断 |
| --- | --- | --- | --- |
| `opportunity`（改善・維持） | 強みと正常の中間 | 5区分と重複しやすい | **不採用**（`strength` / `functioning_normally` で足りる） |
| `priority_high` を Classification に混ぜる | 早い | 優先は関係・重みの問題 | **不採用** → Clinical Reasoning |
| `hypothesis` | 仮説明示 | 全 Assessment が仮説的であり冗長 | **不採用**（原則「正解ではない」で足りる） |
| `null` / `unclassified` | 作成途中 | 永久放置の温床 | **draft のみ `null` 許容**。active では Module が分類を促す |

---

## 7. Interpretation

### 7.1 定義

Assessment の本文。Information から学生が行った意味づけ。

コード推奨名: `interpretation`  
「Analysis」は学校様式ラベル／説明用語に留め、Core フィールド名にしない（Domain Language）。

### 7.2 形式の比較

| 案 | 内容 | 評価 |
| --- | --- | --- |
| **A. 短文1本** | `interpretation` のみ（1〜数文） | Atomic に合う。関連図ラベルにも使いやすい |
| **B. タイトル＋本文** | `title` + `body` | 一覧性は高いが、タイトルが「看護問題名」化しやすい |
| **C. 長文エッセイ** | 様式提出並みの文章 | Artifact と責務が衝突。Workspace が重くなる |

### 7.3 推奨案：**A（短文中心の単一フィールド）**

- **短文〜中短文の `interpretation` 1本**を正とする。  
- タイトル必須は採用しない（看護問題名・提出見出しへの早期固定を避ける）。  
- Module が表示用に先頭を truncate するのは可。  
- 学校様式の長い「解釈・分析・援助の必要性」は **Final Assessment Text（Artifact）** で学生が統合する。  

**良い例:** 「低栄養状態が疑われる」「睡眠リズムが乱れている可能性」  
**避ける例:** 様式3の完成段落を Assessment にまるごと書く。

---

## 8. Evidence（根拠 Information）

### 8.1 定義（混同禁止）

| 用語 | 意味 |
| --- | --- |
| Evidence Information | Assessment が根拠とする **Information Card** の集合 |
| Evidence（知識） | Assessment を支える **知識・論文・ガイド等の結び**（別概念・Module 拡張） |

本節の「Evidence」は、ユーザ要求どおり **Information Card 参照**を指す。論文 Evidence ではない。

### 8.2 規則

1. Assessment → Information（`evidenceInformationIds[]`）  
2. **最低1件**必須  
3. **コピー禁止。ID 参照のみ**  
4. 同一 Information を複数 Assessment が参照してよい（N:N）  
5. Information 本文変更は Assessment を自動書き換えない（Information Model §10）  
6. Information soft delete 時: Assessment 残存、`missing_evidence` 警告  

### 8.3 知識 Evidence との関係

- 最小実装: `evidenceInformationIds` のみ（**事実根拠の唯一正本**）  
- Knowledge Evidence は **Evidence Link（Module）** で Assessment に付く（Information には付けない）  
- **Evidence Card は採用しない**（Core Patch）  
- `supports` Edge は Related Map 本格まで導出表示のみ（永続正本にしない） 

---

## 9. Need More Information

### 9.1 比較

| 案 | 置き場所 | 利点 | 欠点 |
| --- | --- | --- | --- |
| **A. Assessment フィールド** | `needMoreInformation` | 情報不足の解釈と一体。Form3 既存 `additionalInformationNeeded` と近い | Reasoning 全体の「情報ギャップ」一覧には弱い |
| **B. Clinical Reasoning のみ** | Edge / Gap Node | 横断的な不足情報を構造化しやすい | 単体 Assessment の `insufficient_information` と離れる |
| **C. 両方正本** | 二重 | — | SSOT 違反 |

### 9.2 推奨案：**A（Assessment に任意フィールド）＋ Reasoning は将来拡張**

- **正本:** Assessment の `needMoreInformation`（任意文字列）  
- `classification === insufficient_information` のとき、Module は入力を強く推奨（Core は空を絶対禁止とは限らないが、Form3 Final の学校規則とは別）  
- Clinical Reasoning 側の「情報不足ギャップ」構造化は **Reasoning Model で検討**（本 Phase では二重正本にしない）  

コード別名: Version2 互換で `additionalInformationNeeded` としてもよい。本モデルの正式概念名は **Need More Information**。

---

## 10. Pattern

### 10.1 結論

| | Pattern | 所有 |
| --- | --- | --- |
| Assessment | **主所属タグ**（`patternKey`、原則 **0..1 / 運用上1**） | user / org / year / case |
| Information | タグ配列 `patternKeys[]`（**0..N**） | 同上 |

Assessment の Pattern は **所有ではない**。どの機能的健康パターン視点の思考か、という所属タグである。

### 10.2 Information（0..N）との差

- Information は横断事実のため複数タグが自然。  
- Assessment は「1 Interpretation」のため、**主パターンを1つ**に置く（Core Architecture）。  
- パターンまたがり（例: 栄養の問題が活動耐性に影響）は **Clinical Reasoning** で結ぶ。  
- `patternKeys[]`（0..N）を Assessment に持たせる案は、主所属の曖昧化を招くため **本モデルでは採用しない**。  

### 10.3 Draft

作成直後は `patternKey` 未設定を許容しうる。Form3 Workspace 保存時は Module がパターン文脈を付与する。

---

## 11. Lifecycle

```
作成（ULID・interpretation 下書き・pattern 文脈）
  ↓
Evidence 追加（Information ID を1件以上）
  ↓
Classification / Need More Information の整備
  ↓
修正・再考（対話・追加情報・Evidence により変化してよい）
  ↓
Clinical Reasoning へ接続（Node / Edge）
  ↓
Artifact で利用（学生が様式へ統合。自動生成しない）
  ↓
Archive または soft delete
  ↓
（条件付き）hard delete — 例外
```

「完成してロック」は Assessment Core の必須ではない。提出ロックは Artifact Submission の責務。

---

## 12. 編集と影響伝播

| イベント | Assessment | Clinical Reasoning | Artifact Draft | Artifact Submission |
| --- | --- | --- | --- | --- |
| Information 更新 | 自動修正しない。根拠 ID 維持。警告は Module 任意 | 表示ラベルは最新 Information を読んで可 | 様式文は学生が再統合 | Snapshot 不変 |
| Assessment 修正（interpretation / classification 等） | `updatedAt` 更新。正解化ではない再考 | Edge は ID 維持。表示は最新解釈 | 追従しない（学生が再書く） | 不変 |
| Evidence Information の追加・削除 | 配列更新。0件化は incomplete | 端点欠け時は警告 | 同上 | 不変 |
| Assessment soft delete | 活性リストから除外 | 接続 Edge soft | 参照欠け表示 | Snapshot 維持 |

Source（Patient）変更は Information Model に従い、Assessment を自動書き換えしない。

---

## 13. 削除

| 方式 | 定義 | いつ | Reasoning / Artifact |
| --- | --- | --- | --- |
| **soft delete** | `status=deleted` + `deletedAt` | **標準** | Edge soft。Draft は欠け表示。Submission 不変 |
| **archive** | `status=archived` | 整理・学期末など。削除意思は弱い | 参照可。archived 表示 |
| **hard delete** | 物理削除 | 参照ゼロ＋ポリシー満たす場合のみ。当面必須にしない | 参照中は **禁止** |

Information Model と同方針。

---

## 14. Confidence（確信度）

### 14.1 比較

| 案 | 内容 | 利点 | 欠点 |
| --- | --- | --- | --- |
| **採用** | `confidence: low \| medium \| high` 等 | 学習分析・Coach 介入の材料 | 「正解への距離」スコア化に見えやすい。Vision の点数化忌避と緊張 |
| **保留** | フィールドを持たない | モデルが単純。再考可能性を status／updatedAt で表現 | 確信度の明示が遅れる |
| **Coach／分析側のみ** | Core 外メタ | Core を汚さない | 移植性が低い |

### 14.2 判断：**今回は保留（不採用）**

- Assessment は「その時点の思考」であり、確信度数値は必須ではない。  
- 将来、学習分析や Coach の Intervention Level と合わせて再検討する。  
- 採用する場合も **採点・順位付けに使わない**ことを条件とする。  

---

## 15. Teacher（教員コメント）

### 15.1 比較

| 案 | 内容 | 評価 |
| --- | --- | --- |
| **A. Assessment に直接フィールド** | `teacherComment` を Card 内 | 学生思考 SSOT が汚染される。所有・RLS が曖昧 |
| **B. 別 Entity（Review / Comment）** | Assessment ID を参照 | Core Architecture・Relationship と一致 |

### 15.2 推奨案：**B（別 Entity）**

- 教員コメントは **Review Module の別 Entity**。  
- Assessment 本文は学生のみが更新。  
- コメントは形成的支援であり、Assessment を「正解に上書き」しない。  

詳細スキーマ（スレッド、差し戻し）は未決。

---

## 16. Coach

| 項目 | 内容 |
| --- | --- |
| 読んでよい | interpretation, classification, evidenceInformationIds（解決後の Information）, needMoreInformation, patternKey, status |
| 返すもの | **Coach Question**（および慎重な Hint） |
| 書いてはならない | Assessment 本文・classification の代筆・自動確定 |
| ログ | Coach Module。Core Assessment に混ぜない |

問いの方向性例（文面は別 Phase）:

- 「この解釈を支える Information は足りていますか？」  
- 「低栄養と転倒リスクは、分けて考えられますか？」  
- 「これは問題ですか、リスクですか、それとも情報不足ですか？」  

---

## 17. Clinical Reasoning との責務分離

### 17.1 Assessment に置かない理由

| 関心事 | Assessment に置くと何が起きるか | 置くべき層 |
| --- | --- | --- |
| Assessment 同士の関係（因果・対立・補強・派生） | カードがグラフ化し、1 Interpretation が崩れる | **Clinical Reasoning Edge** |
| 優先順位 | Classification や本文に「最優先」が混入し、関係の重みと衝突 | **Clinical Reasoning**（または優先 Artifact） |
| 看護問題（正式） | `problem` 分類が提出問題文と同一視される | **Artifact**（Reasoning は前段の見通し） |
| 病態理解（つながりとしての） | 単発解釈に病態ストーリーを詰め込む | **Clinical Reasoning** |

### 17.2 一文

**Assessment = 点（その時点の解釈）。Clinical Reasoning = 点と点の関係。Artifact = 学校言語での提出表現。**

Related Map の座標・色・折りたたみは Module（Assessment / Reasoning Core に含めない）。

---

## 18. Artifact

1. Assessment は学校提出文ではない。  
2. 学生が Workspace の Assessment を見ながら、**自分の言葉で**様式3（Final Assessment Text 等）へまとめる。  
3. **自動文章生成・自動転記は禁止。**  
4. Draft Artifact は Assessment ID を参照しうる。Submission は Snapshot 固定。  
5. 提出後の Assessment 再考は学習として許容。Snapshot は変わらない。  

学校様式の項目名（解釈・分析・援助の必要性 等）は学校資料優先。Workspace 用語と混同しない。

---

## 19. Version2 との関係

### 19.1 form3_records

| Version2 | Version3 Assessment Model |
| --- | --- |
| `form3_records` 行 | 当面 **Artifact 永続化＋移行期に Workspace 論理を内包** |
| `patterns.*.assessmentCards[]` | **Assessment Card** の移行期入れ物 |
| Core 昇格後 | 同一 Assessment ID を維持したまま `assessment_cards` 等へ |

### 19.2 フィールド対応

| Version2（現行・再設計） | 本モデル |
| --- | --- |
| Workspace `assessment` / `assessmentCards[].interpretation` | `interpretation` |
| `judgment`（パターン全体の単一判断） | **廃止方向**。複数 Assessment の `classification` ＋ Final の `judgment`（Artifact） |
| Final / 旧 `judgment` | Artifact（学校様式の判断欄） |
| `judgmentRationale` | Artifact。Assessment 短文とは別 |
| `relatedInformation`（Workspace 長文） | **Information Card** へ分解。Final の同名欄は Artifact のまま |
| `assessment`（長文一体） | 複数 Assessment Card へ |
| `careNeed` | **Assessment に置かない**。Artifact（援助の必要性等）へ移行（Core Patch） |
| `additionalInformationNeeded` | `needMoreInformation` |
| `reviewed` / `isReviewed` | **Artifact / Module** の整理済み。Assessment `status` と混同しない |
| `evidenceCardIds` / 根拠 | `evidenceInformationIds` |
| 色付き判断 UI | Classification の Module 表現 |

**V2 `careNeed` 移行:** Assessment Core フィールドとしては採用しない。既存値がある場合は Final Form／Artifact の「援助の必要性」相当欄へマッピングする（自動転記 UI は作らず、移行スクリプトまたは手動整理）。

### 19.3 方針

- Version2 機能は本設計承認だけでは削除しない。  
- パターン全体の単一 `judgment` は、Assessment 複数化と矛盾するためモデルから除去し、Final のみに残す（Form3 redesign と一致）。  

---

## 20. ID・AutoSave（要約）

Information Model と同じ方針:

- 作成瞬間に **ULID** を付与し、それが Permanent ID  
- AutoSave 前でも Reasoning / Artifact Draft が参照してよい  
- サーバによる ID 振り直しはしない  

---

## 21. 未決事項

推測で確定しない。

1. ~~`careNeed`~~ → **Artifact 責務**（Core Patch 確定）。V2 既存値は Final／Artifact 欄へ移行マッピング  
2. `relatedAssessmentIds` を Reasoning 本格化後に廃止するか残すか  
3. `needMoreInformation` と Reasoning 上の情報ギャップ構造の将来接続  
4. 教員コメント Entity の詳細（スレッド・可視範囲・差し戻し）  
5. Assessment 改訂履歴テーブルの導入時期  
6. active 時に `classification` を Core 必須にするか Module 必須にするか  
7. Confidence を学習分析メタとして後から足す場合の格納先  
8. Form3 payload 内 Assessment と将来テーブルの物理移行手順（ID 維持は方針済み）  

---

## 22. 改訂方針

- Assessment の意味変更は本ファイルを更新し、Concept Freeze 文書と矛盾がないか確認する。  
- Information 根拠規則は `04_information_model.md` / Relationship R3 を優先する。  
- Reasoning／Artifact と衝突する場合は、責務分離（§17–18）を先に保ち、必要なら Relationship を改訂してから合わせる。
