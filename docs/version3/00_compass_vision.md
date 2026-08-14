# Compass Vision

- 文書種別: **最上位 Vision**（実装仕様ではない）
- 適用範囲: Version3 以降のすべての設計・実装・AI・UI 判断
- Version2 実装からの切り離し: 本文書は V2 の画面・テーブル・API に依存しない
- 状態: 設計文書（コード・DB・Migration・`.cursor/rules` は変更しない）

---

## 1. Compass とは何か

Compass は **患者理解を育てる Clinical Reasoning Platform** である。

Compass の目的は、成果物を作ることではない。

- 患者理解を深め、
- 臨床推論を支援し、
- **その結果として**成果物を生み出す。

電子カルテの代替でも、看護記録ソフトでも、様式入力システムでもない。  
学校指定様式を置き換えるシステムでもない。

Compass は、学生が患者さんについて考え続けられるための **Learning Platform** である。

---

## 2. Clinical Reasoning Learning Model

Compass における学びの骨格は、次の一方向の「完成パイプライン」ではなく、行き来を許す **推論モデル** である。  
ただし、概念上の階層は明確に分ける。

```
Patient
   ↓
Information
   ↓
Assessment
   ↓
Clinical Reasoning
   ↓
Artifacts
```

下位レイヤーを飛ばして成果物だけを埋める設計は、Compass の Vision に反する。

---

## 3. 各レイヤーの責務

### 3.1 Patient（患者）

**責務:** Compass の主役。すべての思考の中心。

含むもの（概念）:

- 患者という人そのもの（生活・病い・関係・時間の流れ）
- 受け持ち対象としての教育ケース
- 学生が「誰について考えているか」という焦点

含まないもの:

- 様式の欄
- 教員の評価ラベル
- AI が決めた患者像

判断基準:

- 画面・機能の主役が患者からずれていないか。
- 様式や AI が患者より前面に出ていないか。

---

### 3.2 Information（情報）

**責務:** 患者から得られた **事実** を扱う。

定義:

- 観察、会話、カルテ記載、検査、治療、薬剤、家族からの情報など、根拠となりうる事実。
- **解釈を書かない。** 意味づけは Assessment の仕事である。

性質:

- 1件ずつ扱える（原子的であるほど、推論と成果物に再利用しやすい）。
- 出典（どこから得たか）を持てる。
- 主観（S）／客観（O）などの区別を持てる。

禁止:

- Information に看護問題名・優先度・解釈文を混ぜること。
- 事実を自動で「問題」に変換すること。

---

### 3.3 Assessment（アセスメント）

**責務:** 学生が **考えたこと** を扱う。

定義:

- Information を根拠にした解釈・分析・分類。
- 「この事実は、自分にとって何を意味するか」を言語化する層。

性質:

- **Information を根拠にする**（根拠なき断定を構造的に避ける）。
- **複数存在してよい**（一つの患者・一つの視点に、一つの正解アセスメントはない）。
- 途中の迷い・修正も学習過程として残せる。

禁止:

- Assessment をシステムが自動確定すること。
- 学生の代わりに「正しい解釈」を書くこと。

---

### 3.4 Clinical Reasoning（臨床推論）

**責務:** Assessment 同士を関連付け、臨床的な見通しをつくる。

ここから生まれるもの（例）:

- 関連図
- 優先順位
- 看護問題
- 病態理解

定義:

- 単発の Assessment を超えて、「つながり」「重み」「仮説の更新」を扱う層。
- 思考は見える化するが、自動化して完成させない。

禁止:

- 関連図の自動完成。
- 看護問題の自動決定。
- 正解パスの提示。

---

### 3.5 Artifacts（成果物）

**責務:** 学校・養成校・実習で求められる **提出物・共有物** を扱う。

例:

- 様式2
- 様式3
- 関連図（提出物としての図）
- 看護問題
- 看護計画
- その他学校指定の記録物

原則:

- **成果物は最後に作られる。**
- Artifacts は学習のゴールではなく、学習の結果として現れる。
- 学校指定様式の項目名・順序・構成・意味は変更しない。

禁止:

- Artifacts 入力を学習の起点にすること（空欄埋めから始めさせること）。
- Compass の都合で学校指定様式を作り替えること。

---

## 4. Compass Coach

Coach は、学生の代わりに考えない。

### 見てよいもの

- Information
- Assessment
- Clinical Reasoning

### 見ても、書かないもの

