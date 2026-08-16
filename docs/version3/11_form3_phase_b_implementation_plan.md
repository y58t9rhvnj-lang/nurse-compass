# Form3 Phase B Implementation Plan

- 文書種別: **実装計画のみ**（コード・DB・UI は変更しない）
- ブランチ: `feature/version2-form3`
- working tree: clean 確認済み（計画作成時点）
- 基準:
  - Core Design Freeze v1: `fb0d990`
  - Manifesto: `99161c2`
  - Artifact Model: `07_artifact_model.md`
  - Form3 再設計: `docs/version2/20_form3_v2_redesign.md`
  - 現行実装: `schemaVersion: 1`（`lib/form3/*`, `components/v2/form3/*`, `0016_form3_records.sql`）

---

## 1. Phase B の目的

Form3 Phase B は、現行の **「1パターン＝長文入力＋単一判断」** を、次の構造へ段階移行する。

```
Patient Source
      ↓
Information Cards（複数・1カード1事実）
      ↓
Assessment Cards（複数・1カード1解釈）
      ↓
Final Form3（学校指定様式・Artifact）
```

| 原則 | 内容 |
| --- | --- |
| 学校指定様式 | 項目名・順序・意味を **変更しない** |
| Workspace / Final | **分離**。カード作業 ≠ 提出様式 |
| 自動転記・生成 | **禁止** |
| 既存資産 | `form3_records`・RLS・オートセーブ・所有軸を **破壊しない** |
| 旧 UI | Feature Flag で維持。即削除しない |

各ゴードン健康パターン文脈で:

1. **Information Cards** … 複数  
2. **Assessment Cards** … 複数  
3. **Final Form** … 学校指定様式（パターンごと）  

---

## 2. 現在の Form3 資産調査

### 2.1 再利用するもの（Must で活かす）

| 資産 | 場所・内容 | Phase B での扱い |
| --- | --- | --- |
| `form3_records` | `0016_form3_records.sql` | **維持**。JSONB payload 進化のみ |
| 所有軸 | `user_id`, `organization_id`, `academic_year`, `case_id` UNIQUE | 不変 |
| RLS / GRANT | student CRUD 相当・staff SELECT・DELETE なし | 不変 |
| 楽観ロック | DB 列 `version` | 不変。`schemaVersion` と混同しない |
| Repository | `lib/v2/notebook/form3Repository.ts` | 維持。必要なら v2 sanitize 経由 |
| Mapper | `lib/v2/notebook/form3Mapper.ts` | v2 sanitize / migrate 組込 |
| Server Actions | `app/v2/actions/form3.ts` | 維持。payload 判定分岐 |
| Hook | `hooks/v2/useForm3Supabase.ts` | v2 対応（autosave / conflict） |
| Hook logic | `lib/v2/notebook/form3HookLogic.ts` | 拡張 |
| Draft | `lib/v2/notebook/form3Draft.ts` localStorage | 維持。v2 キー方針は §9 |
| conflict UI | Header / loadLatestOnConflict | 維持 |
| 保存状態 UI | idle/dirty/saving/saved/error/conflict | 維持 |
| 11パターン定義 | `form3PatternDefinitions.ts` / keys / prompts | 維持（Guide） |
| Pattern Nav | `Form3PatternNav.tsx` | 維持・カード UI と接続 |
| iPad レイアウト基盤 | `xl` 分岐・chips・safe-area・focus scroll | 維持・拡張 |
| Student SSR | `app/v2/student/page.tsx` → AppShell | 維持。initial payload に migrate |
| Learning Layer | SideNav / LearningLayer / WorkspaceHost | 維持。Flag で新旧切替 |
| Validation / Progress | `form3Validation.ts` / `form3Progress.ts` | v2 用に再定義 |
| Feature flag 機構 | `lib/featureFlags.ts` | **`form3PhaseB` 追加**（実装時） |

### 2.2 廃止・置換するもの（Workspace 側）

