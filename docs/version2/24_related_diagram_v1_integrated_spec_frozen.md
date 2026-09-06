# Nurse Compass V2.2 Related Diagram V1 統合仕様書
**Status:** Canonical — Design Frozen (V1)  
**Scope:** 教育設計 / 学習体験 / UI/UX / データ構造 / AI評価 / 教員トリアージ  
**Implementation:** 本仕様書の凍結後に開始する。現時点では実装しない。

---

## 1. 目的

Compassの関連図は、Form3でパターンごとに文章化した患者理解を図式化し、それらをパターンの境界を越えて関連づけることで、一人の患者として再統合する学習段階である。関連図を作ることによって、学生は自らの思考構造を可視化し、Form3では見えていなかった患者の状態同士の関係や新たな患者理解に気づき、次の情報収集と患者理解の更新につなげる。

補足定義：
> Compassの関連図とは、分けて考えた患者情報をつなぎ直し、「この患者さんに今、何が起きているのか」「なぜそうなっているのか」「この先何が起こり得るのか」「だから何を大切に看護するのか」を、一人の患者として再構成するための思考の場である。

関連図は完成物ではなく、患者理解を更新するための装置である。

---

## 2. Form2・Form3・Related Diagramの役割

### Form2
- 患者情報に最初の意味づけを行う。
- 既有知識を呼び起こし、患者像の「第一印象」をつくる。
- Form3の下書きではない。
- 「何が気になるか」「何が分からないか」を生み出す。

### Form3
- Gordonの11パターンをレンズとして一次情報に戻る。
- 必要な情報を整理する。
- 情報同士を関連づけ、「何が起きているか」「なぜ起きているか」を文章化する。
- 現在・潜在の状態を考える。
- 必要な看護を考える。
- 病態・治療・薬剤効果・副作用など、患者理解に必要なメカニズムはここで一度Assessmentされている前提とする。
- 11パターンすべてを同量・同密度で埋めることは目的ではない。

### Related Diagram
- Form3で分けて考えた患者理解を再統合する。
- Form3 Assessmentで文章化した思考を図式化する。
- Gordonのパターン境界を越えて患者状態を関連づける。
- 病態Knowledge、患者Information、Form3 Assessment、学生が新たに気づいた患者理解を一つのA3上で結び直す。
- 看護問題を患者理解から抽出し、必要に応じて統合・焦点化する。
- 講義内では看護問題の統合・優先順位までを到達点とし、目標・OP/TP/EP・看護計画には進まない。

---

## 3. 教育上の中心原則

1. **図をきれいに作ることは目的ではない。**
2. **線やCardの数は評価しない。**
3. **Gordon 11パターンを関連図上で再度区画化しない。**
4. **病態関連図は患者理解のための一般知識であり、それ自体は学生のIntegration評価に含めない。**
5. **AIは関連図を完成させない。**
6. **学生が自分でCardを選び、配置し、Connectionを作る。**
7. **新しい患者理解がForm3にないことは誤りではない。**
8. **ただし新しい理解は、患者情報・Form3・病態Knowledgeなどから説明可能であることが望ましい。**
9. **現在／潜在は「由来」と独立した判断軸である。**
10. **関連図は最終回答ではなく、次の問いを生み出す。**

---

## 4. 学習フロー

1. 左メニューから「関連図」を開く。
2. 教員管理の病態KnowledgeがA3上に初期表示される。
3. 学生がForm3 Assessmentを選択する。
4. Assessment本文を複数の短い関連図Cardへ分解する。
5. そのAssessmentでEvidenceとして使ったInformationは自動的に追加候補へ入る。
6. 学生がCardをA3へ配置する。
7. 学生自身がConnectionを作る。
8. 別のForm3 Assessmentを追加する。
9. パターンを越えて患者状態を関連づける。
10. 必要に応じて「新しい気づき」を追加する。
11. 患者状態から看護問題Cardを作成する。
12. 患者状態と看護問題をConnectionする。
13. 看護問題同士を必要に応じて統合する。
14. 最終看護問題に優先順位をつける。
15. A3全体を見直す。
16. Compass CoachのReflectionを読む。
17. 提出する。
18. 提出時点のForm3とRelated Diagramをsnapshotとして固定する。

---

## 5. A3キャンバス

### 5.1 基本
- 論理キャンバスはA3横。
- iPad Safariを主要対象とする。
- 10.5pt程度で印刷時に可読性を確保する。
- 編集時はpinch zoom / panを許可する。
- 「全体表示」でA3全体へ戻れる。
- 無限キャンバスにはしない。

