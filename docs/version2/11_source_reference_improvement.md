# 11. Evidence 出所参照 `source_reference` 正規化・改善 設計レビュー

Version 1.0
Last Update: 2026-07-18
Status: Proposal（Sprint2-2A 調査・実装しない）

> 本書は Evidence（Information Card）の **出所参照 `source_reference`**（＝その事実が「どこから来たか」）の
> 現状調査と正規化方針の設計レビューである。TD-001（会話エントリIDのセッション跨ぎ衝突）を中心に扱う。
> **今回はアプリコード・DB を一切変更しない。**
>
> 別概念との区別：Evidence を「様式2のどの記述の根拠に使ったか」（利用先）を結ぶ **Evidence–Form2 根拠リンク**は
> 別書 `10_evidence_form2_link_design.md` が扱う。本書は「上流（出所）への参照」のみを対象とする。
> 比較案の初出は `07_evidence_source_reference.md`、負債の記録は `06_sprint2_technical_debt.md`（TD-001）。

---

## 1. 現在の `source_reference` の型と保存形式

### 型（`lib/information/informationCard.ts`）
```ts
export interface InformationSourceReference {
  kind: string;   // ← 自由文字列（enum ではない）。navigation 用の種別。
  id?: string;    // 任意
  date?: string;  // 任意
  tab?: string;   // 任意
}
```
- `source_reference` は Evidence の**任意プロパティ**（無くてもよい）。
- 別に、出所の**種別**を表す `sourceType`（`source_type`）が **12種の enum** として存在する（`INFORMATION_SOURCE_TYPES`：`patient_conversation` / `student_note` / `clinical_record` / `nursing_record` / `flowsheet` / `prescription` / `examination` / `life_history` / `ot` / `psw` / `student_observation` / `pathophysiology_reference`）。
- 出所の**原文**は `originalText`（`original_text`）、出所の**時刻**は `observedAt`（`observed_at`）として、`source_reference` とは別のフラットな列で保持されている。

### 保存形式（Supabase `information_cards` / `0006`,`0008`）
```
source_type      text not null   -- 12種 enum を CHECK 制約で担保（型安全）
source_label     text not null
source_reference jsonb           -- {kind,id?,date?,tab?} | null（任意）
original_text    text            -- 出所の原文（＝実質の抜粋）
observed_at      timestamptz     -- 出所の時刻
```
- 二重収集防止の一意インデックス：
  `uq_information_cards_source (user_id, organization_id, academic_year, case_id, source_reference->>'kind', source_reference->>'id')`
  — **`deleted_at is null` かつ `source_reference ? 'id'`（id を持つ行）のみ**が対象。
- `source_reference` は不変（`reject_immutable_columns` トリガー）。作成後に変更不可。

**要点**：`source_type` は enum で型安全だが、`source_reference.kind` / `id` は **jsonb 内の自由文字列**で、CHECK も型もない。

---

## 2. どの経路で値が設定されるか

現状、Supabase へ実際に書き込む V2 の経路は **会話** と **一時メモ** の2つ（Sprint1 スコープ）。カルテ／Timeline からの直接収集は **未実装**（Sprint2 以降）。

| 経路 | 実装場所 | `source_type` | `source_reference` | `id` の由来 | 一意制約対象 |
|---|---|---|---|---|---|
| **会話** | `hooks/v2/useEvidenceSupabase.ts` `collectUtterance` | `patient_conversation` | `{kind:"patient_conversation", id: entryId}` | `getEntryId()` = **`${patientId}-${index}`（位置ベース）** | ○（id あり） |
| **一時メモ** | 同 `collectMemo` | `student_note` | **付与しない（null）** | — | ×（id 無しのため対象外） |
| 電子カルテ | V2 未実装（Sprint2+） | （将来）`clinical_record`/`nursing_record`/`prescription` 等 | （将来）`{kind:"recordId"/"nursingId"/"rxId"...}` | 将来：記録の安定ID | 将来 |
| Timeline | V2 未実装（Timeline は表示のみ） | — | — | — | — |
| その他（V1 の Note→Card 等） | `lib/information/informationCardAdapters.ts` | `student_note` / `patient_conversation` | `{kind:"student_note", id: note.id}` 等 | Note の安定ID／会話 entryId | ○/× |

補足：
- 会話 entryId は `pushEntry` 時に `id: \`${patientId}-${history.length}\`` として**位置で決定**され（`lib/patientFacingData.ts`）、会話状態 `FacingConvoState` は**メモリのみ**でリロードで初期化される。
- `getEntryId()` は id 未設定の旧 state で `\`${patientId}-${index}\`` にフォールバックする（位置依存）。
- V2 の**一時メモは `source_reference` を持たない**ため、V1 アダプター（メモに `id: note.id` を付与）と**設定内容が不統一**。