| 現行（v1 Workspace＝様式一体） | Phase B |
| --- | --- |
| `relatedInformation` 長文（Workspace） | → Information Cards。**Final の同名欄は学校指定のため残す** |
| `interpretation` 単一欄（Workspace） | → Assessment Cards。**Final の interpretation は残す** |
| パターン全体の単一 `judgment`（Workspace 兼用） | → 複数 Assessment `classification`。**Final `judgment` は残す** |
| `judgmentRationale`（Workspace 兼用） | → Final のみ（Artifact） |
| `additionalInformationNeeded`（Workspace 兼用） | → Assessment `needMoreInformation` ＋ Final 欄は学校指定として残す |
| パターン単位 `isReviewed` | Final Artifact の Module フラグとして残す。Submission と混同しない |
| 「患者理解の手がかり」Sheet（Form2 前提） | → **Patient Source 直接参照**に置換（Form2 必須導線を外す） |
| Form3 内の様式2参照を主情報源とする導線 | 縮小〜廃止。一次情報参照が主 |

### 2.3 一時的に残すもの（即時削除しない）

| 項目 | 理由 |
| --- | --- |
| 旧 Form3 UI（v1 エディタ） | Flag OFF で講義ロールバック |
| v1 読取パス | `schemaVersion === 1` の行が残る |
| `migrateV1toV2` | 冪等変換。v1Backup |
| Clues Sheet コード | Flag / 段階的に Source パネルへ置換するまで残置可 |
| Progress の旧定義 | v2 progress 並行期間 |

---

## 3. 講義までの必須範囲

### 3.1 Must（講義成立の最小）

**Information Cards**

- 1カード＝1事実  
- 複数作成・編集・並び替え  
- Archive（soft）または削除相当  
- S/O（`soType: "S" | "O" | null`）※Core に合わせる。`subjective`/`objective` 文字列は使わない  
- 情報源（`sourceType` / `sourceLabel` / 任意 `sourceReference`）  
- ゴードン `patternKeys[]`（複数可）  
- オートセーブ・再ログイン復元  

**Assessment Cards**

- 1カード＝1解釈  
- 複数作成・編集・Archive  
- `interpretation` / `classification`（5区分＋null）  
- `evidenceInformationIds[]`（複数・最低1を保存時に推奨／必須は Module）  
- `needMoreInformation`  
- 主所属 `patternKey`（Core Freeze。0..1）  
- オートセーブ・再ログイン復元  
- 同一パターンで正常・強み・問題・リスク併存可  

**Final Form3（Artifact）**

学生自身が記述（自動転記・生成・カード全文コピーなし）:

- 情報（S・O）→ フィールド `relatedInformation`  
- 解釈・分析・援助の必要性 → 主に `interpretation`（＋学校様式上の関連欄は既存キー維持）  

Workspace を **参照しながら** Final を書ける UI 必須。  
`careNeed` は **Artifact（Final 文中）**。Assessment Core フィールドにしない。

**Patient Source 参照**

Workspace から直接参照（様式2へ戻る前提にしない）:

- 患者基本情報  
- 電子カルテ  
- 患者との会話  
- 検査  
- 治療・薬剤  

### 3.2 Should（余裕時）

- 患者情報選択 → Information Card 下書き作成（内容・出所のみ。要約・分類・アセスメント自動なし）  
- 同一 Source の重複提案  
- ルールベース Coach（問いテンプレ）  
- Final プレビュー  
- Pattern 横断一覧  

### 3.3 今回対象外（Phase B 外）

- AI Coach / Related Map / Clinical Reasoning Edge  
- Evidence 連携 / Teacher Review  
- Submission Snapshot  
- Learning Analytics  
- Core 個別正規化テーブル  
- 新規外部ライブラリ（可変幅ライブラリ含む）  

---

## 4. schemaVersion 2 設計

### 4.1 方針

- 当面 **`form3_records.payload` JSONB 維持**（案C）  
- 論理は Core／Artifact に寄せるが、物理テーブル新設はしない  
- `schemaVersion: 2`  

### 4.2 トップレベル（推奨）