### 5.2 A3外
- A3外への配置は完全禁止しない。
- 「A3印刷範囲外」と明示する。
- 提出前確認で警告する。
- 印刷時に巨大な図を自動縮小して無理に1枚へ収めない。

### 5.3 左メニュー
既存Compassの左メニュー構造を維持する。
関連図はForm2/Form3と同じように直接開ける。
Form3完了を起動条件にはしない。

---

## 6. Cardモデル

Cardは以下の4系統を基本とする。

### 6.1 Information Card
- 患者固有の事実。
- Form3でEvidenceとして使用した情報を含む。
- 原則として現在／潜在のstateは持たない。
- Form3のInformation Cardの視覚言語を継承する。
- 同じInformationが複数AssessmentでEvidenceになっていても、関連図上では1枚を基本とする。
- 複数のprovenanceを保持可能とする。

### 6.2 Patient Understanding Card
学生が考えた患者理解。

由来は2種類：
- `form3_assessment`
- `diagram_integration`

両者は見た目を大きく分けず、出典表示で区別する。

どちらもstateとして以下を持てる：
- `current`
- `potential`

**originとstateは独立する。**

### 6.3 Knowledge Card
- 教員管理の病態Library由来。
- 一般知識。
- 小さな「病態」ラベル等で患者固有のCardと区別する。
- 現在／潜在のstateは持たない。
- 学生のIntegration得点には直接含めない。

### 6.4 Nursing Problem Card
- 患者理解から学生が抽出した看護問題。
- A3上に直接配置する。
- 看護問題専用のCard種別とする。
- **現在／潜在を持たせる。**
- これはoriginとは独立し、Form3で潜在的問題が抽出される教育設計との整合を保つ。
- 最終看護問題にはpriorityを直接表示する。

---

## 7. Form3 Assessment → Card化

### 7.1 起点
Form3 Assessment一覧から、Assessmentが存在するパターンのみ選択可能。

### 7.2 学生への問い
「このAssessmentで考えたことを、関連図に置くカードに分けてみましょう」

### 7.3 Card作成
- Assessment本文を表示。
- iPadで文章を選択し「カードにする」。
- 短い表現に編集可能。
- `＋カード`で自由入力も可能。
- Card数の最小・最大・推奨数は設けない。
- 「原因」「症状」「機序」などの分類を学生に要求しない。
- currentを初期値とし、学生がpotentialへ変更可能。
- AIはcurrent/potentialを自動決定しない。

### 7.4 Evidence
- Form3で使用したEvidence Informationは自動的に候補へ入る。
- 再選択させない。
- 自動的にConnectionしない。

### 7.5 Source
各Patient Understanding Cardは少なくとも元Assessment IDを保持する。
Assessment本文の完全なtext range provenanceはV1必須としない。

---

## 8. 追加されたCardトレイ

- Drawerとして表示。
- `Assessment由来` / `Evidence` のセクションを持つ。
- Canvasへdragして配置。
- 配置後もトレイから消さず「✓ 配置済み」を表示。
- 配置済み項目をタップするとA3上の該当Cardへfocusできる。
- 未配置のCardが残っていても誤りとはしない。

---

## 9. Connection

### 9.1 基本操作
- 専用line toolは置かない。
- Card選択時にconnection handleを表示。
- handleから対象Cardへdragしてrelease。
- drag方向を矢印方向とする。
- 選択中Connectionは方向反転・種類変更・削除可能。
- Card移動時は線を追従させる。

### 9.2 通常Connection
学生が通常Card間を結ぶ場合、以下から選択。

- `current`：実線
- `potential`：破線
- `treatment`：太線

初期値はcurrent。

Cardのcurrent/potentialとConnectionのcurrent/potentialは独立した軸。

### 9.3 Nursing Problem Basis
Patient Understanding / Information → Nursing Problem への線は、
`nursing_problem_basis`

学生が通常線の種類を選ぶのではなく、接続先がNursing Problemならシステムが意味を決定する。

### 9.4 Nursing Problem Integration
Nursing Problem → Integrated Nursing Problemは、
`nursing_problem_integration`

「統合して考える」操作によって生成する。

### 9.5 白黒印刷での表現
通常3種と混同しないよう、以下を推奨する。

- Nursing Problem Basis：**細い二重線矢印**
- Nursing Problem Integration：**二重線＋統合記号（◇）を終端近くに付与**

※実装前のUIモックでA3白黒印刷可読性を確認し、必要なら線パターンのみ調整する。意味論は固定する。

---

## 10. 病態Knowledge Library

### 10.1 目的
病態Knowledgeは疾患理解のための一般知識であり、患者理解の土台として用いる。

> 病態関連図は疾患を理解するための地図。Compassの関連図は、その疾患を持ちながら生活している「この患者」を理解するための地図。

