# Compass Version2 UI Architecture

正式名称: **Compass Workspace Design System（CWDS）**

- ステータス: 設計原則の確定記録（**設計のみ**。本改訂ではアプリコード・DB は未変更）。
- 位置づけ: Compass Version2 の**全 UI が従う土台**。各機能設計書（Question＝`12`、学習設計＝`15`、Learning Layer＝`14` 等）は本書の原則の上に位置づけられる。
- 本改訂の要点: Workspace を「1 つの画面」として設計する従来モデルを廃し、**学習フェーズごとに専用の Workspace を持つ**設計へ全面変更する（§3, §4）。共通なのは **Learning Inspector**（右側）のみ（§5）。
- 禁止事項（本フェーズ）: アプリコード変更・DB 変更・migration・commit・push は行わない。

> ### 従来設計からの変更（Supersedes）
>
> 旧版（本書 §3「Workspace First」の単一縦フロー **Timeline → Conversation → Evidence → Form2**、および §4「Workspace Inspector」）は、本改訂で次のように置き換わる。
>
> | 旧設計 | 新設計 |
> |---|---|
> | Workspace は 1 画面。1 本の縦フロー（Timeline→Conversation→Evidence→Form2）に全要素を積む | Workspace は**学習フェーズ専用の思考空間**。フェーズごとに独立した UI レイアウトを持つ（様式2 / 様式3 / 関連図） |
> | Evidence は Form2 と同じ画面内の一要素 | Evidence の中心は**様式3 Workspace**。様式2 Workspace は Evidence を主役にしない |
> | 右側は汎用 "Workspace Inspector"（Question 等のパネル置き場） | 右側は **Learning Inspector**（共通概念）。器は共通で、**表示内容だけが Workspace ごとに変わる** |
> | Compassメモ ＝ 気づきメモ（会話・患者トップ側） | **Compass Note** を Learning Inspector 内の思考記録として位置づけ直す（様式2 を書くためのメモではない） |
>
> 現行実装（`ClinicalWorkspace` ＝ 左 Evidence ／ 右 様式2）は、本設計における **様式2 Workspace の途中形**として扱う。レイアウトの新形（左＝患者情報／中央＝様式2／右＝Learning Inspector）への移行は将来フェーズで行い、本改訂ではコードを変更しない。

---

## 1. Purpose

- 本書の目的は、Compass Version2 の**すべての UI が共有する設計原則**を一箇所に定めること。
- 学習フェーズ（様式2 / 様式3 / 関連図）ごとに UI 判断を分散させず、**同じ哲学・同じ視覚言語・同じ Learning Inspector**の上に、各フェーズ専用の思考空間を作れるようにする。
- 目的の核: 学生が**患者理解の文脈を見失わない**こと。UI は学生の思考を支援する道具であり、主役ではない。

---

## 2. Compass Design Philosophy

Compass の UI は次の 4 つの価値を守る（フェーズ専用 Workspace になっても不変）。

- **Appleらしい静けさ**: 余白・弱い影・明確な境界・落ち着いたタイポグラフィ。装飾より情報の読みやすさを優先する。
- **医療教育らしい信頼性**: 医療情報（電子カルテ・Evidence）と学習支援（Coach・Compass Note 等）を視覚的に区別する。医療的意味を持つ色（赤=警告／緑=正常）を装飾目的で乱用しない。
- **学生の思考を支援する**: UI は学生が自分で気づき・考え・言葉にする過程を支える足場（scaffolding）であって、結論を代行しない。
- **AI を主役にしない**: AI（Coach）は学生の後ろから支える補助であり、学生より前に出ない。AI が答えを出す UI にしない。

---

## 3. Phase-specific Workspaces（Workspace ＝ 学習フェーズ専用の思考空間）

**Workspace は「1 つの画面」ではなく、学習フェーズごとに異なる思考空間である。**

- 各 Workspace は学習フェーズに最適化した**独立した UI レイアウト**を持つ。
  - **様式2 Workspace**（Form2 Workspace）
  - **様式3 Workspace**（Form3 Workspace）
  - **関連図 Workspace**（Related Map Workspace）
- これらのレイアウトは互いに異なってよい。**共通なのは Learning Inspector（右側）だけ**であり、それ以外の構成（中央に何を置くか、左に何を置くか）はフェーズごとに設計する。
- 各 Workspace 内でも、学生を別ページへ飛ばさず、その思考空間の中で必要な情報を開く（文脈維持）。
- Workspace 間の移動（様式2 ↔ 様式3 ↔ 関連図）は学習フェーズの遷移であり、患者文脈（選択患者・受け持ち）を保ったまま切り替える。

> フェーズが変われば「主役」が変わる。様式2 Workspace の主役は様式2、様式3 Workspace の主役は Evidence、関連図 Workspace の主役は Canvas。Learning Inspector は常に補助に徹する。

---

## 4. Workspace Catalog

### 4.1 様式2 Workspace（Form2 Workspace）

学生が患者情報を参照しながら様式2 を記述するフェーズ。

**レイアウト（3 カラム）**

