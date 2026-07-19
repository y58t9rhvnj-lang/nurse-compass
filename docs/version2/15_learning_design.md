# 15. Compass Version2 学習設計（正式版）

> 本書は Compass Version2 の**学習設計を正式に文書化**したもの。設計文書であり、アプリコード・Supabase・DB は変更しない（commit / push もしない）。
> 本書は `14_learning_layer_architecture.md`（Learning Layer アーキテクチャ）を**上書きせず、その学習体験（Compassメモ・思考ワークスペース・Evidence・Compass Coach）を確定・具体化**する。両者が矛盾する場合は本書を優先し、差分を §0 に明記する。

- ステータス: 学習設計 確定（実装前）。本書では DB スキーマ・SQL・RLS を確定しない（学習体験とドメイン概念まで）。
- 恒久アーキテクチャ名: **Core / Learning Layer / Compass Coach / Clinical Thinking Workspace**。「Version1 / Version2」は移行段階の呼称。
- 上位設計: `docs/architecture/01_compass_core.md`〜`05_design_principles.md`。本書はその Learning Layer / Learning Flow を Version2 実装文脈で具体化する。

---

## 0. 既存設計・実装との整合性確認

本書で確定する学習設計と、既存文書・実装との関係。**矛盾する場合は本書を優先し、対応を明記する。**

| 既存資産 | 現状 | 本書との関係 | 対応 |
|---|---|---|---|
| `docs/architecture/01–05` | Core / Learning Layer / Integration / Learning Flow / 原則の恒久定義 | 整合（本書はその Version2 具体化） | 追随 |
| `docs/version2/14_learning_layer_architecture.md` §4「Learning Layer in Core」 | 電子カルテ・会話・患者トップから **直接 Evidence を追加**（`AddToWorkspaceButton` 等）する導線を記載 | **矛盾**: 本書では Core 画面から直接 Evidence を確定しない（§5）。学生は Compassメモに記録し、Evidence 化は思考ワークスペース内で行う | **本書で更新**（§0.1・§5）。14 §4 は「将来の任意拡張」に格下げ |
| `docs/version2/14_...` §7 左ペイン / §9 Information Model | Evidence/Observation/Patient Voice/Insight/Relationship/Interpretation/Hypothesis/Gap 等を左ペインで扱う | 整合（本書はその入口を Compassメモに一本化し、選別・整理を WS 内に限定） | 追随＋制約 |
| `docs/version2/12_question_feature_review.md` / `13_ui_architecture.md`（CWDS） | Question/Coach を Inspector で提示（静的・非AI）、UI 土台 | 整合（本書の Coach は Inspector を器として流用） | 追随 |
| `docs/version2/03_learning_journey.md` | 学びの足跡を append-only で残す（stage はイベント） | 整合（Coach の進捗参照＝§8 の状態は Journey から導出可能） | 参照 |
| `docs/version2/10_evidence_form2_link_design.md` | Evidence⇄様式2 リンク（`form2_evidence_links` 案） | 整合（§5 の「関係する看護問題」への発展先） | 参照 |
| Compassメモ実装（`NoteZone` = 気づきメモ / `useNotes` / `lib/notesStore.ts`） | localStorage 永続（キー `nc:notes:{patientId}`）。患者単位。Supabase 未接続 | 整合（本書の Compassメモの土台。将来 Supabase 化＝§9-4） | 流用＋拡張 |
| 思考ワークスペース実装（`ClinicalWorkspace` / `EvidencePane` / `WorkspaceForm2Section`） | 左=Evidence（Supabase）／右=様式2（Supabase）。会話発言の直接収集 UI は**現在無効化**（`CONVERSATION_CAPTURE_ENABLED=false`） | 整合（本書の思考ワークスペースの土台） | 流用 |
| Core 収集導線（`EvidenceCaptureButton` / `ConversationCaptureButton` / `EvidenceCaptureContext`） | 電子カルテ・会話の「Workspaceへ追加」。**現在 Provider へ null を渡し非表示**（`CORE_CAPTURE_ENABLED=false`）。コードは残置 | 整合（本書の方針＝直接収集しないと一致） | 非表示継続（削除は §9-8） |
| 左メニュー「患者との会話」 | **メニューからは除外済み**（会話画面は残し、患者トップから入る導線に一本化） | 整合 | 追随 |