### 10.2 V1の初期表示範囲
教員レビュー済みの固定Knowledgeとして、原則以下を提供する。
- 疾患
- 基本病態
- 主要メカニズム
- 代表的症状

### 10.3 V1で自動提供しないもの
- 患者固有の生活影響
- 患者固有の看護問題
- 学生がForm3でAssessmentすべき治療効果
- 学生がForm3でAssessmentすべき副作用
- AI生成Knowledge

治療・副作用等がこの患者に重要なら、Form3 AssessmentからPatient Understanding Cardとして関連図へ出す。

### 10.4 Group
病態Knowledgeは初期状態ではsystem groupとして移動可能。
個別Knowledge Cardは患者CardとConnection可能。
誤削除防止のため初期ロックを推奨。

---

## 11. 「新しい気づき」

### 11.1 定義
Form3 Assessmentを図式化し、他Assessment・患者Information・病態Knowledgeとの関係を考える中で新たに生まれた患者理解。

### 11.2 UI
`＋ → 新しい気づき`

入力項目：
- Card本文
- state：current / potential

理由入力欄は設けない。
関連図そのものが思考の根拠となる。

### 11.3 provenance
`origin = diagram_integration`

### 11.4 重要原則
- 新しい気づき＝潜在ではない。
- current / potentialは別軸。
- 新しいConnectionだけでもIntegrationになり得る。
- 新Cardを作ることを高評価条件にしない。

---

## 12. 看護問題

### 12.1 作成
iPad向けにmulti-select modeを持つ。

学生が複数の患者状態Cardを選択し、
`［看護問題にする］`

Drawerでは、
- 選択中の患者状態
- 看護問題名入力

のみを表示。

Form3・関連図で既に根拠が表現されているため、
原因・関連因子・根拠・必要な看護を別欄で再入力させない。

### 12.2 配置
作成後のNursing Problem Cardは学生がA3上へ配置する。

### 12.3 supporting_card_ids
作成時に選択したCardは内部的にsupportとして保持する。

ただしvisible Connectionは自動作成しない。
学生自身が患者状態→看護問題をConnectionする。

### 12.4 supportと最終Connectionは別
作成時の着目点と、最終的な患者理解の構造が変化することを許容する。
両方を学習データとして保持する。

---

## 13. 看護問題の統合

### 13.1 操作
2枚以上のNursing Problem Cardをmulti-select。
`［統合して考える］`

### 13.2 UI
別ページへ移動しない。
関連する構造を強調し、無関係部分を軽くdim。

問い：
「この看護問題を、一人の患者としてどのように捉えますか？」

入力は統合後の看護問題名のみ。

### 13.3 統合結果
- 新しいIntegrated Nursing Problem Cardを生成。
- 元の問題は残す。
- 元Cardに小さく「統合済み」表示。
- Integration Connectionを生成。
- 多段階統合を許可。

例：
A + B → C  
C + D → E

### 13.4 統合解除
Integration Connectionの単純削除ではなく、
「この看護問題の統合を解除しますか？」
を表示し、integration semanticsを戻す。
Undo/Redo対象。

### 13.5 統合しない判断
統合しないことも正当。
理由記述は要求しない。
統合数は評価しない。

---

## 14. 優先順位

- 最終Nursing Problem Cardに直接付与。
- `① ② ③ ...` をCard上に表示。
- 統合済み途中Cardには付与しない。
- 重複順位は許可しない。
- 新しい順位設定時は既存順位をシフトする。
- 優先順位理由の別テキスト入力はV1では求めない。
- AIは患者状態、current/potential、安全、苦痛、S情報、他状態への影響などから「説明可能性」を見る。
- 単一の正解順位は設定しない。

---

## 15. Compass Coach

### 15.1 原則
> Coachは関連図を完成させるのではなく、学生が自分の関連図をもう一度見るための問いを返す。

### 15.2 役割
- 基本は学生が呼び出す。
- 自動介入は最小限。
- Card・Connection・看護問題候補を生成しない。
- 正解図を提示しない。
- Levelを学生へ提示しない。

### 15.3 問いの例

病態だけの場合：
「病態の中で、この患者さんに実際に確認できていることはどこでしょう？」

Pattern island：
「それぞれ別の状態でしょうか。それとも患者さんの中でつながっている部分がありますか？」

根拠が弱いConnection：
「このつながりについて、患者さんのどの情報から考えましたか？」

potential：
「この可能性を確かめるには、患者さんについて何を知る必要がありますか？」

看護問題統合：
「この2つを一つとして捉えることで、見えやすくなることと、見えにくくなることはありますか？」

優先順位：
「現在起きていること、安全、患者さんの苦痛や思いという視点から、もう一度見てみるとどうでしょう？」

