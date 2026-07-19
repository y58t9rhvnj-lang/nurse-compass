# Compass Version2 UI Architecture

正式名称: **Compass Workspace Design System（CWDS）**

- ステータス: 設計原則の確定記録（実装前）。本ドキュメントは方針であり、アプリコード・DB は未変更。
- 位置づけ: Compass Version2 の**全 UI が従う土台**。各機能設計書（Question＝`12`、様式2、Evidence 等）は本書の原則の上に位置づけられる。
- 出典: 本書は当初 `12_question_feature_review.md` の「Compass Version2 UI Architecture」章に含まれていたが、Question 固有ではなく Version2 全体の設計原則であるため、本書へ独立させた。
- 禁止事項（本フェーズ）: アプリコード変更・DB 変更・migration・commit・push は行わない。

> ## 正式名称の提案と理由
>
> **採用: Compass Workspace Design System（CWDS）**
>
> | 候補 | 評価 |
> |---|---|
> | Compass **Design Language** | 視覚言語（色・余白・タイポグラフィ）に寄った名称。本書はそれに加えて Workspace/Inspector/Panel の構造・責務・情報階層・Non-goals まで扱うため範囲が狭すぎる。 |
> | Compass **Workspace Architecture** | 構造（Workspace 中心・Inspector・Panel）は言い表せるが、Design Philosophy／Design Language／Non-goals など「原則・価値観」の側面が名称から抜ける。 |
> | **Compass Workspace Design System**（採用） | 「Workspace 中心」という Compass 固有の思想と、「Design System」＝視覚言語＋コンポーネント規約＋パターン＋原則、の両方を包含する。本書が扱う哲学・構造・言語・拡張・禁止事項をすべて名前で表現できる。 |
>
> 理由: 本書は単なる見た目のガイド（Design Language）でも、構造図（Architecture）でもなく、「哲学 → 構造 → 情報階層 → コンポーネント責務 → 視覚言語 → 拡張 → 禁止事項」を一貫した体系として定義する。この体系全体を指すのは **Design System** が最も正確で、そこに Compass 固有の中核概念 **Workspace** を冠した **Compass Workspace Design System（CWDS）** を正式名称とする。以降、Version2/Version3 の全 UI は CWDS に従う。

---

## 1. Purpose

- 本書の目的は、Compass Version2 の**すべての UI が共有する設計原則**を一箇所に定めること。
- 機能ごと（Question / Reflection / Story / Teacher Guide / AI Assistant / Clinical Notebook 等）に UI 判断を分散させず、**同じ哲学・同じ構造・同じ視覚言語**で作れるようにする。
- 目的の核: 学生が**患者理解の文脈を見失わない**こと。UI は学生の思考を支援する道具であり、主役ではない。

---

## 2. Compass Design Philosophy

Compass の UI は次の 4 つの価値を守る。

- **Appleらしい静けさ**: 余白・弱い影・明確な境界・落ち着いたタイポグラフィ。装飾より情報の読みやすさを優先する。
- **医療教育らしい信頼性**: 医療情報（電子カルテ・Evidence）と学習支援（Question 等）を視覚的に区別する。医療的意味を持つ色（赤=警告／緑=正常）を装飾目的で乱用しない。
- **学生の思考を支援する**: UI は学生が自分で気づき・考え・言葉にする過程を支える足場（scaffolding）であって、結論を代行しない。
- **AI を主役にしない**: AI は学生の後ろから支える補助であり、学生より前に出ない。AI が答えを出す UI にしない。

---

## 3. Workspace First

**Workspace は学生の思考空間である。**

- 主役は Workspace 本体の縦フロー: **Timeline → Conversation → Evidence → Form2**。
- 学生の視線導線は常に **患者 → 電子カルテ → 会話 → Evidence → 様式2**。この連続性を壊さない。
- **Inspector は Workspace を支援する存在**であり、主役を奪わない。
- **Inspector は Workspace の状態を壊さない**（開閉しても会話・Evidence・様式2・スクロール位置を破棄しない）。
- 個別機能のためだけに Workspace 本体を縦長化しない。

---

## 4. Workspace Inspector

Compass Version2 の共通 UI コンポーネント。Workspace の文脈と状態を保ったまま、必要な情報だけを重ねて表示する。

### 採用理由

- Question／Reflection／Story／Teacher Guide／AI が個別に別 UI を持つと、(1) Workspace の縦長化、(2) デザインの不統一、(3) 開閉・レイアウト・状態管理の実装分散が起きる。
- 共通 Inspector にすれば、開閉・配置・視覚言語・状態保持の仕組みを**一度だけ実装して再利用**でき、Version3 まで一貫性を保てる。

### 構成

```
Workspace 本体            Inspector（開いた時だけ）
─────────────           ─────────────
Timeline                  ┌───────────────┐
Conversation              │ QuestionPanel  │  ← 初期実装
Evidence                  │ ReflectionPanel│  ← 将来
Form2                     │ StoryPanel     │  ← 将来
                          │ TeacherGuide   │  ← 将来
                          │ AI Assistant   │  ← 将来
                          │ Clinical Notebook ← 将来
                          └───────────────┘
```

- 器（Inspector）は「開閉・レイアウト・オーバーレイ・スクロール・`no-print`」のみを担い、ドメイン知識を持たない。
- 中身（Panel）は「パネル ID → コンポーネント」の登録型。差し替え可能。