再設計ドキュメントは `patterns[key].assessmentCards` 入れ子だったが、Phase B 実装は **フラット配列＋タグ**の方が横断参照・根拠 ID・検索に有利。Final のみパターン辞書にする。

```ts
// 設計上の型イメージ（本計画では実装しない）
type Form3DataV2 = {
  schemaVersion: 2;
  patientId: string;
  informationCards: Form3InformationCardV2[];
  assessmentCards: Form3AssessmentCardV2[];
  finalForm: Record<Form3PatternKey, Form3FinalFormPattern>; // 11キー固定
  updatedAt: string; // ISO
  /** 移行メタ（任意） */
  migration?: {
    fromSchemaVersion: 1;
    migratedAt: string;
    bannerDismissed?: boolean;
  };
  /** 冪等・監査用。変換後も保持推奨 */
  v1Backup?: Form3DataV1;
};
```

### 4.3 InformationCard

Core Information Model に整合。

```ts
type Form3InformationCardV2 = {
  id: string; // クライアント ULID
  content: string;
  soType: "S" | "O" | null; // Core。subjective/objective は使わない
  sourceType: string; // chart | patient_conversation | lab | vital | ...
  sourceReference?: {
    kind: "fixture" | "manual" | "db";
    sourceType?: string;
    sourceRecordId?: string;
    path?: string;
    note?: string;
  };
  sourceLabel?: string;
  observedAt?: string;
  patternKeys: Form3PatternKey[]; // 0..N タグ
  order: number;
  status: "active" | "archived"; // soft delete は archived または status+deletedAt
  createdAt: string;
  updatedAt: string;
  /** 移行で作った未分割カード */
  migratedFromV1?: boolean;
};
```

### 4.4 AssessmentCard

```ts
type Form3AssessmentCardV2 = {
  id: string; // ULID
  interpretation: string;
  classification: Form3Judgment | null;
  // Form3Judgment = functioning_normally | strength | problem | risk | insufficient_information
  evidenceInformationIds: string[]; // 1..N 推奨。SSOT
  needMoreInformation: string;
  patternKey: Form3PatternKey | null; // Core: 主所属1つ
  order: number;
  status: "active" | "archived"; // draft 相当は classification null + 短文空で表現可
  createdAt: string;
  updatedAt: string;
  migratedFromV1?: boolean;
};
```

※依頼文の `patternKeys[]` / `status: draft|reviewed` は Core Freeze と衝突するため、**Assessment は `patternKey`＋`active|archived`** とする。`reviewed` は Final の `isReviewed` のみ。

### 4.5 Final Form（学校指定・変更しない）

正本フィールド（現行 `Form3PatternData` / `20_form3_v2_redesign` §2.4 / `FORM3_FIELD_ORDER`）:

| 学校の意味 | フィールド名 |
| --- | --- |
| 関連する患者情報（S・O） | `relatedInformation` |
| 情報から考えたこと（解釈） | `interpretation` |
| 他の情報・健康パターンとの関連 | `crossPatternRelations` |
| 判断 | `judgment` |
| 判断の根拠 | `judgmentRationale` |
| 追加で必要な情報 | `additionalInformationNeeded` |
| 整理済み | `isReviewed` |

```ts
type Form3FinalFormPattern = {
  relatedInformation: string;
  interpretation: string; // 解釈・分析・援助の必要性の記述の中核
  crossPatternRelations: string;
  judgment: Form3Judgment | null;
  judgmentRationale: string;
  additionalInformationNeeded: string;
  isReviewed: boolean; // Module 整理フラグ。Submission ではない
};
```

**careNeed:** 独立 Core フィールドにしない。学生が Final の `interpretation`（および学校様式上の援助記述）へ自分の言葉で書く（Artifact 責務）。

**講義 Must の最小記述対象:** 少なくとも `relatedInformation` と `interpretation` を学生が書けること。他欄も UI 上は学校指定どおり全表示（既存どおり）。

---

## 5. v1 → v2 移行

### 5.1 変換ルール（合意方向を確定）

