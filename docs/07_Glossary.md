# 07 Glossary（Compass Version1 用語集）

Version 1.0
Last Update: 2026-07-12
Status: Official Version1 Glossary（Version1 公式用語集）

> 本書は Compass Version1 の公式用語を定義する。
> 学生向け表示語（UI）と内部・開発語が異なる場合は、両方を明記する。
> 教育モデルは `docs/06_Compass_Educational_Model_V1.md`、
> 設計原則は `docs/08_Design_Principles.md` を参照。

各用語は次の形式で記す：

- **表示語（日本語）** ／ 内部・開発語（異なる場合）
  - 定義
  - それが「ではないもの」
  - 関連する用語（必要な場合）

---

## 基本

### Compass ／ Nurse Compass

- 患者理解のための思考を支える臨床思考の学習環境。
- **ではないもの**：電子カルテ操作練習システム／記録完成システム／自動アセスメント生成器。
- 関連：Patient understanding、Clinical Thinking Workspace。

### 患者理解（Patient understanding）

- 患者を一人の人として観察し、状態がなぜ起きているかを説明できるようになること。
- **ではないもの**：知識の暗記／カルテ内容の再現。
- 関連：North Star、Cue。

---

## 思考の段階

### 気づき（Noticing）

- 興味・違和感・矛盾・好奇心が生まれる瞬間。思考の起点。
- **ではないもの**：結論／解釈の確定。
- 関連：「あれ？」、Temporary memo。

### 「あれ？」

- 情報を比較したときに生じる違和感・引っかかりの瞬間（気づきの一種）。
- **ではないもの**：エラー表示／システムからの警告。
- 関連：Comparison、Cue。

### 一時メモ（Temporary memo） ／ 気づきメモ・NoteZone（内部）

- 思考を中断させないための作業記憶の場。未完成の考え・疑問・備忘・粗い言葉を置く。
- **ではないもの**：収集データではない。自動的に収集されない。様式の下書きでもない。
- 関連：Collection（学生が明示的に選んで初めて収集データになる）。

### 収集（Collection）

- 患者理解のために「残す価値がある」と学生が判断してデータを保存する行為。
- **ではないもの**：単なる保存操作ではない（教育的判断を伴う）。自動保存ではない。
- 関連：Collected data、Collection release。

### 収集データ（Collected data） ／ InformationCard（内部）

- 収集された事実。出所と原文を保持する。
- **ではないもの**：学生の解釈ではない。情報（整理済み）ではない。
- 関連：Data、Source、Original text、Saved content。

---

## データ・情報・手がかり

### データ（Data） ／ InformationCard（内部型）

- 編集していない事実（患者発言・観察・カルテ記載・測定値）。
- **ではないもの**：解釈ではない。整理済みの情報ではない。
- 表示上の注意：`InformationCard` は内部型名。学生向け UI では「**データ**」または「**収集データ**」と表示する。

### 出所（Source）

- データがどこから来たか（患者・診療録・看護記録・フローシート・処方・検査・生活歴・OT・PSW・学生観察・一時メモ）。
- **ではないもの**：学生の解釈ではない。
- 関連：Evidence reference、Original text。

### 原文（Original text）

- 収集時点の元の文言・数値。保持され、書き換えない。
- **ではないもの**：編集可能な表示文ではない。
- 関連：Saved content（表示文は修正可、原文は不変）。

### 保存内容（Saved content）

- 学生が一覧で見やすいように整えた表示内容。後から修正できる。
- **ではないもの**：原文の書き換えではない（原文は保持される）。
- 関連：Original text。

### 患者理解の視点（Patient-understanding perspective）

- データを整理する切り口（テーマ）。例：睡眠・休息、服薬、家族 など。
- **ではないもの**：進捗チェックリストではない。固定分類ではない（追加・変更可）。
- 関連：Information。

### 情報（Information） ／ InformationGroup（内部・設計）

- 1つ以上の収集データを、患者理解の視点で整理し、S/O/未分類に分類したまとまり。
- **ではないもの**：**解釈ではない**。解釈文を含まない。自動生成されない。
- 関連：Data、Cue、Subjective/Objective。

### 主観的データ／S情報（Subjective data / S information）

- 患者・家族の発言など、主観的なデータ。
- **ではないもの**：解釈・分析ではない。
- 関連：Objective、Unclassified。

### 客観的データ／O情報（Objective data / O information）

