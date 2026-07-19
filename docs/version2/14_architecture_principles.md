# Compass Version2 Architecture Principles

- ステータス: 設計原則の確定記録（設計フェーズ完了）。本書は方針であり、アプリコード・DB は未変更。
- 位置づけ: **Compass Version2 の最上位設計書**。教育・プロダクト・技術・開発の原則を定義する。
- CWDS（`13_ui_architecture.md`）との関係: **上位ではなく並列**。本書が「なぜ・何を守るか（原則）」、CWDS が「UI をどう作るか（設計体系）」を担う。両者はともに最上位に位置し、機能設計書はこの2つに従う。
- 禁止事項（本フェーズ）: アプリコード変更・DB 変更・migration・commit・push は行わない。

---

## 1. Purpose

### この文書の役割

- Compass Version2 における **教育・プロダクト・技術・開発** の最上位原則を一箇所に定義する。
- あらゆる設計判断・実装判断が拠って立つ「価値観と制約」を明文化し、機能ごとに判断がぶれないようにする。
- 迷ったときの最終的な拠り所（tie-breaker）とする。

### 対象範囲

- Version2 の全機能（Question / Evidence / Form2 / Coach / Timeline / Teacher Guide / 認証 / 学習ログ 等）。
- 教育設計・プロダクト設計・技術設計・開発プロセスのすべて。
- Version3 以降を見据えた将来設計思想（§8）。

### 他設計書との関係

- 本書（Architecture Principles）と CWDS（`13`）は**並列の最上位**。
- 機能設計書（例: Question＝`12`、Information Notebook＝`05`、Evidence–Form2 リンク＝`10`、source_reference 改善＝`11` 等）は、本書と CWDS の**下位**に位置し、両者に従う。
- 優先順位は §末尾「設計原則の優先順位」を正とする。

---

## 2. Educational Principles

- **学生主体**: 学習の主役は学生。UI・AI・教材は学生の思考の場を用意する脇役に徹する。
- **AI は支援者**: AI は学生の後ろから支える。学生より前に出て考えたり結論を出したりしない。
- **Evidence First**: 学生はまず事実（Evidence）を集める。解釈・結論はその後。事実と解釈を混ぜない。
- **Question は答えを与えない**: Question が示すのは「次に確認・観察・考えるべき方向」であって、診断・正解・完成アセスメント・完成質問文ではない。
- **Direct Diagnosis 禁止**: システムが診断名・結論を直接提示しない。学生が自分の言葉で理解を組み立てる余地を必ず残す。
- **思考を奪わない**: チェックリスト化・進捗率・自動送信・機械的な情報不足判定など、学生の思考過程を代行/短絡する UI を作らない。
- **Reflection を重視する**: 気づき・ふり返りを学習の中心に据える。結果より思考プロセスを可視化・支援する。

---

## 3. Product Principles

- **Workspace First**: 学生の思考空間は Workspace。機能ごとに体験を分散させず、Workspace を起点・帰着点とする。
- **CWDS 準拠**: すべての UI は Compass Workspace Design System（`13`）に従う。独立した派手な UI を作らない。
- **必要になるまで見せない**: 情報は必要なときにだけ開く（Inspector）。常時表示で画面を圧迫しない。
- **状態を壊さない**: 画面遷移・パネル開閉で、会話・Evidence・様式2・スクロール位置などの作業状態を失わせない。
- **一貫した情報構造**: 情報階層（患者/カルテ → 会話 → Evidence → 様式2 → 補助）を全機能で共有する。
- **Appleらしい静けさ**: 余白・弱い影・明確な境界・落ち着いたタイポグラフィ。装飾より読みやすさ。
- **医療教育らしい信頼性**: 医療情報と学習支援を視覚的に区別。医療的意味の色を装飾流用しない。

---

## 4. Technical Principles