| v1 | v2 |
| --- | --- |
| 各パターン `relatedInformation`（非空） | Information Card ×1（`migratedFromV1: true`）。**自動分割しない**。`patternKeys: [当該]`。`soType: null`。`sourceType: "other"` |
| 各パターンの解釈・判断系 | Assessment Card ×1（同）。`interpretation`←v1 interpretation。`classification`←judgment。`needMoreInformation`←additionalInformationNeeded。根拠は空配列または後で学生が紐付け。`migratedFromV1: true` |
| Final | 同一内容を `finalForm[pattern]` へコピー（学校欄維持） |
| 空パターン | カードなし。空 Final |

### 5.2 決定事項

| 論点 | 決定 |
| --- | --- |
| 変換タイミング | **読込時にメモリ上で v2 化**し、画面は常に v2 モデル。**初回オートセーブ／明示保存で DB に schemaVersion 2 を書き戻す**。読込のみで DB を黙って書き換えない（SSR と競合しにくい） |
| v1Backup | **payload 内に `v1Backup` を保持**（変換時1回。以降の v2 保存で消さない） |
| 冪等 | `schemaVersion === 2` なら再変換しない。`v1Backup` があっても二重カード化しない |
| 警告表示 | 「以前の長文入力をカードへ移しました。分割・修正できます」バナー。`migration.bannerDismissed` |
| ロールバック | Flag OFF で **旧 UI**。データが v2 の場合、旧 UI は **読取専用フォールバック**または「v2 のため旧画面では編集不可・最新を開く」のいずれか（実装時に選ぶ。推奨: 旧 UI は v1 のみ編集、v2 は新 UI 必須） |
| 空 v1 | 空の v2（createEmptyV2）へ。backup 省略可 |
| 元データ | `v1Backup` ＋ Final コピーで消さない |

### 5.3 変換関数

純関数 `migrateForm3V1toV2(v1): Form3DataV2` を B1 でテスト必須。Mapper sanitize は v2 強制＋未知キー落とし＋11 Final キー固定。

---

## 6. UI 構成

### 6.1 PC（Must: 2ペイン可／Should: 3）

```
┌──────────────┬────────────────────────────┬─────────────┐
│ Patient      │ Form3 Workspace            │ Guide       │
│ Source       │ Pattern: [選択中]          │ (折りたたみ可)│
│ 基本/カルテ/ │ [Info] [Assess] [Final]    │             │
│ 会話/検査/   │ カードリスト + 編集         │             │
│ 治療・薬剤   │                            │             │
└──────────────┴────────────────────────────┴─────────────┘
```

- **Must:** 左 Source ＋ 中央 Workspace（Info/Assess/Final をタブまたは縦セクション）  
- 右 Guide: 初期は折りたたみ可（既存 `Form3PatternGuide` 流用）  
- DOM: ペインを独立セクションにし、将来 CSS 可変幅でも責務が混線しない構造（今回ライブラリ追加なし）

### 6.2 iPad（常時3カラム禁止）

- Workspace 全面  
- Patient Source: **タブ切替または Sheet**（Clues 置換）  
- Guide: 折りたたみ  
- Information / Assessment / Final: **段階タブ**  
- ソフトウェアキーボードで入力欄が隠れない（既存 focus scroll 継承）  
- メインスクロール原則1本  
- Pattern Nav: 既存 chips（`xl` 未満）維持  

### 6.3 可変幅

Must 外。ペイン境界をハードコード比率に固定しすぎない。`flex`＋独立スクロールコンテナで将来対応可能にする。

---

## 7. Patient Source → Information Card 導線

### 7.1 比較

| | 案A 手入力のみ | 案B 選択して Card 化 |
| --- | --- | --- |
| 教育 | 切り出し思考が強い | 出所保持が正確。切り出しは残る |
| 工数 | 低 | 中（Source UI＋参照付与） |
| 講義確実性 | 高い | Source データ配線が詰まると遅延 |
| 自動禁止との関係 | 問題なし | 内容コピーは可。要約・分類・Assessment 自動は禁止 |

### 7.2 講義までの推奨

