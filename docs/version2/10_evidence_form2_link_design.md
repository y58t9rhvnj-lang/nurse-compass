# 10. Evidence–Form2 根拠リンク 設計レビュー

Version 1.1
Last Update: 2026-07-18
Status: Proposal（Sprint2-2 設計レビュー・実装しない）

> 本書は Sprint2-2 の設計レビュー資料である。
> 目的は「学生が集めた **Evidence（事実）** を、**様式2（Form2）** のどの記述の根拠として使ったかを
> 相互に関連付け、学生の思考プロセス（事実 → 患者理解の言語化）を可視化できる設計」を検討することである。
> 本書で扱う関係を **「Evidence–Form2 根拠リンク」** と呼ぶ。
> **今回はコードを変更しない。** 実装方式は本書の比較を踏まえて Sprint2 の該当フェーズで正式決定する。
>
> 注：本書は既存の `source_reference`（Evidence の**出所参照**）の改善ではない。
> `source_reference` の改善（TD-001）は別書 `11_source_reference_improvement.md` が扱う。両者は別概念（§0）。

---

## 0. スコープと用語整理（最重要）

本プロジェクトには「reference」と名の付く別概念が2つある。**混同を避けるため本書で明確に分ける。**

| 概念 | 意味 | 例 | 状態 | 設計書 |
|---|---|---|---|---|
| **出所参照 `source_reference`** | その Evidence が **どこから来たか**（出所） | `{kind:"patient_conversation", id:"..."}` | 実装済み（`information_cards.source_reference`） | `07_evidence_source_reference.md` / `11_source_reference_improvement.md`（TD-001） |
| **Evidence–Form2 根拠リンク（本書の対象）** | その Evidence を **様式2のどの記述の根拠として使ったか**（利用先） | Evidence X → 様式2「現在の状態」欄 | 未実装（設計のみ） | 本書 `10_...` |

- `source_reference` は「上流（原文・カルテ）への参照」であり、Evidence 固有の不変プロパティ。**本書では変更しない。**
- 本書が扱う「Evidence–Form2 根拠リンク」は「下流（学生の記述）への参照」であり、Evidence と様式2を結ぶ **多対多の関係**。
- 依頼文中の「sourceReference」は、目的（Evidence と様式2の相互関連付け）から判断し、本書では一貫して **「Evidence–Form2 根拠リンク」** と呼称する。名称・スキーマの最終提案は §6 で示す。

かつて Phase 3 で「様式2へのカード引用機能」は明示的に対象外とされた。本書はその機能の**設計検討**であり、実装解禁ではない。

---

## 1. 現在の Evidence データ構造

### 型（`lib/information/informationCard.ts`）
```ts
interface InformationCard {
  id: string;                 // クライアント生成 UUID（crypto.randomUUID）
  patientId: string;          // V1 患者ID（"A"）
  content: string;            // 事実（原文/学生が整えた本文）※空不可
  sourceType: InformationSourceType; // 12種の出所種別
  sourceLabel: string;
  sourceReference?: { kind: string; id?; date?; tab? }; // 出所参照（本書の根拠リンクとは別）
  createdAt: string; createdBy: "student" | "system";
  category?; note?; originalText?; observedAt?; updatedAt?;
}
```
- **事実のみ**を保持する（解釈・推論・アセスメント・看護判断は書かせない＝Sprint1 方針）。

### 保存形式（Supabase `information_cards` / `0006`,`0008`）
- 1事実 = 1行。`(user_id, organization_id, academic_year, case_id)` でデータ境界を分離。
- 論理削除（`deleted_at`）。物理 DELETE は誰にも許可しない。
- 二重収集防止：`uq_information_cards_source`（`... , source_reference->>'kind', source_reference->>'id'`、有効行かつ `id` 保持時のみ）。
- 不変カラム：`user_id / organization_id / academic_year / case_id / created_by / created_at / source_type / source_reference / original_text / observed_at`（DBトリガー `reject_immutable_columns`）。
- 学生が編集可：`content / category / note / sort_order / deleted_at / source_label` のみ。

