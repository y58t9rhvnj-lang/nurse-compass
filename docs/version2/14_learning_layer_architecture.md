# Compass Learning Layer Architecture

> Architecture Sprint 4 で確定する、Compass Version2 の中核設計。
> Learning Layer を「様式2 だけに依存しない共通アーキテクチャ」として定義する。
> 本 Sprint はドキュメントのみ（アプリコード・Supabase・DB は変更しない。commit / push もしない）。

- ステータス: 設計確定（実装前）。DB スキーマ・SQL は本 Sprint では確定しない（UI・ドメイン概念まで）。
- 恒久アーキテクチャ名: **Core / Learning Layer / Compass Coach / Clinical Thinking Workspace**。
  Version1 / Version2 は実装履歴・移行段階の呼称であり、恒久名称には用いない。
- 上位設計との関係: `docs/architecture/01_compass_core.md`〜`05_design_principles.md` を上位とし、本書はその Learning Layer を Version2 実装文脈で具体化する。
- 番号重複の注記: 本ディレクトリには既に `14_architecture_principles.md` が存在する。本書はユーザ指定のファイル名 `14_learning_layer_architecture.md` で新規作成した（別ファイル・別内容）。将来リネーム要否は Open Questions（§18）で扱う。
- **更新の注記（重要）**: 学習体験の確定版は `docs/version2/15_learning_design.md`。本書 §4「Learning Layer in Core」の **Core 画面からの直接 Evidence 追加**（`AddToWorkspaceButton` 等）は、15 §0.1・§5 により**非採用**へ更新された（学生は Compassメモに記録し、Evidence 化は思考ワークスペース内で行う）。関連コードは削除せず非表示（`CORE_CAPTURE_ENABLED=false` / `CONVERSATION_CAPTURE_ENABLED=false`）。矛盾時は 15 を優先する。

---

## 0. 既存設計・実装との整合性確認

本 Sprint で確認した既存資産と、今回確定構造との関係。**矛盾する場合は今回の構造を優先し、修正要否を明記する。**

| 既存資産 | 現状 | 今回構造との関係 | 対応 |
|---|---|---|---|
| `docs/architecture/01–05` | Core/Learning Layer/Integration の恒久定義 | 完全に整合（本書はその具体化） | 追随 |
| `docs/version2/13_ui_architecture.md`（CWDS） | 「Workspace First」「単一縦フロー Timeline→Conversation→Evidence→Form2」「Workspace Inspector」 | **一部矛盾**: 主役は Core（Workspace First ではない）。Workspace は縦単一フローでなく**左右2ペイン**（§7）。 | 修正明記（§0.1）。CWDS は下位 UI ガイドとして整合させる |
| `docs/version2/12_question_feature_review.md` | Question を Inspector で提示（静的・非AI） | 整合（Coach/Question は Inspector 内・思考支援） | 追随 |
| `docs/version2/04_patient_understanding.md` / `05_information_notebook.md` | Patient Understanding / InformationGroup・Cue の将来構想 | 整合（Relationship/Interpretation/Hypothesis の将来接続先） | 参照 |
| 現在の `/v2/student`（`app/v2/student/page.tsx` → `AppShell mode="v2"`） | 患者A固定・4項目ナビ・患者トップ/カルテ/会話/様式2 | 整合（Core 上の Learning。左メニューに Workspace/学習成果を追加） | 拡張 |
| Workspace Inspector（`components/v2/workspace/inspector/*`, `useWorkspaceInspector`, `QuestionPanel`） | Core view 上に開く overlay。状態非破壊 | 整合（Coach/Question の器としてそのまま採用） | 流用 |
| Supabase 版様式2（`WorkspaceForm2Section` + `useForm2Supabase` + `form2Repository`/`form2Mapper`, `Form2EditForm`/`Form2SheetView`） | 保存の正=Supabase、楽観ロック・下書き退避・競合バナー | 整合（Workspace 右ペインの最初の Learning Outcome としてそのまま流用） | 流用 |
| Evidence（`EvidencePane` + `useEvidenceSupabase` + `informationCards` actions + `lib/information/informationCard.ts`） | 事実のみ収集。会話・一時メモから収集。`CollectionDialog` 再利用 | 整合（Workspace 左ペインの Evidence 基盤。カルテからの収集導線を拡張） | 流用＋拡張 |
| `components/thinking-workspace/ClinicalThinkingWorkspace.tsx`（V1・flag `informationNotebook`） | localStorage 版の3ペイン（データ/情報整理/手がかり）。`useInformationCards` | **部分流用**: 2ペイン化＋保存を Supabase Evidence へ寄せる責務分離が必要 | 責務分離 |
| `components/v2/workspace/PatientWorkspace.tsx`（別シェル型・縦フロー） | Sprint1 の独立 Workspace ルート | 縦単一フローは今回構造で非採用 | 廃止/転用（§17・§15） |
| Compass Coach（`FacingCoachPanel` = Core 常設ウィジェット / `WorkspaceCoachPanel`） | Core 画面下部に常時表示のコーチ | **一部矛盾**: 常時大表示にしない。Inspector 内へ寄せる | 再配置明記 |

