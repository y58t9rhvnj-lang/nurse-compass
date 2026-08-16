# Compass Information Model（Phase M1）

- 文書種別: **Information Layer 完全設計**
- 正本前提（Concept Freeze）:
  - `00_compass_vision.md`
  - `01_compass_core_architecture.md`
  - `02_domain_language.md`
  - `03_relationship_model.md`
- ブランチ前提: `feature/version2-form3`
- 状態: **設計ドラフト（レビュー待ち）**
- 制約: コード・DB・Migration・TypeScript型・UI・`.cursor/rules` は変更しない

本文書は Information Layer の設計正本とする。後続の Assessment / Clinical Reasoning / Artifact Model、および実装は本モデルと `03_relationship_model.md` に従う。

用語は `02_domain_language.md` に従う。

---

## 1. 目的

Information Layer を完全設計し、**Information Card を Compass 全体の最小単位（Atomic Unit）** として固定する。

将来の次は、すべて Information を起点（または根拠の事実側）として成立する。

| 上位／隣接 | Information との関係 |
| --- | --- |
| Assessment | 根拠として Information ID を参照（最低1件） |
| Clinical Reasoning | Node 候補として参照 |
| Related Map | 表示・編集は Module。事実の正本は Card |
| Coach | 事実を読み、問いを返す |
| Evidence | Assessment を支える知識。Information には直接付けない |
| Artifacts | Draft は ID 参照。Submission は Snapshot。転記自動生成しない |

---

## 2. 設計原則

### 2.1 何を保持するか

Information は **患者から得られた事実** のみを保持する。

### 2.2 書いてはならないもの

| 禁止 | 例（書かない） |
| --- | --- |
| 解釈 | 「不安が強いため拒薬している」 |
| 判断 | 「服薬自己管理は不可能」 |
| 推測 | 「おそらく低血糖だろう」 |
| 看護問題 | 「服薬管理能力の低下」 |
| 援助 | 「服薬指導が必要」 |
| 学校提出の完成文 | Final Form Text そのもの |

これらは Assessment / Clinical Reasoning / Artifact の責務である。

### 2.3 Single Source of Truth（再掲）

- 一次記録の本文正本 → **Patient Source Record**  
- 学生が切り出した事実の正本 → **Information Card**  
- Assessment / Reasoning / Artifact は **コピーせず ID 参照**（提出 Snapshot のみ例外的固定）

---

## 3. Information Card

### 3.1 定義

| 項目 | 内容 |
| --- | --- |
| 正式英語名 | Information Card |
| 正式日本語名 | 情報カード |
| 定義 | 学生が Patient Source から切り出した、または自ら観察した **1事実** の永続単位 |
| Atomic Unit | Compass における事実の最小単位。これ以上分割できない／すべきでない粒度を目指す |

### 3.2 責務

1. **1カード＝1事実**  
2. 解釈を書かない  
3. 可能な限り Source Reference を持つ  
4. 複数 Assessment から同一 Card を参照できる  
5. Clinical Reasoning / Related Map の Node 候補になる  
6. 学生の独自観察（手入力）も扱える  

### 3.3 良い例（1事実）

- 薬は飲みたくない  
- SpO₂ 91%  
- HbA1c 9.2%  
- 夜間3回覚醒  
- 母が服薬管理  

### 3.4 悪い例（混入）

- 「SpO₂ 91% のため呼吸状態が悪い」（事実＋解釈）  
- 「食欲低下と体重減少があり栄養障害のリスク」（複数事実＋判断）  
- 「服薬自己管理ができない」（判断／看護問題寄り）  

### 3.5 論理フィールド（設計）

Concept Freeze（Core Architecture）と整合する論理モデル。

```
InformationCard {
  id                      // Permanent ID（ULID 推奨）— §7
  userId
  organizationId
  academicYear
  caseId                  // 思考スコープの主キー側

  content                 // 事実テキスト（解釈なし）
  soType                  // "S" | "O"  — Information Type（性質）
  sourceType              // 情報源分類 — §5
  sourceReference         // 構造化参照 — §7
  sourceLabel             // UI 用短い出所表示

  observedAt?             // 観察・記録日時（任意）
  patternKeys[]           // 0..N — タグ（所有ではない）— §8
  order                   // リスト並び（UI用）。IDに順序を埋め込まない

  status                  // active | archived | deleted
  deletedAt?              // soft delete 時刻
  createdAt
  updatedAt
  // 楽観ロック用 DB version は永続化層の話（Product/Core/Schema Version とは別）
}
```

**持たないもの:** classification、interpretation、careNeed、座標、様式タブ状態、Evidence オブジェクト本体、Artifact 本文。