### ID
- DB主キーは `uuid`（`gen_random_uuid()`）。クライアント側の `InformationCard.id` も UUID。
- **この UUID が根拠リンクの参照先キーになり得る**（安定・一意）。

### Server Action（`app/v2/actions/informationCards.ts`）
- `list / create / update / release`。すべて **student ロール必須**。
- identity・事実性はサーバが決定（クライアント申告を信用しない）。`created_by` は常に `student`。
- update/release は `expectedUpdatedAt` による楽観ロック。戻り値は判別可能ユニオン（`CardMutationResult` 等）で、DB生エラーは返さない。

---

## 2. 現在の様式2データ構造

### 型（`lib/form2/form2Types.ts`）
```ts
interface Form2Data {
  version: 1;                 // 構造(スキーマ)バージョン
  patientId: string;
  student: { studentNumber; studentName };
  period: { start; end };
  basicInformation: { patientName; age; sex; diagnosis; pastHistory; admissionType; chiefComplaint }; // 7項目
  history: { familyBackground; developmentalHistory; ... currentCondition; ... dischargeThoughts };    // 13項目
  treatment: { policyAndContent };  // 医師の治療方針・内容（統合1欄）
  updatedAt: string;
}
```
- 各「項目」は **ネストした文字列フィールド**。行ID・項目IDは持たない（フィールドパスが実質のキー）。
- 根拠リンクの対象になり得る自由記述の中心は `history.*`（生育歴・現病歴など）と `treatment.policyAndContent`。`basicInformation.*` は基本情報のため根拠付けの主対象になりにくい（設計上は付与可能）。

### 保存単位・更新方式（Supabase `form2_records` / `0005`）
- `(user_id, organization_id, academic_year, case_id)` で **1レコード（head 方式）**。
- `payload jsonb` に `Form2Data` を**まるごと**保持。**項目単位の行は存在しない。**
- DB列 `version` = レコードバージョン（楽観ロック）。payload 内 `Form2Data.version` は構造バージョンで別物。
- 保存はデバウンス自動保存＋手動保存（`useForm2Supabase`）。競合は「最新を読み込む」で解決。
- 不変カラム：`user_id / organization_id / academic_year / case_id / created_at`。

**設計上の含意**：様式2は「1つの JSON ドキュメント」であり、項目に安定した行IDが無い。根拠リンクの対象を指すには **フィールドパス文字列**（例 `history.currentCondition`, `treatment.policyAndContent`）を安定キーとして用いる必要がある。

---

## 3. 根拠リンクをどこへ保持するか（A〜D 比較）

前提：Evidence と様式2の関係は **多対多**。
1つの Evidence が複数の様式2項目の根拠になり得るし、1項目が複数 Evidence を根拠にし得る。

### 方式A：Evidence 側に保持（`information_cards` に利用先を持たせる）
- 例：`used_in jsonb`（`[{target:"form2", field:"history.currentCondition"}, ...]`）を追加。
- **メリット**：Evidence 起点で「この事実をどこで使ったか」を即取得できる。
- **デメリット**：
  - 「Evidence は**事実のみ**」という Sprint1 の中核方針に反する（利用先という**関係**を事実行に混ぜる）。
  - 多対多を配列で持つと更新競合・重複・整合が難しい。`source_reference` 等の不変トリガー方針とも相性が悪い（利用先は可変）。
  - 様式2側から「この項目の根拠一覧」を引くのに全 Evidence の配列走査が必要。