### 0.1 CWDS（13_ui_architecture.md）から修正する点
- 「**Workspace First**」→ **Core First / Clinical World First**（主役は Core。Workspace は Learning Layer 可視化画面であって Compass の主役ではない）。
- 「**単一縦フロー**（Timeline→Conversation→Evidence→Form2）」→ **左右2ペイン**（左=Clinical Thinking / 右=Learning Outcomes、§7）。Timeline/Conversation は Core 側の体験として分離。
- 「**Workspace Inspector**」→ 名称・器はそのまま流用。帰属を「Workspace の支援」→「**Core/Workspace 双方の患者文脈上で開く Learning Layer / Coach の器**」に一般化。
- 既存 `13` は変更しない（本書を上位に置き、`13` は Inspector・視覚言語の実装ガイドとして整合運用）。

---

## 1. Purpose

Learning Layer は、**学生が Core 上で得た患者情報を、患者理解へつなげるための学習機能層**である。

- 単なるメモ機能・情報保存機能・様式入力補助ではない。
- 学生の**臨床的思考を支える作業メモリ（working memory）**として位置づける。
- 目的は情報を保存することではなく、次の思考過程を支えること:
  重要な情報を選択する / Evidence として残す / 気づきを言語化する / 情報同士を関係づける /
  解釈・意味づけを行う / 仮説を立てる / 不足情報を明らかにする / Core へ戻って確認する /
  学習成果へ自分の言葉で表現する。
- **様式2 の完成を最終目的にしない。** 様式2 は思考過程を構造化する器の一つであり、患者理解を深める過程が中心。

---

## 2. Core as the Foundation

Core は Compass の基盤（臨床世界）である。含むもの: **患者トップ / 電子カルテ / 患者との会話 / ノート**。

- Core の責務: 患者と出会い、患者の情報・言葉・経過・生活背景を知ること。
- **Learning Layer や Compass Coach を使っても、Core 自体の責務・画面構造を壊さない。**
- Core を Workspace 化しない。すべての Core 画面に常時大きな学習 UI を出さない。
- Core は Learning Layer 無しで単独成立する（`docs/architecture/01` Core Independence）。

実装対応: `AppShell.tsx`（Core Shell）/ 患者トップ `StudentPatientTop`・`FacingPatient` / 電子カルテ `CompassChart`(+`ChartSideNav`/`ChartAside`) / 会話 `FacingPatient` / ノート `NoteZone`。

---

## 3. Layered Architecture

Core / Learning Layer / Compass Coach を、役割の異なる**独立した層**として整理する。**上下の主従ではなく、Core の患者文脈上でそれぞれ独立して動く。**

