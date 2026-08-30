# Compass Version 2.2 — AI 評価アーキテクチャ（正式運用方針）

Status: **正式仕様**  
Scope: Version 2.2 における AI 形成的評価の運用アーキテクチャと境界  
非対象: Version 3.0 のワンクリック API 接続実装、未提出支援、自動採用

関連仕様:

- パッケージ: `01_ai_evaluation_package_spec.md`
- 評価方針: `02_ai_evaluation_policy.md`
- staging: `03_ai_evaluation_staging_spec.md`
- 取込検証: `04_ai_evaluation_import_validation.md`
- 採用フロー: `05_ai_evaluation_adoption_flow.md`
- 一括 ZIP: `06_ai_evaluation_batch.md`

---

## 1. 目的

本書は、Compass Version 2.2 における **AI 評価の正式運用方針**を固定する。

Version 2.2 の目的は次のとおりである。

1. 教員が提出済み学生の評価対象を **Export Package** として安全に取り出せる。
2. 教員が任意の外部 AI（ChatGPT / Cursor / Claude 等）に Package を渡し、形成的評価案を得られる。
3. 外部 AI が生成した **Import ZIP（AiEvaluationResult）** を Compass に取り込み、staging 上の候補として確認できる。
4. 教員が必要な項目だけ **一部採用**し、最終評価・返却の責任を教員が負う。
5. Compass 本体は特定の AI ベンダー・モデル・API に依存しない。

本方針は「AI を使うこと」自体を目的としない。  
教育上の最終判断を教員に残したまま、外部 AI を **交換可能な支援手段**として接続する境界を定義する。

---

## 2. Version 2.2 の運用フロー

Version 2.2 の正規フローは次のとおりとする。

```
Compass
  ↓
一括 AI Package Export
  ↓
教員が ZIP をデスクトップへ保存
  ↓
ChatGPT / Cursor / Claude 等の任意の AI へ渡す
  ↓
AI が Import ZIP（AiEvaluationResult）を生成
  ↓
Compass 一括 Import
  ↓
教員が AI 候補を確認
  ↓
必要な項目のみ一部採用
  ↓
最終評価・返却
```

### 2.1 各段階の責務

| 段階 | 実施者 | Compass の責務 | 外部 AI の責務 |
|------|--------|----------------|----------------|
| Export | 教員 | 対象選定・匿名化 Package 生成・ZIP 交付 | なし |
| 外部評価 | 教員 + 任意 AI | なし（オフライン） | Package を読み、Result JSON を生成 |
| Import | 教員 | manifest / schema / request 照合・staging 保存 | なし |
| 確認・採用 | 教員 | 候補表示・部分採用・監査 | なし |
| 最終評価・返却 | 教員 | 既存 review / 返却フロー | なし |

### 2.2 Version 2.2 で行わないこと

- OpenAI API / Claude API / Azure OpenAI 等への **直接接続**
- Compass 画面からの **ワンクリック外部 LLM 実行**
- AI 結果の **自動採用**
- 最終評価・学生返却の AI 代行
- 特定ベンダーへのロックインを前提とした内部ジョブ必須化

---

## 3. 設計思想

### 3.1 Compass は AI に依存しない

- Compass の正本データは、提出・教員 review・返却である。
- AI 評価結果は **staging 上の候補**であり、教員採用前は学生に公開しない。
- 外部 AI が利用不能でも、教員は従来どおり評価・返却できる。

### 3.2 Export / Import で AI を交換可能にする

- Compass が公開する契約は **AiEvaluationPackage** と **AiEvaluationResult**（および Batch manifest）である。
- 教員は ChatGPT、Cursor、Claude、その他の任意ツールをその都度選択できる。
- モデル変更・プロンプト調整・ベンダー切替は、Compass コード変更なしに行える。

### 3.3 最終評価者は必ず教員である

- Import 後の既定状態は確認待ち（例: `needs_review`）。
- 自動採用は行わない。
- 採用は項目単位の部分採用を基本とし、未選択の教員入力は維持する。
- 学生への返却内容の最終責任は教員にある。

### 3.4 境界をファイルとスキーマで固定する

- Export ZIP: `manifest.json` + `packages/{evaluation_request_id}.json`（必要に応じ `target-list.json` 等の監査用付帯ファイル）
- Import ZIP: `manifest.json` + `results/{evaluation_request_id}.json`
- 検証は schema / request 照合 / 重複拒否 / 対象リスト外拒否などで行い、曖昧な自由入力を本番経路に載せない。

### 3.5 教育方針との整合

- AI は形成的評価の下書き支援であり、完成アセスメントや看護計画の代行ではない。
- 学生向け文面に、看護の方向性・看護目標・看護計画・援助方法等の禁止内容を混ぜない（詳細は `02_ai_evaluation_policy.md`）。

---

## 4. Version 3.0 との違い

| 観点 | Version 2.2（現行正式方針） | Version 3.0（将来） |
|------|-----------------------------|---------------------|
| AI 実行場所 | 教員の外部ツール（ChatGPT / Cursor / Claude 等） | Compass からのワンクリック接続も追加可能 |
| API 直接接続 | **実装しない** | OpenAI / Claude / Azure OpenAI 等を検討 |
| ベンダー依存 | なし（ファイル契約のみ） | 接続先を設定可能にするが、Export/Import 経路も維持推奨 |
| 運用の中心 | 教員が ZIP を運ぶ | 教員 UI 上の実行も選択肢になりうる |
| 自動採用 | しない | 原則しない（教員最終責任は維持） |
| Compass 単体運用 | AI なしでも評価可能 | 同様に AI なし運用を維持すべき |

Version 3.0 は「利便性の追加」であり、Version 2.2 の **AI 非依存・教員最終責任・交換可能な境界**を破棄する変更ではない。

---

## 5. 採用理由

### 5.1 教育上の理由

- 最終評価を教員に残すことで、AI の過信・自動確定による教育責任の空洞化を防ぐ。
- 教員が外部 AI を比較・選択できるため、授業文脈や評価方針に合わせた使い方が可能。

### 5.2 プロダクト上の理由

- Version 2.2 では、本番品質の Package / Result / staging / 部分採用を先に安定させる。
- API キー管理・課金・レート制限・障害切り分けを Compass 運用に持ち込まず、現場導入を単純化する。

### 5.3 技術上の理由

- Export/Import 契約があれば、モデル進化に追従するために Compass を頻繁に改修しなくてよい。
- ベンダー SDK・秘密鍵・ジョブ基盤を必須化しないため、障害点が減る。
- 将来の Version 3.0 API 接続は、同じ Package/Result 契約の上に載せる拡張として設計できる。

### 5.4 運用上の理由

- 教員は使い慣れた AI ツールをそのまま利用できる。
- Compass 障害と外部 AI 障害を分離できる。
- 監査上も「誰が Export したか」「何を Import したか」「教員が何を採用したか」を段階的に追跡しやすい。

---

## 6. 方針の要約（固定）

1. **Version 2.2 は Export → 外部 AI → Import → 教員確認 → 部分採用 → 最終評価・返却**を正規フローとする。  
2. **OpenAI API 等への直接接続は Version 2.2 では行わない。**  
3. **AI は外部で自由に選べる。Compass は AI に依存しない。**  
4. **AI は交換可能（ファイル契約）。**  
5. **最終評価者は教員。自動採用はしない。**  
6. **Version 3.0 のワンクリック API 接続は将来課題であり、本版では実装しない。**

---

## 7. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-08-30 | Version 2.2 正式運用方針として新規作成 |