---

## 3. 現在の問題点

### (a) 値の不統一
- 会話は `source_reference` を持つが、**V2 の一時メモは持たない**（V1 アダプターは持つ）。同じ「メモ由来」でも経路で形が変わる。
- `source_reference.kind` の語彙が `source_type`（enum）と**部分的に重複**（`patient_conversation` / `student_note`）しつつ、別レイヤ（navigation 種別）として自由文字列で管理され、対応関係が明文化されていない。

### (b) 欠損
- 一時メモは `id` 欠損 → **二重収集防止インデックスの対象外**（同じメモを何度でも重複収集し得る）。
- `source_reference` 自体が任意のため、将来の経路で付け忘れ・部分欠損が起こり得る。

### (c) 表示上の問題
- 出所の可読名は `source_label`（例「患者との会話」「一時メモ」）で担保されており、現状の一覧表示は破綻しない。
- ただし「出所へ戻る（navigation）」UI は未実装で、`kind/id/date/tab` は保持のみ。将来 UI 化する際、語彙が揃っていないと**遷移先解決に失敗**する恐れ。

### (d) 型安全性
- `kind: string`（自由文字列）で TS の網羅チェックが効かない。`rowToInformationCard` の `toSourceReference` も任意 `kind` を素通しする。
- `source_type` は enum＋DB CHECK で型安全だが、`source_reference.kind`/`id` には DB 制約が無い。

### (e) 自由文字列による揺れ
- `kind` を書く箇所が経路ごとに散在（`useEvidenceSupabase` / V1 アダプター）。タイポ・表記揺れ（例 `patient_conversation` vs `conversation`）が入り込む余地がある。

### (f) 将来の参照不能リスク（TD-001 の核心）
- 会話 `id = ${patientId}-${index}` は**位置ベース**。会話はリロードで index が 0 から振り直されるため、次セッションで **`A-3` などのIDが別発言へ再利用**される。
- 結果、(i) 別発言が「収集済み」と誤判定され収集候補から外れる（`isCollectedBySource` の誤一致）、(ii) 一意制約 `uq_information_cards_source` が**偽の重複**として収集を拒否する。
- 会話を跨いだ「同じ発言＝同じ出所」を安定して指せないため、**出所参照としての同一性が保証されない**。

**最大の問題**：会話由来 `source_reference.id` が**位置依存で非永続**なこと（TD-001）。これにより出所同一性が崩れ、偽の重複衝突・収集漏れが起こる。`kind` の自由文字列・メモの id 欠損はこれに次ぐ副次問題。

---

## 4. 既存データへの影響

- **正式な蓄積データは存在しない。** Sprint1 は検証／QA データのみで、収集後にクリーンアップ済み（`08_sprint1_review.md`）。来週の講義が最初の本番投入。
- したがって **既存データ移行は不要**。正規化は「今後の新規収集」に対して適用すればよく、後方互換のためのバックフィルや破壊的変更は発生しない。
- スキーマ形状（`source_reference = {kind,id}`／一意インデックス／不変トリガー）を**変えずに** `id` の**導出方式だけ**を差し替えれば、DB 変更なしで是正できる（下記 §6）。

---

## 5. 推奨する正規化方法（現行コード・DB を踏まえて）

依頼の候補（`source_type` / `source_id` / `source_label` / `source_excerpt` / `source_timestamp`）を、**現行スキーマへ対応づける**と、多くは**既に別列として存在**する。新設は不要で、`source_reference` の中身を型安全＋安定IDへ正規化するのが最小・最良。

| 依頼の正規化項目 | 現行の対応 | 方針 |
|---|---|---|
| `source_type` | `source_type`（enum 12種・DB CHECK） | **既存を正とする**（追加不要）。型安全は担保済み。 |
| `source_label` | `source_label`（text） | 既存を維持（表示名）。 |
| `source_excerpt` | `original_text`（text） | **既存列を抜粋として扱う**（`source_reference` へ埋め込まない＝重複回避）。 |
| `source_timestamp` | `observed_at`（timestamptz） | **既存列を出所時刻として扱う**。 |
| `source_id` | `source_reference.id`（jsonb 内・自由） | **ここを正規化**：安定・位置非依存・サーバ検証可能な id へ。 |