| 観点 | Core | Learning Layer | Compass Coach |
|---|---|---|---|
| 目的 | 患者と出会い情報を得る土台 | Core 上で得た情報を選択・保存・整理し患者理解へつなげる | 思考を代行せず、問い返しで思考を促す |
| 扱う情報 | 患者データ・記録・会話・生活背景 | Evidence・気づき・関係・解釈・仮説・不足情報・学習成果 | 学生の思考状態への問い（Coach Question） |
| 学生の主な行動 | 読む・聴く・観る・メモする | 選ぶ・残す・言語化する・関係づける・表現する | 問いに答える・考え直す・Core へ戻る |
| 画面上の表示 | Core 各画面（主役・常時） | Core 上の小さな収集操作＋Workspace（可視化・編集） | Inspector 内（必要時のみ・常時大表示しない） |
| 保存の有無 | Core 状態は基本一時（一部 localStorage） | 学生別・患者別に Supabase 永続化 | 原則保存しない（保存は Open Question §18） |
| 他層との関係 | 土台。上位2層に文脈を提供 | Core を参照し情報を取り込む／Coach の問いを受ける | Core/Workspace の文脈を読み、問いを返す |

---

## 4. Learning Layer in Core

Core 上では、Learning Layer は**情報収集を邪魔しない小さな操作**として提供する。

- 電子カルテの記録を「Evidence として追加」
- 患者との会話を「患者の言葉として保存」（既存 `EvidencePane` の会話収集）
- 患者トップの情報を「Workspace へ追加」
- ノートを「気づきとして関連づける」
- 後で確認したい内容を「不足情報・確認事項として保存」

原則:
- Learning Layer へ送る情報は**学生が明示的に選択・確認**する（既存 `CollectionDialog` を踏襲）。
- **AI やシステムが、学生の意思確認なしに大量の情報を自動保存しない。**
- Core の画面は主役のまま。収集 UI は小さな affordance（例: `AddToWorkspaceButton`）に留める。

---

## 5. Compass Coach in Core

Core 上の Coach は、情報保存の主役ではなく、**学生に気づき・確認を促す**。

例の問い: 「この情報は患者理解にどう関係しますか」「患者本人の言葉として残す必要はありませんか」「この情報だけで判断してよいでしょうか」「他の記録と矛盾していませんか」「Workspace に Evidence として残しますか」「次に何を確認しますか」。

- **Coach は Inspector 内で提供し、常時大きく表示しない。**（現状の `FacingCoachPanel` 常設ウィジェットは Inspector 側へ再配置する — §0 / §15）。
- **Inspector を開閉しても、Core の選択患者・カルテタブ・記録位置・入力内容を失わない**（既存 `useWorkspaceInspector` + overlay 配置の非破壊性を必須要件として継承）。

---

## 6. Clinical Thinking Workspace

Clinical Thinking Workspace は、**Learning Layer に保存された内容を可視化・編集する画面**である。

- Core 左メニューに配置する**患者単位の主要画面**。
- 左メニュー構成（例）:
  ```
  患者トップ
  電子カルテ
  患者との会話
  ノート
  ────────────
  思考ワークスペース      ← Clinical Thinking Workspace
  学習成果（提出物）      ← Learning Outcomes（§12）
  ```
- 患者A を見ている状態で Workspace を開くと、**患者A について Learning Layer に収集した内容**が表示される。
- **患者文脈を切り替えたり、別の独立アプリへ移動したように見せない**（現在の患者・Core 文脈を維持したまま開く）。

実装方針: 既存 `ClinicalThinkingWorkspace.tsx`（V1 localStorage 3ペイン）を土台に、**2ペイン化**し保存を Supabase Evidence（`useEvidenceSupabase`）へ寄せる（§15 責務分離）。

---

## 7. Two-Pane Workspace

Workspace は**左右2ペイン**構成とする。

### 左ペイン: Clinical Thinking（思考）
扱う要素: Evidence / Observation / 患者本人の言葉（Patient Voice）/ Student Insight（気づき）/ 関係づけ（Relationship）/ 解釈・意味づけ（Interpretation）/ 仮説（Hypothesis）/ 不足情報（Information Gap）/ 確認事項（Confirmation Item）/ Coach から提示された問い（Coach Question）。

### 右ペイン: Learning Outcomes（学習成果）
成果物を切り替えて表示: **様式2 / 様式3 / 看護計画 / 将来追加される学習成果**。

- **左側の思考文脈を維持したまま、右側の成果物だけを切り替えられる**構造（`LearningOutcomeSwitcher` + `LearningOutcomeContainer`）。
- 右ペインには、まず**既存の Supabase 版様式2（`WorkspaceForm2Section`）を可能な限りそのまま流用**する。
- 左右のスクロール位置・入力は互いに独立して保持（§13）。