```
左（患者情報）            中央（出力）        右（学習支援・共通）
──────────────           ─────────          ─────────────────────
患者トップ                様式2              Learning Inspector
・電子カルテ                                  ・Coach
・患者との会話                                ・Compass Note
```

- **左**: 患者トップを起点に、電子カルテ・患者との会話へアクセスできる（患者理解の一次情報）。
- **中央**: 様式2（受け持ち患者の記述）。保存の正は Supabase。
- **右**: Learning Inspector（§5）。このフェーズでは **Coach** と **Compass Note** を表示する。

**このフェーズでの Compass Note の役割**（詳細は §5.2）

- Compass Note は**様式2 を書くためのメモではない**。
- 役割は、**気付き・疑問・仮説・後で考えたいこと**を保存し、**様式3 への思考を残す**こと。

**このフェーズでの Coach の役割**（詳細は §5.3）

- Coach は **情報不足・情報収集・整理漏れ**のみを支援する。
- **答えは提示しない**（アセスメント・診断・様式2 の文面を書かない）。

### 4.2 様式3 Workspace（Form3 Workspace）

看護問題へと発展させるフェーズ。**様式2 Workspace とは別 UI**。

- **Evidence が中心**の UI になる。
- 様式2 Workspace で残した **Compass Note** を元に、次へ発展させる。
  - Compass Note → **Evidence** → **患者理解** → **看護問題**
- Learning Inspector（右側・共通）は、このフェーズに合わせた内容を表示する（Coach ／ Compass Note を、Evidence 中心の思考に接続する）。
- 中央〜主領域は Evidence の整理・関連づけ・意味づけに最適化する（様式2 のような文章記述中心ではない）。

### 4.3 関連図 Workspace（Related Map Workspace）

患者像・看護問題の関連を図として構成するフェーズ。**Canvas 中心の UI**。

- 主領域は **Canvas**（ノードとつながりを配置する図の作業空間）。
- 活用する素材:
  - **Evidence**（事実の根拠）
  - **Compass Note**（気付き・疑問・仮説）
  - **Story**（患者の物語・患者像）
  - **Coach**（つながり・不足の気づきを支援）
- Learning Inspector（右側・共通）は、このフェーズに合わせて上記素材を参照・引き込みできる形で表示する。

---

## 5. Learning Inspector（共通概念）

**右側の Inspector は全 Workspace 共通の概念**である。**器（開閉・レイアウト・状態保持）は共通で、表示内容だけが Workspace ごとに変わる。**

### 5.1 器としての役割（共通・不変）

- 器（Learning Inspector）は「開閉・レイアウト（PC 右サイドパネル／iPad 下シート）・オーバーレイ・スクロール・`no-print`」のみを担い、ドメイン知識を持たない。
- 画面遷移しない。Workspace 本体は消えない。開閉するのは Inspector だけ。
- 背景は薄いオーバーレイ、閉じるボタンを明確に表示、外側タップ・Esc で閉じられる、ドラッグ操作は必須にしない。
- 開閉状態・アクティブ表示は Workspace 側の state で保持し、開閉で子 state（会話・Evidence・様式2・Canvas・スクロール位置）を破棄しない。
- 中身（Panel）は「パネル ID → コンポーネント」の登録型。Workspace ごとに表示するパネル集合を切り替える。

**Workspace ごとの表示内容（例）**

| Workspace | Learning Inspector の内容 |
|---|---|
| 様式2 Workspace | Coach ／ Compass Note |
| 様式3 Workspace | Coach ／ Compass Note（Evidence 中心の思考へ接続） |
| 関連図 Workspace | Coach ／ Compass Note ／ Story（Canvas 素材の参照） |

### 5.2 Compass Note

- Compass Note は学生が自由に記載・保存する**個人の思考記録**。
- **様式2 を書くためのメモではない。**
- 役割:
  - **気付き**を残す
  - **疑問**を残す
  - **仮説**を残す
  - **後で考えたいこと**を残す
  - → これらを保存し、**様式3 への思考をつなぐ**。
- Compass Note のすべてが自動的に Evidence になるわけではない。Evidence 化は学生が明示的に選択・確認したうえで行う（学習設計 `15` に準拠）。

### 5.3 Coach

- Coach は答えや看護問題を直接提示しない。
- 支援範囲は次の 3 点に限定する:
  - **情報不足**（まだ足りていない観点への気づき）
  - **情報収集**（どこを確認するとよいかの案内）
  - **整理漏れ**（拾いきれていない情報・つながりへの気づき）
- Coach は学生の代わりに判断・記述・完成をしない。問い・案内の形で返す。

---

## 6. Information Hierarchy

情報の優先順位。**フェーズによって「主役」は変わる**が、Learning Inspector は常に最下位（補助）に置く。

- **Level 1 — 患者 / 電子カルテ**: 学習の起点。最も信頼される一次情報。
- **Level 2 — Conversation（会話）**: 学生が患者から情報を引き出す場。
- **Level 3 — Evidence**: 会話・観察・記録から学生が選び整理した事実（様式3 Workspace の中心）。
- **Level 4 — フェーズ出力**: 様式2 / 様式3 / 関連図（各フェーズの中央・主領域）。
- **Level 5 — Learning Inspector**: 上記を支援する補助レイヤ（Coach ／ Compass Note ／ Story）。

