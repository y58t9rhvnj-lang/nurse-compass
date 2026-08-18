# Compass Clinical Reasoning Principles

- 文書種別: **Clinical Reasoning 設計原則**（教育思想の最上位）
- 適用範囲: Assessment・Related Map・Coach・AI・Modules・Artifact の設計判断
- 正本前提（Concept Freeze）:
  - `00_compass_vision.md`
  - `01_compass_core_architecture.md`
  - `02_domain_language.md`
  - `03_relationship_model.md`
  - `04_information_model.md`
  - `05_assessment_model.md`
  - `06_clinical_reasoning_network_model.md`
  - `07_artifact_model.md`
- ブランチ前提: `feature/version2-form3`
- 状態: **設計ドラフト（レビュー待ち）**
- 制約: 技術仕様・DB・実装・画面部品の話は書かない。教育思想のみを書く

本文書は Compass における Clinical Reasoning の **最上位原則**である。  
Assessment・Related Map・Coach・AI の設計判断は、矛盾があるとき **本原則を優先**して解釈する。

---

## 1. Clinical Reasoning とは

Compass における Clinical Reasoning とは、学生が **患者理解を深めていく思考の過程そのもの**である。

それは様式を埋める作業ではない。  
看護問題の名称を当てはめる作業でもない。  
正解のアセスメントを探す作業でもない。

Clinical Reasoning は、次の流れとして始まる。

```
患者を見る・聞く・読む
        ↓
Information（事実）を切り出す
        ↓
Assessment（意味づけ）を立てる
        ↓
関係づける（Clinical Reasoning Network）
        ↓
Artifact（学校言語での成果物）としてまとめる
```

重要なのは順序である。

- **始まりは患者理解**である。  
- **終わりは Artifact**である。  
- Artifact は目的ではなく、思考の結果である。

Compass は、この過程を支え、可視化し、問い直しを促す Clinical Reasoning Platform である。

---

## 2. Information First

Clinical Reasoning の土台は Information である。  
Information が曖昧なまま Assessment に進むと、思考は崩れやすい。

Compass における Information は、次を満たす。

| であること | でないこと |
| --- | --- |
| **1つの事実** | 複数事実の束ね |
| 患者・記録・観察から得た事実 | **解釈** |
| 切り出された一次情報 | **看護問題** |
| 意味づけの材料 | **援助・介入そのもの** |

Information は「何が起きたか／何が観察されたか／何が語られたか」である。  
「だから低栄養だ」「だから不眠の看護問題だ」「だから食事援助が必要だ」は Information ではない。

**Information First** とは、先に事実を守り、解釈を急がない原則である。

---

## 3. Hub Information

### 正式定義

**Hub Information** とは、**一つの Information が、複数の Assessment および複数の Pattern を支える状態**である。

一つの事実は、一つの意味に閉じないことがある。  
同じ Information が、異なる角度の Assessment を支え、複数の健康パターン理解に関わる。

### 例

```
Information: 幻聴がある
        │
        ├── Assessment（認知のゆがみとして）
        ├── Assessment（睡眠への影響として）
        └── Assessment（自己概念への影響として）
```

同じ「幻聴」という事実が、認知・睡眠・自己概念など複数の理解を支える。  
これが Hub Information である。

Hub Information は「便利なラベル」ではない。  
**一つの事実が持つ多義性を、教育上・設計上に正面から認めるための概念**である。

---

## 4. Hub Assessment

### 正式定義

**Hub Assessment** とは、**複数の Information が、一つの Assessment へ収束している状態**である。

ばらばらの事実が、一つの意味づけのもとにまとまる。  
これが臨床でよく起きる収束である。

### 例

```
Information: 食欲低下
Information: 体重減少
Information: Alb 低値
        │
        ▼
Assessment: 低栄養状態
```

複数の事実が、一つの解釈（Assessment）を支える。  
これが Hub Assessment である。

Hub Assessment は「まとめすぎ」を推奨するものではない。  
根拠となる Information を失わずに、意味を一つに束ねるための概念である。

---

## 5. Divergent Reasoning

**Divergent Reasoning（分岐的推論）** とは、**一つの Information から複数の Assessment が生まれる**思考である。

Hub Information の運動方向である。

```
一つの事実
   ├── 意味づけ A
   ├── 意味づけ B
   └── 意味づけ C
```

学生が一つの事実から複数の可能性を考えることは、誤りではない。  
むしろ Clinical Reasoning の豊かさである。

禁止すべきは、事実をコピーして別カードに増やすことである。  
分岐するのは Assessment であり、Information の複製ではない。

---

## 6. Convergent Reasoning

**Convergent Reasoning（収束的推論）** とは、**複数の Information から一つの Assessment が生まれる**思考である。

Hub Assessment の運動方向である。

```
事実 1
事実 2  ──►  一つの意味づけ
事実 3
```

複数の事実が一つの理解へ収束することは、臨床推論の中核である。  
散らばった観察を、一貫した患者理解へまとめる力である。

