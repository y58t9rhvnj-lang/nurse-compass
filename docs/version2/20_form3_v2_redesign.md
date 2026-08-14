# Form3 Version2 再設計（設計のみ）

- 状態: **設計ドラフト（実装未着手・承認待ち）**
- ブランチ前提: `feature/version2-form3`
- 作成日: 2026-08-14
- 本ドキュメントは **コード・DB・Migration・UI を変更しない**。設計合意のための正本候補。

---

## 0. 設計の結論（1段落）

様式3の本質は「11パターンへ長文を埋めること」ではなく、**患者情報を1件ずつ整理し、複数のアセスメントとして分析し、最後に学校指定様式へまとめること**である。したがって Compass 内の作業単位を **Information Card → Assessment Card → Final Form Text** に再設計する。学校指定様式の項目名・順序・構成・意味は変更せず、Workspace と提出様式を分離する。既存の `form3_records`（RLS・楽観ロック・オートセーブ）は所有軸を維持したまま payload の `schemaVersion` を 2 へ進化させる。

---

## 1. Form3 Version2 全体設計

### 1.1 Mission との整合

| Constitution | Version2 での実現 |
| --- | --- |
| Learning Workspace | Workspace でカードを考え、提出様式は最後にまとめる |
| 主役は患者 | 電子カルテ・会話・検査等を直接参照しながら情報カードを作る |
| 一度に一つ | 1パターン集中。カード単位で思考 |
| 転記しない | 様式2へ戻る前提を廃し、一次情報を参照する。自動転記なし |
| 入力順＝思考順 | 情報 → 解釈・分類 → 様式へまとめる |
| 未完成を肯定 | カード途中保存。Final Form 未記入でも Workspace は有効 |
| Coach は問い返す | Card を見て問いのみ。文章生成しない |

### 1.2 二層アーキテクチャ

```
┌─────────────────────────────────────────────┐
│  Learning Workspace（Compass 固有）           │
│  Information Cards ＋ Assessment Cards       │
│  ＋ 一次情報参照（カルテ／会話／検査…）         │
└───────────────────┬─────────────────────────┘
                    │ 学生がまとめる（自動転記しない）
                    ▼
┌─────────────────────────────────────────────┐
│  Final Form Text（学校指定様式）              │
│  項目・順序・構成・意味は学校指定どおり固定      │
└─────────────────────────────────────────────┘
```

**原則:** Workspace を提出様式にしない。提出・印刷・教員確認の対象は Final Form（学校指定）である。

### 1.3 思考フロー（講義体験）

```
患者情報（カルテ・会話・検査・治療・薬剤・基本情報）
    ↓ 学生が選ぶ／拾う
Information Card を追加（1件ずつ・S/O）
    ↓ 同じパターン内で複数可
Assessment Card を作成（解釈・分類・根拠カードID）
    ↓ 複数アセスメント可
Final Form Text へまとめる（学校指定の欄へ、学生の言葉で）
```

### 1.4 絶対条件（再掲）

- 学校指定様式の項目名・順番・構成・意味は変更しない。
- Compass は様式を作り替えない。ガイド・ヒント・UI・Coach・導線で教育効果を高める。
- 自動転記・一括コピー・同期ボタンは作らない。

---

## 2. データモデル

### 2.1 概念図

```
Form3Document (schemaVersion: 2)
├── patientId
├── informationCards: InformationCard[]     // ケース横断でパターン紐付け可
├── patterns: Record<PatternKey, PatternWorkspace>
│     ├── assessmentCards: AssessmentCard[]
│     └── finalForm: FinalFormText          // 学校指定の欄
└── meta (updatedAt 等)
```

### 2.2 Information Card

患者情報を **1件ずつ** 保存する最小単位。関連図ノード・Evidence・Coach の共通原子になる。

