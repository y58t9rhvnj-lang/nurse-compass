# Nurse Compass V2.2 Related Diagram V1
## Implementation Design Spec — UI State / Data Schema / AI Evaluation / Implementation Slices
**Status:** Implementation Design — Slice 0 / Slice 1 Frozen; later slices Draft  
**Parent Spec:** `24_related_diagram_v1_integrated_spec_frozen.md`  
**Rule:** 本書はDesign Frozen V1の教育的意味を変更しない。実装都合で意味を変えない。  
**Slice 1:** Read-only A3 Canvas は実装 Freeze。Slice 2（Card drag / editable topology）は未着手。

---

# 1. 実装方針

Related Diagram V1は、既存のForm2/Form3を壊さず、段階的に実装する。

原則：
1. 先にDBとsemantic modelを固める。
2. Canvasは「表示」より先に「保存・復元」を成立させる。
3. AI評価はdiagram screenshotではなくsemantic graphを評価する。
4. Student CoachとTeacher Evaluationは別pipelineとする。
5. Submission snapshotを最優先で設計する。
6. iPad Safariを主要受入環境とする。
7. 1 Sprintで全機能を実装しない。

---

# 2. Student UI State Machine

## 2.1 Top-level states

```text
LOADING
  ↓
DRAFT_READY
  ├─ PATHOLOGY_VIEW
  ├─ ASSESSMENT_DRAWER
  ├─ CARD_TRAY
  ├─ CANVAS_EDIT
  ├─ NEW_INSIGHT
  ├─ NURSING_PROBLEM_CREATE
  ├─ NURSING_PROBLEM_INTEGRATE
  ├─ COACH
  └─ PRE_SUBMIT_REVIEW
          ↓
      SUBMITTING
          ↓
      SUBMITTED_LOCKED
```

Error states:
```text
LOAD_ERROR
SAVE_ERROR
SUBMIT_ERROR
RECOVERY_REQUIRED
```

---

## 2.2 LOADING

取得対象：
- assignment/cycle
- student related_diagram draft
- assigned knowledge group/version
- Form3 assessments
- Evidence references
- current submission status

完了条件：
- diagram metadata取得
- draft作成 or 復元
- knowledge snapshot取得
- Form3 read-only references取得

---

## 2.3 DRAFT_READY

初期表示：
- A3 landscape canvas
- assigned pathology Knowledge Group

Slice 1 toolbar（確定・1段・transform外・sticky top）：
- 左：Related Diagram / case title
- 右：現在倍率 / 100% / 全体表示 / 印刷

後続 Slice で追加し得るもの（Slice 1 には置かない）：
- Undo / Redo / ＋ / 追加Card / Coach / 提出

Slice 1 はこの状態で **read-only**。編集可能になるのは Slice 2 以降。

---

# 3. Drawer / Modal State

## 3.1 ASSESSMENT_DRAWER

表示内容：
- Form3 Pattern一覧
- Assessmentが存在するPatternのみselectable
- Assessment本文
- Evidence一覧
- 既に作成済みのDiagram Card一覧

操作：
- text selection → 「カードにする」
- ＋カード
- current/potential選択
- 「関連図で使う」

禁止：
- AIによる自動分解
- Assessment本文の自動要約
- recommended card count

---

## 3.2 CARD_TRAY

Sections:
- Assessment由来
- Evidence

各Item:
- text
- source pattern
- state（understandingのみ）
- placed / unplaced
- focus action

Drag:
TRAY_ITEM_DRAGGING
→ CANVAS_DROP
→ CARD_PLACED

配置済みでもTrayから消さない。

---

## 3.3 NEW_INSIGHT

Trigger:
`＋ → 新しい気づき`

Input:
- text
- state current/potential

Create:
- origin = diagram_integration
- current viewport付近に配置
- Canvas上で即編集可能

---

# 4. Canvas Interaction State

## 4.1 Card states

