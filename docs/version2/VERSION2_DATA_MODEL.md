# VERSION2_DATA_MODEL — データモデル設計（案）

> ステータス: **設計案**。既存スキャフォールドを再利用し、破壊的変更は行わない。
> 実装はまだ行わない。既存の Version1 データ型・localStorage キーは変更しない。

## 1. 設計原則（既存 store を踏襲）

1. 純粋関数（state 変換）と localStorage 永続化層を分離する。
2. SSR / hydration で壊れない（`typeof window` ガード、`useSyncExternalStore` + 安定参照）。
3. 不正データでクラッシュせず、**安全に空状態へ戻す**（`try/catch` + normalize）。
4. `version` を持ち、将来 migration できる。
5. **患者ごとにデータを分離**（キー or `patientId` フィールドで隔離。normalize 時に一致検証）。
6. 保存は「ユーザー操作時のみ」。初期レンダリングで空データを上書きしない。

> これらは V1 の `notesStore` / `informationCardStore` / `organizedInformationStore` / `facingConvoStore`（V1 fix）で確立済みのパターン。

## 2. 保存対象データ（Version2）

| データ | 目的 | 既存/新規 | 分離単位 |
| --- | --- | --- | --- |
| 情報カード | 収集した情報の最小単位 | **既存**（`InformationCard`） | 患者別（state 内 `cardsByPatient`） |
| 整理された情報 | カードを束ねた意味のまとまり | **既存**（`OrganizedInformation` + revision） | 患者別（`currentByPatient`） |
| 気づきメモ | 自由記述の気づき | 既存（`Note`） | 患者別キー |
| 患者会話 | 面接履歴（V1 fix で永続化済み） | 既存 | 患者別キー |
| ワークスペース UI 状態 | 開いているセクション等 | **新規（案）** | 患者別 or セッション |
| 学習進捗（保留） | 段階の到達状況 | **新規（保留）** | 患者別 |

## 3. 既存の型定義（再利用・変更しない）

### InformationCard（`lib/information/informationCard.ts`）

```ts
type InformationSourceType =
  | "patient_conversation" | "student_observation" | "clinical_record"
  | "nursing_record" | "flowsheet" | "prescription" | "examination"
  | "life_history" | "ot" | "psw" | "student_note" | "pathophysiology_reference";

interface InformationSourceReference { kind: string; id?: string; date?: string; tab?: string; }

interface InformationCard {
  id: string;
  patientId: string;
  content: string;
  sourceType: InformationSourceType;
  sourceLabel: string;
  sourceReference?: InformationSourceReference;
  createdAt: string;                 // ISO 8601
  createdBy: "student" | "system";
  category?: string;                 // ②分類（方式は保留）
  note?: string;
  originalText?: string;
  observedAt?: string;               // ISO 8601
  updatedAt?: string;                // ISO 8601
}
```

### OrganizedInformation（`lib/organization/`）

- `currentByPatient: Record<patientId, OrganizedInformation[]>`
- `revisionsByInformationId: Record<informationId, OrganizedInformationRevision[]>`
- `OrganizedInformation` は `title` / `content` / `sourceDataIds`（元カード参照）/ `revision` / `status`（organized|archived 等）/ `createdBy` / `createdAt` / `updatedAt` / `previousRevisionId`。
- 更新は `commit` を通して **revision +1**（破壊的上書きをしない）。

> Version2 では上記を **拡張せずに** UI 接続することを第一候補とする。追加が必要な場合も **任意フィールドの追加のみ**（既存必須項目は変えない）。

## 4. 新規型定義（案・拡張候補）

### 4.1 分類（②）— category の扱い（保留：A案/B案）

- A案: `category` を **自由文字列** のまま使う（学生が自分でラベル付け）。
  - 長所: 思考を代行しない。柔軟。短所: 集計・一貫性が弱い。
- B案: `category` を **定義済み列挙** にする（例: 身体 / 精神 / 生活 / 社会 / 家族 …）。
  - 長所: 迷いにくい・一覧性。短所: 枠に当てはめる思考になりやすい（教育方針と要検討）。
- 既存型は `category?: string` なので **どちらも後方互換**（列挙化は検証関数の追加で対応可能）。