---

## 16. Form3更新時の扱い

Draft中にForm3 Assessmentが更新された場合：
- Related Diagram Cardを自動更新しない。
- 「Form3のAssessmentが更新されています」と通知。
- 学生自身がkeep / edit / add / deleteを判断する。

患者理解の更新過程を保つため、強制同期しない。

---

## 17. 提出前確認

### 17.1 提出
「完成」ではなく「提出」。

### 17.2 A3全体へ戻す
提出操作後、A3全体表示にfitする。

### 17.3 Reflection
以下のような問いを表示する。

- 病態と、この患者さんの実際の情報はつながっていますか？
- Form3で別々に考えた患者さんの状態に、パターンを越えたつながりはありますか？
- 現在起きていることと、これから起こり得ることを区別して考えていますか？
- 看護問題は、関連図の患者理解からつながっていますか？
- 看護問題を統合したことで、この患者さんをより一人の人として捉えられていますか？

チェックリスト型の達成判定にはしない。

### 17.4 システム警告
客観的に判定できる未処理のみ警告する。
例：
- A3外Card
- 空本文Card
- 未確定Connection
- 名称未入力Nursing Problem

以下は警告にしない：
- Cardが少ない
- Connectionが少ない
- 11パターンを使っていない
- 看護問題が少ない

---

## 18. 提出snapshot

提出時点で以下を固定する。

- diagram metadata
- Cards
- Card位置・サイズ
- Card type
- Card state
- Card origin
- provenance
- Connections
- relation type
- Connection origin
- Knowledge version
- Nursing Problem
- supporting cards
- integration
- priority
- 提出時点のForm3 snapshot参照

Form3が後から更新されても、提出済みRelated Diagramの評価根拠は変化させない。

---

## 19. データ構造（概念設計）

### 19.1 related_diagram
- id
- student_user_id
- case_id
- cycle_id
- status
- canvas_version
- created_at
- updated_at

### 19.2 diagram_card
- id
- diagram_id
- card_type
- text
- x
- y
- width
- height
- z_index
- state
- origin
- created_at
- updated_at

`card_type`
- information
- understanding
- knowledge
- nursing_problem

`state`
- current
- potential
- null

`origin`
- patient_information
- form3_assessment
- diagram_integration
- knowledge_library

### 19.3 diagram_card_source
- diagram_card_id
- source_type
- source_id
- relation

source_type例：
- patient_information
- form3_information_card
- form3_assessment
- evidence
- knowledge_library
- diagram_integration

### 19.4 diagram_connection
- id
- diagram_id
- source_card_id
- target_card_id
- relation_type
- origin
- created_at
- updated_at

`relation_type`
- current
- potential
- treatment
- nursing_problem_basis
- nursing_problem_integration

`origin`
- knowledge_library
- student_diagram
- system_integration

### 19.5 nursing_problem
- card_id
- status
- priority

`status`
- active
- integrated

### 19.6 nursing_problem_support
- nursing_problem_card_id
- supporting_card_id

### 19.7 nursing_problem_integration
- id
- result_problem_card_id
- created_at

### 19.8 nursing_problem_integration_member
- integration_id
- source_problem_card_id

### 19.9 Knowledge Group
- knowledge_group_id
- disease / topic
- version
- reviewed_status
- published_at

---

## 20. AI評価の原則

AIは関連図単体を評価しない。

参照系列：
Patient Information  
→ Form3 Information / Evidence  
→ Form3 Assessment  
→ Related Diagram Card  
→ Student Connection  
→ New Integration  
→ Nursing Problem  
→ Nursing Problem Integration  
→ Priority

評価対象は「完成図」ではなく、思考の連続性・統合・更新・焦点化。

---

## 21. AI評価4軸

### A. Form3の思考を図式化できているか
主要なForm3 Assessmentが患者理解Cardとして適切に表現されているか。

### B. パターンを越えて統合できているか
異なるForm3 Assessment由来の患者状態が、意味のあるConnectionでつながっているか。

### C. 関連図によって患者理解が進んでいるか
Cross-pattern Connection、新しい患者理解、不足情報・不確実性への気づきなどが生じているか。

### D. 患者理解から看護問題を焦点化できているか
患者状態→看護問題→統合→優先順位が思考の連続性として追えるか。

単純平均はしない。
段階的ルーブリックとして判定する。

---

## 22. 5段階評価

### Level 1
患者理解の構造がほぼ見えない。

### Level 2
Form3を図式化している段階。
Pattern内の構造はあるが、患者全体としての統合が弱い。

### Level 3 — 到達基準
Form3を越えて、異なる視点を関連づけ、一人の患者として統合できている。