### 方式B：様式2側（`payload` JSON 内）に保持
- 例：`payload` に `citations: { "history.currentCondition": ["<evidenceId>", ...], ... }` を持たせる。
- **メリット**：DBスキーマ変更**不要**（payload は自由 JSON）。既存の様式2自動保存・楽観ロックにそのまま乗る。項目ごとに自然にスコープされる。
- **デメリット**：
  - **参照整合性が無い**：Evidence を解除（論理削除）しても payload 内 ID が残り、**ダングリング参照**になる。
  - Evidence 起点で「どこで使ったか」を引けない（全学生の payload 走査は非現実的）。
  - 構造化された関係を文書ブロブに埋めるため、教員閲覧・将来のクエリ・AI 分析がやりにくい。
  - Question / Reflection / Patient Story でも根拠付けが必要になったとき、**同じ仕組みを再利用できない**（様式2 payload 限定）。

### 方式C：中間テーブル（Evidence–Form2 根拠リンク表）★推奨
- 新テーブルに「Evidence → 様式2項目」を1行1リンクで保持。
- **初期実装は完全汎用の `evidence_links` ではなく、明確な外部キーを持つ Form2 専用中間テーブル `form2_evidence_links` を第一候補とする**（§6 参照）。汎用化は要件確定後に判断する（過度な汎用化を避ける）。
- **メリット**：
  - 多対多を素直に表現。`evidence_id` は `information_cards(id)`、`form2_record_id` は `form2_records(id)` への **FK で参照整合性**を持てる。
  - **双方向にクエリ可能**（項目→根拠一覧／Evidence→利用先一覧）。
  - Evidence は事実のまま／様式2 payload はクリーンなまま（関心の分離）。
  - RLS・organization 境界・年度分離を既存テーブルと同じ規約で適用できる。教員は閲覧のみ。
- **デメリット**：
  - テーブル・RLS・Server Action が増える（運用コスト）。
  - 様式2は項目行が無いため、リンク先は **固定フィールドキー**で指す（アプリ定義の許可集合から選択＝自由入力にしない）。
  - Evidence 論理削除時にリンクをどう扱うか（連動削除 or 読取時フィルタ）を決める必要がある。

### 方式D：その他（ハイブリッド／汎用リンク）
- D-1：**Cの権威データ + 表示用キャッシュ**。権威は中間テーブル。描画高速化・下書きのため、必要なら様式2 payload に読取専用キャッシュを持つ（ドリフト管理が必要なため初期は非推奨）。
- D-2：**汎用 `learning_links`**（`from_kind/from_id/to_kind/to_ref`）。Evidence 以外（Question→Evidence 等）も1表で扱う最大汎用。柔軟だが早すぎる一般化のリスク。
- D-3：**根拠リンクを様式2ではなく Patient Story に紐づける**。様式2は最終成果物であり、根拠付けの本質は「学生の患者理解の言語化＝Patient Story」に属するという立場（Patient Story は Sprint2 後半）。

### 比較表
| 観点 | A: Evidence側 | B: 様式2 payload | C: 中間テーブル | D: ハイブリッド/汎用 |
|---|---|---|---|---|
| 多対多の表現 | △（配列） | △（項目→配列） | ○ | ○ |
| 参照整合性（FK） | △ | ×（ダングリング） | ○ | ○ |
| 双方向クエリ | △（片方向） | ×（片方向） | ○ | ○ |
| DBスキーマ変更 | 要（不変方針と衝突） | 不要 | 要（新表） | 要 |
| 既存自動保存に相乗り | × | ○ | △（別経路） | △ |
| Evidence=事実のみ維持 | ×（関係混入） | ○ | ○ | ○ |
| 様式2 payload の清潔さ | ○ | ×（関係混入） | ○ | ○/△ |
| 将来機能への再利用 | × | ×（様式2限定） | ○（target_kind） | ◎（過度の汎用リスク） |
| 教員閲覧・AI分析容易性 | △ | × | ○ | ○ |
| 実装複雑度 | 中 | 低 | 中 | 中〜高 |

---

## 4. 将来機能との整合性

根拠リンクは「事実（Evidence）を根拠に、学生が理解を言語化する」という Compass の学習スパイラルの**接続点**である。方式Cの `target_kind` 化はこれらと自然に噛み合う。