### 正規化の中身（`source_reference`）
1. **`kind` を型付きユニオンにする**（TS）。`source_reference` 専用の許可集合を定義し、経路ごとの自由記述をやめる。
   - 例：`type SourceRefKind = "patient_conversation" | "student_note" | "clinical_record" | "nursing_record" | "prescription" | "flowsheet" | "examination" | ...`（`source_type` と1:1 or 対応表で明示）。
   - DB では当面 CHECK を追加せず、まず TS＋Server Action 検証で揃える（DB 変更なし）。
2. **会話 `id` を安定キーへ**：位置ベースをやめ、**原文（学生が整える前の発話）の content hash** を `id` にする（`07` 方式C）。
   - 偽衝突が消え（別発言＝別ハッシュ）、セッションを跨いでも同一発言は同一ID＝二重収集を一意制約で正しく防げる。
   - **サーバ側で `original_text` から同手順のハッシュを再計算し、クライアント値を上書き**（クライアントの id を信用しない＝Phase 3-2 方針と整合）。
   - `source_reference = {kind,id}` の形・一意インデックス・不変トリガーは**不変**（DB 変更なし）。
3. **一時メモの扱いを明文化**：当面は現状どおり `source_reference` なし（重複許容）を**正式仕様として固定**。将来メモの重複抑止が要るなら content hash を任意付与（`07` 方式D）。
4. **kind と source_type の対応表を単一箇所に**：語彙の散在・揺れ（問題 e）を防ぐため、収集生成を1つのヘルパーへ集約する。

この方針は「Evidence は事実のみ」「識別情報はサーバ決定」の既存方針と整合し、**スキーマ変更ゼロ**で TD-001 を解消できる。

---

## 6. 来週の講義に必要な最小実装範囲

来週の講義は Sprint1（会話・一時メモ → Evidence 収集）を使用する。実害が出得るのは会話由来の TD-001。**最小実装**は次のとおり（本書では実装しない＝別途承認後）。

1. **会話 `source_reference.id` の安定化（TD-001 の是正）**
   - `id` を「原文の content hash」に変更（`getEntryId` 依存の位置IDをやめる）。
   - 収集候補判定（`isCollectedBySource`）も同じ導出で行う。
   - **サーバ（`createCardAction`）で `original_text` からハッシュ再計算し上書き**（クライアント値を信用しない）。
   - DB 変更なし（`{kind,id}`・一意インデックス・不変トリガーは不変）。
2. （任意・低コスト）**`source_reference.kind` の TS ユニオン化**と生成ヘルパー集約（揺れ防止）。DB CHECK は追加しない。

この2点で「別セッションで別発言が収集できない／偽重複で拒否される」現象を解消できる。既存データ移行は不要（§4）。

---

## 7. 後回しにできる拡張範囲

- **カルテ／記録／Timeline からの直接収集**とそれに伴う `kind`（`recordId`/`nursingId`/`rxId`/`flowsheetDate`/`date`/`tab`）の標準化（Sprint2 以降。V2 未実装）。
- **出所へ戻る navigation UI**（`kind/id/date/tab` を使った遷移）。現状は保持のみ。
- **`source_reference.kind` の DB CHECK 制約**追加（まず TS で揃え、安定後に DB へ）。
- **一時メモの重複抑止**（content hash 付与＝方式D）。現状は重複許容で運用可。
- `source_excerpt` / `source_timestamp` を `source_reference` へ**埋め込む**案（既存の `original_text`/`observed_at` 列で足りるため不要。将来ネスト保持が必要になった場合のみ再検討）。
- 既存データのバックフィル（本番データが蓄積された後、必要が生じた場合のみ）。

---

## 関連ドキュメント

- `docs/version2/06_sprint2_technical_debt.md` — TD-001 / TD-002 と Sprint2 方針
- `docs/version2/07_evidence_source_reference.md` — `source_reference` 識別子の比較案（方式A〜D。本書の推奨は方式C＝content hash に整合）
- `docs/version2/10_evidence_form2_link_design.md` — Evidence–Form2 根拠リンク（別レイヤ＝利用先）
- `docs/version2/02_database.md` — `information_cards` スキーマ・一意制約・不変トリガー
- `docs/version2/05_information_notebook.md` — Information Notebook（Evidence）設計
- 実装場所：`hooks/v2/useEvidenceSupabase.ts`（`collectUtterance`/`collectMemo`/`isCollectedBySource`）、`lib/patientFacingData.ts`（`getEntryId`／entry 採番）、`lib/v2/notebook/informationCardMapper.ts`（`toSourceReference`）、`lib/information/informationCardAdapters.ts`（V1 生成）、`supabase/migrations/0006_information_cards.sql`（一意インデックス・不変トリガー）