- 観察・測定値・カルテ記載など、客観的なデータ。
- **ではないもの**：解釈・分析ではない。
- 関連：Subjective、Unclassified。

### 未分類（Unclassified）

- まだ S/O へ分類していないデータの状態。
- **ではないもの**：不要データではない。
- 関連：Subjective、Objective。

### 手がかり（Cue） ／ Cue（内部・設計）

- 情報を根拠に学生が作成した解釈・関連・追加確認の方向・看護問題の方向性。
- **ではないもの**：確定した看護問題ではない。Compass が自動生成するものではない。
- 関連：Evidence reference、Information、Form。

### 根拠参照（Evidence reference）

- 手がかりが依拠するデータ・情報への参照。手がかりは必ずこれを保持する。
- **ではないもの**：データの複製ではない（参照のみ）。
- 関連：Cue、Source。

---

## 画面・場

### 情報整理ノート ／ Clinical Thinking Workspace（内部設計名）

- 収集データを見渡し、視点別に整理し、手がかりを考える専用の思考空間。
- **ではないもの**：記録入力画面ではない。進捗管理画面ではない。
- 表示上の注意：内部設計名は「Clinical Thinking Workspace」。学生向け UI では「**情報整理ノート**」と表示する。
- 関連：Information Organization Notebook。

### Information Organization Notebook（情報整理ノート）

- 上記「情報整理ノート」の英語名。教育ワークスペースとしての位置づけ（`docs/03`）。
- 関連：Clinical Thinking Workspace。

### Compass Coach

- 答えを与えず、問いによって学生の思考を支える存在。
- **ではないもの**：解答者ではない。自動分類・自動生成・自動アセスメントを行わない。自然な会話を中断しない。
- 関連：Role of AI（`docs/06` §8）。

---

## 表現（様式）

### 様式（Form）

- 思考の**出力（output）**。整理・手がかりの結果として表現するもの。
- **ではないもの**：出発点ではない。目的ではない。
- 関連：Form 2、Form 3。

### 様式2（Form 2）

- 患者の全体像を初期的につかむ表現。
- **ではないもの**：完成したアセスメントではない。
- 関連：Form 3。

### 様式3（Form 3）

- 方向性に沿って深めるための情報収集・整理の表現（情報 S・O／解釈・分析／診断の手がかり）。
- **ではないもの**：自動生成される文章ではない。
- 関連：Cue（診断の手がかりに対応しうる）。

### 病態関連図の参照（Pathophysiology reference）

- 教育者があらかじめ用意する一般病態図の参照。
- **ではないもの**：個別患者の解釈ではない。
- 関連：Patient relationship diagram。

### 患者関連図（Patient relationship diagram）

- 一般病態と個別患者を、学生自身が接続して表現する図。
- **ではないもの**：自動生成・自動配置される図ではない。
- 関連：Understanding nursing problems。

---

## 運用・レビュー

### 収集解除（Collection release）

- 収集した参照を外す操作。**元の出所（データ本体）は削除しない**。
- **ではないもの**：出所の削除ではない。原文の削除ではない。
- 関連：Collection。

### 教育受け入れテスト（Educational Acceptance Test）

- 機能が教育モデルに適合するかを確認する観点（設計テスト、`docs/08`）。
- **ではないもの**：単体テスト・E2E テストではない。
- 関連：Compass Review、Design Test。

### Compass Review

- 実装レビュー（Implementation Review）と教育レビュー（Educational Review）の2層で行う点検（`docs/08`）。
- **ではないもの**：コードレビューだけではない。
- 関連：Design Test。

### 振り返り（Reflection）

- 学生が自分の思考過程を見直す学習行為（Observe→…→Reflect）。
- **ではないもの**：採点ではない。
- 関連：Thinking Flow（`docs/05`）。

### 設計ログ（Design Log）

- 教育モデル・設計に関する判断を番号付きで記録する中央ログ（`docs/09`）。
- **ではないもの**：作業日報ではない。
- 関連：Educational Model Freeze。

---

## 重要な区別（Key distinctions）

- `InformationCard` は内部型。学生向け UI では「データ」または「収集データ」と表示する。
- `Clinical Thinking Workspace` は内部設計名。学生向け UI では「情報整理ノート」と表示する。
- 一時メモは、収集データではない。
- 情報は、解釈ではない。
- 手がかりは、確定した看護問題ではない。
- 様式は、出力であって目的ではない。