---

## 8. Compass Learning Loop

以下を **Compass Learning Loop** として正式定義する（一方向手順ではなく、患者理解が更新され続ける**循環**）。

```
Core で患者情報を得る
   ↓
Learning Layer へ重要な情報を残す
   ↓
Workspace で Evidence・気づき・関係・仮説を考える
   ↓
学習成果へ表現する
   ↓
不足・矛盾・根拠不足に気づく
   ↓
Core へ戻って追加確認する
   ↓
Learning Layer・Workspace・学習成果を更新する
   ↺（循環）
```

- 上位の学習サイクル（`docs/architecture/04`: Observe→Understand→Think→Organize→Reflect）の実装的表現であり整合する。
- どの段階からでも入れる。順序を強制しない。Core への往復を前提にする。

---

## 9. Information Model

以下を **UI・ドメインモデル**として定義する（本 Sprint では DB スキーマは確定しない）。

| 概念 | 定義 / 目的 | 生成元 | 編集主体 | 保存 | Core作成 | WS作成 | 関連・学習成果との関係 |
|---|---|---|---|---|---|---|---|
| **Evidence** | 見た/聞いた**事実**。患者理解の根拠 | 会話・カルテ・観察・一時メモ | 学生 | ○（患者別） | ○ | ○ | Interpretation/Hypothesis の根拠。様式2 記述の裏付け |
| **Observation** | 学生が観察した事実（表情・姿勢・様子等） | Core（患者トップ/会話/病棟） | 学生 | ○ | ○ | ○ | Evidence の一種として扱いうる（source=student_observation） |
| **Patient Voice** | 患者本人の言葉（発言の引用） | 患者との会話 | 学生（選択） | ○ | ○ | ○ | Evidence の一種（source=patient_conversation）。個別性の核 |
| **Student Insight** | 学生の気づき（言語化された着眼） | Core/Workspace | 学生 | ○ | ○ | ○ | Relationship/Interpretation の入口。ノートと統合可否は §18 |
| **Relationship** | 情報同士の関係づけ | Workspace | 学生 | ○ | △ | ○ | Evidence 間・気づき間を結ぶ。Interpretation の材料 |
| **Interpretation** | 解釈・意味づけ（事実→意味） | Workspace | 学生 | ○ | × | ○ | Evidence を根拠に持つ。事実と分離して保持 |
| **Hypothesis** | 仮説（患者理解の暫定的な見立て） | Workspace | 学生 | ○ | × | ○ | Information Gap（検証に必要な不足）と対で扱う |
| **Information Gap** | 不足情報（まだ分からないこと） | Core/Workspace | 学生 | ○ | ○ | ○ | Confirmation Item・Core への往復導線に接続 |
| **Confirmation Item** | 確認事項（Core へ戻って確認すべきこと） | Core/Workspace | 学生 | ○ | ○ | ○ | Information Gap と近縁。Core への戻り行動を促す |
| **Coach Question** | Coach が提示した問い（正解ではない） | Compass Coach | システム提示・学生は状態のみ | 保存要否は §18 | ○（Inspector） | ○（Inspector） | 思考を促す。成果物へ自動転記しない |
| **Learning Outcome Reference** | 学習成果への参照（様式2/様式3/看護計画） | Workspace 右ペイン | 学生 | ○（成果物本体は各テーブル） | × | ○ | 左の思考と右の成果物を結ぶ（Evidence⇄様式2 リンクは `10_evidence_form2_link_design.md`） |

注: Evidence / Observation / Patient Voice は既存 `InformationCard`（`lib/information/informationCard.ts`）の `sourceType` で表現できる（`patient_conversation` / `student_observation` / `nursing_record` 等）。Interpretation/Hypothesis/Relationship は「事実」と分離するため、Evidence とは別概念として扱う（既存方針: EvidencePane は事実のみ）。

---

## 10. Compass Coach in Workspace

Workspace 上の Coach は、**完成文や正解を提示せず**、問いを通じて思考を支援する。