### 開閉

- 画面遷移しない。Workspace 本体は消えない。開閉するのは Inspector だけ。
- 背景は薄いオーバーレイ、閉じるボタンを明確に表示、外側タップ・Esc で閉じられる、ドラッグ操作は必須にしない。
- 開閉状態・アクティブパネルは親（`PatientWorkspace`）の state で保持し、子 state を破棄しない。

### PC

- Workspace 右側に現れるサイドパネル。Workspace 本体と横に共存し、本体は消えない。
- Inspector 内のみスクロール可能。Workspace 本体の高さは増やさない。

### iPad

- 右側幅が狭い場合は下シートへ自動切替（V1 `CollectionDialog` のレスポンシブ挙動を踏襲）。

### 将来拡張

- パネルは登録型なので追加は登録のみ。複数パネルのタブ／セグメント切替、パネル状態の Supabase 永続化、Teacher Guide のロール別表示、AI Assistant の動的生成などに拡張可能。

---

## 5. Information Hierarchy

情報の優先順位を定義する。上位ほど「主役」、下位ほど「補助」。

- **Level 1 — 患者 / 電子カルテ**: 学習の起点。最も信頼される一次情報。
- **Level 2 — Conversation（会話）**: 学生が患者から情報を引き出す場。
- **Level 3 — Evidence**: 会話・観察・記録から学生が集めた事実。
- **Level 4 — Form2（様式2）**: 学生が理解を文章化する出力。
- **Level 5 — Inspector**: 上記を支援する補助レイヤ（Question 等）。

> **Inspector は補助であり、主役にならない。** 情報階層の下位に置き、Level 1〜4 の視認性・文脈を決して奪わない。

---

## 6. Navigation Rules

- **画面遷移より文脈維持**: 別ページへ飛ばさず、現在の Workspace 上で必要な情報だけを開く（Apple 製品的な情報開示）。
- **Workspace 中心**: すべての学習操作は Workspace を起点・帰着点とする。学生を Workspace から迷子にしない。
- 補助情報（Question 等）は Inspector を開いて参照し、閉じれば元の作業に戻る。ナビゲーションで状態を失わせない。

---

## 7. Component Rules

3 層の責務を明確に分離する。

- **Workspace**: 主舞台。Timeline / Conversation / Evidence / Form2 を統括し、Inspector の開閉状態・アクティブパネルを保持する（状態の所有者）。
- **Inspector**: 共通の器。開閉・レイアウト（PC 右サイドパネル／iPad 下シート）・オーバーレイ・スクロール・`no-print` のみを担い、ドメイン知識を持たない。
- **Panel**: 差し替え可能な中身（`<QuestionPanel />` など）。自身のドメイン表示だけに責任を持ち、開閉やレイアウトには関与しない。

原則: Inspector を「何でも入る万能パネル」にしない。ドメイン知識は各 Panel に閉じ込め、Inspector は器に徹する。

---

## 8. Design Language

**Version1 のデザインを継承する。** 参照実装: `components/collection/CollectionDialog.tsx`, `components/patient/FirstAssignmentSheet.tsx`。

- **Appleらしい / 静か**: 強いグラデーション・派手なカードを使わない。影は弱め、境界を明確にする程度。アニメーションは短く控えめ。
- **余白**: ゆとりのある間隔。タップ領域は `min-h-[44px]`（フッター等 48px）。
- **読みやすさ**: 落ち着いたタイポグラフィ（`text-[13px]〜[17px]`、`text-[#1D1D1F]` / `#3A3A3C` / `#6E6E73`）。
- **医療らしい信頼感**: 医療情報と学習支援を視覚的に区別する。医療的意味の色（赤／緑）を装飾流用しない。分類は色だけでなく色＋ラベル＋アイコンで区別。
- 共通トークン例: オーバーレイ `bg-black/40`、パネル `bg-white` `rounded-3xl`（PC）/`rounded-t-3xl`（シート）`shadow-[0_12px_40px_rgba(0,0,0,0.18)]`、ニュートラル背景 `#F7F9FC`/`#F7F7F9`、チップ `bg-[#EAF3FF] text-[#0A5FCC]`、アイコンは lucide 細線（`strokeWidth` 1.75〜2）。

---

## 9. Future Expansion

次の機能はいずれも独立 UI を作らず、**Workspace Inspector へパネルとして追加**する。

- Question（`<QuestionPanel />`）— 初期実装
- Reflection（`<ReflectionPanel />`）
- Story（`<StoryPanel />`）
- Teacher Guide（`<TeacherGuidePanel />`）
- AI Assistant（`<AiAssistantPanel />`）
- Clinical Notebook（`<ClinicalNotebookPanel />`）

追加は「パネル ID → コンポーネント」の登録のみ。器・開閉・視覚言語は共通のまま再利用する。

---

## 10. Non-goals

Compass では設計原則として次を**行わない（禁止）**。

- AI がアセスメントを書く
- AI が診断する
- AI が様式2 を書く
- AI が学生より前に出る
- Question を答えに変える（診断・正解・完成アセスメント・完成質問文の直接提示）
- 学生の思考を奪う UI（チェックリスト化・進捗率・自動送信・機械的な情報不足判定 等）

これらは Compass Workspace Design System の**恒久的な禁止事項**とし、今後のすべての UI 判断はこの Non-goals に反しないことを前提とする。