```text
IDLE
SELECTED
DRAGGING
EDITING
CONNECTING
MULTI_SELECTED
```

Card actions:
- tap: SELECTED
- drag: DRAGGING
- double tap: EDITING
- handle drag: CONNECTING
- `…`: menu

Card menu:
- 編集
- state変更（対象Cardのみ）
- 出典
- 削除

Knowledge Card:
- 初期削除不可
- group move可
- individual connection可

---

## 4.2 Connection creation

```text
SOURCE_SELECTED
→ HANDLE_DRAGGING
→ TARGET_HOVER
→ DROP
→ CONNECTION_TYPE_RESOLUTION
→ CREATED
```

Resolution:
- target = Nursing Problem
  → nursing_problem_basis
- source,target both Nursing Problem via explicit integration action
  → nursing_problem_integration
- otherwise
  → default current
  → user can current/potential/treatment変更

---

## 4.3 Connection selection

Selected connection actions:
- relation type変更（normal connection only）
- reverse direction
- delete

Integration connection:
- deleteではなく「統合解除」
- integration structure rollback

---

# 5. Multi-select State

Entry:
persistent `選択`

State:
```text
MULTI_SELECT_ACTIVE
  ├─ patient/understanding cards selected
  │      → 看護問題にする
  └─ nursing problem cards selected
         → 統合して考える
```

Other action:
- まとめて移動
- 選択解除

iPadではShift依存にしない。

---

# 6. Nursing Problem State Machine

## 6.1 Create

```text
SELECT_SUPPORTING_CARDS
→ OPEN_NP_DRAWER
→ ENTER_PROBLEM_TEXT
→ SET_STATE
→ CREATE_NP
→ PLACE_ON_CANVAS
→ STUDENT_CONNECTS_BASIS
```

Persist:
- nursing_problem
- nursing_problem_support

visible basis connectionは自動作成しない。

---

## 6.2 Integrate

```text
SELECT_2PLUS_NP
→ INTEGRATION_MODE
→ ENTER_INTEGRATED_TEXT
→ SET_STATE
→ CREATE_RESULT_NP
→ CREATE_INTEGRATION_RECORD
→ CREATE_INTEGRATION_CONNECTIONS
→ PLACE_RESULT_NP
```

Original NP:
- remain visible
- status = integrated
- badge「統合済み」

Multi-stage integration supported.

---

# 7. Priority State

Eligible:
- final/active Nursing Problem only

Action:
`… → 優先順位`

Rules:
- unique
- assigning existing priority shifts order
- integrated/intermediate NP = null

No required rationale field.

---

# 8. Form3 Update Detection

Compare:
- source assessment updated_at/version
- diagram_card_source source_version

If changed:
show non-blocking notice:
「Form3のAssessmentが更新されています」

Actions:
- Form3を見る
- このまま使う
- Cardを編集
- Cardを追加

No auto-sync.

---

# 9. Autosave / Recovery

## 9.1 Save strategy

Debounced autosave:
- card create/edit/delete
- move
- connection create/edit/delete
- state change
- integration
- priority

Avoid DB write on every pointer move.
Card movement:
- local transient movement
- pointerupでpersist

## 9.2 Recovery

Local recovery cache:
- temporary unsaved UI state only
- server draft remains source of truth after confirmed save

Reload:
1. server draft fetch
2. detect newer local unsaved recovery
3. if conflict:
   - 「未保存の編集があります」
   - 復元 / サーバー版を使用

V1ではsilent mergeしない。

---

# 10. Pre-submit State

Trigger:
`提出`

State:
`PRE_SUBMIT_REVIEW`

Actions:
1. Fit A3
2. validate objective structural errors
3. show Reflection prompts
4. show Form3 / Patient Info / Memo references
5. allow return to edit
6. submit

Blocking errors:
- empty card text
- unresolved connection transaction
- unnamed nursing problem
- invalid integration graph