| 将来機能 | 根拠リンクとの関係 | 相性 |
|---|---|---|
| **Question** | 「この Evidence から生まれた問い」を `target_kind='question'` で結べる。Evidence→Question の系譜が残る。 | ◎（Cで一貫） |
| **Reflection** | 振り返りが「どの事実／記述に基づくか」を Evidence・様式2・Story へリンク。 | ◎（Cで一貫） |
| **Patient Story** | 学生の患者理解の文章化。根拠付けの**本命の帰属先**。様式2と同じリンク機構を共有できる（D-3 の論点はここで回収）。 | ◎（Cで一貫） |
| **Teacher Guide** | 教員は「どの事実がどの記述の根拠か」を**閲覧のみ**で確認し、形成的助言に使う。教員はリンクを**書かない**（学生の思考過程を尊重）。 | ○（RLS 読取のみ） |
| **AI 支援（Compass Coach）** | Coach はリンクを**読んでよい**（例：「その根拠だけで十分ですか？」と問いを返す）。ただし Coach が**リンクを作成・アセスメント・Patient Story を書くことは禁止**（DD 維持）。 | ○（読取のみ・生成禁止） |

方式Bだと Question / Reflection / Patient Story のたびに別の格納先（payload 内格納）を作ることになり、将来コストが跳ね上がる。方式Cの中間テーブルは、後から Question / Reflection / Patient Story へ拡張しやすい。
ただし本書では**初期実装を Form2 専用（`form2_evidence_links`）に限定**し、他ステージへの共通化は各機能の要件が固まってから判断する（現段階での過度な汎用化を避ける＝§6・作業方針）。

---

## 5. UI 案（複数）

前提：**iPad 最優先／ドラッグ&ドロップ不使用（DD-020 One Workspace, 迷わないUI）**。既存の Workspace 縦フロー（患者ヘッダー → Timeline → 会話 → Coach → Evidence → 様式2）を壊さない。

### 案1：Evidence カードの「根拠として使う」ボタン（Evidence 起点）
- 各 Evidence カードに「この根拠を使う」ボタン。押すと様式2の**項目ピッカー**（`history.*` / `treatment` 等の選択肢）が開き、対象項目にチェックで紐付け。
- 長所：Evidence を読みながら「どこで使うか」を決められる。短所：様式2の項目名を学生が把握している必要。

### 案2：様式2 項目側の「根拠を選ぶ」（様式2 起点）
- 各様式2テキスト欄の脇に「根拠を選ぶ」。押すと Evidence 一覧がモーダル/サイドで開き、チェックで複数選択。欄の下に紐付いた Evidence を**チップ表示**（タップで原文プレビュー、×で解除）。
- 長所：書いている記述に対して「根拠は？」と自然に紐付く（教育的）。短所：欄ごとに一覧を開く操作量。

### 案3：フォーカス項目 × タップ紐付け（ドラッグ不要・iPad 向け）★
- 様式2の1項目にフォーカス（選択）した状態で、Evidence カードをタップすると「使用中／未使用」をトグル。使用中カードにバッジ表示。
- 長所：ドラッグ不要・指1本で完結・One Workspace と親和。短所：現在のフォーカス項目を明示する UI が必要。

### 案4：スプリットビュー（左 Evidence／右 様式2）
- 画面を左右に分け、左の Evidence をタップ→「編集中の項目へ紐付け」。iPad 横向き向け。
- 長所：一覧性。短所：縦フローの現行 Workspace を大きく変える（Freeze 下では優先度低）。

### 案5：可視化（読み取り専用）
- 各様式2項目の下に「根拠：N件」を折りたたみ表示。展開で Evidence 一覧＋原文。
- 「思考プロセス」ビュー：Evidence → 様式2項目のマップ（教員閲覧・振り返りにも流用）。
- 案1〜3 と併用する読み取り層。