**Must: 案A ＋ Patient Source 参照ペイン必須。**  
学生が一次情報を見ながら手で Card を書く。

**Should: 案B の軽量版**（選択 → `content` と `sourceReference`/`sourceLabel` を埋めた下書き Card。S/O・pattern は学生が選ぶ。自動アセスメントなし）。

様式2前提の Clues は Must では主導線にしない。

---

## 8. Final Form 導線

| 原則 | 実装方針 |
| --- | --- |
| 自動文章生成・転記・カード全文コピー | 禁止 |
| Workspace 参照 | 同パターンの Info/Assess 一覧を横または上に表示 |
| Final | Artifact（`finalForm[pattern]`） |
| 保存 | 同一 autosave パイプライン |
| 整理済み | `isReviewed`（既存トグル流用可） |
| 提出 Submission | Phase B **未実装で可**。混同しないラベル（「整理済み」≠「提出」） |

援助の必要性（careNeed）は Final の記述欄へ学生が書く。

---

## 9. 保存と競合

| 論点 | 方針 |
| --- | --- |
| 永続化 | 1レコード JSONB ＋ DB `version` 楽観ロック **維持** |
| ID | **クライアント ULID**（作成瞬間確定。Assessment 根拠が即張れる） |
| 並び順 | `order` 数値。ID に順序を埋め込まない |
| 複数 Card 編集 | 単一 `data` 状態を更新し debounce 1s で整送（現行踏襲） |
| stale closure | functional update / ref で最新 payload（現行 Hook を監査・必要なら修正は B2） |
| conflict | 現行どおり停止＋最新読込。マージ自動しない |
| localStorage Draft | 維持。キーに schema を含めるか、読込時 migrate。v2 保存成功で整合 |
| v1→v2 後 Draft | 旧 Draft は migrate してから採用、失敗時はサーバ優先 |
| payload 肥大 | カード増でも講義規模は JSONB で可。要約 Snapshot は対象外 |
| 70名同時 | 行ロックはユーザ×ケース単位。共有行なし。致命停止は conflict UI とエラー再試行で回避 |

過剰最適化（正規化テーブル・CRDT）はしない。

---

## 10. 実装フェーズ分割（コミット単位）

| Phase | 内容 | 依存 |
| --- | --- | --- |
| **B0** | Feature Flag `form3PhaseB`。旧 UI 維持。新エントリは Flag ON のみ | — |
| **B1** | 型・`createEmptyV2`・`migrateV1toV2`・sanitize・validation・progress・単体テスト | B0 |
| **B2** | Mapper/Actions/Hook/Draft/autosave/conflict が v2 を往復 | B1 |
| **B3** | Information Cards UI（CRUD/Archive/S/O/source/pattern/order） | B2 |
| **B4** | Assessment Cards UI（根拠 multi-select/classification/needMore） | B3 |
| **B5** | Patient Source 参照ペイン（基本・カルテ・会話・検査・治療薬剤）。Clues/Form2 主導線を外す | B3 と並行可だが B3 後が安全 |
| **B6** | Final Form UI（学校欄全表示＋ Workspace 参照。転記なし） | B4 |
| **B7** | SSR・AppShell・Nav・iPad・QA・ロールバック確認 | B5+B6 |

**順序変更の許容:** B5 を B4 より先にすると「見て書く」体験が早い。その場合 B4 前に手入力 Info のみで講義は成立しにくいので、**B3→B5→B4→B6** も可。理由: Source 参照は Info 作成の前提。

---

## 11. Feature Flag と安全な切替

| 項目 | 方針 |
| --- | --- |
| Flag | `FEATURE_FLAGS.form3PhaseB`（default `false`） |
| 旧 Form3 | Flag OFF で現行 `Form3Workspace` v1 |
| 新 Form3 | Flag ON で Phase B Workspace |
| 先行利用 | テストアカウント / 開発 org のみ Flag true（環境変数上書きでも可） |
| 同一 `form3_records` | 読込: v1→migrate 表示。保存: v2 書き戻し |
| 問題時 | Flag false で旧 UI。v2 行は旧 UI 編集不可メッセージ＋読取 |
| 本番切替 | QA DoD 達成 → 段階的 true → 監視 → 旧 UI 廃止判断 |
| 旧 UI 廃止条件 | 全アクティブ講義データが v2、ロールバック不要、教員合意 |