- **Deterministic First**: まず決定論的（静的・再現的）に作る。教育の安全性と再現性を優先する。
- **AI Last**: AI（動的生成）は最後の手段。導入は誤誘導リスクを評価してから、必ず学生の思考を奪わない形で。
- **Server Action 優先**: 変更系はクライアント直叩きでなく Server Action を経由し、identity・権限をサーバ側で確定する。
- **RLS 必須**: 学生関連テーブルは Row-Level Security を有効化。学生は自分のデータのみ R/W、教員/管理者は同一組織内で読み取り。
- **Type Safety**: 型で不正状態を排除する。Server Action は例外送出でなく `Result` 型を返し、クライアントで安全に扱う。
- **Small Components**: コンポーネントは小さく保つ。器（Inspector）と中身（Panel）のように責務を分ける。
- **Single Responsibility**: 各モジュール/コンポーネントは単一の責務。ドメイン知識を共通基盤に漏らさない。
- **Offline を考慮**: 保存失敗・ネットワーク断でも作業を失わない（ローカルドラフト・リトライ・状態のスタック回避）。

---

## 5. Development Principles

### 開発フロー

```
設計 → レビュー → 実装 → QA → 講義 → 改善
```

- **Sprint 単位**で進める。各 Sprint は明確な完了条件を持つ。
- **MVP 優先**: まず講義に間に合う最小構成を出荷し、拡張は後続 Sprint へ。
- **CWDS レビュー必須**: UI を伴う変更は CWDS（`13`）適合をレビューする。
- **Question レビュー必須**: Question に関わる変更は教育原則（§2、Direct Diagnosis 禁止・思考を奪わない）を教員監修でレビューする。

### 補足

- 設計フェーズでは commit/push・コード変更を行わず、方針を文書で確定してから実装に入る（Architecture Freeze の運用）。
- 変更の影響範囲（V1 非干渉・既存機能非破壊）を各 Sprint で確認する。

---

## 6. Architecture Decision Records（ADR）

- 今後、**重要な設計変更は ADR として残す**。口頭・チャットのみで決めた設計を後から追えなくしない。
- 対象例: Question の UI 方針、CWDS（UI アーキテクチャ）、Workspace Inspector、認証/RLS 設計、source_reference の正規化 など。
- 記録先（提案）: `docs/version2/adr/NNNN_title.md`（連番）。最低限、次を含める。
  - Context（背景・課題）
  - Decision（決定内容）
  - Alternatives（検討した代替案）
  - Consequences（結果・トレードオフ・影響範囲）
  - Status（proposed / accepted / superseded）
- 既存の設計書（`12` Question、`13` CWDS 等）は、事後的に該当 ADR から参照してよい。撤回した方針（例: 縦セクション常設 → QuestionSheet → Inspector）は改訂履歴として残す。

---

## 7. Non-goals

Compass が**目指さないもの**（恒久的な禁止）。

- AI が学生より先に/深く考える
- AI が様式（様式2 等）を書く
- AI が診断する
- 派手な UI（強いグラデーション・過度な装飾・大きな影）
- ゲーム化（バッジ・スコア・ランキングで学習を煽る）
- 複雑な設定（学生に不要な設定項目・分岐を負わせる）

これらは全設計判断の前提として禁止する。CWDS §10 の Non-goals と整合する。

---

## 8. Future Vision

- **Version2（現在）**: Workspace 中心の学習基盤を確立。Evidence First・決定論的 Question・Form2・認証/RLS。Inspector 基盤を Question で実証。
- **Version3**: Inspector にパネルを拡張（Reflection / Story / Teacher Guide）。学習ログの蓄積と教員支援（読み取り中心）。患者理解の「積み上げ」可視化。
- **Version4**: AI 支援の慎重な導入（AI Last 原則の下で、学生の思考を奪わない補助に限定）。組織横断の学習分析、より豊かな臨床シナリオ。
- 一貫する思想: どのバージョンでも「学生主体・AI は支援者・思考を奪わない・Workspace 中心・静かな信頼性」を変えない。機能は増えても原則は増やさない。

---

## 設計原則の優先順位

判断に迷ったときは、上位が下位に優先する。

```
Architecture Principles（本書 / 14）
        ↓
CWDS（UI アーキテクチャ / 13）
        ↓
Feature Design（機能設計書 / 例: Question=12, Notebook=05 …）
        ↓
Implementation（実装）
        ↓
UI Details（個別の見た目・細部）
```

- 下位の都合（実装容易性・見た目の好み）で上位原則（教育原則・CWDS）を曲げない。
- 競合したときは、より上位の文書の記述を正とし、必要なら ADR（§6）で変更を記録する。