### Level 4
統合した患者理解から看護問題を焦点化・統合できている。

### Level 5
関連図を使って患者理解そのものを更新できている。
新しい統合、不確実性、不足情報などを捉え、理解を再構成している。

---

## 23. AI評価で禁止する指標

以下を直接の得点要素にしない。

- Card数
- Connection数
- Cross-pattern Connection数
- Gordon Pattern使用数
- Knowledge Card数
- 看護問題数
- 文字数
- jargon量
- 病態の細かさ
- A3上の位置
- 図の大きさ
- 見た目の美しさ

---

## 24. Connection評価

AIは学生Connectionを内部的に以下のように見る。

### A. 連続性が明確
Form3 / Evidence / Patient Informationから十分説明可能。

### B. 統合として説明可能
一つのAssessmentにはないが、複数Assessmentを組み合わせると説明可能。
これは関連図で生まれたIntegrationとして価値がある。

### C. 現時点で根拠を追えない
直ちに誤りとしない。
重要度を考慮し、必要なら教員確認またはCoachの問いへ回す。

---

## 25. AI EvaluationとCompass Coachの分離

### AI Evaluation
- 提出後
- 教員支援
- Level 1〜5
- 判定根拠
- review status
- class analysis

### Compass Coach
- 作成中
- 学生支援
- 問いのみ
- Level提示なし
- 正解提示なし

---

## 26. AIトリアージ

LevelとReview Statusは別物。

### AUTO_CLEAR
AIが必要な根拠を十分追跡でき、重要な判断保留がない。

低LevelでもAUTO_CLEAR可。

### REVIEW
AI評価は可能だが、最終評価に影響し得る重要な曖昧さがある。

例：
- 重要Connectionの根拠が弱い
- current/potentialの重要な不整合
- 看護問題導出が弱い
- 看護問題統合の妥当性が不明瞭
- 優先順位と患者理解に重要な不整合

### REQUIRED
限定的に使用。

例：
- データ欠損・構造破損
- Form3との連続性がほぼ追跡不能
- 患者安全に関わる重大な矛盾
- AI評価が大きく競合し、Level確定不能

---

## 27. トリアージ判定原則

Review Statusは、
**AI不確実性 × 最終評価への影響**
で決める。

| AI不確実性 | 学習評価への影響 | Status |
|---|---|---|
| 低 | 小 | AUTO_CLEAR |
| 低 | 大 | AUTO_CLEAR |
| 中 | 小 | AUTO_CLEAR |
| 中 | 大 | REVIEW |
| 高 | 小 | REVIEW |
| 高 | 大 | REQUIRED |

Confidenceは精密な%ではなく、
- HIGH
- MEDIUM
- LOW

を内部的に使用する。

---

## 28. 重要度判定

根拠が弱いConnectionが1本あるだけでREVIEWにしない。

そのConnectionが、
- 周辺的な仮説なのか
- Nursing Problemへ到達するのか
- Integrated Nursing Problemへ到達するのか
- Priority 1へ影響するのか

をGraph上で追跡し、重要性を判断する。

---

## 29. 教員レビューUI

標準導線：

学生一覧  
→ AI要約  
→ AI確認ポイント  
→ 必要な場合のみ該当A3範囲  
→ 必要な場合のみA3全体

教員に最初からA3全体を読ませない。

### 一覧表示
- 学生
- AI Level
- Review Status
- 短いAI判定概要
- 確認ポイント数

### REVIEW学生
AIが以下を返す。
- 確認対象
- 確認理由
- 該当Card / Connection
- 関連Form3 / Evidence

教員操作：
- 妥当
- 要修正
- 全体を見る

長文コメントは必須としない。

---

## 30. 教員向けA3表示

学生と同じ配置を表示する。
自動整列しない。

補助表示：
- 出典を見る
- 学生の思考を表示
- Form3から広がった思考
- Nursing Problem統合経路
- Problemを選択して関連患者状態をhighlight

病態Knowledgeを薄くし、学生由来部分だけを強調する表示を持つ。

---

## 31. AUTO_CLEARの一括処理

AUTO_CLEAR群は一括承認候補とする。

ただし運用上、
- AUTO_CLEAR群から少数をランダムサンプリング
- 教員が確認
- 問題なければ残りを一括承認

を可能とする。

サンプリング率は学校・授業単位で変更可能にしてよい。

---

## 32. AIと教員の一致データ

以下を保存する。

- ai_level
- final_level
- review_status
- confidence
- teacher_changed
- review_reason_category
- reviewed_at

変更理由カテゴリ：
- Form3との連続性
- 患者状態の関連
- 現在／潜在
- 看護問題
- 問題統合
- 優先順位
- その他