> **Learning Inspector は補助であり、主役にならない。** どのフェーズでも Level 1〜4 の視認性・文脈を決して奪わない。

---

## 7. Navigation Rules

- **画面遷移より文脈維持**: 各 Workspace 内では別ページへ飛ばさず、その思考空間で必要な情報だけを開く（Apple 製品的な情報開示）。
- **フェーズ遷移は明示的に**: 様式2 ↔ 様式3 ↔ 関連図 の移動は学習フェーズの切替として扱い、患者文脈（選択患者・受け持ち）を保つ。
- **Learning Inspector で迷子にしない**: 補助情報（Coach ／ Compass Note ／ Story）は Inspector を開いて参照し、閉じれば元の作業に戻る。開閉で状態を失わせない。
- 受け持ち患者のみが Learning Layer（様式2 / 様式3 / 関連図・Evidence・Compass Note）の対象（学習設計 `15` / Learning Layer `14` に準拠）。

---

## 8. Component Rules

責務を明確に分離する。

- **Workspace（フェーズ専用）**: 各フェーズの主舞台。フェーズ固有のレイアウト（左・中央・主領域）と状態を統括し、Learning Inspector の開閉状態・アクティブ表示を保持する（状態の所有者）。
- **Learning Inspector（共通の器）**: 開閉・レイアウト（PC 右サイドパネル／iPad 下シート）・オーバーレイ・スクロール・`no-print` のみを担い、ドメイン知識を持たない。
- **Panel（差し替え可能な中身）**: `Coach` ／ `Compass Note` ／ `Story` 等。自身のドメイン表示だけに責任を持ち、開閉やレイアウトには関与しない。Workspace ごとに表示する Panel 集合が切り替わる。

原則: Learning Inspector を「何でも入る万能パネル」にしない。ドメイン知識は各 Panel に閉じ込め、Inspector は器に徹する。フェーズ差は「どの Panel を出すか」で表現し、器を分岐で肥大化させない。

---

## 9. Design Language

**Version1 のデザインを継承する。** 参照実装: `components/collection/CollectionDialog.tsx`, `components/patient/FirstAssignmentSheet.tsx`。

- **Appleらしい / 静か**: 強いグラデーション・派手なカードを使わない。影は弱め、境界を明確にする程度。アニメーションは短く控えめ。
- **余白**: ゆとりのある間隔。タップ領域は `min-h-[44px]`（フッター等 48px）。
- **読みやすさ**: 落ち着いたタイポグラフィ（`text-[13px]〜[17px]`、`text-[#1D1D1F]` / `#3A3A3C` / `#6E6E73`）。
- **医療らしい信頼感**: 医療情報と学習支援を視覚的に区別する。医療的意味の色（赤／緑）を装飾流用しない。分類は色だけでなく色＋ラベル＋アイコンで区別。
- 共通トークン例: オーバーレイ `bg-black/40`、パネル `bg-white` `rounded-3xl`（PC）/`rounded-t-3xl`（シート）`shadow-[0_12px_40px_rgba(0,0,0,0.18)]`、ニュートラル背景 `#F7F9FC`/`#F7F7F9`、チップ `bg-[#EAF3FF] text-[#0A5FCC]`、アイコンは lucide 細線（`strokeWidth` 1.75〜2）。
- Canvas（関連図 Workspace）も同じ視覚言語に従い、ノード・つながりの表現は静かで読みやすいトーンにする。

---

## 10. Future Expansion

- **新しい学習フェーズ**が増える場合は、**専用 Workspace を追加**する（各フェーズに最適な UI を与える）。共通なのは Learning Inspector の器のみ。
- Learning Inspector に**新しい Panel**（Reflection / Teacher Guide / AI Assistant 等）を足す場合は「パネル ID → コンポーネント」の登録のみ。器・開閉・視覚言語は共通のまま再利用する。
- Compass Note・Evidence・様式・関連図の永続化は Supabase を正本とする（学習設計 `15` に準拠）。

---

## 11. Non-goals

Compass では設計原則として次を**行わない（禁止）**。

- AI がアセスメントを書く
- AI が診断する
- AI が様式2 / 様式3 を書く
- AI が関連図を自動生成して学生の思考を代行する
- AI（Coach）が学生より前に出る／答え（診断・正解・完成アセスメント）を提示する
- **Compass Note を「様式を書くための下書き欄」に矮小化する**（Compass Note は気付き・疑問・仮説・後で考えたいことを残し、様式3 への思考をつなぐ場所）
- 学生の思考を奪う UI（チェックリスト化・進捗率・自動送信・機械的な情報不足判定 等）
- Learning Inspector を主役化する／医療情報（Level 1〜4）の文脈を奪う

これらは Compass Workspace Design System の**恒久的な禁止事項**とし、今後のすべての UI 判断（各フェーズ Workspace・Learning Inspector の設計）はこの Non-goals に反しないことを前提とする。