### 0.1 14_learning_layer_architecture.md から更新する点
- 14 §4 の「電子カルテ記録／患者発言／患者トップ情報を **直接 Evidence として追加**する導線」は、本書では**採用しない**。Core 画面での Learning 操作は「Compassメモに記録する」促し（Coach）に限定する。
- Evidence の**選別・整理・確定は思考ワークスペース内**でのみ行う（§5）。
- 上記に伴い、14 §15 の `AddToWorkspaceButton`/`LearningCaptureAction`（Core からの明示的収集）は**保留**（不要になる可能性・§9-8）。`EvidenceCaptureButton` 系は削除せず非表示のまま残す。
- 14 は Learning Layer の広い構造（2ペイン・状態境界・レスポンシブ・移行）を引き続き有効とする。本書はその中の**学習体験（メモ→思考→Evidence→様式）**を確定する上位ルールとして運用する。

---

## 1. 基本方針

Version2 は **Version1 を置き換えるものではなく、Version1 Core に以下を追加する構成**とする。

1. ログイン（認証）
2. Supabase による保存・復元
3. 思考ワークスペース（Clinical Thinking Workspace）
4. Compass Coach（思考支援）

- Core（病棟ホーム／患者トップ／電子カルテ／患者との会話／Compassメモ）は Version1 の UI・画面構成・操作性を基盤とする。
- Learning Layer は Core を土台に重畳される。Core は Learning Layer 無しでも単独成立する（`architecture/01` Core Independence）。
- 主役は学生と患者。AI・様式の完成を画面の主役にしない。

---

## 2. 学生の基本的な学習導線

```
ログイン
  ↓
病棟ホーム
  ↓
患者トップ
  ↓
電子カルテ・患者との会話
  ↓
Compassメモ
  ↓
思考ワークスペース
  ↓
Evidence 整理
  ↓
様式2・様式3
```

- 一方向の手順ではなく、**Core への往復を前提とした循環**（`architecture/04` Learning Flow ／ 14 §8 Compass Learning Loop と整合）。
- どの段階からでも入れる。順序を強制しない。
- 「患者との会話」へは**患者トップから入る**（左メニューには会話項目を置かない。会話画面自体は残す）。

---

## 3. Compassメモの定義

Compassメモは、**学生が自由に記載・保存する個人メモ**とする。記載内容は限定しない。

含みうる内容:
- 学生が気づいたこと
- 気になったこと
- Evidence になりそうな情報
- 後で確認したいこと
- 後で振り返りたいこと
- 電子カルテを見て生じた疑問
- 患者との会話で感じたこと
- 様式へ整理する前の考え

原則:
- **Compassメモに記載された内容が、すべて Evidence になるわけではない。**
- Compassメモは、学生の気づき・疑問・考えを保存し、**後から思考ワークスペースで再利用する**ための場所とする。
- 個人メモであり、学生本人のものである（教員可視範囲は §10 未決）。

実装対応: `components/patient/notes/NoteZone.tsx`（「気づきメモ」）／ `hooks/useNotes.ts` ／ `lib/notesStore.ts`（現状 localStorage、キー `nc:notes:{patientId}`、型 `Note{ id, patientId, text, createdAt, updatedAt }`）。将来の Supabase 保存は §9-4。

---

## 4. 思考ワークスペースの定義

思考ワークスペースは、**電子カルテ・患者との会話・Compassメモと、様式2・様式3 を橋渡しする「思考整理の場所」**とする。

単なる情報収集画面ではなく、学生が以下を行う場所とする。
- 気になる情報を整理する
- 情報同士のつながりを考える
- 情報が示している意味を考える
- 不足している情報を確認する
- 看護問題につながる Evidence を選ぶ
- 様式2・様式3 へ整理する内容を考える

原則:
- **電子カルテや患者との会話画面から、直接 Evidence を確定する設計にはしない**（§0.1）。
- Evidence の選別・整理は思考ワークスペース内で行う。
- 左＝思考（Clinical Thinking）／右＝学習成果（様式2・様式3 等）の 2 ペインを基本とする（14 §7）。

実装対応: `components/v2/workspace/ClinicalWorkspace.tsx`（左 `EvidencePane` ＋ 右 `WorkspaceForm2Section`）。会話発言の直接収集候補 UI は現在無効（`CONVERSATION_CAPTURE_ENABLED=false`）。

---

## 5. Evidence の定義

Evidence は、**看護問題を明確にし、根拠づける情報**とする。

- 単なるカルテ情報の引用・患者発言の抜き出しではない。
- **学生が思考ワークスペースで意味を考えたうえで、選択・整理した情報**とする。

Evidence の元となる情報源:
- 電子カルテ
- 患者との会話
- Compassメモ