これによりAI評価品質を検証できる。

---

## 33. クラス全体分析

AIは個別評価終了後、クラス全体について以下をまとめる。

- Level分布
- AUTO_CLEAR / REVIEW / REQUIRED数
- 学生がつまずいた学習段階
- よく見られる思考パターン
- Pattern island傾向
- current/potentialの理解傾向
- Nursing Problem焦点化の傾向
- 次回講義で扱うと有効なポイント

これは個別採点ではなく、授業改善支援として使用する。

---

## 34. V1でAIがしてはいけないこと

### 学生作成中
- Cardを自動生成する
- Assessmentを自動分解して完成Cardを提示する
- Connectionを自動生成する
- 「正しい」病態関連図を完成させる
- 看護問題候補を提示する
- 看護問題を自動統合する
- 優先順位を決める
- current/potentialを自動確定する
- Form3 Assessmentを書き換える
- 「線が少ない」など量を基準に指導する
- Gordon 11パターンすべてを使わせる

### 評価
- Card数・線数で採点する
- 図の美しさで採点する
- Pathology Libraryの既定構造を学生成果として加点する
- Form3との文章一致率で採点する
- 新しいCardが多いだけで高評価する
- 看護問題の統合数で高評価する
- 教科書上の単一の看護問題名との一致だけで判定する

---

## 35. V1で実装しないもの

- 無限キャンバス
- 自動レイアウト
- AI自動作図
- AI自動Card作成
- AI自動Connection
- AI自動看護問題
- 学生向けAI採点表示
- 自由手書き図形
- 高度な図形編集ソフト機能
- pathophysiologyのAI即時生成
- advanced/detail表示切替
- 操作量を使った学習評価
- 全操作履歴をAI評価へ使用
- 看護目標
- OP/TP/EP
- 看護計画

---

## 36. 設計クリティーク

### 36.1 強み
1. Form2→Form3→Related Diagramが一つの臨床推論過程としてつながっている。
2. Gordonの11パターンを「最終構造」にしないため、一人の患者への再統合という教育目的が明確。
3. General KnowledgeとPatient Understandingを分離しているため、病態知識の量が学生評価を汚染しにくい。
4. provenanceによりAIが画像印象ではなく思考の連続性を評価できる。
5. Nursing Problemの作成・統合履歴を残すため、最終ラベルだけでなく判断過程を評価できる。
6. AIトリアージにより、教員が全A3を丁寧に読む運用を避けられる。
7. AUTO_CLEARをLevelから切り離したため、低評価者を無駄に全件人手確認する必要がない。
8. 学生向けCoachと教員向けEvaluationを分けたため、形成評価と総括評価が混同されにくい。

### 36.2 主なリスクと対策

#### リスクA：病態Knowledgeが大きすぎてA3を圧迫
対策：
- V1 Libraryは基本病態・主要メカニズム・代表症状に限定。
- 患者固有の治療・副作用・生活影響は学生側から出す。
- A3印刷の標準密度をLibrary制作基準にする。

#### リスクB：学生がCard分解作業に時間を使いすぎる
対策：
- text selection → Card化を最短操作にする。
- Card数目標を置かない。
- 完璧な文章分割を求めない。

#### リスクC：線種が多くなり混乱
対策：
- 学生が選ぶのは通常Connectionの3種だけ。
- Nursing Problem Basis / Integrationは接続先・操作から自動意味付け。
- UI上で5種類の選択肢を並べない。

#### リスクD：AIが「医学的正誤」に寄りすぎる
対策：
- AI prompt / rubricでcontinuity・integration・patient-specific reasoningを優先。
- 根拠不明は即誤答ではなく「要確認」。
- Knowledge Libraryとの差異は「患者理解として説明可能か」で見る。

#### リスクE：AIのAUTO_CLEARを過信
対策：
- random sampling監査。
- ai_levelとfinal_levelを分離保存。
- teacher correction率を継続測定。
- 特定領域の修正率が高ければその領域の自動承認を弱める。

#### リスクF：関連図が「提出用作品」化
対策：
- draft中のForm3往復を許可。
- new insight / Memo導線を残す。
- Reflectionは正解チェックではなく再観察。
- Undo/Redo・削除・再接続を自然な学習行動として扱う。

---

## 37. Design Freeze前の確認事項

以下は実装前にUIモックで最終確認するが、教育上の意味は本仕様で固定する。

1. Nursing Problem Basis / Integration線の白黒A3上での最終視覚表現。
2. Nursing Problem Cardのcurrent/potential表示位置。
3. 10.5pt基準での病態Knowledge初期密度。
4. iPad Safariでのmulti-select / drag / connection handleの操作性。
5. AUTO_CLEAR random samplingの初期デフォルト値。
6. Related Diagram AI EvaluationのJSON output schema。

