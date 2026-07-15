# Compass Version2 — 実装前設計フェーズ（planning）

このフォルダは **Compass Version2 の実装前設計資料** です。
`feature/version2-planning` ブランチで作成し、**Version1 の動作コード・表示・データ・導線・feature flag は一切変更しません**。
講義後の学生フィードバックを反映できるよう、確定は最小限に留め、複数案（A案/B案）を残しています。

## 重要方針（このフェーズの制約）

- Version1 は公開済みの**安定版として凍結**。本番コード・データ・導線を変更しない。
- `main` へ直接変更を加えない／マージしない。
- **講義前は機能実装を行わない**（設計・調査・型定義案・タスク分解・ドキュメントのみ）。
- `lib/featureFlags.ts` は変更しない（`informationNotebook: false` / `collection: false` のまま）。
- 新しいボタン・タブ・フォーム・導線・表示は追加しない。
- Compass Coach・看護記録・患者データ・患者会話内容は変更しない。

## 資料一覧

| # | ファイル | 目的 |
| --- | --- | --- |
| 1 | [VERSION2_SCOPE.md](./VERSION2_SCOPE.md) | 目的・対象/対象外・V1との違い・成功条件 |
| 2 | [VERSION2_USER_FLOW.md](./VERSION2_USER_FLOW.md) | 学生の学習フロー（面接→カルテ→整理→言語化） |
| 3 | [VERSION2_INFORMATION_ARCHITECTURE.md](./VERSION2_INFORMATION_ARCHITECTURE.md) | 画面・タブ構成、ノートの位置、PC/iPad配置案 |
| 4 | [VERSION2_DATA_MODEL.md](./VERSION2_DATA_MODEL.md) | 保存対象・型定義案・localStorageキー・移行余地 |
| 5 | [VERSION2_TASK_BREAKDOWN.md](./VERSION2_TASK_BREAKDOWN.md) | Epic/Sprint/Task・依存・優先度・実装順 |
| 6 | [VERSION2_FEEDBACK_CHECKLIST.md](./VERSION2_FEEDBACK_CHECKLIST.md) | 講義中の観察点・仕様反映の判断基準 |
| 7 | [VERSION2_ACCEPTANCE_CRITERIA.md](./VERSION2_ACCEPTANCE_CRITERIA.md) | 受け入れ条件・UI/保存/iPad要件・回帰防止 |

## 前提

- 主利用端末は **iPad と PC**。スマートフォンは主対象外。
- 学生アカウントは当面実装しない。保存は当面 `localStorage`。クラウド同期は対象外。
- 患者ごとにデータを分離する。
- Version2 は **feature flag で切替可能**な構成を維持する（既定は off）。
- 新機能は学生の思考を代行しない。Coach は答えを与えず**問い返し**を基本とする。
- 情報整理ノートは答えを自動生成する場ではなく、学生が**自分の言葉で整理する場**とする。

## 既存の Version2 用スキャフォールド（実装済み・UI非接続）

Version2 の基盤は Version1 期間中に「UIに接続しない土台」として一部実装済みです。本設計はこれを再利用します。

- `lib/information/informationCard.ts` … `InformationCard` 型・検証・生成
- `lib/information/informationCardStore.ts` … `nc:information-cards`（version 1, 患者別, 購読対応）
- `lib/organization/organizedInformation*.ts` … `nc:organized-information`（version 1, revision履歴, 患者別）
- `lib/featureFlags.ts` … `informationNotebook` / `collection`（ともに false）

> これらは「基盤のみ」で、学生導線・表示・収集操作は Version1 では非表示です（feature flag off）。