| フィールド | 型（案） | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string (ulid/uuid) | ○ | 安定ID。関連図・Assessment 根拠参照に使う |
| `type` | `"S" \| "O"` | ○ | 主観／客観 |
| `source` | enum | ○ | 情報の出自 |
| `text` | string | ○ | 事実の記述（解釈を混ぜない教育を UI で支援） |
| `patternKey` | `Form3PatternKey \| null` | △ | 紐付けパターン。未分類は null 可 |
| `createdAt` | ISO string | ○ | 作成時刻 |
| `updatedAt` | ISO string | ○ | 更新時刻 |
| `order` | number | ○ | 同一パターン内表示順 |
| `links`（将来） | 任意 | × | カルテ行ID・会話ターンID等。Version2.1では任意 |

**source enum（初期）**

- `chart`（電子カルテ）
- `conversation`（患者との会話）
- `lab`（検査）
- `treatment`（治療）
- `medication`（薬剤）
- `patient_profile`（患者基本情報）
- `family`（家族等）
- `observation`（観察）
- `other`

**設計意図**

- 「関連情報」長文 textarea を廃止し、**拾った事実をカード化**する。
- カードはパターンをまたいで再配置できる（`patternKey` 変更）。転記ではなく再整理。

### 2.3 Assessment Card

1パターンに **複数** 持てる。1カード＝1つの解釈・分類の単位。

| フィールド | 型（案） | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string | ○ | 安定ID |
| `patternKey` | `Form3PatternKey` | ○ | 所属パターン |
| `interpretation` | string | ○ | 解釈・分析（学生の言葉） |
| `classification` | Judgment5 \| null | △ | 正常／強み／問題／リスク／情報不足 |
| `evidenceCardIds` | string[] | ○ | 根拠となる Information Card id |
| `additionalInfoNeeded` | string | △ | 特に情報不足時 |
| `crossRelationsNote` | string | △ | 他パターン・他情報との関連（任意メモ） |
| `order` | number | ○ | 表示順 |
| `createdAt` / `updatedAt` | ISO | ○ | |

**classification（学校の判断5区分と同一意味）**

| 値 | 表示（学校指定の意味を維持） |
| --- | --- |
| `functioning_normally` | 正常に機能している |
| `strength` | 強みがある |
| `problem` | 問題がある |
| `risk` | 問題が生じる可能性がある |
| `insufficient_information` | 情報不足で判断できない |

色は Constitution どおり（緑／青／赤／オレンジ／グレー）。テキスト必須。

### 2.4 Final Form Text（学校指定様式）

**学校指定の欄だけ**を持つ。Workspace カードの自動結合結果ではない。

現行学校様式（Version2.1 で採用した欄）を **そのまま** 残す:

| 学校指定の意味 | フィールド名（実装キー・変更しない方針） |
| --- | --- |
| 関連する患者情報（S・O） | `relatedInformation` |
| 情報から考えたこと（解釈） | `interpretation` |
| 他の情報・健康パターンとの関連 | `crossPatternRelations` |
| 判断 | `judgment` |
| 判断の根拠 | `judgmentRationale` |
| 追加で必要な情報 | `additionalInformationNeeded` |
| （学生が様式として一区切り） | `isReviewed` |

**ルール**

- Final Form のラベル・順序・意味は学校指定どおり。
- カードから Final Form への **自動転記はしない**。
- UI は「カードを見ながら、様式の欄へ自分の言葉でまとめる」導線のみ（ヒント表示は可、値の注入は不可）。

### 2.5 Pattern Workspace

```ts
// 設計上の型イメージ（実装しない）
type PatternWorkspace = {
  assessmentCards: AssessmentCard[];
  finalForm: FinalFormText; // 学校指定6欄＋isReviewed
};
```

パターン全体に **単一の judgment** は持たない（複数 Assessment を許容するため）。最終的な「様式上の判断」は Final Form の `judgment` のみ。

---

## 3. 保存構造

### 3.1 維持するもの（既存資産）

| 資産 | 方針 |
| --- | --- |
| テーブル `form3_records` | **維持**。所有軸・UNIQUE・RLS・GRANT・楽観ロック列 `version` |
| Server Actions / Repository | 経路維持。sanitize / conflict の思想維持 |
| オートセーブ Hook | 維持。保存ボタン前提にしない |
| 1レコード jsonb payload | 維持。中身の schema を v2 へ |

### 3.2 payload 構造（schemaVersion: 2）