---

## 38. V1 Definition of Done

Related Diagram V1は、以下を満たした時点で教育機能として完成とする。

- Form3 Assessmentを学生自身が図式化できる。
- Evidence Informationを再選択せず利用できる。
- 病態Knowledgeと患者固有情報を区別して扱える。
- 学生がパターンを越えたConnectionを作れる。
- current / potential / treatmentを区別できる。
- 図式化の過程で新しい患者理解を追加できる。
- 患者理解からNursing Problemを作れる。
- Nursing Problemを必要に応じて統合できる。
- Integration過程がA3上に可視化される。
- 最終Nursing Problemへ優先順位を付与できる。
- A3として保存・復元・印刷できる。
- Form3とのprovenanceが追跡できる。
- 提出snapshotを固定できる。
- AIが全件一次評価できる。
- AIがLevelとReview Statusを分離して判定できる。
- 教員がAI指定箇所だけを効率的に確認できる。
- AUTO_CLEAR群をサンプル監査後に一括処理できる。
- クラス全体の学習傾向をAIがまとめられる。

---

## 39. 実装開始条件

以下の順序を守る。

1. 本統合仕様書レビュー
2. 必要修正
3. Design Freeze
4. UI state / data schema詳細化
5. migration設計
6. component設計
7. AI evaluation schema / prompt設計
8. 実装
9. iPad Safari受入
10. 教員評価運用テスト
11. 実学生データによるAI評価検証

**Design Freeze前にCursorへ実装を依頼しない。**


---

# 40. Design Freeze Critique — 最終修正

本仕様を実装可能性・教育的一貫性・評価妥当性・教員運用負荷の4観点で再検討し、以下をDesign Freeze修正として確定する。

## 40.1 修正1：Level 4とLevel 5を「加点項目の積み上げ」にしない

Levelは段階構造である。

- Level 3：患者全体としてのIntegrationが成立
- Level 4：そのIntegrationを基盤に看護問題の焦点化・統合が成立
- Level 5：さらに患者理解の更新・不確実性への気づきが成立

したがって、看護問題がきれいに統合されていてもCross-pattern Integrationが成立していなければLevel 4にはしない。
Level 5も「新しい気づきCardがある」だけでは成立しない。

## 40.2 修正2：Level 5に「編集履歴」を必須としない

V1はdraftの全操作履歴を評価データとして保持しない。
したがって「一度作った線を変更した」という操作履歴をLevel 5の必須証拠にはしない。

Level 5は提出snapshotから、
- Form3を越えた説明可能なIntegration
- 新たな患者理解
- 不足情報・不確実性への認識
- 患者理解の再構成

が確認できる場合に成立し得る。

## 40.3 修正3：Nursing Problem Cardのcurrent/potentialは保持するが二重評価しない

看護問題Cardにもcurrent/potentialを保持する。
ただしAIは、基礎となるPatient Understanding CardのstateとNursing Problem Cardのstateを別々の得点項目として数えない。

見るのは「患者状態の判断と看護問題の捉え方に重大な矛盾がないか」である。

## 40.4 修正4：Knowledge Libraryと学生思考の境界を厳格化

Knowledge Libraryから提供されたCard・Connectionは学生評価の成果量に含めない。

評価可能なのは主として、
- Knowledgeと患者固有Cardを学生が接続したこと
- Knowledgeを患者情報・Assessmentに照らして意味づけたこと
- そこから患者固有のIntegrationへ進んだこと

である。

## 40.5 修正5：「病態Knowledge初期表示」は事例ごとに教員が指定する

疾患名からAIが自動選択して配置しない。
assignment/caseに対して教員が公開済みKnowledge Group/versionを指定し、学生はその固定版を使用する。

これにより学生間で土台となる一般知識を統一する。

## 40.6 修正6：AUTO_CLEARは「自動成績確定」と同義にしない

AUTO_CLEARは、
「AI一次評価上、個別の詳細レビューを要求しない」
というトリアージ状態である。

学校・授業設定により、
- サンプル監査後の一括承認
- 教員の一括確定
- 全件形式承認

などの運用を選べる。

AI単独で最終成績を不可逆に確定する設計にはしない。

## 40.7 修正7：REQUIREDの「患者安全」は評価上の重大矛盾として扱う

AIが臨床上の危険性を断定して学生を分類するのではなく、

「提出された患者情報との重大な不整合があり、看護判断に大きく影響する可能性がある」

場合をREQUIRED候補とする。

最終判断は教員が行う。

## 40.8 修正8：ConfidenceとReview Statusは学生に表示しない