Non-blocking warning:
- A3 overflow

Never block for:
- few cards
- few connections
- few patterns
- few nursing problems

---

# 11. Submission Transaction

Atomic conceptual flow:

```text
LOCK_DRAFT_VERSION
→ CREATE_DIAGRAM_SNAPSHOT
→ CREATE_FORM3_SNAPSHOT_REFERENCE
→ CREATE_KNOWLEDGE_SNAPSHOT_REFERENCE
→ CREATE_SUBMISSION
→ MARK_SUBMITTED
→ QUEUE_AI_EVALUATION
```

If AI evaluation fails:
submission remains valid.

After submit:
`SUBMITTED_LOCKED`

Teacher reopen:
- creates editable continuation from submitted state
- previous submission snapshot immutable

---

# 12. DB Schema — Recommended V1

## 12.1 related_diagrams

```sql
id uuid pk
organization_id uuid
assignment_id uuid
case_id uuid
student_user_id uuid
status text -- draft/submitted/reopened
canvas_schema_version text
knowledge_group_id uuid
knowledge_version text
created_at timestamptz
updated_at timestamptz
```

Unique recommendation:
`(assignment_id, student_user_id, case_id)` for active draft context.

---

## 12.2 related_diagram_cards

```sql
id uuid pk
diagram_id uuid fk
card_type text
text text
state text null
origin text
x numeric
y numeric
width numeric
height numeric
z_index integer
is_locked boolean default false
created_at timestamptz
updated_at timestamptz
```

Enums/check:
card_type:
- information
- understanding
- knowledge
- nursing_problem

state:
- current
- potential
- null

origin:
- patient_information
- form3_assessment
- diagram_integration
- knowledge_library

---

## 12.3 related_diagram_card_sources

```sql
id uuid pk
diagram_card_id uuid fk
source_type text
source_id uuid/text
source_version text null
source_pattern text null
relation text null
created_at timestamptz
```

Do not require source_id FK across all source types.
Use application-level validation due polymorphic provenance.

---

## 12.4 related_diagram_connections

```sql
id uuid pk
diagram_id uuid fk
source_card_id uuid fk
target_card_id uuid fk
relation_type text
origin text
created_at timestamptz
updated_at timestamptz
```

relation_type:
- current
- potential
- treatment
- nursing_problem_basis
- nursing_problem_integration

origin:
- knowledge_library
- student_diagram
- system_integration

Check:
source != target in V1.

---

## 12.5 related_diagram_nursing_problems

```sql
card_id uuid pk/fk
status text -- active/integrated
priority integer null
created_at timestamptz
updated_at timestamptz
```

Unique partial constraint concept:
priority unique per diagram where priority is not null and status = active.

---

## 12.6 related_diagram_nursing_problem_supports

```sql
nursing_problem_card_id uuid fk
supporting_card_id uuid fk
created_at timestamptz
primary key (nursing_problem_card_id, supporting_card_id)
```

---

## 12.7 related_diagram_integrations

```sql
id uuid pk
diagram_id uuid fk
result_problem_card_id uuid fk
created_at timestamptz
```

---

## 12.8 related_diagram_integration_members

```sql
integration_id uuid fk
source_problem_card_id uuid fk
primary key (integration_id, source_problem_card_id)
```

---

# 13. Knowledge Library Schema

## 13.1 knowledge_groups

```sql
id uuid pk
title text
topic_key text
version text
status text -- draft/reviewed/published/retired
created_by uuid
reviewed_by uuid null
published_at timestamptz null
created_at timestamptz
updated_at timestamptz
```

## 13.2 knowledge_cards

```sql
id uuid pk
knowledge_group_id uuid fk
text text
x numeric
y numeric
width numeric
height numeric
z_index integer
```

## 13.3 knowledge_connections

```sql
id uuid pk
knowledge_group_id uuid fk
source_knowledge_card_id uuid fk
target_knowledge_card_id uuid fk
relation_type text
```