### 4.2 重要度（④）— 追加候補（保留）

```ts
// 案: InformationCard に任意フィールドを追加（必須にしない）
// importance?: "high" | "normal" | "low";   // ④見極め（採用可否は保留）
```

- 並び替え（`reorderCards` 既存）で「重要順」を表現する案もある（新フィールド不要）。

### 4.3 ワークスペース UI 状態（新規・軽量）

```ts
interface WorkspaceUiStateV2 {
  version: 1;
  patientId: string;
  openSection?: string;      // 開いているセクション（集める/つなげる/全体像…）
  updatedAt: string;         // ISO 8601
}
```

- UI の一時状態のみ。学習データ本体は既存 store に置く。
- 破損時は破棄して既定へ（学習データには影響させない）。

## 5. localStorage キー案

### 既存（変更しない）

| キー | 内容 | version |
| --- | --- | --- |
| `nc:notes:<patientId>` | 気づきメモ | 配列（型検証あり） |
| `nc:information-cards` | 情報カード（全患者・`cardsByPatient`） | 1 |
| `nc:organized-information` | 整理された情報・revision | 1 |
| `compass:v1:patient-conversation:<patientId>` | 患者会話（V1 fix） | 1 |
| `compass:firstAssignment:<patientId>` | 課題シート既読 | — |

### 新規（Version2・案）

| キー | 内容 | 分離 | version |
| --- | --- | --- | --- |
| `compass:v2:workspace-ui:<patientId>` | ノートUIの一時状態 | 患者別 | 1 |
| `compass:v2:progress:<patientId>` | 学習進捗（**保留**） | 患者別 | 1 |

> 命名規則: 学習データで新設する場合は `compass:v2:<domain>:<patientId>` に統一（V1 の `compass:v1:*` と衝突しない）。
> 既存 `nc:*` キーは **流用**し、無闇に新キーを増やさない（情報カード/整理情報は既存キーのまま UI 接続）。

## 6. 患者ごとの分離

- キーに `<patientId>` を含める（会話・メモ・UI状態・進捗）。
- 全患者を1キーに持つ store（`nc:information-cards` / `nc:organized-information`）は、
  normalize 時に **キー（patientId）と各要素の `patientId` の一致を検証**して混入を防ぐ（既存実装済み）。
- 表示時は必ず `patientId` でスコープしたスナップショットを使う。

## 7. バージョン管理と移行

- すべての保存データに `version` を持たせる（既存踏襲）。
- 読み込み時に `version` 不一致 → **安全に空/初期へフォールバック**（現状方針）。
- 将来的に migration が必要になったら、`normalizeStoreState` に version 分岐を追加する（データを壊さない移行を関数内に閉じる）。

## 8. 不正データ時の処理

- `JSON.parse` は必ず `try/catch`。
- normalize で要素単位に型検証（不正要素は除外、順序・ID・話者区分など必要属性は維持）。
- 容量超過・プライベートモードの `setItem` 失敗は握りつぶし、**画面をクラッシュさせない**。
- 学習データ本体（カード/整理情報/メモ/会話）と UI 一時状態を分離し、UI 破損が学習データに波及しないようにする。

## 9. 将来 DB 化する場合の移行余地

- 現在の store は「純粋関数 + 永続化層」に分離済み。永続化層（`loadStore`/`saveStore`）を **API 実装へ差し替え** れば UI/フックは不変。
- `InformationCard` / `OrganizedInformation` は ID・patientId・createdAt(ISO)・出所参照を持ち、そのまま行レコードへ写像可能。
- revision 履歴は別テーブル（`revisionsByInformationId` → `revisions` テーブル）へ対応づけ可能。
- 当面は **localStorage のみ**（クラウド同期・アカウントは対象外）。移行余地を残すだけで実装はしない。

## 10. データモデル関連の保留事項（講義後に確定）

- category を自由文字列にするか列挙にするか（4.1）。
- 重要度をフィールド化するか並び替えで表現するか（4.2）。
- 学習進捗を保存するか否か（5 / 保留キー）。
- 関連づけの表現（`sourceDataIds` のみ / タグ / グラフ構造）。