Confidence（HIGH/MEDIUM/LOW）とAUTO_CLEAR/REVIEW/REQUIREDは教員運用・監査用内部情報とする。
学生の学習画面には表示しない。

## 40.9 修正9：AI評価失敗時のfallbackを定義

AI evaluationがtimeout、schema error、参照データ不足等で成立しなかった場合：
- 学生提出自体は失敗扱いにしない
- `evaluation_status = failed`
- Review Status = REQUIRED
- 教員に「AI評価未完了」と表示
- 再評価可能

とする。

## 40.10 修正10：AI再評価で過去結果を上書きしない

AI prompt/model/rubric version変更後に再評価する場合、旧AI評価を削除・上書きしない。

最低限、
- evaluation_version
- rubric_version
- model identifier
- evaluated_at
- ai_level
- rationale
- review_status

を評価run単位で保持する。

教員が確定した`final_level`はAI再評価で自動変更しない。

## 40.11 修正11：提出snapshotは「評価再現性」を最優先

提出snapshotには表示再現だけでなく、AIが後日同じ提出物を再評価できる情報を固定する。

特に、
- Form3 submission/snapshot
- Related Diagram semantic graph
- Knowledge Group/version
- provenance
- Nursing Problem integration graph

を固定する。

## 40.12 修正12：A3上の位置は原則AI評価から除外

Cardの位置・距離・左右上下・密集度は、V1のAI Level判定には原則使用しない。
学生が「近くに置いた」ことを意味的Connectionと推定しない。

意味を持つのは明示的なCardとConnectionである。

---

# 41. V1評価データの最小契約

AIへ渡す意味データは、表示用DOMやスクリーンショットではなく、原則として以下のsemantic payloadとする。

```text
submission
  ├─ form3_snapshot
  │    ├─ information
  │    ├─ evidence
  │    └─ assessments
  │
  ├─ related_diagram
  │    ├─ cards
  │    │    ├─ type
  │    │    ├─ text
  │    │    ├─ state
  │    │    ├─ origin
  │    │    └─ provenance
  │    └─ connections
  │         ├─ source
  │         ├─ target
  │         ├─ relation_type
  │         └─ origin
  │
  ├─ knowledge_snapshot
  │
  └─ nursing_problems
       ├─ state
       ├─ support
       ├─ integrations
       └─ priority
```

Canvas座標は保存するが、V1 AI評価payloadでは原則除外する。

---

# 42. AI評価出力の最小契約

AI一次評価は少なくとも以下を構造化して返す。

```text
evaluation_status
level
confidence
review_status

dimension_findings
  - form3_visualization
  - cross_pattern_integration
  - understanding_update
  - nursing_focus

strengths[]
review_points[]
evidence_refs[]
teacher_summary
class_analysis_tags[]
```

`review_points`には、
- type
- importance
- card_ids
- connection_ids
- form3_refs
- short_reason

を保持し、教員画面の「該当箇所を見る」へ直結できるようにする。

AIの自由文だけを保存して後から解析する設計にはしない。

---

# 43. 教員レビューの時間効率KPI

V1の運用成功条件として、教育成果だけでなく教員負荷も測定する。

初期検証では以下を記録する。

- 提出人数
- AUTO_CLEAR率
- REVIEW率
- REQUIRED率
- 教員が実際に開いた提出数
- 1提出あたりレビュー時間
- AI Level変更率
- AUTO_CLEARサンプルでの変更率
- Review reason別の修正率

目標値をDesign段階で固定はしない。
実学生データからbaselineを取得し、AIトリアージの閾値を調整する。

---

# 44. 初回導入時の安全運用

最初の実学生運用からAUTO_CLEARを全面自動処理しない。

Phase 1:
- AI全件一次評価
- 教員はREVIEW/REQUIREDを確認
- AUTO_CLEARから一定数をランダム監査
- AI/教員一致データを蓄積

Phase 2:
- 十分な一致実績が得られた評価領域から教員確認を縮小

これにより、教員負荷軽減と評価妥当性を同時に検証する。

---

# 45. Design Freeze 判定

上記修正を反映した時点で、Related Diagram V1は教育設計上の重大な未解決事項を残していない。

**Design Status: FROZEN — V1**

以後、実装中に教育上の意味を変更する必要が生じた場合は、実装都合だけで変更せず、本仕様書へDesign Changeとして戻す。

次工程は以下とする。

1. UI state machine詳細化
2. DB/data schema詳細化
3. AI evaluation JSON Schema
4. implementation slice設計
5. migration
6. UI実装
7. AI評価実装
8. iPad Safari受入
9. 教員運用検証
10. 実学生データでAI妥当性検証

