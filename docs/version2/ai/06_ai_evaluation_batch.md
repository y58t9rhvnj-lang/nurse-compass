# Sprint 5D — AI Evaluation Batch（ZIP + manifest）

Status: **実装**  
Scope: 正式 `AiEvaluationPackage` の共通生成、ZIP+必須 manifest による一括 Export/Import。一括採用・AI送信・ジョブキューは対象外。

## 方針

- **1学生（提出）= 1 Package / 1 Result**
- Package 生成は `buildAiEvaluationPackage()` **一経路のみ**（個別 Export と Batch Export で共有）
- Batch は運用単位。`batch_runs` テーブルは作らない。audit JSON payload に `batch_id` 等を載せる
- Import は既存個別 Import を **同時 2〜3 件**で呼び出す
- 運用: 一括取込 → 個別確認 → 個別（部分）採用

## Export ZIP

```
manifest.json          # 必須
README.txt
packages/{evaluation_request_id}.json   # AiEvaluationPackage
```

## Import ZIP

```
manifest.json          # 必須（無い場合は取込しない）
results/{evaluation_request_id}.json    # AiEvaluationResult
```

manifest と実ファイルが一致しない場合、**Preview で実行不可**。

## 主要モジュール

| ファイル | 役割 |
|----------|------|
| `lib/v2/assessment/aiEvaluationPackageBuilder.ts` | `buildAiEvaluationPackage()` |
| `lib/v2/assessment/aiEvaluationPackageExport.ts` | request 記録 + Package 配列生成 |
| `lib/v2/assessment/aiEvaluationBatchManifest.ts` | manifest 必須検証 |
| `lib/v2/assessment/aiEvaluationBatchZip.ts` | ZIP / README |
| `lib/v2/assessment/aiEvaluationBatch.ts` | Batch Preview / Export / Import |
| `app/v2/actions/assessmentAiEvaluationBatch.ts` | Server Actions |

## 運用

- 正式評価前に `compass_policy_version` / `rubric_version` が現行定数と一致する Package で Export すること
- policy 更新後（例: 2026.3 → **2026.4**）は、対象コホートを **再Export** してから外部 AI 評価を行う（旧 ZIP は旧原則のまま）

## テスト

```bash
npx tsx lib/v2/assessment/aiEvaluationBatch.smoke.ts
npx tsx lib/v2/assessment/aiEvaluationPolicy2026_4.test.ts
```
