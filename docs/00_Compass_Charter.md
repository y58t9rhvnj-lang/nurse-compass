# 00 Compass Charter（コンパス憲章）

Compass Charter **Version 1.0**
Last Update: 2026-07-12
Status: Foundational — Compass の最上位設計資料（すべての設計判断の基準）

> 本憲章は Compass の教育思想を「開発判断に使える形」で明文化した、最上位の設計資料である。
> 既存の `docs/00_Project_Charter.md`（Mission / Vision / Core Principles）と矛盾がある場合は、
> より具体的な本憲章の記述を優先する。
> 将来の更新（Version 1.1 / Version 2.0）は、本憲章の教育思想を保持しなければならない（§11 参照）。

---

## 1. North Star（北極星）

```
Compass は、患者を理解した結果として看護過程が自然に立ち現れるよう、
学生の思考を支える。
```

Compass supports students' thinking so that the nursing process naturally emerges
as the result of understanding the patient.

看護過程（様式・関連図）は、患者理解の「結果」として現れるべきものであり、
先に埋めるべき「作業」ではない。

---

## 2. Mission（使命）

```
書くことが目的ではない。
考えることが目的である。
```

Writing is not the purpose. Thinking is the purpose.

---

## 3. Vision（ビジョン）

```
考えが導く。記録はそれに従う。
（Thinking leads. Documentation follows.）
```

日本語の設計宣言：

```
考えを導いた結果、様式が完成する。
```

---

## 4. Educational Philosophy（教育思想）

Compass は「記録（documentation）システム」ではない。
Compass は「患者を理解するための学習環境」である。

Compass is not a documentation system.
Compass is a learning environment for understanding patients.

学びは、次の一続きの思考として起こる：

```
患者（Patient）
   ↓
データ（Data）           … 事実。患者発言・観察・カルテ記載
   ↓
情報（Information）       … データをテーマ別に整理・分類したまとまり
   ↓
手がかり（Cue）           … 情報を根拠に学生が考えた解釈・関連・方向性
   ↓
様式（Forms）             … 様式2・様式3
   ↓
関連図（Relationship Diagram）
   ↓
看護問題の理解（Understanding Nursing Problems）
```

各段階は分断された作業ではなく、患者理解へ向かう一つの思考の流れである
（詳細は `docs/03_Information_Organization_Workspace.md` の「データ → 情報 → 手がかり」モデル、
および `docs/01_Compass_Version1_Spec.md` の学習フローと一致）。

### Compass とは何か / 何ではないか

- Compass は「電子カルテ操作の練習システム」ではない。
  電子カルテは「患者を理解するための手段」であって、目的ではない。
- Compass が育てるのは、次の一連の思考である。
  - 患者を一人の人として観察する
  - 違和感や疑問を持つ
  - 必要な情報を自分で探す
  - 患者に戻って確かめる
  - なぜその状態が起きているのかを説明できる

Compass は「知識を覚えたか」ではなく「患者を理解できたか」を中心に据える。

---

## 5. 中核となる原則（Core Principles）

### 5.1 患者はカルテより先にある（Patient before Chart）

学生はまず患者と向き合う。
カルテは、患者と向き合って生まれた疑問を「確認し、理解を深める」ために開く。

### 5.2 カルテは理解の確認と深化のために使う

カルテは答えの一覧ではない。
患者から得た仮説を検証し、見落としていた視点を補うための参照先である。

### 5.3 Coach は答えを与えない

Compass Coach は正解や結論を提示しない。
学生が自分で気づき、自分の言葉で説明できるようになることを支援する。

### 5.4 Coach は問いによって思考を支える

Coach の役割は「問いを返すこと」「観察の視点を差し出すこと」に限られる。

- 「その表情が気になった理由は？」
- 「なぜその情報が必要だと思いましたか？」
- 「患者さんは今どんな気持ちでしょう？」

### 5.5 一般的な疾患知識は提供してよい

一般論としての病態・疾患知識（例：疾患の一般的な経過、一般的な症状）は提示してよい。
ただしそれは「一般知識」としての提示にとどめる。

### 5.6 一般知識と「その患者」の接続は学生が行う

一般的な知識を、目の前の患者に当てはめて解釈する作業は、
必ず学生自身が行う。Compass はこの接続を代行しない。
「この患者にとってそれが何を意味するか」は、学生の思考の中でのみ成立する。

### 5.7 学生の思考時間を奪わない

自動化・要約・先回りの提示によって、学生が考える前に答えらしきものを
与えてはならない。考える「間（ま）」を守ることは、Compass の設計責務である。

---

## 6. 開発の6原則（Six Development Principles）

Compass のすべての設計・実装は、次の6原則に従う。

1. **患者理解を最優先する。**
   （Patient understanding comes first.）