## 13.4 assignment_knowledge_binding

```sql
assignment_id uuid
case_id uuid
knowledge_group_id uuid
knowledge_version text
```

Student entry uses this binding.
No AI auto-selection.

---

# 14. Snapshot Schema Strategy

Recommend JSONB immutable snapshot rather than duplicating every submission row into normalized history tables.

## 14.1 related_diagram_submissions

```sql
id uuid pk
diagram_id uuid
assignment_id uuid
student_user_id uuid
submitted_at timestamptz

diagram_snapshot jsonb
form3_snapshot_ref uuid/text
form3_snapshot jsonb optional
knowledge_snapshot jsonb
semantic_schema_version text

created_at timestamptz
```

Reason:
- evaluation reproducibility
- simpler immutable history
- stable AI payload
- easier future schema migration via semantic_schema_version

Normalized draft + JSONB immutable submission is preferred.

---

# 15. Snapshot Validation

Before submission snapshot:
- all card ids unique
- all connection endpoints exist
- all source references serializable
- all nursing problem card ids exist
- integration result/member ids valid
- no integration cycle
- priority uniqueness
- knowledge version known

Integration graph:
must be DAG in V1.

---

# 16. AI Evaluation Runs

## 16.1 related_diagram_ai_evaluations

```sql
id uuid pk
submission_id uuid fk
evaluation_status text
evaluation_version text
rubric_version text
model_identifier text

level integer null
confidence text null
review_status text null

result_json jsonb
created_at timestamptz
completed_at timestamptz null
error_code text null
error_message text null
```

Never overwrite old evaluation runs.

---

# 17. Teacher Final Evaluation

## 17.1 related_diagram_teacher_reviews

```sql
id uuid pk
submission_id uuid fk
ai_evaluation_id uuid null
teacher_user_id uuid

final_level integer null
decision text -- approved/changed/reopen
review_reason_category text null
comment text null

created_at timestamptz
updated_at timestamptz
```

AI rerun never changes teacher final_level.

---

# 18. AI Evaluation JSON Schema — Logical Contract

Top-level:

```json
{
  "evaluation_status": "completed",
  "level": 3,
  "confidence": "HIGH",
  "review_status": "AUTO_CLEAR",
  "dimension_findings": {},
  "strengths": [],
  "review_points": [],
  "evidence_refs": [],
  "teacher_summary": "",
  "class_analysis_tags": []
}
```

---

## 18.1 dimension_findings

```json
{
  "form3_visualization": {
    "status": "established|partial|weak",
    "summary": "",
    "refs": []
  },
  "cross_pattern_integration": {
    "status": "established|partial|weak",
    "summary": "",
    "refs": []
  },
  "understanding_update": {
    "status": "established|partial|not_observed",
    "summary": "",
    "refs": []
  },
  "nursing_focus": {
    "status": "established|partial|weak|not_applicable",
    "summary": "",
    "refs": []
  }
}
```

Do not independently score 1–5 per dimension in V1.
Avoid pseudo-precision.

---

## 18.2 review_points

```json
{
  "type": "continuity|state|connection|nursing_problem|integration|priority|data",
  "importance": "low|medium|high",
  "card_ids": [],
  "connection_ids": [],
  "form3_refs": [],
  "short_reason": ""
}
```

Rule:
low-importance review point alone does not force REVIEW.

---

## 18.3 evidence_refs

AI explanation must point back to semantic IDs.

Example:
```json
{
  "claim": "睡眠と活動の患者理解が統合されている",
  "card_ids": ["...","..."],
  "connection_ids": ["..."],
  "form3_refs": ["assessment:..."]
}
```

Teacher UI can highlight exact graph area.

---

# 19. AI Level Decision Logic

Not arithmetic.

## Level 1
- meaningful patient structure absent or evaluation shows almost no usable student reasoning.