---

## 4. Atomic Unit：1カード1事実

### 4.1 比較

| 案 | 例 | 内容 |
| --- | --- | --- |
| **A** | 「食欲低下と体重減少」を **1カード** | 2つの観察を1事実として結合 |
| **B** | 「食欲低下」「体重減少」を **2カード** | 各1事実 |

### 4.2 評価

| 観点 | A | B |
| --- | --- | --- |
| Atomic Unit | 弱い（分割可能） | 強い |
| Assessment 根拠の粒度 | 粗い（片方だけ根拠にしたいときに困る） | 細かく参照できる |
| Clinical Reasoning | エッジが粗い | 因果・時間を精密に結べる |
| Coach | 「どちらが先か」等の問いが曖昧 | 事実単位で問いやすい |
| Artifact 統合 | 学生が後で結合して書ける | 同じ |
| 作成コスト | 低い | やや高い（許容） |

### 4.3 推奨案：**B（分割）**

**採用方針:** 独立して観察・測定・発言として成立する事実は **別カード** にする。

- 「食欲低下」と「体重減少」→ **2カード**  
- 結合が必要なのは Assessment（「栄養状態の悪化を示唆する」）または Artifact の学校様式文  

**例外（1カードのまま許容）:**

- 同一発言の不可分な一塊（例: 「薬は飲みたくない、副作用が怖い」を学習段階で1発言として扱う場合）— ただし後から分割可能であることが望ましい  
- 臨床的に一体の測定セットを教材が1 Source Record としている場合でも、**数値は可能な限り1指標1カード**（SpO₂ と BP は分ける）

**Module 支援（設計方針・実装は別 Phase）:** 長い貼り付け時に「分割を提案」してよい。強制マージはしない。

---

## 5. Information Source（情報源）

### 5.1 原則

**Source = どこから来たか。**  
**soType（S/O）= 情報の性質。**  
両者を混同しない。同一 Source から S も O も取りうる（例: カルテ内の患者訴え＝S、カルテ内の検査値＝O）。

### 5.2 Source Type 一覧（最低限）

| sourceType（コード候補） | 日本語 | 含むもの | 備考 |
| --- | --- | --- | --- |
| `chart` | カルテ | 電子／紙カルテの記載全般 | 医師・看護の区別が明確なら下位で分解可 |
| `patient_conversation` | 患者会話 | 患者本人との会話 | |
| `family_conversation` | 家族会話 | 家族・キーパーソンとの会話 | Domain の family と整合 |
| `nursing_record` | 看護記録 | 看護記録・看護サマリ | chart の下位でも可。当面並列許可 |
| `physician_record` | 医師記録 | 医師記載・指示 | 同上 |
| `lab` | 検査 | 検体検査・画像レポートの事実値 | |
| `vital` | バイタル | SpO₂、BP、脈拍、体温等 | |
| `observation` | 観察 | 客観的観察（誰が観察したかは Label／Reference） | |
| `medication` | 薬剤 | 処方・与薬事実 | |
| `treatment` | 治療 | 処置・治療事実 | |
| `student_observation` | 学生観察 | 学生自身の観察・聞き取りの手入力 | `sourceReference.kind: manual` と併用 |
| `other` | その他 | 上記に入らない | 乱用しない |

**マッピングメモ（既存 Domain / Core との整合）:**

- Core Architecture の `conversation` → 本モデルでは `patient_conversation` / `family_conversation` に細分（実装時にエイリアス可）  
- Core の `family` / `social` → 会話以外の家族情報・社会背景は `family_conversation` または `other`＋Label、あるいは将来 `social` を残す（**`social` 継続可否は未決**）  
- Core の `observation` と本表の `student_observation` は近い。手入力の学生観察は `student_observation` を推奨

### 5.3 Source Reference / Source Label

| 概念 | 役割 |
| --- | --- |
| Source Type | 分類コード |
| Source Reference | 構造化参照（kind, sourceRecordId, path?, note?） |
| Source Label | UI 表示用短い出所（「看護記録 6/1」「自分の観察」） |

```
sourceReference: {
  kind: "fixture" | "manual" | "db",
  sourceType: "...",           // Card 上の sourceType と一致推奨
  sourceRecordId?: string,     // fixture/db では推奨〜必須級
  path?: string,               // 教材内パス（過度に長くしない）
  note?: string                // 手入力時の短い出所メモ
}
```

手入力（`student_observation` / `other` + `kind: manual`）は `sourceRecordId` なしを許容する。

---

## 6. Information Type（情報の性質）

### 6.1 定義

Information Type は **事実の性質**であり、Source ではない。