2. **事実と解釈を分離する。**
   （Separate facts from interpretation.）
   データ（事実）と手がかり（解釈）を混同しない。

3. **AI は思考を支えるが、決して肩代わりしない。**
   （AI supports thinking but never replaces it.）

4. **書く量を減らし、考える量を増やす。**
   （Reduce writing. Increase thinking.）

5. **すべての考えは、根拠へたどれなければならない。**
   （Every thought must trace back to evidence.）

6. **様式は思考の結果であって、目的ではない。**
   （Forms are the result of thinking, not the goal.）

---

## 7. Compass Coach の原則（Compass Coach Principles）

Compass Coach は、答えを与える指導者ではない。
その役割は、患者との対話を学びの中心に据えたまま、学生の思考を支えることにある。

### 7.1 Coach は学生の思考を妨げない

Coach は、学生が考えている過程に割り込まない。
考える「間（ま）」を守ることを最優先とする（§5.7 と一致）。

### 7.2 Coach は答えではなく「次の視点」を差し出す

Coach が提示するのは結論ではなく、次に考えるための視点である（§5.3・§5.4 と一致）。

### 7.3 Coach は適切なときにだけ介入する

Coach は常に発話するのではなく、次のような場面に限って介入する。

- 学生が助けを求めたとき
- 会話が停滞したとき
- 一つの話題が自然に一区切りついたとき
- 重要な未完了の話題が、忘れられそうなとき

### 7.4 Coach は会話を前の話題へ強制的に戻さない

Coach は、以前の話題への復帰を命令しない。
「睡眠の話に戻ってください」のような指示ではなく、
学生が自然に気づけるよう促す。

例：

```
先ほどのお話で気になった睡眠についても、もう少し確認できそうですね。
```

### 7.5 Coach は自立的思考の機会を減らさずに学びを支える

Coach は学生の学びを支えるが、そのために学生が自分で考える機会を奪ってはならない。
意思決定の主体は、常に学生自身である。

---

## 8. Core Statement（中核宣言）

```
患者さんを理解するためにカルテを見る。
カルテを理解するために患者さんを見るのではない。
```

この一文が、Compass のすべての機能・画面・文言の判断基準である。

---

## 9. Educational Promise（教育上の約束）

```
Compass は、学生の代わりに考えない。
Compass は、学生が考え続けられる環境をつくる。
```

Compass never thinks for students.
Compass creates an environment where students continue thinking.

---

## 10. Compass Design Test（設計テスト）

新しい機能・変更は、次のすべてに「YES」と答えられなければならない。
一つでも「NO」があれば、その機能は実装しない、または再設計する。

- これは患者理解を深めるか？（Does this deepen patient understanding?）
- これは考える量を増やすか？（Does it increase thinking?）
- これは書き直しを減らすか？（Does it reduce rewriting?）
- AI が思考を肩代わりしていないか？（Does AI avoid replacing thinking?）
- 思考が自然に様式を生むか？（Does thinking naturally produce Forms?）

補足：機能は「データ → 情報 → 手がかり」モデル（情報カードを中核とする情報の扱い）に
沿っていなければならない（`docs/02_Information_Card_Model.md` /
`docs/03_Information_Organization_Workspace.md` 参照）。
そして Version1 の最終ゴール「患者に起きている看護問題が、なぜ生じているのかを説明できる」に
近づくものでなければならない（`docs/01_Compass_Version1_Spec.md` 参照）。

---

## 11. Version Policy（バージョン方針）

本書を **Compass Charter Version 1.0** として確定する。

将来の更新について：

- **Version 1.1**（改良）および **Version 2.0**（拡張）は、
  本憲章の**教育思想を必ず保持する**。
- 保持すべき核：患者理解の優先、事実と解釈の分離、AI が思考を肩代わりしないこと、
  書く量を減らし考える量を増やすこと、根拠へたどれること、様式は結果であること。
- 名称・区分・操作・UI は、教育思想を守るための改善に限り見直してよい。

---

## 12. 関連ドキュメント

- `docs/00_Project_Charter.md` — Mission / Vision / Core Principles（上位思想）
- `docs/01_Compass_Version1_Spec.md` — Version1 の学習フロー仕様
- `docs/02_Information_Card_Model.md` — 情報カードのドメインモデル
- `docs/03_Information_Organization_Workspace.md` — データ → 情報 → 手がかり モデル
- `docs/05_Thinking_Flow.md` — 思考サイクルと情報優先順位
- `docs/06_Compass_Educational_Model_V1.md` — Version1 教育モデル（公式基盤・Freeze）
- `docs/07_Glossary.md` — 用語集
- `docs/08_Design_Principles.md` — 設計原則・設計テスト・レビュー層
- `docs/09_Design_Log.md` — 設計判断ログ

---

本憲章は、Project Charter とともに Compass の設計判断の最優先資料とする。
