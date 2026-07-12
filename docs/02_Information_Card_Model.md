# 02 Information Card Model（情報カード・ドメインモデル）

Version 1.0
Last Update: 2026-07-12
Status: Domain Model（Version1 の中核データモデル）

> 情報カードは Compass Version1 の中核ドメインモデルである。
> 学習フローにおける位置づけは `docs/01_Compass_Version1_Spec.md`、
> 思想的背景は `docs/00_Compass_Charter.md` を参照すること。
> 本書は概念モデルの定義であり、実装スキーマの確定版ではない。

---

## 1. 情報カードとは

**情報カード（Information Card）** は、学生が「患者を理解するために選び取った
一片の情報」を表す最小単位である。

情報カードは、Version1 の全段階を貫く共通の通貨である。
患者との対話・電子カルテ・観察から生まれ、情報整理ノート・様式2・様式3・
関連図へと、**出所を保持したまま**受け渡されていく。

情報カードは「情報そのもの」だけでなく、
**「その情報がどこから来たか」** を必ず伴う。

> 用語について：内部の型名 `InformationCard` は保持するが、
> `docs/03_Information_Organization_Workspace.md` の「データ → 情報 → 手がかり」
> モデルでは、情報カードは学生にとって未整理の事実である **「データ」** にあたる。
> 学生自身が整理して意味づけたものが「情報」であり、それは情報整理ノートで生まれる。

---

## 2. 概念的フィールド定義

各情報カードは、概念的に次の要素を含む。
（実装時のフィールド名・型は本モデルを基準に設計するが、確定仕様ではない。）

### 必須

| フィールド | 意味 |
|-----------|------|
| `id` | カードの一意識別子 |
| `content` | カードが表す情報の内容（学生が扱う本文） |
| `sourceType` | 情報の出所の種別（後述の Supported Sources のいずれか） |
| `sourceLabel` | 出所の表示名（例：「夜間観察」「処方内容」など、人間が読むラベル） |
| `sourceReference` | 出所へ厳密に戻るための参照情報（後述の Source Navigation Data） |
| `patientId` | どの患者に属するカードか |
| `createdAt` | 作成時刻（epoch ms 等） |
| `createdBy` | 作成主体（原則は学生。学生の判断で作られたことを示す） |

### 任意

| フィールド | 意味 |
|-----------|------|
| `category` | 学生による分類（観察 / 疑問 / 仮説 / S / O など。任意） |
| `note` | 学生が付す補足コメント |
| `originalText` | 出所の原文（患者発言や記録の原文を保持する場合） |
| `date` / `time` | 情報が属する日時（フローシート日付・記録日時など） |
| `sourceNavigation` | 出所画面へ遷移するためのナビゲーションデータ（`sourceReference` を具体化したもの） |

---

## 3. サポートする出所（Supported Sources）

`sourceType` は次の出所を表現できること。

- 患者との対話（patient conversation）
- 学生の観察（student observation）
- 診療録（clinical record）
- 看護記録（nursing record）
- フローシート（flowsheet）
- 処方（prescription）
- 検査（examination）
- 生活歴（life history）
- OT（作業療法記録）
- PSW（精神保健福祉記録）
- 学生が作成したメモ（student-created note）
- 病態関連図の参照（pathophysiology reference）

> 実装対応：電子カルテ由来の出所は `lib/chartTabs.ts` のタブ
> （診療録・患者情報・生活歴・エピソード・看護記録・OT・PSW・
> フローシート・検査・処方）と対応づく。
> Sprint10.7 の `RelatedResource`（`lib/patientFacingData.ts`）は、
> 患者対話から生まれる情報カードの原型にあたる。

---

## 4. 出所ナビゲーションデータ（Source Navigation Data）

情報カードは、タップで**出所へ厳密に戻れる**ための参照を保持する。
文字列一致ではなく、共通IDによる厳密なリンクを用いる。

現行実装（`lib/chartNav.ts` の `ChartFocus`）に基づく参照例：

- `recordId` — 診療録の記録を一意に特定
- `clinicalId` — 診療録の記録（`medicationChangeId`）
- `nursingId` — 看護記録（`nursingRecordId`）
- `restrictionId` — 行動制限イベント（`restrictionEventId`）
- `date` — 診療録の日付ジャンプ
- `flowsheetDate` — フローシートの日付ジャンプ
- `rxId` — 処方オーダー

情報カードの `sourceReference` / `sourceNavigation` は、
これらの厳密な参照を保持し、`(tab, focus)` への変換
（`resourceToNav` 相当）を通じて出所画面へ戻す。

---

## 5. 原則（Principles）

1. **カードは学生の判断なしに自動追加されない。**
   Compass が勝手にカードを増やすことはない。何をカードにするかは学生が決める。

2. **カードは、どこで使われても出所を保持する。**
   情報整理ノート・様式2・様式3・関連図のどこにあっても、
   そのカードは「どこから来たか」を失わない。

3. **カードをタップすると、出所へ戻れる。**
   学生はいつでも原文・原記録に立ち返って確認できる。

4. **同じカードは、情報整理ノート・様式2・様式3・関連図で参照されうる。**
   一つのカードが複数の段階で使われることを前提とする。

5. **情報を独立した別コピーとして複製しない。**
   同じ情報を各段階でバラバラにコピーせず、
   同一カードへの参照として扱う（出所と同一性を保つ）。

6. **Compass は整理・表示はするが、学生の代わりに解釈しない。**
   並べ替え・グルーピング・出所提示までが Compass の役割。
   「それが何を意味するか」の解釈は学生が行う（Charter 2.6 / 2.7）。

---

## 6. カードのライフサイクル

```
出所（source）
   ↓  学生が選択する（student selects）
情報整理ノート（information organization note）
   ↓
様式2
   ↓
様式3
   ↓
関連図（relationship diagram）
```

- **出所 → 学生が選択**：自動ではなく、学生の意思でカード化される（原則1）。
- **情報整理ノート**：カードを集約・整理する作業台。
- **様式2 / 様式3**：同一カードを参照して思考を構造化する（複製しない・原則5）。
- **関連図**：カードを付箋として配置し、矢印で関係を表現する。
  関係性の決定は学生が行い、システムは自動化しない
  （`docs/01_Compass_Version1_Spec.md` 3.7）。

ライフサイクルのどの時点でも、カードは出所への参照を保持し続ける（原則2・3）。

---

## 7. 関連ドキュメント

- `docs/00_Compass_Charter.md` — 憲章（開発判断基準②「情報カード中心か」）
- `docs/01_Compass_Version1_Spec.md` — Version1 学習フロー
- `docs/03_Information_Organization_Workspace.md` — データ → 情報 → 手がかり モデル
- `lib/patientFacingData.ts` — `RelatedResource` / `resourceToNav`（実装上の原型）
- `lib/chartNav.ts` — `ChartFocus`（出所ナビゲーションの厳密リンク）
- `lib/notes.ts` — `Note`（気づきメモ。情報カードへの拡張起点）