## Level 2
Required:
- Form3-derived thinking is visualized.
But:
- cross-pattern patient integration is not established.

## Level 3
Required:
- meaningful cross-pattern integration established.
- patient-specific reasoning continuity established.

## Level 4
Required:
- Level 3 conditions
AND
- nursing problems are derived/focused from integrated patient understanding.
- integration/focusing is explainable where used.

## Level 5
Required:
- Level 4 conditions
AND
- evidence of patient-understanding update/reconstruction beyond simple Form3 visualization.
- uncertainty/missing information/new integration may support this.
- new insight card is NOT mandatory.

---

# 20. Review Status Decision Logic

Conceptual:

```text
if evaluation_failed:
  REQUIRED
elif high_uncertainty AND high_impact:
  REQUIRED
elif (medium_uncertainty AND high_impact)
  OR (high_uncertainty AND low_or_medium_impact):
  REVIEW
else:
  AUTO_CLEAR
```

Impact factors:
- reaches nursing problem?
- reaches integrated problem?
- reaches priority 1?
- materially changes Level?
- major patient-information inconsistency?

---

# 21. Coach AI Contract

Separate endpoint/prompt/schema.

Input:
- current semantic graph
- selected card/connection optional
- Form3 refs
- patient info refs
- trigger context

Output:

```json
{
  "question": "",
  "focus_type": "patient_evidence|cross_pattern|state|uncertainty|nursing_problem|integration|priority",
  "refs": []
}
```

Forbidden:
- answer
- generated card text
- generated connection
- nursing problem candidate
- level
- score

---

# 22. Teacher Dashboard Query Model

Per student row:
- student
- submitted_at
- latest ai_level
- latest review_status
- confidence
- short summary
- review_points count
- final_level
- teacher review status

Dashboard aggregates:
- submission count
- level distribution
- AUTO_CLEAR / REVIEW / REQUIRED
- review reason distribution
- AI/teacher change rate
- average review duration where measurable

---

# 23. Implementation Slices

## Slice 0 — Schema foundation
Goal:
semantic modelだけを作る。

Deliver:
- migrations
- RLS
- types
- repository/service
- seed Knowledge Group minimal
- no student UI exposure

Acceptance:
- create/read/update/delete draft semantic graph in test
- no existing Form2/Form3 regression

---

## Slice 1 — Read-only A3 Canvas — **FROZEN**
Goal:
published Knowledge binding または DEV fixture を、編集なしの A3 上に表示する。

Delivered:
- logical A3 canvas（1587 × 1122、本文 10.5pt）
- Toolbar 1段（transform外 / sticky / 倍率・100%・全体表示・印刷）
- pinch zoom / 2本指 pan / fitScale
- Knowledge / Information / Understanding / Nursing Problem Card renderer
- orthogonal Connection renderer + 半円 bridge
- A3-local Legend（顕在・潜在・看護問題 / 顕在・潜在・治療）
- print baseline
- student runtime: Knowledge binding → published group/version。未設定は empty。load error は error。**production fixture fallback なし**
- DEV `/dev/related-diagram-slice1`: schizophrenia fixture + style demo（本番経路から呼ばない）
- explicit route topology（`rd.routeTopology.v1`）
- Knowledge compact（幅146、padding 5×7、左上配置）

No editing. 1 finger card drag は Slice 2 以降。

### Slice 1 route topology
Schema: **`rd.routeTopology.v1`**（`RelatedDiagramRouteTopology`）

layout/routing metadata。semantic graph ではない。AI評価に使わない。

- `ExplicitSharedTrunk`
- `ExplicitBranchPoint`
- `ExplicitRouteGroup`
- `ExplicitConnectionRoute`

### Slice 1 routing pipeline
```text
semantic connections
  → route topology
  → authored / derived orthogonal polyline
  → explicit Junction exclusion（bridge なし）
  → remaining proper H×V internal crossing
  → Independent Crossing
  → deterministic jumper
  → bridge rendering
    （spine gap + 別 SVG 半円 arc。potential は arc のみ solid overlay 可）
```