```jsonc
{
  "schemaVersion": 2,
  "patientId": "A",
  "informationCards": [ /* InformationCard */ ],
  "patterns": {
    "health_perception_management": {
      "assessmentCards": [ /* AssessmentCard */ ],
      "finalForm": { /* 学校指定欄 */ }
    }
    // …11キー固定
  },
  "updatedAt": "ISO"
}
```

### 3.3 別テーブル化について（設計判断）

| 案 | 採否 | 理由 |
| --- | --- | --- |
| A. すべて jsonb（現行テーブル） | **Version2.2 までは推奨** | RLS・楽観ロック・Day2–5資産を最大化。講義展開が早い |
| B. information_cards を正規化テーブル | Version2.3+ 検討 | 関連図・横断検索が重くなった段階 |

**今回の設計結論:** まず A。Information Card の `id` を安定させれば、将来 B へ抽出しても参照を壊しにくい。

### 3.4 楽観ロック・競合

- DB `version` は現状どおり。
- カード単位の編集でも **ドキュメント全体の version** で conflict 検出（Form2/Form3 v1 と同型）。
- conflict UI（最新を読む／下書き）は維持。

### 3.5 sanitize 方針（実装時）

- 未知キー削除、11パターン固定キー補完。
- `evidenceCardIds` は存在する Information Card id のみ残す（孤児参照を落とす）。
- Final Form の不正 `isReviewed` は v1 同様、条件未達なら false へ（本文は保持）。
- クライアント申告の user_id / org / case_id は信用しない（現行どおり）。

---

## 4. UI構成

### 4.1 画面の役割分担

| 領域 | 役割 |
| --- | --- |
| 一次情報参照ペイン | 電子カルテ／会話／検査／治療／薬剤／患者基本情報（切替） |
| パターン・ナビ | 11パターン＋進捗（カード数／Final 整理状態） |
| Workspace 本体 | Information Cards → Assessment Cards |
| Final Form | 学校指定様式（折りたたみまたは別ステップ） |
| Guide | 定義・視点・情報収集（答えを書かない・折りたたみ） |

### 4.2 iPad First

- 固定3カラム禁止。
- 推奨: **参照は Sheet/Drawer**、本体は1スクロール。
- パターン切替はチップ（広い PC のみ縦ナビ可）。
- タップ 44px、safe-area、キーボードで欄が隠れない。

### 4.3 1パターン集中 UI（例）

```
┌ Header: 様式3 Workspace / 保存状態 / 進捗 ┐
├ パターンチップ（横スクロール）────────────┤
├ [参照を開く] カルテ・会話・検査…──────────┤
├ Information Cards（追加・並べ替え）───────┤
├ Assessment Cards（追加・分類色＋ラベル）──┤
├ Guide（折りたたみ）──────────────────────┤
└ Final Form（学校指定・まとめる）──────────┘
```

### 4.4 カード UI の教育ルール

- Information Card: 「事実」であることをラベルで明示。解釈欄と視覚分離。
- Assessment Card: classification は大きなタップカード（色＋テキスト）。
- Final Form: 「ここが学校に提出する様式です」と明示。Workspace と視覚的に分離。

---

## 5. 画面遷移

```
病棟ホーム / 患者トップ / カルテ・会話（Core）
        │
        ▼
様式3 Workspace（Learning Layer）
        │
        ├─ 参照 Sheet（カルテ／会話／検査／治療／薬剤／基本情報）
        ├─ Information Card 追加・編集
        ├─ Assessment Card 追加・編集
        └─ Final Form 編集（学校指定）
                │
                └─（将来）印刷・提出ビュー ※Workspace とは別画面推奨
```

**様式2へ戻る前提にしない。** 様式2は全体像の別フェーズとして残すが、様式3の必須参照経路にはしない。

---

## 6. schemaVersion 2 設計

### 6.1 定数

- `FORM3_SCHEMA_VERSION = 2`
- DB 列 `version` とは別物（現行方針維持）

### 6.2 必須不変条件

1. `patterns` は常に11固定キー。
2. `informationCards[].id` はドキュメント内で一意。
3. `assessmentCards[].evidenceCardIds` ⊆ informationCards ids。
4. `finalForm` のキー集合は学校指定欄と一致（増減しない）。
5. 転記用の form2 全文・overview 全文を payload に埋め込まない。