今後の設計で、Evidence について以下を整理できる構造を検討する（本 Sprint では DB 変更しない）:
- Evidence の内容
- 情報源（source）
- その情報を Evidence として選んだ理由（rationale）
- 関係する看護問題（nursing problem）
- 追加で必要な情報（information gap）

実装対応: `lib/information/informationCard.ts`（`InformationCard`：`content`/`sourceType`/`sourceReference`/`originalText`/`createdAt`/`updatedAt`）／ `hooks/v2/useEvidenceSupabase.ts`（`collectMemo` はメモ由来 Evidence の保存に流用。会話発言直接収集 `collectUtterance`・任意情報源 `collectSource` は残置するが Core からは呼ばない）。「選んだ理由」「関係する看護問題」は現行スキーマに無く、保存項目の調整が必要（§9-5・§10）。

---

## 6. Compass Coach の基本原則

Compass Coach は、**答えや看護問題を直接提示するものではない**。

- 学生の現在地・進捗・整理状況に応じて、**次に何を確認・検討するとよいかを「問い」や「案内」として返す**。
- Coach は、学生の代わりに判断したり、様式を完成させたりしない。

Coach が行わないこと（14 §11 と整合）:
- 患者像を自動確定しない／看護問題を代わりに決めない
- 様式を自動完成させない／正解を一方的に提示しない
- Evidence を学生の確認なしに保存しない
- 学生の文章を AI 文章へ自動置換しない／AI 出力を事実として扱わない

---

## 7. 各画面における Coach の役割

| 画面 | Coach の役割 | 主な支援内容（例） |
|---|---|---|
| **病棟ホーム** | 今日の学習ナビゲーター | 今日何をすればよいか迷った時に次の行動を導く：受け持ち患者を確認／患者トップを開く／電子カルテ・会話を確認／Workspace で整理／様式2・様式3 の続き |
| **患者トップ** | 情報収集経路の案内役 | 電子カルテと会話のどちらから進むとよいか、探している情報をどこから得られるかを導く。判断材料＝カルテ確認状況／会話進行／Compassメモ内容／Evidence 不足／様式進捗 |
| **電子カルテ** | 情報探索の案内役 | 探す情報に応じてどの記録・タブを見るとよいかを導く（治療経過／看護記録／フローシート／基本情報／入院時情報／家族情報／生活状況）。重要な気づきは **Compassメモへの記録を促す** |
| **患者との会話** | 対話の伴走者 | 会話を進め必要な情報を得られるよう導く：言葉を詳しく聞く／気持ちを受け止める／尋問的にしない／生活場面を具体化／重要発言や気づきを **Compassメモへ残す**。模範質問・正解を提示しすぎない |
| **思考ワークスペース** | 思考整理を支援する問いかけ役 | 代わりに整理せず問いを返す：情報の共通点は何か／どんな困りごとを示すか／看護問題の説明に不足する情報は何か／事実と解釈を分けられているか／矛盾をどう考えるか／Evidence と看護問題がどうつながるか |

- Coach は Inspector 内で提供し、常時大きく表示しない（14 §5・§10。器＝`WorkspaceInspector`/`useWorkspaceInspector`/`QuestionPanel`。Core 常設の `FacingCoachPanel` は将来 Inspector 側へ再配置＝14 §15）。
- Inspector を開閉しても Core / Workspace の状態（選択患者・タブ・記録位置・入力・スクロール）を失わない。

---

## 8. Coach が参照する進捗情報

最初から詳細な行動ログや滞在時間は実装しない。まずは以下の**状態**を参照できることを想定する。

参照する状態:
- 現在の画面
- 電子カルテの確認状況
- 患者との会話の進行状況
- Compassメモの有無
- Evidence の件数・整理状況
- 様式2・様式3 の進捗
- 学生が現在探している情報や目的

状態区分（まずはこの程度でよい）:
- 未着手
- 確認中
- メモあり
- 整理中
- 様式記載中

- これらの状態は、可能な限り既存データから**導出**する（新規の常時ログ基盤を先に作らない）。`learning_journey`（`03_learning_journey.md`）の `entered_*` イベントや Compassメモ有無・Evidence 件数・様式進捗から導ける。
- 「現在探している情報や目的」は学生入力または画面文脈から得る（保存要否は §10）。

---

## 9. 今後の実装順序