| 値 | 正式日本語 | 意味 |
| --- | --- | --- |
| `S`（Subjective） | 主観的情報 | 患者・家族等の訴え・主観的報告 |
| `O`（Objective） | 客観的情報 | 観察・測定・記録上の客観的事実 |

コード上の推奨名: `soType`（`informationType` に Source を混ぜない）。

### 6.2 Source との直交

| | S | O |
| --- | --- | --- |
| 患者会話 | 「薬は飲みたくない」 | （通常少ない） |
| 検査 | （稀） | HbA1c 9.2% |
| カルテ | 記載された訴え | 記載された所見・数値 |
| 学生観察 | 聞き取った訴え | 見た・測ったこと |

### 6.3 持たない「Type」

次を Information Type にしない（Source または他層へ）:

- laboratory / vital / medication（→ sourceType）  
- problem / risk（→ Assessment classification）  
- nursing_problem（→ Artifact）  

---

## 7. ID 設計

### 7.1 用語

| 用語 | 定義 |
| --- | --- |
| Information ID | Information Card の識別子（永続の正） |
| Source Record ID | Patient Source Record の識別子（参照先） |
| Temporary ID | 作成直後〜サーバ確定前のクライアント側 ID（多くの場合、最初から ULID を振り **そのまま Permanent にする**） |
| Permanent ID | 永続化後も変わらない Information ID |

### 7.2 ULID 採用理由

| 理由 | 説明 |
| --- | --- |
| クライアント生成可能 | 作成瞬間に ID が決まり、参照を即時張れる |
| AutoSave 親和 | Assessment が未保存の Information を根拠参照できる |
| 時系列ソート容易 | ULID の時間成分（補助。正式な観察時刻は `observedAt`） |
| 衝突耐性 | 実用上極めて稀。サーバは重複拒否 |
| Offline | オフライン作成→再接続マージがしやすい |

Core Architecture の方針と一致: **クライアント ULID 許容**。DB uuid のみに固定するかは実装 Phase の選択だが、本 Information Model は **ULID を標準推奨**とする。

### 7.3 AutoSave との関係

```
1. UI で Card 作成 → クライアントが ULID 付与（この時点で Information ID 確定）
2. Dirty → Saving → Saved（楽観ロックは行 version）
3. 未 Saved でも Assessment は同 ULID を evidenceInformationIds に入れてよい
4. 保存失敗時: Card はローカル保持。参照は切れない（ID が先に在るため）
```

サーバが別 uuid を振り直す方式は **採用しない**（参照破壊のため）。衝突時のみ再生成を検討。

### 7.4 Offline 対応

| 状態 | 扱い |
| --- | --- |
| Offline 作成 | ローカルに ULID + Card。キューに保存 |
| 再接続 | 同一 ID で upsert。所有軸で衝突検知 |
| Offline 中の参照 | Assessment / 一時 Reasoning も同一 ULID で張る |
| 競合 | Optimistic Lock。勝ち負けは Module UX（Relationship の Conflict） |

詳細プロトコル（CRDT 等）は未決。モデルとして **ID 先決め**までを本 Phase で固定する。

### 7.5 Source Reference と ID

- Information ID ≠ Source Record ID  
- 複数 Information が同一 `sourceRecordId` を参照してよい（切り出し粒度の違い）  

---

## 8. Pattern タグ設計

### 8.1 結論

`patternKeys[]` は **タグ（分類ラベル）** であり、**所有（ownership）ではない**。

| | Pattern タグ | 所有 |
| --- | --- | --- |
| 何か | どの機能的健康パターン視点で使うか | 誰のレコードか |
| 多重度 | **0..N（複数付与可）** | user / org / year / case で一意に所属 |
| 削除 | タグを外しても Card は残る | 所有者が変わると別物 |

### 8.2 規則

1. 複数パターンにまたがる事実を許可する（関連図・横断アセスメントに必要）。  
2. パターン未設定（空配列）を許容する（後からタグ付け）。  
3. Assessment は原則 **主 patternKey を1つ**（Core Architecture）。またがりは Reasoning で表現。  
4. Form3 Module が「今見ているパターン」でフィルタしても、Card の正本タグは配列のまま。  

### 8.3 所有軸（再掲）

```
userId + organizationId + academicYear + caseId
```

学生間共有はしない。教員は同組織 SELECT（編集しない）。

---

## 9. 重複

### 9.1 比較

| 方針 | 内容 |
| --- | --- |
| 複数 Card 許可 | 同一事実に見える文を複数持つ |
| Reference のみ | 同一 Source からは1 Card に強制 |

### 9.2 推奨案