- Artifacts の本文を代筆しない
- 正解の看護問題・解釈・関連図を提示しない

### 役割

- 気付きを促す
- 根拠を確認する
- 視点を広げる

**問いを返す。答えは書かない。**

---

## 5. Evidence

Evidence は **Assessment を支える**。

- Assessment の解釈・分類・主張に対する根拠づけとして存在する。
- **Information には付けない。**  
  Information は事実そのものであり、「根拠づけられる対象」ではなく「根拠になりうる素材」である。

言い換えると:

- Information = 事実
- Assessment = 考え
- Evidence = その考えを支える結び（どの Information が、どの Assessment を支えるか）

---

## 6. 学校指定様式

学校指定様式は **教育上の共通言語** である。

- 項目名、入力順序、様式の構成、様式の意味は、Compass の都合で変更しない。
- Compass は学校指定様式を書くためのシステムではない。
- Compass は、指定された様式でより深く考えられるよう支援する Learning Platform である。

教育効果の向上は、様式の改変ではなく次で行う:

- Guide
- 補助説明
- 考えるヒント
- UI
- Compass Coach
- 患者理解の導線

---

## 7. Compass Golden Rule

今後実装するすべての機能は、次の問いで判断する。

> **この機能は患者理解を深めるか**

| 答え | 行動 |
| --- | --- |
| YES | 実装を検討する |
| NO | 実装しない |

便利さ、入力効率、自動化、見た目の完成度は、この問いに劣後する。

補助確認（Golden Rule の補強）:

1. 学生自身が考える余地を残しているか。
2. 思考を代替していないか。
3. 学校指定様式を壊していないか。
4. Patient → Information → Assessment → Clinical Reasoning → Artifacts のどこに位置するか説明できるか。

---

## 8. Compass Core と Compass Modules

### 8.1 考え方

- **Core** は、時代や画面が変わっても残る **推論の骨格** である。
- **Modules** は、Core の上に載る **具体的な学習機能・成果物・支援機能** である。
- Module は Core を置換しない。Core を侵食しない。Core に加算する。

### 8.2 Compass Core

| Core | 一言 |
| --- | --- |
| Patient | 主役。思考の焦点 |
| Information | 事実。解釈しない |
| Assessment | 考え。根拠を持つ。複数可 |
| Clinical Reasoning | 考えの関連づけ。仮説・優先・病態理解 |
| Artifacts | 成果物。最後に生まれる |

Core は「どの学校のどの様式か」に依存しない。  
どの Module を載せても、この5層で説明できなければならない。

### 8.3 Compass Modules（例）

| Module | 主に載る Core 層 |
| --- | --- |
| 様式2 | Artifacts（全体像の整理・提出） |
| 様式3 | Information / Assessment → Artifacts（学校様式） |
| 関連図 | Clinical Reasoning → Artifacts |
| Coach | Information / Assessment / Clinical Reasoning への問い |
| Evidence | Assessment を支える結び |
| 看護問題 | Clinical Reasoning → Artifacts |
| 看護計画 | Artifacts（推論の結果としての計画） |
| 教員レビュー | 学習過程への形成的フィードバック（採点機械ではない） |
| 学習分析 | 過程の可視化（順位付け・選別が目的ではない） |

Modules は増減してよい。  
Core の意味を歪める Module は採用しない。

---

## 9. Version2 との関係（Vision 上の位置づけ）

- Version2 は、この Vision に至る **実装上の学習過程** である。
- Version2 の画面・テーブル・API は Vision そのものではない。
- Version2.1 様式3再設計（Information / Assessment / Final Form）は、本 Vision の Clinical Reasoning Learning Model への接近である。
- 今後、Version2 の個別仕様と本 Vision が衝突した場合は、**Vision を優先して仕様を見直す**（ただし学校指定様式は変更しない）。

本文書は `.cursor/rules`（Constitution 等）を置き換えない。  
Constitution が「いまの実装規律」なら、本 Vision は「これから向かう北極星」である。両者は整合する想定だが、文書としては分離する。

---

## 10. 設計者・実装者への使い方

新しい機能・画面・AI・データモデルを提案するときは、必ず次を書く。

1. どの Core 層の話か。
2. Module 名は何か（あるなら）。
3. Golden Rule（患者理解を深めるか）への YES/NO と理由。
4. Coach / Evidence / 学校指定様式に触れるなら、本 Vision の禁止事項に抵触しない根拠。

説明できない提案は、実装に進まない。