1. 今回の学習設計を文書化（＝本書）
2. 既存 Workspace 機能との差分確認（`ClinicalWorkspace`/`EvidencePane`/`WorkspaceForm2Section` と本設計の突合）
3. Workspace 画面構成の確定（左＝思考／右＝様式2・様式3、Compassメモ連動 UI）
4. Compassメモの Supabase 保存（`notesStore` の抽象層を保ったままバックエンド差し替え。患者×学生キー）
5. Evidence 定義に合わせた保存項目の調整（source／選んだ理由／関係する看護問題／不足情報。DB 変更は別途合意）
6. 各画面の Coach 支援設計（§7 の役割・§8 の状態区分に基づく問い・案内。Inspector で提供）
7. 教員が学生別・患者別に Workspace・様式を確認する機能（可視範囲・RLS を含む）
8. 不要コードの削除・統合（非表示中の Core 直接収集＝`EvidenceCaptureButton`/`ConversationCaptureButton`/`EvidenceCaptureContext`、`collectSource`、EvidencePane の会話収集パス等の整理）
9. 動作確認（Core 回帰＋ Learning、PC / iPad）
10. 保全 commit

---

## 10. 既存設計との矛盾・未決事項

矛盾（本書で解消済み・要追随）:
- 14 §4「Core から直接 Evidence 追加」⇔ 本書「直接確定しない・Compassメモ経由」→ **本書優先**（§0.1）。関連コードは非表示で残置。

未決事項（次工程で確定）:
- Compassメモと Workspace の**具体的な連動方法**（メモを Evidence 候補として WS に流す UI／メモ単位か抜粋か／メモ編集と Evidence の独立性）。
- Compassメモの **Supabase 保存**（テーブル・RLS・localStorage からの移行と二重管理回避）。
- Evidence の追加保存項目（**選んだ理由・関係する看護問題**）を現行 `InformationCard` にどう持たせるか（payload/metadata か新カラムか）。
- **様式3・看護計画**の右ペイン成果物としての追加（`LearningOutcomeSwitcher`）。
- Coach の**進捗状態の導出元**と「探している情報・目的」の取得・保存要否。
- Coach Question の永続化要否／学生が問いを保留・非表示にできるか（14 §18）。
- 教員の**可視範囲**（学生別・患者別の Workspace／様式／Compassメモの閲覧と RLS）。
- 非表示中の Core 直接収集コードの**削除 or 恒久保持**の最終判断（§9-8）。
- 番号重複（`14_architecture_principles.md` と `14_learning_layer_architecture.md`）の解消（将来リネーム）。

---

## 11. 次工程で確認すべき既存コード

- Compassメモ: `components/patient/notes/NoteZone.tsx`, `components/patient/notes/NoteComposer.tsx`, `components/patient/notes/NoteList.tsx`, `hooks/useNotes.ts`, `lib/notesStore.ts`, `lib/notes.ts`
- 思考ワークスペース: `components/v2/workspace/ClinicalWorkspace.tsx`, `EvidencePane.tsx`, `WorkspaceForm2Section.tsx`
- Evidence: `hooks/v2/useEvidenceSupabase.ts`（`collectMemo`/`collectUtterance`/`collectSource`）, `app/v2/actions/informationCards.ts`, `lib/information/informationCard.ts`, `lib/information/informationCardAdapters.ts`
- Core 直接収集（非表示・削除候補）: `components/v2/capture/EvidenceCaptureButton.tsx`, `ConversationCaptureButton.tsx`, `EvidenceCaptureContext.tsx`, `lib/v2/notebook/conversationSourceId.ts`, および `components/chart/ChartTabContent.tsx` / `components/patient/facing/FacingPatient.tsx` の呼び出し箇所
- Coach / Inspector: `components/patient/facing/FacingCoachPanel.tsx`, `components/v2/workspace/inspector/*`, `hooks/**/useWorkspaceInspector*`, `QuestionPanel` / `useQuestionPanel`
- シェル・導線: `components/AppShell.tsx`（`CORE_CAPTURE_ENABLED`）, `components/SideNav.tsx`（`STUDENT_NAV_ITEMS`）
- 様式2: `hooks/v2/useForm2Supabase.ts`, `lib/v2/**/form2Repository`/`form2Mapper`/`caseId`/`form2Draft`

---

## 関連文書
- 上位: `docs/architecture/01_compass_core.md` / `02_learning_layer.md` / `03_core_learning_integration.md` / `04_learning_flow.md` / `05_design_principles.md`
- Learning Layer 構造: `docs/version2/14_learning_layer_architecture.md`（本書が学習体験を確定）
- UI 土台: `docs/version2/13_ui_architecture.md`（CWDS） / Coach・Question: `12_question_feature_review.md`
- 関連設計: `03_learning_journey.md` / `04_patient_understanding.md` / `05_information_notebook.md` / `10_evidence_form2_link_design.md` / `11_source_reference_improvement.md`
