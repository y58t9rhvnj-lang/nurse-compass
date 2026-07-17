# 09 Design Log（設計判断ログ）

Version 1.1
Last Update: 2026-07-17
Status: Central Design Log（中央設計ログ）

> 本書は、Compass の教育モデル・設計に関する判断を番号付きで記録する中央ログである。
> 教育モデルの変更（`docs/06_Compass_Educational_Model_V1.md` の Freeze 対象）には、
> 本ログへの記録された判断が必要である。

各エントリの形式：

- **ID**
- **Date**（日付）
- **Decision**（決定）
- **Context**（背景）
- **Decision details**（決定の詳細）
- **Educational rationale**（教育的根拠）
- **Alternatives considered**（検討した代替案）
- **Risks**（リスク）
- **Validation plan**（検証計画）
- **Status**（状態）

---

## DL-001

- **Decision**：患者理解は、カルテ完成に先行する。
- **Date**：2026-07-12
- **Context**：Compass は電子カルテ操作練習と誤解されやすい。学習の中心を明確にする必要がある。
- **Decision details**：学生はまず患者と向き合い、疑問を持ってからカルテを確認・深化に使う。カルテは目的ではなく手段。
- **Educational rationale**：患者理解を中心に据えることで、思考が主・記録が従になる（Charter Core Statement）。
- **Alternatives considered**：カルテ入力を起点とする従来型（不採用：思考を後回しにする）。
- **Risks**：学生が「早く様式を埋めたい」動機に流れる。
- **Validation plan**：学生が患者との対話・観察を起点に情報を集めるか。患者理解に関する発話・記述が増えるか。
- **Status**：Adopted（Version1 基盤）

---

## DL-002

- **Decision**：データ → 情報 → 手がかり（Data → Information → Cue）モデルを採用する。
- **Date**：2026-07-12
- **Context**：事実と解釈が混在すると、学生が「何が事実で何が自分の考えか」を見失う。
- **Decision details**：データ＝事実、情報＝視点別に整理・分類した事実（解釈を含まない）、手がかり＝根拠に紐づく学生の解釈。
- **Educational rationale**：段階を分離することで、根拠のある思考と振り返りが可能になる。
- **Alternatives considered**：情報に解釈文を持たせる `OrganizedInformation`（title/content）案（不採用：事実と解釈が混ざる。DL 化して撤回）。
- **Risks**：「情報」「手がかり」という語が学生に伝わりにくい可能性。
- **Validation plan**：学生が用語を理解するか。事実と解釈の混同が起きないか。教員が区別を有用と感じるか。
- **Status**：Adopted（`docs/03` §3・教育仮説）

---

## DL-003

- **Decision**：一時メモを、収集データから分離する。
- **Date**：2026-07-12
- **Context**：思考を止めないための自由な書き場と、患者理解のために残す事実は役割が異なる。
- **Decision details**：一時メモ（気づきメモ/NoteZone）は作業記憶。自動的に収集データにならない。収集は学生の明示的選択。
- **Educational rationale**：途中の思考を守りつつ、「残す価値がある」という判断自体を学びにする。
- **Alternatives considered**：メモを自動的に収集データ化（不採用：判断の学びを奪う／事実と雑記が混ざる）。
- **Risks**：メモと収集の二段階が手間に感じられる可能性。
- **Validation plan**：学生がメモから意図的に収集するか。転記が減るか。混同が起きないか。
- **Status**：Adopted

---

## DL-004

- **Decision**：すべての出所で統一収集モデルを採用する。
- **Date**：2026-07-12
- **Context**：出所ごとに収集の仕組みが違うと、学習と実装が複雑になる。
- **Decision details**：患者会話・診療録・看護記録・フローシート・処方・検査・生活歴・OT・PSW・学生観察・一時メモを、同じ「収集」概念で扱う。
- **Educational rationale**：収集という教育的行為を一貫させ、出所横断で患者理解を組み立てられる。
- **Alternatives considered**：出所別の個別UI（不採用：概念が分裂する）。
- **Risks**：出所固有のメタデータ（recordId等）を一般化する設計負荷。
- **Validation plan**：どの出所からも同じ操作で収集できるか。出所・時刻・参照が保持されるか。
- **Status**：Adopted（`docs/06` §7）

---

## DL-005