Junction は検出しない。生成する。
使わない判定：vertex一致 / vertex-on-segment / Card近傍 / same source だけ / geometry coincidence。

### Slice 1 Connection renderer
`resolveConnectionStrokeVisual`：
- current → solid arrow
- potential → dashed arrow
- treatment → thick solid arrow
- nursing_problem_basis → solid arrow（semantic type は保持）
- nursing_problem_integration → solid arrow（semantic type は保持）

**廃止仕様（実装しない）：** double-line / diamond / 青色 Connection。

bridge は共通 renderer。Junction には付けない。

### Slice 1 Knowledge runtime
- DEV fixture のみ explicit topology を持つ
- production/student は Knowledge binding を解決する
- production に schizophrenia fixture fallback なし
- Knowledge 未設定 → empty state
- Slice 1 では student editable topology は実装しない
- Slice 2 以降で student card drag / topology persistence を検討する（今回実装しない）

### Slice 1 viewport
```text
header[data-rd-toolbar]   → transform 外
viewport                  → overflow hidden
canvas transform layer    → translate + scale
A3 logical canvas         → 1587 × 1122
```

---

## Slice 2 — Card placement/edit/autosave
Deliver:
- tray
- drag placement
- move
- edit
- delete
- current/potential
- autosave
- reload recovery

No connections yet.

---

## Slice 3 — Connection editing
Deliver:
- handle connect
- current/potential/treatment
- reverse
- delete
- line rerouting with card move

No AI.

---

## Slice 4 — Form3 provenance integration
Deliver:
- Assessment Drawer
- text selection → card
- Evidence auto-carry
- provenance
- Form3 update notice

This is first educationally meaningful student slice.

---

## Slice 5 — New insight + Nursing Problem
Deliver:
- new insight
- multi-select
- nursing problem create
- support capture
- basis connection behavior
- priority

---

## Slice 6 — Nursing Problem Integration
Deliver:
- multi-select NP
- integrate
- integration graph
- integrated badge
- multi-stage integration
- undo integration

---

## Slice 7 — Submission / Snapshot
Deliver:
- pre-submit review
- structural validation
- immutable snapshot
- submitted lock
- reopen/re-submit

AI still disabled.

---

## Slice 8 — Compass Coach
Deliver:
- manual call
- question-only response
- semantic refs
- no answer generation
- audit minimal

---

## Slice 9 — AI Evaluation
Deliver:
- evaluation payload builder
- structured JSON output
- Level
- confidence
- review_status
- review_points
- versioned run storage
- retry/failure fallback

---

## Slice 10 — Teacher Review
Deliver:
- dashboard
- AI summary
- exact flagged-area highlight
- approve/change/reopen
- student thought filter
- Form3 expansion view

---

## Slice 11 — Batch / Sampling / Class Analysis
Deliver:
- AUTO_CLEAR sampling
- batch approval
- agreement metrics
- class analysis
- teaching feedback

---

# 24. Implementation Order Constraints

Do not:
- AI evaluation before submission snapshot
- Nursing Problem before base Connection semantics
- teacher dashboard before versioned AI run
- Coach and Evaluation in same prompt pipeline
- screenshot-only evaluation
- pathophysiology auto-generation
- arbitrary auto-layout

---

# 25. RLS / Authorization Principles

Student:
- own draft read/write
- own submission read
- submitted snapshot immutable
- Knowledge published/bound read-only
- no AI evaluation internals
- no Review Status/Confidence

Teacher:
- assigned class submissions read
- review write
- reopen action
- knowledge group read
- teacher-authorized Knowledge management separately

Admin:
- broader access according existing Compass role model

Must reuse existing role/organization isolation patterns.
Do not invent parallel auth.

---