**同一 `sourceRecordId` + 同一 user/case で「既存 Card を提案」。強制マージはしない。**

理由:

- 教育上、言い換え・再記述・学習過程の再考がありうる  
- Atomic 分割のやり直し（1枚→2枚）を妨げない  
- 完全同一の大量複製だけを Module が警告すれば足りる  

**推奨しない:** サイレント自動マージ、Source につき Card 1枚の強制。

---

## 10. 編集と影響伝播

### 10.1 元情報（Source）変更

| 前提 | 扱い |
| --- | --- |
| 教材 fixture | **不変前提** |
| 将来 DB 教材更新 | `sourceReference` は残す。Card `content` は学生側が正。Module が「元が更新された」警告を出しうる |

Source 変更で Assessment / Artifact を自動書き換えしない。

### 10.2 Information 更新（学生が content / soType / source / tags を変更）

| 影響先 | 扱い |
| --- | --- |
| Assessment | **自動更新しない**。根拠 ID は維持。内容変化は Module が「根拠が更新された」表示を検討（必須ではない） |
| Clinical Reasoning | Edge は ID 参照のまま。表示ラベルは最新 content を読んでよい |
| Artifact Draft | 参照 ID 維持。学校様式本文は学生が再統合 |
| Artifact Submission | **Snapshot 固定**。提出後の Information 変更は Snapshot に影響しない |

### 10.3 解釈を後から足したくなった場合

Information を「解釈付き」に編集しない。  
→ 新しい **Assessment** を書く／既存 Assessment を直す。

---

## 11. 削除：soft delete / archive / hard delete

| 方式 | 定義 | いつ使うか | Assessment 参照中 |
| --- | --- | --- | --- |
| **soft delete** | `status=deleted` + `deletedAt`。一覧から消すが ID は残る | **標準の削除** | **許可**。根拠欠け警告。Assessment 自動削除なし |
| **archive** | `status=archived`。活性リストから退場だが削除意思は弱い | 整理・学期末・使わなくなったが履歴として残したい | 参照可。UI は archived 表示 |
| **hard delete** | 行物理削除 | 参照ゼロ＋保持ポリシー満たす場合のみ。当面必須にしない | **禁止** |

**推奨ライフサイクル上の削除:** soft delete を正とする。archive は任意の整理状態。hard delete は運用・移行の例外。

Reasoning: Information soft delete 時、端点 Edge も soft（Relationship Model）。  
Artifact Submission: 影響なし（Snapshot）。

---

## 12. Lifecycle（全体）

```
作成（ULID 付与・content / soType / source）
  ↓
編集（事実の修正・タグ・出所の整備）— 解釈は入れない
  ↓
Assessment から参照（evidenceInformationIds、N:N）
  ↓
Clinical Reasoning で利用（Node）
  ↓
Artifact で利用（Draft 参照 → Submission Snapshot）
  ↓
Archive または soft delete
  ↓
（条件付き）hard delete — 例外
```

各段階で Information は **事実の正本**であり続け、下流がコピーで分岐しない。

---

## 13. Assessment との関係

### 13.1 規則（Relationship R3）

1. 1 Information → 複数 Assessment から参照可（N:N）  
2. 1 Assessment → **最低 1** Information  
3. 参照方向: Assessment → Information（`evidenceInformationIds` が当面の正本）  
4. Information は Assessment 一覧を必須保持しない（逆索引は実装最適化）  

### 13.2 根拠不足時

| 状況 | 扱い |
| --- | --- |
| Assessment 保存時に根拠 0 件 | **拒否または incomplete 状態**（Module）。Core 規則として「最低1」を維持 |
| 根拠 Information が soft delete | Assessment 残存。`missing_evidence` 警告。再選択を促す |
| 根拠が解釈混入カード | 教育・Coach で分割／書き換えを促す（自動修正しない） |

### 13.3 Evidence Information という呼び方

Assessment が指す Information 集合は Domain Language 上 **根拠情報（Evidence Information）**。  
これは **Evidence オブジェクト（知識）とは別**（§14）。

---

## 14. Evidence との違い

| | Information | Evidence |
| --- | --- | --- |
| 何か | この患者について切り出した **事実** | Assessment を支える **知識・根拠の結び** |
| 層 | Information Layer（Core） | Evidence Module（Knowledge Evidence / Evidence Link） |
| 付く先 | Assessment の事実根拠 | Assessment（支え） |
| 付かない先 | — | **Information に直接付けない** |
| 例 | SpO₂ 91% | 「慢性呼吸器疾患の観察ポイント」へのリンク等 |

**避ける表現:** Information を Evidence と呼ぶ。**Evidence Card は採用しない。**