- **Decision**：様式は思考の出力であり、出発点ではない。
- **Date**：2026-07-12
- **Context**：様式を先に埋める学習は、思考を後回しにする。
- **Decision details**：様式2・様式3・関連図は、整理・手がかりの後に表現する。引用可・直接入力可だが解釈判断は学生が行う。
- **Educational rationale**：「考えを導いた結果、様式が完成する」を体現する。
- **Alternatives considered**：様式テンプレート先行入力（不採用：思考の代行になりやすい）。
- **Risks**：様式提出が目的化する外圧。
- **Validation plan**：様式が整理・手がかりから生成されるか。転記が減るか。解釈が学生のものか。
- **Status**：Adopted

---

## DL-006

- **Decision**：Clinical Thinking Workspace（情報整理ノート）は3領域構成とする。
- **Date**：2026-07-12
- **Context**：収集データを見渡し、視点別に整理し、手がかりを考える空間が必要。
- **Decision details**：左＝収集したデータ、右＝視点別の情報整理、下＝手がかり領域。iPad 横画面を主対象。
- **Educational rationale**：事実（左）と解釈（下）を空間的に分離し、整理（右）を中心に据える。
- **Alternatives considered**：単一リスト＋モーダル編集（不採用：比較・整理がしにくい）。
- **Risks**：狭い画面での3領域圧縮。
- **Validation plan**：iPad 横で3領域が収まるか。学生が左→右→下の流れで思考するか。
- **Status**：Adopted（Sprint12.1 で骨格実装）

---

## DL-007

- **Decision**：収集は、単なる保存ではなく教育的判断である。
- **Date**：2026-07-12
- **Context**：何を残すかの判断自体が患者理解の学びである。
- **Decision details**：「患者理解のために残す価値がある」と学生が判断したデータを保存する行為として収集を定義。
- **Educational rationale**：選別の思考を保持する（自動収集はこの学びを奪う）。
- **Alternatives considered**：全件自動収集（不採用）。
- **Risks**：収集操作の負担感。
- **Validation plan**：学生が取捨選択しているか。収集件数と患者理解の質の関係。
- **Status**：Adopted

---

## DL-008

- **Decision**：元の根拠は不変とし、保存表示内容は修正可能とする。
- **Date**：2026-07-12
- **Context**：原文は証拠として保持しつつ、一覧の見やすさのために表示は整えたい。
- **Decision details**：原文（original text）・出所は書き換えない。学生が整える保存表示内容（saved content）は後から修正できる。
- **Educational rationale**：証拠の信頼性を保ちながら、整理の主体性を学生に残す。
- **Alternatives considered**：原文を直接編集可能にする（不採用：証拠が失われる）。
- **Risks**：原文と表示内容の乖離が混乱を生む可能性。
- **Validation plan**：原文へ常に戻れるか。表示修正が誤解を生まないか。
- **Status**：Adopted

---

## DL-009

- **Decision**：同一データは複数の患者理解の視点を支えてよい。
- **Date**：2026-07-12
- **Context**：一つの事実が複数のテーマに関係することは臨床的に自然。
- **Decision details**：データはコピーせず、参照として複数の視点（情報）から用いる。
- **Educational rationale**：多面的な患者理解を促し、重複入力を避ける。
- **Alternatives considered**：1データ1テーマ固定（不採用：現実に合わない）。
- **Risks**：参照関係の理解・UI の複雑化。
- **Validation plan**：学生が同一データを複数視点で扱えるか。重複コピーが生じないか。
- **Status**：Adopted（`docs/03` §3）

---

## DL-010

- **Decision**：Coach は必要時のみ介入し、自然な思考を中断しない。
- **Date**：2026-07-12
- **Context**：常時介入は思考の「間」を奪う。
- **Decision details**：学生が求めたとき／停滞したとき／話題が一区切りしたとき／重要な未完了テーマが忘れられそうなときに限り介入。強制的な話題復帰はしない。
- **Educational rationale**：自立的思考の機会を守る（Charter Coach 原則）。
- **Alternatives considered**：毎ターン助言（不採用：思考中断）。
- **Risks**：介入不足で学生が行き詰まる可能性。
- **Validation plan**：成功ターン後に idle を維持するか。停滞時に適切に介入するか。
- **Status**：Adopted（Sprint10.8B/10.8C で実装・検証済み）

---

## DL-011

- **Decision**：転記は減らすが、解釈の作業は保持する。
- **Date**：2026-07-12
- **Context**：繰り返しの書き写しは学びが薄く、負担が大きい。
- **Decision details**：収集済みデータ・情報の引用で転記を減らす。ただし解釈・判断は自動化せず学生が行う。
- **Educational rationale**：認知資源を思考へ振り向ける（原則4・15）。
- **Alternatives considered**：AI による要約・自動転記（不採用：思考の肩代わり）。
- **Risks**：引用が「考えずに貼る」に堕す可能性。
- **Validation plan**：転記量が減るか。解釈が依然学生のものか。
- **Status**：Adopted