# 26. Performance Notes

A3 target density is moderate, not thousands of nodes.

V1 design target:
- tens to low hundreds of cards/connections per diagram
- render semantic graph client-side
- avoid full DB fetch after every edit
- optimistic local UI + debounced persistence
- submission builds stable server-side snapshot

Virtualization not required initially unless real data proves necessary.

---

# 27. Testing Matrix

## Student
- first load
- draft reload
- Form3 source add
- duplicate Evidence
- state change
- connection reverse
- card delete with connections
- Form3 updated
- new insight
- NP create
- NP integrate
- multi-stage integration
- priority reorder
- A3 overflow
- submit
- reload submitted
- reopen/re-submit

## iPad Safari
- drag card
- pinch zoom
- two-finger pan
- text selection → card
- connection handle
- multi-select
- drawer interaction
- rotation
- reload/recovery
- print preview

## AI
- clear Level2
- clear Level3
- clear Level4
- Level5 without new insight card
- ambiguous connection low impact
- ambiguous connection high impact
- failed evaluation
- rerun with new rubric
- teacher overrides AI

---

# 28. First Cursor Handoff Boundary

Slice 0 と Slice 1 は完了し Freeze 済み。次の実装指示は **Slice 2 のみ**（人間が開始を明示したとき）。
最初のhandoff（当時）は Slice 0 のみだった。

最初のhandoffで依頼しないもの：
- Canvas
- AI
- Coach
- Teacher UI
- submission
- nursing problem UX

Slice 0で確認するもの：
1. existing schema inspection
2. naming consistency
3. migration draft
4. RLS compatibility
5. TypeScript types
6. repository/service tests
7. no production destructive changes
8. commit前にdiff report

Design Frozen specを参照させ、
教育的意味を勝手に変更させない。

---

# 29. Slice 0 Cursor Instruction — Draft

```text
Nurse Compass V2.2 Related Diagram V1 の実装準備を開始してください。

重要：
- まだUIは実装しません。
- Production DBへ適用しません。
- AI/Coach/Teacher Reviewも実装しません。
- Design Frozen仕様の意味を変更しません。
- 既存Form2/Form3を変更しないことを優先します。

参照仕様：
- docs/version2/24_related_diagram_v1_integrated_spec_frozen.md
- 本Implementation Design Spec

今回の範囲は Slice 0: Schema foundation のみです。

実施：
1. 現在のSupabase schema / migration / RLS / role設計を調査
2. Related Diagram V1に必要なtable設計を既存命名規則へ合わせて具体化
3. migration SQLを新規作成
4. RLS policyを既存organization / role modelに合わせて作成
5. TypeScript domain typesを追加
6. Draft semantic graphのrepository/service層を追加
7. 最小testを追加
8. 既存Form2/Form3に影響がないことを確認

禁止：
- migration適用
- production変更
- UI実装
- AI実装
- auto-layout
- schema simplificationによるprovenance削除
- Nursing Problem integration履歴の省略
- submission snapshotの実装（今回はschema検討まで）

完了時はcommitせず、以下を報告してください。
- 変更ファイル
- migration概要
- RLS概要
- 既存schemaとの整合
- 懸念点
- test結果
- git diff summary
```

---

# 30. Next Gate

Slice 0 / Slice 1 は通過済み。

**Slice 1 Freeze Gate（達成）:**
- read-only A3 / Toolbar / Legend / zoom-pan
- explicit route topology（Junction 生成、Independent Crossing = bridge）
- Connection visual 簡素化（NP も通常実線。semantic type 保持）
- Knowledge compact + 左上配置
- student binding / empty / error。production fixture fallback なし
- Form2/Form3 非改変
- iPad 実機 PASS

Slice 2 へ進む条件（今回は進まない）:
- 人間が Slice 2 開始を明示する
- Slice 1 Freeze UI を壊さない
- student card drag / topology persistence の設計レビュー後