**推奨 UI**：初期は **案3（フォーカス項目×タップ）＋案5（項目下チップ/件数）** の組み合わせ。ドラッグ不使用・操作量最小で、「どの事実を根拠にしたか」を学生が直感的に扱える。案2 のモーダルはフォールバックとして併設可。

---

## 6. 推奨アーキテクチャ

### 結論（推奨方針）
1. **方式C（中間テーブル）を採用**する。
2. **初期実装は完全汎用の `evidence_links` を作らない。** 明確な外部キー（`form2_record_id` / `evidence_id`）を持つ **Form2 専用中間テーブル `form2_evidence_links` を第一候補**とする。
3. **`form2_field_key` は自由入力文字列にしない。** アプリケーションで定義した **固定キーの一覧から選択**する（DB でも許可集合を CHECK 可能）。
4. **Question / Reflection / Patient Story への共通化は行わない（現段階）。** 各機能の要件が確定してから、汎用化（`target_kind` 化 / 汎用 `evidence_links` への発展）を判断する。現段階では過度な汎用化を避ける。

### 設計理由
1. Compass が管理するのは「学生の患者理解プロセス」。**事実 → 記述の根拠関係**こそがその可視化の核であり、独立した第一級の関係として持つべき。
2. Sprint1 の中核方針「Evidence は事実のみ」を守れる（Evidence 行に関係を混ぜない）。
3. 様式2 payload をクリーンに保てる（既存の自動保存・楽観ロックを侵さない）。
4. 明確な FK を持つ Form2 専用表なら参照整合性・双方向クエリ・教員閲覧を最小コストで実現でき、要件が固まる前の過度な抽象化を避けられる。
5. RLS・organization 境界・年度分離・教員閲覧（読取のみ）を既存規約でそのまま適用できる。

### データモデル（第一候補・案。SQL は実装時に確定）
```
public.form2_evidence_links
  id               uuid pk default gen_random_uuid()
  organization_id  uuid not null references public.organizations(id)
  patient_id       text not null                 -- V1 患者ID（"A"）。case_id はサーバで導出（下記）
  form2_record_id  uuid not null references public.form2_records(id) on delete cascade
  form2_field_key  text not null                 -- 固定キー集合から選択（自由入力にしない）
  evidence_id      uuid not null references public.information_cards(id) on delete cascade
  created_by       text not null default 'student'  -- 学生権限では 'student' 強制
  created_at       timestamptz not null default now()

  -- 併せてサーバ側で決定・保持を検討（RLS/分離のため）:
  --   user_id (= auth.uid()), academic_year, case_id
  --   ※ form2_record_id / evidence_id は所有者・組織・年度・ケースが一致する行のみ許可

制約:
  check form2_field_key in ( … アプリ定義の固定キー … )  -- 許可集合を DB でも担保
  unique (form2_record_id, form2_field_key, evidence_id)   -- 同一リンクの重複防止
インデックス:
  (form2_record_id, form2_field_key)   -- 項目→根拠一覧
  (evidence_id)                        -- Evidence→利用先一覧
```

- **`form2_field_key` の固定キー**：様式2は項目行を持たないため、リンク先は**アプリ定義の固定キー**で指す。候補集合は `Form2` のフィールドキー（`FORM2_BASIC_KEYS` / `FORM2_HISTORY_KEYS` / `'treatment.policyAndContent'`、`lib/form2/form2Types.ts`）に対応させ、Server Action と DB CHECK の両方で妥当性を担保する（自由入力による揺れを許さない）。
- **識別情報はサーバ決定**：`organization_id / user_id / academic_year / case_id / created_by` は Phase 3-2 と同様クライアント申告を信用せず、`profiles` と `caseIdForPatient()` から解決。`form2_record_id` / `evidence_id` は「呼び出し学生が所有し、組織・年度・ケースが一致する行か」を検証してからリンク。
- **Evidence 論理削除との整合**：Evidence は `deleted_at` による論理削除（行は残る）ため FK cascade は発火しない。方針は2択で実装時に確定：
  - (推奨) **解除 Server Action がその Evidence のリンクも同時に物理削除**（リンクは事実ではなく関係のため保持義務が薄い）。
  - もしくは **読取時に `information_cards.deleted_at is null` を join 条件でフィルタ**（履歴を残したい場合）。