収束は、事実を消して一つの文章に溶かすことではない。  
事実は残り、Assessment がそれらを根拠として参照する。

---

## 7. Clinical Reasoning Network

Assessment は孤立しない。

一つの Assessment が、別の Assessment と関係し、優先や因果や併存の意味を持つ。  
その **関係の総体**が Clinical Reasoning Network である。

```
Assessment ──関係── Assessment
     ↑                    ↑
Information            Information
```

Compass における Clinical Reasoning の本体は、この Network である。  
点（Assessment）だけでは足りない。点と点の関係が思考である。

### Related Map との区別

| | Clinical Reasoning Network | Related Map |
| --- | --- | --- |
| 何か | 思考構造そのもの（Core） | 可視化・操作の Module |
| 役割 | 推論の正本 | 見せ方・学び方の一つの表現 |
| 置き換え | 不可 | Network の代替ではない |

Related Map は Module である。  
Related Map を描くことが Clinical Reasoning の目的ではない。  
Network が先にあり、Related Map はその表現の一つである。

---

## 8. Gordon Health Patterns

### 最重要

> **患者は、健康パターンごとに存在しているのではない。**  
> **健康パターンは、患者理解のための分類である。**

患者さんは「栄養代謝パターンの人」として存在するのではない。  
一人の人として存在し、理解のために健康パターンという分類を用いる。

したがって、次が原則となる。

- Pattern は患者を切り刻む壁ではない。  
- Pattern は理解のためのレンズである。  
- **Information は複数 Pattern へ所属できる。**

一つの事実が複数のパターン理解に関わることは自然である。  
「この事実はどの Pattern の箱に入れるか」で迷うより、  
「この事実はどの理解に効くか」を考える。

Hub Information が複数 Pattern を支えるのも、同じ思想である。

---

## 9. Clinical Reasoning Rules

最低限、次の規則を守る。

### Rule 1 — Information はコピーしない

同じ事実を別カードとして増やさない。  
分岐・再利用は参照と Assessment の側で行う。

### Rule 2 — Assessment は Evidence を最低 1 件持つ

Assessment は根拠なしに立たない。  
ここでの Evidence は、少なくとも **根拠となる Information への支え**を含む（知識 Evidence の詳細は Assessment Model に従う）。

### Rule 3 — Information は複数 Pattern 可

一つの Information が複数の健康パターンに関与してよい。

### Rule 4 — Assessment は複数 Information 可

一つの Assessment が複数の Information を根拠としてよい（Convergent / Hub Assessment）。

### Rule 5 — Network は Assessment 間を表現する

Clinical Reasoning Network は、Assessment 同士の関係を表現する。  
Related Map はその Module 表現である。

### Rule 6 — Artifact は最後に生成する

様式・看護問題文・提出表現は、思考の結果として最後にまとめる。  
Artifact から逆算して事実や解釈を作らない。

---

## 10. Golden Principles

次の二文を、Compass Clinical Reasoning の黄金原則とする。

> **一つの患者情報は、一つの意味しか持たないとは限らない。**

> **複数の患者情報が、一つの意味へ収束することもある。**

前者は Divergent Reasoning / Hub Information である。  
後者は Convergent Reasoning / Hub Assessment である。

この二つが同時に成り立つことが、Compass の Clinical Reasoning 観である。

---

## 11. Version2 との関係

Version2 から Version3 への転換は、機能追加ではなく **思考の中心の転換**である。

| Version2 で起きやすかったこと | Version3 の原則 |
| --- | --- |
| Information の重複（同じ事実のコピー） | **参照**する。コピーしない |
| Pattern 固定（一つの箱に閉じる） | **複数 Pattern** を許す |
| 看護問題中心（問題名へ急ぐ） | **Clinical Reasoning 中心**（事実→意味→関係→成果物） |

Version3 は、看護問題を否定しない。  
看護問題は Artifact（またはその一部）として、思考の後に現れる。

Version3 が変えるのは、出発点である。

```
V2 的になりやすい流れ:  様式・看護問題 → あとから根拠を足す
V3 の流れ:            患者理解 → Information → Assessment → Network → Artifact
```

---

## 12. 本原則の使い方

Assessment Model・Clinical Reasoning Network Model・Artifact Model・Coach・AI の設計で迷ったとき、次を問う。

1. 患者理解が先か。Artifact が先か。  
2. Information は事実か。解釈が混ざっていないか。  
3. 一つの事実の多義性（Hub Information）を潰していないか。  
4. 複数事実の収束（Hub Assessment）を根拠なしにまとめていないか。  
5. Related Map を Network の本体と誤解していないか。  
6. Pattern を患者の存在様式と誤解していないか。  

Golden Rule（Vision）と合わせて、  
**「それは患者理解を深めるか」** が NO なら採用しない。

---

## 改訂メモ

- 初版: Clinical Reasoning 教育原則として新設。技術仕様は意図的に含めない。