### 6.3 進捗の再定義

文字数では判定しない（現行思想維持）。

| 状態 | 定義（案） |
| --- | --- |
| `not_started` | 情報カードもアセスメントも Final も空 |
| `collecting` | Information Card のみあり |
| `analyzing` | Assessment Card あり（Final 未整理） |
| `needs_final` | Assessment はあるが Final 条件不足 |
| `reviewed` | Final Form が整理済み条件を満たし `isReviewed` |
| `reviewed_insufficient` | Final の判断が情報不足で整理済み |

（UI ラベルは講義向けに日本語化。実装時に純関数化。）

---

## 7. schemaVersion 1 → 2 移行方針

### 7.1 原則

- **破壊的ドロップはしない。** v1 payload は読み取り時に v2 へ昇格（lazy migrate）またはバッチ。
- 学生の既存入力を可能な範囲で Information / Assessment / Final に写す。
- 自動で「完璧なカード分割」はしない（教育上、推測分割は危険）。

### 7.2 機械的マッピング（安全側）

| v1 フィールド | v2 への写し方 |
| --- | --- |
| `relatedInformation`（非空） | Information Card ×1（`type:"O"`, `source:"other"`, text=全文, pattern=当該）※分割しない |
| `interpretation`（非空） | Assessment Card ×1 の `interpretation` |
| `judgment` | 同一 Assessment の `classification` ＋ Final Form の `judgment` |
| `judgmentRationale` | Assessment の根拠テキストが無いため Final `judgmentRationale` へ。可能なら Assessment に note として複製 |
| `crossPatternRelations` | Final へ。Assessment `crossRelationsNote` へも複製可 |
| `additionalInformationNeeded` | Final ＋ Assessment（情報不足時） |
| `isReviewed` | Final の `isReviewed`（条件再検証） |

### 7.3 移行後の学生体験

- 旧データは「1枚の大きな情報カード＋1枚のアセスメント＋Final に原文」として残る。
- 学生は講義でカードを分割・整理し直せる（未完成の肯定）。

### 7.4 ロールバック

- sanitize は v1/v2 両対応の期間を設ける。
- 書き込みは原則 v2 のみ（合意後）。緊急時は feature flag で v1 UI へ戻す余地をロードマップに残す。

---

## 8. 関連図との接続（Version2.2+・構造のみ）

### 8.1 前提

**Information Card = 関連図のノード候補（1:1 の原子）。**

| 関連図要素 | 対応 |
| --- | --- |
| ノード | `InformationCard.id` + text / type / source |
| ノード属性 | S/O、source、patternKey |
| エッジ（将来） | Assessment の「根拠リンク」や明示リンクテーブル |
| 解釈ノード（将来） | Assessment Card を第二種ノードとして追加可能 |

### 8.2 やってはいけないこと

- 関連図完成の自動化。
- Information Card を様式テキストから逆生成して図を埋めること。

### 8.3 データ上の準備（今回）

- 安定 `id`
- `order`
- `patternKey`
- source/type  
これがあれば Version2.2 でグラフ UI を載せるだけで接続できる。

---

## 9. Coach との接続

### 9.1 Coach の役割（固定）

- 文章を書かない・解釈を代行しない・判断を選ばない。
- **Information Card / Assessment Card を見て問いを返す。**

### 9.2 入力コンテキスト（Coach が読んでよいもの）

```ts
type Form3CoachContext = {
  activePatternKey: Form3PatternKey;
  informationCards: InformationCard[];      // 当該パターン優先
  assessmentCards: AssessmentCard[];
  finalForm: FinalFormText | null;         // 参照のみ。書き換え提案はしない
  openGaps: ("no_information" | "no_assessment" | "no_evidence_link" | "final_empty")[];
};
```

### 9.3 問いの例（答えを含まない）

- 「この O 情報は、どの解釈とつながっていますか。」
- 「強みとした根拠のカードはどれですか。」
- 「情報不足としましたが、次に確認したいことは Final に書けていますか。」
- 「まだパターンに紐づいていない情報カードがあります。どこに置けそうですか。」