最小実装: Assessment の `evidenceInformationIds` のみで事実根拠を表現。Knowledge Evidence は Module。

---

## 15. Coach の利用

Coach は Information を **読み**、答えを書かない。

| 利用 | 内容 |
| --- | --- |
| 読んでよい | content, soType, sourceType, sourceLabel, patternKeys, observedAt |
| 目的 | 事実の粒度・出所・S/O・パターン横断の抜けを問う |
| 返してよい | Coach Question /（慎重な）Hint |
| 書いてはならない | Information content の代筆、Assessment／Artifact の完成 |
| 送ってよい範囲 | 当該 Case の必要最小。無関係患者・Artifact 全文は送らない（Core Architecture セキュリティ） |

例（問いの方向性・実装文面は別）:

- 「このカードは1事実になっていますか？」  
- 「これは S ですか O ですか？ 出所は？」  
- 「同じ Source からまだ切り出せる事実はありますか？」  

---

## 16. 検索・将来構造

本論理モデルは、将来の検索軸をフィールドとして保持できる。

| 検索 | 対応フィールド | 構造上の可否 |
| --- | --- | --- |
| Information 全文 | `content` | 可（JSONB→テーブル昇格後は索引しやすい） |
| タグ（Pattern） | `patternKeys[]` | 可（配列包含） |
| Source | `sourceType`, `sourceRecordId` | 可 |
| S/O | `soType` | 可 |
| 時系列 | `observedAt`, ULID 時間, `createdAt` | 可。表示ソートは `observedAt` 優先を推奨 |
| Case / 所有者 | `caseId`, `userId`, … | 可（必須フィルタ） |
| 活性のみ | `status`, `deletedAt` | 可 |

**移行:** 当面 Form3 payload 内でも同一論理フィールドを持てば、検索 API 追加時にマッピング可能。正規化テーブル化は利用が重くなった段階（Core Architecture 案C）。

---

## 17. Version2 との関係

| Version2 資産 | 本モデルとの関係 | 方針 |
| --- | --- | --- |
| `information_cards`（ノート／Evidence 系テーブル） | Information Core の **先祖候補** | 統合時期・同一テーブル可否は **未決**。意味は本 Card 定義へ寄せる |
| `student_notes` / notes 系 | 自由記述メモ。Atomic Fact とは限らない | Information と同一視しない。移行時は「事実化できるものだけ Card 化」 |
| Patient 教材（fixture / カルテ表示） | **Patient Source**。Information ではない | Card は参照するだけ |
| Form2（`form2_records`） | **Artifact**。Facts のコピー倉庫にしない | 必要なら Information ID を参照 |
| `form2_evidence_links` | Evidence →（将来）Assessment。Information 直付けではない | |
| Form3 `form3_records` payload 内の情報カード論理 | 移行期の Information 入れ物 | schemaVersion 進化で本フィールドへ寄せる。昇格後も **同一 Information ID** を維持 |
| 様式3「患者理解の手がかり」長文 | Source 閲覧 UI。Card 正本ではない | 一次情報参照へ置換後に必須導線を外す（段階） |

**非破壊:** Version2 機能は本設計承認だけでは削除しない。

---

## 18. Modules が Information にしてはならないこと

| 禁止 | 理由 |
| --- | --- |
| 様式タブ状態を Card に保存 | Core → Module 依存禁止 |
| 関連図座標を Card 必須化 | Module 状態 |
| Final Form 文を Card に自動生成 | Artifact／転記禁止 |
| AI が Card を「正しい解釈」に書き換え | Coach は問いのみ |

---

## 19. 未決事項

推測で確定しない。

1. 既存 `information_cards` と Form3 Information Card の **同一テーブル統合時期・可否**  
2. `sourceType` の最終列挙の一本化（`conversation` vs `patient_conversation`、`social` の残置など）  
3. Offline 同期の詳細プロトコル（最終的な競合解決 UX）  
4. 「不可分な発言」を1カード許容する教育ガイドラインの文面  
5. Evidence を Core 第1級オブジェクトにするか Module に留めるか  
6. archive と soft delete の UI 上の見せ方の差（教員ビュー含む）  
7. `observedAt` と教材日時のタイムゾーン／精度  
8. 全文検索エンジン（DB LIKE vs 外部索引）の選定  

---

## 20. 改訂方針

- Information の意味変更は本ファイルを更新し、Concept Freeze 4文書と矛盾がないか確認する。  
- Relationship（特に R2/R3）と衝突する場合は `03_relationship_model.md` を先に改訂する。  
- 実装 Phase では本論理フィールドを崩さない。物理テーブル分割は案Cに従う。
