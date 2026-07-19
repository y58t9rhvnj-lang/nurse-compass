# Compass Design Principles

> 本書は Compass 全体（Core ＋ Learning Layer ＋ Integration）を貫く**最上位の設計原則**を定義する。
> 個別機能・UI 細部の設計は本書に従属する。恒久名称は Core / Learning Layer / Integration。

---

## 12 Principles

以下の12原則を Compass の設計原則とする。原則名は変更しない。

### 1. Clinical World First
最初に見えるのは学習ツールではなく**臨床世界**である。ログイン後も、利用者がまず出会うのは Core（病棟・患者・電子カルテ・会話）であり、学習支援 UI が前面に立たない。

### 2. Learning Support on Demand
学習支援は**必要なときのみ開く**。Inspector・問い・整理の道具は常時前面に出ず、学習者が求めたときに現れ、閉じれば臨床世界に戻る。

### 3. Do Not Replace the Core
**Learning Layer は Core を置き換えない**。Learning は Core を参照・重畳するが、病棟・患者・カルテ・会話 UI を複製・差し替えしない（別シェル・別カルテを作らない）。

### 4. Preserve Context
**画面・入力・選択・スクロールを壊さない**。学習能力の開閉・保存で、選択患者・カルテタブ・スクロール位置・会話入力・様式2 入力・保存状態を失わせない。主要画面を再マウントしない。

### 5. Student Thinking First
**AI やシステムが答えを完成させない**。診断・結論・様式2 の完成文を提示せず、学生自身の観察・比較・理由づけ・根拠確認を支える。学生の思考を代行しない。

### 6. Evidence Before Conclusion
**結論より根拠確認を優先する**。先に結論へ飛ばず、事実（Evidence）を選び意味づける過程を重視する。根拠なき結論を促す UI を作らない。

### 7. Quiet UI
学習支援は常時主張せず、**静けさ・信頼性・思考の余白**を重視する。Apple ライクの落ち着いたトーン。視覚的ノイズ・過度な装飾・演出・ゲーミフィケーションを避ける。医療的意味を持つ色を装飾流用しない。

### 8. Progressive Disclosure
**必要な機能だけ段階的に見せる**。情報を一度に出さず、文脈に応じて開示する。学習者が今必要としないものは隠し、迷子にさせない。

### 9. Explicit Persistence
**何が保存され、誰の記録かを明確にする**。保存中／保存済み／保存失敗の状態を可視化し、学習データは学習者本人のものとして扱う（保存の正は一意、Core の localStorage に混在させない）。

### 10. Core Independence
**Learning Layer を無効にしても Core が完全に成立する**。`learningLayer` 未指定でも Core（`/`）は臨床世界として完結し、学習基盤・認証・特定保存基盤に依存しない。

### 11. Accessibility
iPad・キーボード・タッチ・フォーカスを丁寧に扱う。**44px 以上の操作領域**、フォーカス可視、`aria` 属性、Escape で閉じる、背景タップで閉じる、フォーカス復帰（`preventScroll`）、横スクロールを生まないレスポンシブを守る。

### 12. Future Extensibility
**student / teacher / OSCE / exam / reflection 等へ拡張可能**であること。能力単位（capability）で追加でき、Core の構造や既存原則を壊さずに将来機能を重畳できる設計を保つ。

---

## Priority of Principles（原則の優先順位）

競合時は上位を優先する。上記12原則および `01`〜`03` のアーキテクチャ原則が最上位に立つ。

```
Architecture Principles（01 / 02 / 03 ＋ 本書 12 Principles）
        ▼
Design Principles（本書 全体）
        ▼
CWDS（UI アーキテクチャ: docs/version2/13_ui_architecture.md）
        ▼
Feature Design（各機能設計: docs/version2/12 ほか）
        ▼
Implementation（実装）
        ▼
UI Details（UI 細部）
```

- 例: UI 都合（下位）のために Core を再マウントする案は、`Preserve Context`（上位）に反するため採らない。
- 例: `mode` 全体切替の再導入は `Do Not Replace the Core` / `Core Independence`（上位）に反するため採らない。

---

## Non-Goals（非目標・現段階）

- Core を学生専用 UI に置き換えること。
- Learning Layer による別シェル・別ナビゲーション・別カルテの提供。
- 様式2 への自動転記／AI による答えの生成。
- MVP 段階での AI 学習支援・教員評価・Apple Pencil の常用機能化。
- 独立 Workspace ルート（別シェル型）の恒久採用。

---

## 名称と移行方針（全文書共通）

- **Version1** … 現在の Core 実装を指す歴史的・実装上の名称。
- **Version2** … Learning Layer 導入を進めてきた開発段階の名称。
- 恒久的な製品アーキテクチャは **Core / Learning Layer / Integration** で表現する（Version1 / Version2 は恒久名称に用いない）。
- `/v2` ルートと `docs/version2` は移行中の技術資産として当面残す。
- 今回はルート名変更・ファイル移動・コード変更を行わない。

---

## Migration Notes

### 継続採用
- 静けさ・信頼性・思考支援・「AI を主役にしない」（CWDS §2 / §10、`14_architecture_principles.md`）。
- アクセシビリティ規約（44px・フォーカス復帰・Escape・背景タップ・`no-print`）。
- 原則の優先順位という考え方（`14_architecture_principles.md` から継承）。

### 名称・位置付けを変更
- CWDS「**Workspace First**」→ **Clinical World First / Core First**（原則1）。
- CWDS「**Workspace Inspector**」→ **Learning Layer Inspector**（Learning Support on Demand = 原則2 の器）。
- 「Workspace の状態非破壊」→ **Preserve Context**（原則4）として一般化。

### 廃止予定
- `mode="v2"` による AppShell 早期 return。
- StudentShell / 独立 Workspace 中心構造 / V2 専用 4 項目ナビ。

### 実装移行が必要
- `learningLayer` 統合と V1 return への加算接続（`03` §3 / Migration）。
- Learning Navigation セクション・Inspector overlay 化・Supabase 様式2 の患者文脈接続。

> 既存 `docs/version2/13_ui_architecture.md`（CWDS）は「Workspace First / Workspace Inspector」を中核に置くため、本書の原則1〜4 と**名称・主従が矛盾**する。既存文書は変更せず、本 `docs/architecture/` を上位の恒久定義とし、CWDS は UI 実装ガイド（下位）として整合させて運用する。

---

## 関連文書
- `01_compass_core.md` / `02_learning_layer.md` / `03_core_learning_integration.md` / `04_learning_flow.md`
- 移行段階の詳細記録（保持）: `docs/version2/13_ui_architecture.md`（CWDS）, `14_architecture_principles.md`, `12_question_feature_review.md`。