例の問い: 「この解釈の根拠となる Evidence はどれですか」「これらの情報にはどんな関係がありますか」「矛盾している情報はありませんか」「患者の強み・保たれている力はどこですか」「この仮説を確かめるには何が不足していますか」「Core へ戻って何を確認しますか」「様式の記述は Evidence から説明できますか」「事実と解釈が混ざっていませんか」「一般論でなく患者の個別性が表れていますか」。

- **Coach は Inspector 内に置き、Workspace 本体とは分離**する（`WorkspaceInspector` を流用）。
- Inspector を開閉しても、Workspace の選択状態・スクロール位置・入力内容・右ペインの成果物を失わない（§13）。

---

## 11. Coach Boundaries

Compass Coach が**行わないこと**（設計原則）:

- 患者像を自動で確定しない
- 様式2 を自動完成させない
- 学生の代わりに看護問題を決定しない
- 正解を一方的に提示しない
- Evidence を学生の確認なしに大量保存しない
- 学生の文章を AI 文章へ自動置換しない
- AI の出力を患者情報の事実として扱わない

**主役は学生であり、Coach は思考を促す補助役である**（`docs/version2/13` Non-goals と整合）。

---

## 12. Learning Outcomes Navigation

Core 左メニューの「**学習成果（提出物）**」の役割を定義する。

扱う内容: 成果物一覧 / 様式2・様式3・看護計画の進捗 / 作成途中の確認 / 提出状態 / 再編集 / 教員フィードバック / 提出期限 / 更新日時。

「思考ワークスペース」と「学習成果（提出物）」の違い:

| 画面 | 役割 |
|---|---|
| **思考ワークスペース** | 患者理解を深めながら成果物を編集する**作業画面**（左=思考 / 右=成果物） |
| **学習成果（提出物）** | 成果物全体の進捗・提出・フィードバックを管理する**一覧画面** |

- 学習成果一覧から様式2 を開く場合も、**可能なら同じ Workspace 右ペインに対象成果物を開く**設計を検討（一覧＝入口、編集＝Workspace 右ペイン）。

---

## 13. Context Preservation

Core・Workspace・学習成果・Inspector 間の移動で、以下を**失わない**ことをルール化する。

保持対象: 選択中の患者 / Core で開いている画面 / 電子カルテの選択タブ / 選択中の記録 / Core のスクロール位置 / 選択中の Evidence / Workspace の表示セクション / Workspace のスクロール位置 / 開いている学習成果 / 様式の編集中項目 / 未保存入力 / Inspector の表示状態 / Coach の現在の問い。

保持レイヤの割り当て:

| 状態 | 保持場所 |
|---|---|
| 選択中の患者 / 開いている Core 画面 | 共有 state（AppShell、既存 `selectedId`/`activeView`） |
| カルテ選択タブ・記録・スクロール | Core 画面のローカル UI state（再マウント禁止で維持） |
| Evidence・気づき・関係・解釈・仮説・不足情報 | Supabase 永続化（学生別・患者別） |
| 開いている学習成果・様式編集中項目 | 共有 state（選択）＋ Supabase（本体） |
| 未保存入力 | ローカル state ＋ localStorage 下書き退避（既存 `form2Draft` 方式） |
| Inspector 表示・Coach の現在の問い | ローカル UI state（既存 `useWorkspaceInspector`/`useQuestionPanel`） |
| 対象患者・成果物種別 | 必要に応じて URL（例 `?outcome=form2`）で表現可 |

**再マウントを避ける必要がある領域**: Core メイン画面（カルテ/会話/様式2）、Workspace 左右ペイン。Inspector・成果物切替はこれらを unmount させない（sibling/overlay・中身差し替えで実現）。

---

## 14. Responsive Rules

### PC
- 左メニュー常時表示 / Workspace 左右2ペイン / ペイン幅調整可 / Inspector は右ドックまたはオーバーレイ / Inspector 表示時も主要入力領域を維持。

### iPad 横向き
- 左右2ペインを基本 / 必要に応じ成果物側を拡大 / 左メニューは折りたたみ可 / Inspector 表示時も Workspace 主要操作を維持 / 横スクロールを生まない。