---

## DL-012

- **Decision**：Version1 の用語は教育仮説であり、使用テスト後に見直しうる。
- **Date**：2026-07-12
- **Context**：「データ／情報／手がかり」等の語が現場で自然かは未検証。
- **Decision details**：名称・区分・操作は、学生・教員の使用エビデンスに基づき見直しうる。利便性だけでは変更しない。
- **Educational rationale**：理念を守りつつ、教育適合性を実証的に高める。
- **Alternatives considered**：用語を最初から固定（不採用：検証機会を失う）。
- **Risks**：用語変更による混乱・ドキュメント整合コスト。
- **Validation plan**：学生が用語を理解するか。教員が区別を有用と感じるか。事実と解釈の混同が起きないか。患者理解の議論が増えるか。
- **Status**：Adopted（Educational hypothesis）

---

## DL-013

- **Decision**：Sprint2 の技術的負債（会話エントリID衝突・Server Action 例外未処理）と対応方針を記録し、会話全文は永続化せず Evidence を正学習データとする構造を維持する。
- **Date**：2026-07-17
- **Context**：Sprint1（Patient Workspace 統合）完了レビューで、会話の非永続に起因する Evidence 収集の識別子衝突（TD-001）と、Server Action の throw 未処理による保存状態固定（TD-002）が判明した。
- **Decision details**：
  - 会話全文の Supabase 保存は行わない。「会話 → Evidence 収集 → Evidence のみ永続化」を維持（会話は学習インタラクション、Evidence が正式な学習データ）。
  - TD-001 は会話全文保存では解決せず、`source_reference` の識別子設計見直し（発話UUID／セッションID＋連番／content hash の比較）で対応。詳細は `docs/version2/07_evidence_source_reference.md`。
  - TD-002 は Evidence・Form2 で共通の例外処理方針へ統一（try/catch・inFlight 解除・status 更新・エラー表示・リトライ可）。Form2 専用の下書き保存/自動再試行は Evidence へ移植しない（Evidence は手動再試行で十分）。
  - Compass Coach は Question/Reflection/Evidence を読んでよいが、それらや Patient Story を書くことは禁止（問い・方向づけ・気づきのみ）。
  - Sprint2 優先順位：①例外処理共通化 ②Evidence sourceReference 見直し ③Question ④Reflection ⑤Story Workspace ⑥Patient Story。基盤品質を Story Workspace より優先。
- **Educational rationale**：Evidence（事実）を学習データの正とし、揮発的な会話に依存しない識別を採ることで、根拠に紐づく患者理解プロセスの一貫性を保つ。Coach の生成禁止制約は「思考を代替しない」理念を守る。
- **Alternatives considered**：会話全文の永続化による ID 安定化（不採用：会話は学習データではない／プライバシー・データ量の負担）。例外の握り潰し（不採用：保存不能状態の固定を招く）。
- **Risks**：sourceReference 方式変更の設計コスト、例外処理統一のリグレッション。実装前に設計書で比較・確定する。
- **Validation plan**：別セッションで別発言が正しく収集できるか／同一事実の二重収集が適切に扱われるか／通信断で working・saving に固定されず error 復帰できるか／Coach が生成物を書かないか（`scripts/validate-coach-behavior.ts`）。
- **Status**：Recorded（Sprint2 Technical Debt。詳細は `docs/version2/06_sprint2_technical_debt.md`・`07_evidence_source_reference.md`。実装は Sprint2）

---

## 検証質問（共通の目安）

各判断・機能について、次を問う：

- 学生はその用語を理解するか？
- 教員はその区別を有用と感じるか？
- その機能は転記を減らすか？
- 患者理解に関する議論を増やすか？
- 事実と解釈の混同を生まないか？

---

## 関連ドキュメント

- `docs/06_Compass_Educational_Model_V1.md` — 教育モデル（公式基盤・Freeze）
- `docs/07_Glossary.md` — 用語集
- `docs/08_Design_Principles.md` — 設計原則・設計テスト・レビュー層
- `docs/version2/06_sprint2_technical_debt.md` — Sprint2 Technical Debt（TD-001 / TD-002・DL-013 詳細）
- `docs/version2/07_evidence_source_reference.md` — Evidence sourceReference 改善設計