Form3 ナビ項目自体は残す。中身だけ Flag 分岐。

---

## 12. テスト計画

| 区分 | ケース |
| --- | --- |
| 移行 | 空 v1→v2／入力済み v1→v2／冪等／v1Backup 保持 |
| Info | 追加・編集・並び・Archive／pattern・S/O・source |
| Assess | 追加・編集／根拠複数／classification 併存／根拠欠落警告 |
| 参照整合 | 根拠 Info Archive → missing 表示。Assessment 残存 |
| Final | 保存・リロード・isReviewed。転記が走らないこと |
| 永続 | パターン切替／リロード／再ログイン／conflict／保存失敗 |
| 端末 | iPad 縦横・キーボード隠れ／PC 2ペイン |
| 運用 | Flag OFF ロールバック／70名想定の基本（ユーザ分離・連続保存） |
| 品質 | `build` / `tsc` / `eslint` / 単体（migrate・sanitize） |

---

## 13. 講義投入 Definition of Done

1. 学生が患者情報（基本・カルテ・会話・検査・治療薬剤）を直接参照できる  
2. Information Card を複数作成できる  
3. Assessment Card を複数作成できる  
4. 1 Assessment に複数 Information を根拠紐付けできる  
5. 1パターンに正常・強み・問題・リスクが併存できる  
6. 学校指定 Final へ学生自身が記述できる（少なくとも情報 S・O と解釈・分析・援助の必要性）  
7. オートセーブ・復元が動作する  
8. v1 データを失わず移行できる  
9. iPad Safari で致命停止しない  
10. 旧 Form3 へ Flag で戻せる  
11. build／tsc／eslint／計画した検証が通る  
12. AI・関連図・Evidence 未実装でも講義が様式3まで成立する  

---

## 14. スケジュール比較

講義日が未指定のため **相対日数**。楽観を避ける。

| 構成 | 所要 | 範囲 | リスク | 講義利用 |
| --- | --- | --- | --- | --- |
| **最短** | 5–7 日 | B0–B4 + B6 簡略 + Source は既存 Sheet 改造の最小（一次情報テキスト）+ B7 薄め | Source 体験が弱い。iPad 詰め込み | **条件付き可**（Must ぎりぎり） |
| **標準（推奨）** | 9–12 日 | B0–B7 一通り。案A Source。Should なし | conflict・移行バナー・iPad タブの作り込み不足 | **推奨** |
| **挑戦** | 14+ 日 | 標準＋案B 軽量＋重複警告＋Final プレビュー＋ルール Coach | 範囲膨張で講義前に未完 | 余裕があるときのみ |

バッファ: 移行バグ・iPad キーボード・SSR 初期値で **+2 日** を標準に見込む。

---

## 15. 今回行わないこと

- 実装・コード変更・DB・Migration・UI・package 追加  
- 既存 Form3 削除  
- AI Blueprint / Coach / Related Map / Evidence 実装  
- Submission Snapshot  
- Core 個別テーブル化  

---

## 16. リスク（要約）

| 最大リスク | 緩和 |
| --- | --- |
| v1→v2 移行で学習データ喪失・二重化 | 純関数＋テスト＋v1Backup＋冪等＋バナー |
| Flag 切替事故（全員新 UI） | default false。テストアカウントのみ先行 |
| iPad で入力不能・スクロール競合 | 1スクロール・段階タブ・既存 focus 対策継承 |
| 根拠 ID と Archive の不整合 | soft archive＋ missing_evidence UI |
| 範囲膨張（案B・Coach） | Should を講義後に回す |

---

## 17. 改訂

本計画承認後に実装を開始する。Core Freeze・Manifesto・Artifact Model と衝突する場合はそれらを優先し、本計画を更新してから実装する。