### iPad 縦向き・狭幅
- Clinical Thinking と Learning Outcome を**タブ/切替表示**（既存 `ClinicalThinkingWorkspace` のセグメント切替を踏襲）/ 切替でも入力・スクロール保持 / Inspector はオーバーレイまたはボトムシート / Core からの Evidence 追加は片手でも行いやすく（44px 以上のタップ領域）。

---

## 15. Component Architecture

責務ベースの構成案。**既存と重複する場合は新規作成せず、流用・改修を優先。**

| 分類 | コンポーネント / モジュール |
|---|---|
| **そのまま流用可能** | `WorkspaceForm2Section`, `Form2EditForm`, `Form2SheetView`, `useForm2Supabase`, `form2Repository`/`form2Mapper`/`caseId`/`form2Draft`, `WorkspaceInspector`, `WorkspaceInspectorToggle`, `useWorkspaceInspector`, `QuestionPanel`, `useQuestionPanel`, `EvidencePane`, `useEvidenceSupabase`, `informationCards`(Server Actions), `CollectionDialog`, `lib/information/informationCard.ts` |
| **軽微な改修で流用可能** | `SideNav`（「思考ワークスペース」「学習成果」項目を追加）, `AppShell`（左メニュー導線・Workspace view の接続）, `WorkspaceCoachPanel`（Inspector パネル化）, `EvidencePane`（カルテ記録からの収集導線を追加） |
| **責務分離が必要** | `ClinicalThinkingWorkspace`（V1 localStorage 3ペイン → 2ペイン化＋Supabase Evidence 化）, `FacingCoachPanel`（Core 常設 → Inspector 内 Coach へ再配置）, `PatientWorkspace`（縦単一フロー → 2ペインへ転用 or 廃止） |
| **新規実装が必要** | `LearningLayerProvider`（患者文脈の Learning state 供給）, `LearningCaptureAction`/`AddToWorkspaceButton`（Core からの明示的収集）, `ThinkingWorkspacePane`（左ペイン器）, `LearningOutcomePane`/`LearningOutcomeSwitcher`/`LearningOutcomeContainer`（右ペイン成果物切替）, `EvidenceBoard`/`EvidenceCard`（既存 EvidencePane を昇格）, `InsightEditor`, `RelationshipView`, `InterpretationPanel`, `HypothesisPanel`, `InformationGapList`, `CompassCoachPanel`（Inspector 内・Workspace 版）, `LearningOutcomesIndex`（学習成果一覧） |

名称対応の注記: ユーザ提案の `ClinicalThinkingWorkspace`/`WorkspaceInspector`/`CompassCoachPanel` は既存名（`ClinicalThinkingWorkspace.tsx`/`WorkspaceInspector.tsx`/`WorkspaceCoachPanel.tsx`）に対応づけ、原則リネームせず責務を寄せる。

---

## 16. State and Data Boundaries

| 種別 | 例 | 保持場所 |
|---|---|---|
| UI だけの一時 state | ペイン開閉・ホバー・ダイアログ開閉 | ローカル state |
| Core 画面ごとの一時 state | カルテタブ・スクロール・会話入力途中 | 各 Core 画面のローカル state（再マウント禁止） |
| 患者単位で保存する Learning Layer state | Evidence・気づき・関係・解釈・仮説・不足情報 | Supabase（学生×患者） |
| 学生単位で保存する state | プロフィール・識別 | Supabase（`profiles`） |
| 学習成果ごとに保存する state | 様式2/様式3/看護計画の本体 | Supabase（成果物テーブル、様式2 は既存） |
| Coach の一時的な対話 state | 現在の問い・選択・確認状態 | ローカル UI state（保存要否は §18） |
| URL で表現する state | 対象成果物・（将来）Workspace セクション | URL query（任意） |
| Supabase へ永続化する候補 | 上記「患者単位」「学習成果ごと」 | Supabase |

Learning Layer の保存単位は、最低限**学生 / 患者 / 情報の生成元 / Evidence 種別 / 関連学習成果 / 作成日時 / 更新日時**を識別できる構造を検討する（既存 `InformationCard` の `patientId`/`sourceType`/`sourceReference`/`createdAt`/`updatedAt` が土台）。**本 Sprint では DB 変更・SQL 作成は行わない。**

---

## 17. Migration Strategy