### 9.4 禁止

- Final Form への自動記入提案（文章生成）。
- 「看護問題は〇〇です」型の提示。

---

## 10. 現行 Version2.1 との差分一覧

| 観点 | Version2.1（現行実装） | Form3 Version2（本設計） |
| --- | --- | --- |
| 作業単位 | パターンごと長文6欄 | Information / Assessment カード＋Final |
| 関連情報 | 1つの textarea | 複数 Information Card |
| 判断 | パターンに1つ | Assessment 複数＋Final に様式上の1つ |
| 様式2参照 | 「患者理解の手がかり」Sheet | **必須経路にしない**。一次情報を直接参照 |
| 提出対象 | Workspace＝様式入力そのもの | Workspace ≠ 提出。Final Form が学校様式 |
| schemaVersion | 1 | 2 |
| 保存テーブル | form3_records | **同じ** |
| 関連図 | 未接続 | Information Card id で接続可能 |
| Coach | 未接続 | Card コンテキストで問い返し可能 |
| 転記 | 禁止（手がかり参照） | 禁止（カード→Final も自動転記しない） |

### 10.1 削除候補と理由

| 候補 | 判定 | 理由 |
| --- | --- | --- |
| **患者理解の手がかり**（様式2＋私が捉えた患者さん Sheet） | **削除候補（様式3導線から外す）** | 様式3を様式2依存にすると一次情報へ戻る思考が弱まる。様式2は別フェーズとして残す。患者理解文は Core／Evidence 側で維持 |
| **Pattern 全体の単一 judgment** | **削除（モデルから除去）** | 1パターン複数アセスメントと矛盾。様式上の判断は Final Form のみ |
| **relatedInformation 長文 textarea（Workspace上）** | **削除（Workspaceから除去）** | 事実の原子が長文に埋もれる。Information Card に置換。**Final Form の同名欄は学校指定のため残す** |

※「削除」は Compass Workspace の UX／内部モデルから除外する意。学校指定 Final の項目削除ではない。

---

## 11. 実装ロードマップ

新機能の一気実装はしない。既存 RLS・Autosave・Hook を活かし段階導入する。

### Phase R0 — 設計合意（本ドキュメント）

- [ ] 本設計の承認
- [ ] Final Form 欄が学校指定と1:1であることの教員確認
- [ ] 削除候補（手がかり Sheet）の合意

### Phase R1 — ドメイン型と純関数（コード）

- schemaVersion 2 型
- Information / Assessment / Final の factory・sanitize・進捗純関数
- v1→v2 migrate 純関数＋検証スクリプト
- **UI 未接続**

### Phase R2 — 永続化

- Mapper/Repository/Action を v2 payload 対応（テーブル変更なしを基本）
- 既存オートセーブ Hook を v2 ドキュメント単位へ
- conflict / draft 継続

### Phase R3 — Workspace UI

- Information Card UI
- Assessment Card UI
- 一次情報参照 Sheet（カルテ／会話／検査／治療／薬剤／基本情報）
- Final Form UI（学校指定）
- 手がかり Sheet を様式3から外す

### Phase R4 — Learning Layer 配線

- Day5 配線を v2 Workspace に置換
- iPad Lecture Readiness 再確認

### Phase R5 — Version2.2 準備

- 関連図: Information Card → ノード
- Coach: Form3CoachContext で問い返し

### 明示的非目標（当面）

- 提出ワークフロー刷新
- 教員コメント
- Evidence 自動リンク完成
- information_cards 正規化テーブル分割（必要になるまで延期）

---

## 12. 承認してほしい設計判断（チェックリスト）

1. Workspace と学校指定 Final Form を分離してよいか。
2. Information Card を関連図・Coach の共通原子としてよいか。
3. 様式3から「患者理解の手がかり（様式2）」必須導線を外してよいか。
4. v1 データは「分割せず1カードへ退避」する移行でよいか。
5. 当面 `form3_records` jsonb のまま schemaVersion のみ上げてよいか。

---

## 13. 次のアクション

本設計が承認されたら、**Phase R1（型・migrate・検証スクリプト）** から実装に入る。  
承認前はコード・DB・UI を変更しない。