- **リンクの削除**：リンクは学習事実そのものではないため、学生は自分のリンク行を**物理 DELETE 可**とする（Evidence とは異なる）。教員・admin は同一組織を**閲覧のみ**。
- **競合**：リンクは小さな作成/削除操作のため、Form2 のような楽観ロックは不要。二重作成は unique 制約で吸収（`duplicate` を成功扱いにできる）。

### RLS（方針・実装時に SQL 化）
- student：自分の行のみ SELECT / INSERT / DELETE。INSERT の WITH CHECK は `user_id = auth.uid()` かつ `organization_id = current_organization_id()` かつ（保持する場合）`academic_year = current_academic_year()`。`created_by='system'` は学生権限で拒否。
- teacher / admin：`is_staff() and organization_id = current_organization_id()` で **SELECT のみ**。INSERT/UPDATE/DELETE 不可。
- anon：全拒否。service role：シード/検証/管理のみ。

### 将来拡張性（現段階では実装しない）
- Question / Reflection / Patient Story にも根拠付けが必要になった場合、以下のいずれかを**各機能の要件確定後に**判断する：
  - 各機能に対しても Form2 専用表と同様の明確 FK を持つ専用リンク表を用意する、または
  - 実績を踏まえて汎用リンク表（`target_kind` を持つ `evidence_links`）へ統合する。
- いずれにせよ、**現段階で汎用テーブルを先取りしない**（早すぎる一般化を避ける）。本書の第一候補は Form2 専用表に限定する。
- 可視化（§5 案5）や教員の形成的評価、Coach の「問い返し」は、この表を**読むだけ**で成立する（生成・改変はしない）。

---

## 7. 非対象・留意点

- 本書は**設計のみ**。テーブル作成・Server Action・UI・型追加は行わない（Architecture Freeze 維持）。
- `source_reference`（出所参照）の識別子見直し（TD-001）は本書の対象外（`07_evidence_source_reference.md` / `11_source_reference_improvement.md`）。両者は別レイヤ。
- 会話全文の永続化は引き続き**非採用**。根拠リンクは Evidence（永続済み事実）に対してのみ張る。
- 既存 localStorage 由来データの移行は行わない。
- 実装フェーズ・優先順位：Sprint2 の優先順位（① 例外処理共通化 → ② sourceReference 見直し → ③ Question → ④ Reflection → ⑤ Story Workspace → ⑥ Patient Story）の中で、根拠リンクは Question/Reflection/Patient Story と密接なため、それらと同時期に実装するのが自然。様式2への適用だけを先行する場合も、本書のデータモデル（`target_kind='form2_field'`）で開始できる。
- UI はドラッグ&ドロップを用いない（DD-020）。iPad 実機での操作量・フォーカス項目の明示を実装時に検証する。

---

## 関連ドキュメント

- `docs/version2/06_sprint2_technical_debt.md` — TD-001（出所参照の識別子衝突）/ TD-002 / Sprint2 方針
- `docs/version2/07_evidence_source_reference.md` — Evidence **出所参照** `source_reference` の改善設計（比較案・本書とは別レイヤ）
- `docs/version2/11_source_reference_improvement.md` — Evidence **出所参照** `source_reference` の正規化・改善設計レビュー（本書とは別レイヤ）
- `docs/version2/05_information_notebook.md` — Information Notebook（Evidence）設計
- `docs/version2/02_database.md` — `information_cards` / `form2_records` スキーマ・RLS・不変トリガー
- `docs/version2/04_patient_understanding.md` — Patient Understanding / Learning Journey の将来設計
- `docs/09_Design_Log.md` — 中央設計ログ