一度に作り替えず、**各段階が既存機能を壊さず単独で回帰確認できる**単位で進める。

1. Learning Layer の概念と state 境界を確定（本書）
2. Core 左メニューに Workspace 導線を追加（`SideNav` に「思考ワークスペース」）
3. Workspace の外枠と左右2ペインを作成（`ClinicalThinkingWorkspace` を2ペイン化）
4. 右ペインへ既存 Supabase 版様式2 を埋め込む（`WorkspaceForm2Section` 流用）
5. 左ペインに仮の Evidence 一覧を追加（`EvidencePane` 流用）
6. Core（カルテ）から Evidence を追加する最小導線を実装（`AddToWorkspaceButton`）
7. 患者との会話・ノートからの追加へ拡張
8. 気づき・解釈・仮説・不足情報を追加（各 Editor）
9. Workspace 用 Compass Coach を接続（Inspector パネル化）
10. 様式3・看護計画へ拡張（`LearningOutcomeSwitcher`）
11. 学習成果一覧を追加（`LearningOutcomesIndex`）
12. 教員フィードバックとの接続を検討

各段階後に `/`（Core 回帰）と `/v2/student`（Learning）を回帰確認する。

---

## 18. Open Questions

設計上まだ決定が必要な事項:

- Evidence は学生選択を原則とするか（原則 Yes。自動候補提示の許容範囲は？）
- 自動候補提示をどこまで許容するか（提示のみ・保存は学生確認、が基本線）
- Evidence 追加時に引用範囲をどこまで保持するか（`originalText` / `sourceReference` の粒度）
- カルテ記録全体と一部分のどちらを保存するか
- 会話の患者発言をどの単位で保存するか（発言単位＝現行 content hash / TD-001）
- ノートと Student Insight を統合するか分けるか
- Evidence と様式2 項目を直接結びつけるか（`10_evidence_form2_link_design.md` の `form2_evidence_links` 案）
- 関係づけ UI をカード / リスト / キャンバスのどれにするか
- 仮説を成果物へどう反映するか（自動転記しない前提での提示方法）
- Coach の自動介入をどこまで許容するか
- Coach の問いを保存するか（Coach Question の永続化要否）
- 学生が Coach の問いを非表示・保留できるか
- 教員が思考過程をどこまで閲覧できるか（RLS・可視範囲）
- 自動保存の単位と頻度（既存 form2 の debounce を踏襲するか）
- 未保存入力の復元方法（既存 `form2Draft` 方式の全概念への一般化）
- 患者切り替え時の誤保存防止（患者×学生キーの厳格化）
- 本書と `14_architecture_principles.md` の番号重複解消（将来リネーム / 統合の要否）

---

## 設計上の重要原則（Compass 全体の前提）

- Core を Compass の土台として維持する
- Learning Layer は Core の患者文脈上で動く
- Compass Coach も Core の患者文脈上で独立して動く
- Learning Layer と Coach を同一機能として扱わない
- Learning Layer は情報の収集・保持・整理を担う
- Coach は問い返しによる思考支援を担う
- Workspace は Learning Layer を可視化・編集する画面とする
- Workspace は Core 左メニューから開く
- 様式2 の完成だけを目的にしない
- 学生自身の選択・思考・表現を中心にする
- AI を画面の主役にしない
- Core での情報収集を邪魔しない
- Core の患者文脈を壊さない
- 右側の学習成果だけを交換可能にする
- 既存の Supabase 版様式2 を壊さない
- PC と iPad を正式対応対象とする
- Inspector 開閉でメイン画面を再マウントしない
- 将来の様式3・看護計画・教員フィードバックへ拡張可能にする

---

## 関連文書
- 上位: `docs/architecture/01_compass_core.md` / `02_learning_layer.md` / `03_core_learning_integration.md` / `04_learning_flow.md` / `05_design_principles.md`
- UI 実装ガイド（下位・整合）: `docs/version2/13_ui_architecture.md`（CWDS）
- 関連設計: `docs/version2/12_question_feature_review.md`, `04_patient_understanding.md`, `05_information_notebook.md`, `10_evidence_form2_link_design.md`, `11_source_reference_improvement.md`
