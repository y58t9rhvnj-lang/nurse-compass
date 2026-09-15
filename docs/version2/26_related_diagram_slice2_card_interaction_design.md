# Nurse Compass V2.2 Related Diagram — Slice 2
## Card Interaction / Position Persistence Design

**Status:** Slice 2A implemented (card interaction + incremental route hardening). Slice 2B not started.  
**Parent specs:**  
- `24_related_diagram_v1_integrated_spec_frozen.md` (education meaning Frozen)  
- `25_related_diagram_v1_implementation_design.md` (implementation design; Slice 0 / Slice 1 Frozen)  
**Slice 1 Frozen commit:** `6b3360bfa5878de9aa33c091e165240b79a492bd`  
(`6b3360b` — `feat(v2.2): add related diagram read-only A3 canvas`)  
**Rule:** Slice 1 Frozen UI / routing / topology / visual を破壊しない。本書は Slice 2 の interaction / persistence だけを定義する。  
**Slice 2B is not authorized by this document.**

---

# 1. Slice 2 scope

## 1.1 Name

Card Interaction / Position Persistence

## 1.2 Purpose

Slice 1 の Read-only A3 Canvas を、学生が Card を選び、1本指で移動し、その位置を draft に保存できる Canvas へ拡張する。

成立させるもの：

1. Card selection
2. 1本指 Card drag
3. 2本指 Canvas pan / pinch との排他（gesture arbitration）
4. A3 logical position の persistence
5. reload 後の位置復元
6. Card 移動後の route 再計算
7. Slice 1 topology 原則の維持

## 1.3 What Slice 2 is not

Slice 2 は「本番学生が関連図を完成させる Slice」ではない。

関連図作成の全体（Form3 分解、Connection 作成、看護問題、提出、AI）は後続 Slice。

## 1.4 Production vs DEV

現時点の production student scene には Knowledge 以外の可動 Card がまだ存在しない。

| 経路 | Slice 2 の役割 |
|---|---|
| **Production** | Knowledge binding + student draft の get-or-create / layout persistence 基盤を接続する。可動 Card が 0 件でも正常。 |
| **DEV** | unlock した非 Knowledge Card で selection / drag / save / reload を実証する。 |

Form3 からの Card 生成は後続 Slice。DEV 専用の別 interaction 実装は禁止。同じ state machine / persistence / routing を使う。

Knowledge fixture fallback は禁止（Slice 1 どおり）。

---

# 2. Gesture state machine

iPad Safari を最優先する。Slice 1 で PASS した 2本指 pan / pinch は壊さない。

## 2.1 Input mapping

| 入力 | 対象 | 結果 |
|---|---|---|
| 1本指 | movable Card | select →（閾値超過で）drag |
| 1本指 | Knowledge Card | select / individual drag（semantic は lock） |
| 1本指 | 空白 Canvas | no-op（Slice 1 維持） |
| 2本指 | Canvas 上（Card 上を含む） | Canvas pan + pinch |
| mouse | movable Card | select / drag |
| mouse | 空白 Canvas | Canvas pan（Slice 1 desktop 維持） |

Card と Canvas は同時に動かさない。

## 2.2 States

```text
IDLE
  ├─ touch 1本 / movable Card pointerdown     → CARD_SELECTED
  ├─ touch 1本 / Knowledge or locked Card     → CARD_SELECTED（drag へ進まない）
  ├─ touch 1本 / 空白                         → IDLE（no-op）
  ├─ touch 2本 / どこでも                     → VIEWPORT_GESTURE
  ├─ mouse / movable Card                     → CARD_SELECTED
  ├─ mouse / Knowledge or locked Card         → CARD_SELECTED
  └─ mouse / 空白                             → VIEWPORT_PAN（Slice 1 desktop）

CARD_SELECTED
  ├─ 同一 pointer が移動閾値超過              → CARD_DRAGGING（movable のみ）
  ├─ pointerup（閾値未満）                    → 選択維持
  ├─ 空白 tap / 他 Card tap / Escape          → IDLE or 他 Card の CARD_SELECTED
  └─ 2本目 touch 検出                         → VIEWPORT_GESTURE（§3）

CARD_DRAGGING
  ├─ pointermove                              → 当該 Card の logical x/y のみ更新
  ├─ pointerup / pointercancel                → DROP（§7.3）
  └─ 2本目 touch                              → local commit → VIEWPORT_GESTURE（§3）

VIEWPORT_GESTURE
  └─ 指が 0 本になるまで Card 操作禁止
     終了後：選択は維持してよい。新たな Card drag は開始しない。
```

`VIEWPORT_PAN`（desktop mouse）は Slice 1 の mouse-drag pan と同じ。Card 上では開始しない（§20）。

## 2.3 Tap / drag threshold

候補: **6〜8 CSS px**（viewport / screen px。logical px ではない）。

- 閾値未満の pointerup → tap（選択のみ）
- 閾値超過 → `CARD_DRAGGING`

正確な定数は実装時に 1 箇所へ置く。iPad の指ぶれで tap が drag に化けないこと、短い drag が tap 扱いされないことの両方を DEV で確認する。

## 2.4 Native gesture suppression on Card

Card 上では次を抑止する。

- Safari / iOS の text selection
- image / element の native drag
- 1本指の browser scroll（`touch-action: none`）

viewport の 2本指 pinch と Safari `gesture*` の `preventDefault` は Slice 1 のまま。

---

# 3. 1→2 finger handoff

## 3.1 Adopted policy

Card drag 中に 2本目 touch を検出したら：

1. その時点の **合法 Card 位置を local commit**（開始位置へ revert しない）
2. Card の pointer capture を解除する
3. Card tracking を即停止する（以降 Δ を Card に足さない）
4. 排他的に `VIEWPORT_GESTURE` へ handoff する

Card と Canvas の同時操作は禁止。

## 3.2 Why commit, not revert

| 方式 | 判定 |
|---|---|
| **Local commit + handoff（採用）** | 置いてから拡大したい操作を失わない。Card は飛ばない。 |
| Revert to drag-start | 「動いたのに戻る」がバグに見える。学習中の位置を失う。 |
| Both continue | Card が指に付いて飛ぶ / 二重移動。**禁止** |

安全性の本質は「2本目検出と同時に Card へ pointer delta を適用しない」こと。revert しなくてもこの条件を満たせる。

## 3.3 Persist timing on handoff

- pointermove ごと、および 2本目検出そのものでは DB write しない
- local commit した位置は dirty 候補
- persist は Card drag セッション終了後（残 pointer が全て up、または §13 の debounce）にまとめる

---

# 4. Coordinate conversion

## 4.1 Official A3 logical size

コード上の正（`lib/v2/relatedDiagram/a3Canvas.ts`）：

```text
A3_WIDTH_MM  = 420
A3_HEIGHT_MM = 297
A3_PX_PER_MM = 96 / 25.4
A3_WIDTH_PX  = Math.round(420 * 96 / 25.4) = 1587
A3_HEIGHT_PX = Math.round(297 * 96 / 25.4) = 1122
A3_BODY_PT   = 10.5
```

Card position は **A3 logical px**。screen / client 座標では保持しない。

## 4.2 Viewport is not document position

`useA3Viewport` の `{ scale, x, y }` は画面の見え方だけ。

- persist しない（Slice 1 どおり）
- Card `layout.x/y` に混ぜない

## 4.3 Conversion

Slice 1 `a3ViewportGesture.ts` と同じ式を再利用する。

```text
logicalX = (clientX - viewportLeft - translateX) / scale
logicalY = (clientY - viewportTop  - translateY) / scale

ΔlogicalX = ΔclientX / scale
ΔlogicalY = ΔclientY / scale
```

`viewportLeft/Top` は viewport 要素の `getBoundingClientRect()`。  
`translateX/Y` は transform の `x/y`。  
`scale` は現在の viewport scale。

zoom 52% 前後 / 100% / pinch 後でも、同じ指の物理移動は同じ logical 移動になる。

---

# 5. Selection model

## 5.1 Rules

- movable Card tap → selected
- Knowledge Card → 選択可、layout drag 可（semantic lock）
- locked 非 Knowledge Card → 選択可能、drag 不可（将来の system lock 用）
- 空白 Canvas tap → deselect
- 別 Card tap → その Card を selected（単一選択）
- Escape → deselect（desktop 最低限）

Slice 2 は単一選択。複数選択・囲み選択は後続。

## 5.2 Selection visual

最小限。Card の semantic visual を壊さない。

壊してはいけないもの：

- current の solid border
- potential の dashed border
- Nursing Problem visual（二重線は廃止済み。これを復活させない）
- Knowledge「病態」label

採用候補：

- **subtle outer focus ring**（semantic border の外側）
- 必要なら小さな selection handle（必須ではない）

禁止：

- 青色を semantic color として復活させる
- selection を破線にして potential に見せる
- selection で borderStyle / borderWidth を current/potential の意味に変える

色は monochrome（例: `#8E8E93` 系の薄い outer ring / box-shadow）。正確な px は実装時に Slice 1 の border と重ならないよう決める。

---

# 6. Movable policy

## 6.1 Decision (updated after iPad feedback)

**Knowledge は semantic locked / layout movable。**

```text
isCardSemanticLocked  = cardType === "knowledge"
                        OR origin === "knowledge_library"

isCardLayoutMovable   = cardType === "knowledge"
                        OR !isLocked
```

`isLocked: true` は fixture / library 上に残す。**完全 drag 禁止の意味では使わない。** DB カラムは増やさない。

変更不可（semantic / membership）:

- text / cardType / state / origin
- connection semantic
- topology membership（group / trunk / branch / connectionIds / sourceEdge / targetEdge）

変更可能（layout）:

- Individual Knowledge Card position
- Knowledge foundation group position（同一 dx/dy の rigid translation）

患者 Card は従来どおり `!isLocked` なら個別 drag。

## 6.2 Two Knowledge move modes

**A. Individual Knowledge Card drag**  
Card 本体を 1本指 / mouse drag。その Card だけ動く。drop 後に `regenerateExplicitTopologyGeometry` で membership を保ったまま geometry を再生成する。fixture builder は drop ごとに呼ばない。相対パラメータは session 開始時に初期 topology + 初期 Card から 1 度だけ capture する。

**B. Knowledge foundation group drag**  
左上 overlay の「病態」handle を drag。全 Knowledge Card と Knowledge topology 点へ同一 dx/dy。再生成は不要。患者 Card / demo topology は動かさない。modifier / 長押しは使わない。

選択 visual:

- individual: 対象 Card の solid gray outer ring
- group: Knowledge bbox の solid gray outline

青・破線は禁止。handle は compact layout を押し下げない overlay。

## 6.3 Educational reason

病態関連図は、教員が置いた固定図を眺める場ではない。学生が

```text
病態 → 症状 → 患者固有情報 → 生活への影響 → 看護上の意味
```

を空間的に再構成できることに教育的価値がある。そのため Knowledge の意味と topology membership は固定し、layout だけ学生が動かせる。

配置の上手さを AI 評価に使ってはならない（§11）。

## 6.4 Persistence (Slice 2B, not now)

teacher-authored default layout は直接上書きしない。student draft 側に Knowledge layout override（と任意の group offset / topology layout override）を持つ。Slice 2A は local state のみ。

---

# 7. Drag lifecycle

## 7.1 Start

1. `pointerdown` on Card → select
2. movable かつ同一 pointer が閾値超過 → `CARD_DRAGGING`
3. drag 開始位置 `{x,y}` を command の `from` として保持

## 7.2 During drag

- **local state のみ**更新。DB write しない
- pointermove は **rAF に間引き**、反映するのは最新座標 1 件
- `Δlogical = Δclient / scale` で当該 Card だけ移動
- 毎 move で A3 hard clamp（§8）
- Legend との一時 overlap は可（§9）
- 他 Card との collision avoidance はしない
- incident connection は軽量 preview のみ（§16）
- Knowledge authored route は変更しない

## 7.3 Drop

順序を固定する。

1. 最終 pointer 位置から logical coordinate を決める
2. A3 hard clamp
3. Legend collision 解決（最短軸 nudge）
4. 再 A3 clamp
5. `moveCard` command 確定 `{cardId, from, to}`（`from === to` なら no-op。dirty にしない）
6. drop 後に 1 回 `planOrthogonalRoutes`
7. dirty
8. debounce save（§13）

2本指 handoff の local commit も 2〜4 を適用してから位置を残す。

---

# 8. Boundary policy

## 8.1 Adopted: hard clamp

Infinite canvas は禁止。

Card **全体**が A3 内に残る。

```text
x ∈ [0, canvasWidth  - cardWidth]
y ∈ [0, canvasHeight - cardHeight]
```

`canvasWidth/Height` は `A3_WIDTH_PX` / `A3_HEIGHT_PX`（1587 × 1122）。  
`cardWidth/Height` は既存 `layout.width/height`（move では変えない）。

## 8.2 Why not soft warning only

iPad 授業では、弾いた Card が画面外に消え、toast を読む余裕がない。「完全に消える」のが最悪。soft warning + drop 時 clamp だけだと drag 中に見失う。

drag 中から hard clamp し、drop 時にも再 clamp する。

rubber-band は任意。Slice 2 の必須ではない。

---

# 9. Legend collision policy

## 9.1 Existing helpers

`lib/v2/relatedDiagram/a3Legend.ts`（Slice 1 が Slice 2 用に用意済み）：

```text
A3_LEGEND_MARGIN_PX  = 14
A3_LEGEND_WIDTH_PX   = 190
A3_LEGEND_HEIGHT_PX  = 204

getA3LegendBounds(canvasWidth, canvasHeight)
rectIntersectsA3Legend(rect, canvasWidth, canvasHeight)
```

Legend は A3 右下固定。semantic graph の一部ではない。動かさない。

## 9.2 Policy

- **drag 中:** 一時 overlap 可。物理エンジンなし
- **drop 時:** `rectIntersectsA3Legend` が true なら、重なりが消えるまで **最短軸**（Δx vs Δy の小さい方）へ nudge
- nudge 後に A3 clamp
- 両方満たせない狭い角は **A3 内を優先**し、できるだけ Legend 外

warning-only（覆ったまま残す）は不採用。V1 では Legend を Card が完全に覆う状態を避ける。

他 Card との回避、経路回避の本格 collision は後続。Slice 2 では Legend reserved rect だけ。

---

# 10. Position data model

## 10.1 Adopted storage

**既存 `related_diagram_records.semantic_graph` JSONB 内の `cards[].layout`。**

```text
RelatedDiagramCard.layout = { x, y, width, height, zIndex }
```

| 案 | 判定 |
|---|---|
| **A. graph 内 layout（採用）** | Slice 0 の型・`upsertCard`・head + JSONB + version に既にある。migration 不要 |
| B. 別 layout JSON カラム | migration 前提。採用しない |
| C. record の別領域 | 新フィールド / 新カラムになりやすい。採用しない |

DB migration は前提にしない。既存 head + JSONB + optimistic `version` で完結する。

## 10.2 Move-only function

`upsertCard` は text / type / state も書く。Slice 2 は **move 専用**を新設する。

```text
draftMoveCardLayout(state, cardId, { x, y }, now?)
```

純関数側（名称は実装時に合わせる）:

```text
moveCardLayout(graph, cardId, { x, y }, now?)
```

規則：

- 対象が無ければ失敗
- `isLocked` または `cardType === "knowledge"` なら失敗
- `x/y` のみ更新
- `width` / `height` / `zIndex` は変更しない
- `text` / `cardType` / `state` / `origin` は変更しない
- `updatedAt` のみ更新してよい
- connections / nursingProblems 等は触らない

persist は既存 `updateRelatedDiagramWithVersion`（`expectedVersion` 一致で `version + 1`）。

## 10.3 Viewport

viewport `{scale, x, y}` は record に書かない。

---

# 11. Semantic vs layout

`layout` が semantic graph JSON の中にあっても、**臨床推論上の意味ではない。**

JSON 同居は persistence 都合（Slice 0）。意味の同居ではない。

## 11.1 Excluded from AI / reasoning evaluation

次を AI Coach / AI evaluation / reasoning evaluation の評価対象から除外する。

- `layout.x`
- `layout.y`
- `layout.width`
- `layout.height`
- `layout.zIndex`
- visual route geometry（polyline 点、trunk 座標、bridge 位置、Independent Crossing 位置）
- viewport scale / translate
- selection / drag の一時状態

## 11.2 Evaluated later (not Slice 2)

- Card semantic（type / text / state / origin / sources）
- Connection semantic（relation type / endpoints の意味）
- reasoning continuity

**「配置が綺麗だから高評価」は禁止。**  
Slice 2 は評価パイプラインを実装しない。後続がこの原則を破らないための拘束である。

`rd.routeTopology.v1` は今どおり semantic graph の外（spec 25）。AI 評価に使わない。

---

# 12. Draft load / get-or-create

## 12.1 Slice 1 path stays

`loadRelatedDiagramReadonlySceneAction` と `RelatedDiagramReadonlyWorkspace` の Slice 1 契約を維持する。

- published Knowledge binding → foundation only
- 未設定 → 既存 empty
- load error → 既存 error
- development fixture / style-demo を production fallback にしない

## 12.2 Slice 2 edit path

編集用に **draft get-or-create** を追加する。Slice 1 readonly action を「保存付き」に変えない。

既存 repository（Slice 0）:

- `getRelatedDiagram`
- `insertRelatedDiagram`
- `updateRelatedDiagramWithVersion`

新規 action はこれらを呼ぶ（migration なし）。

## 12.3 Scene composition (production)

```text
published Knowledge binding
  → Knowledge cards/connections（isLocked、teacher layout が正）
student related_diagram_records draft
  → student-owned cards / connections / NP 等
  → Knowledge layout の学生上書きは採用しない
```

合成規則：

1. Knowledge 未設定 → Slice 1 と同じ empty。draft を作って fixture を入れない
2. Knowledge あり + draft なし → insert 空 graph（または student 部分が空の graph）、version 1
3. Knowledge あり + draft あり → Knowledge foundation を overlay し、draft の非 Knowledge を載せる
4. draft 内に Knowledge card があっても **表示位置は binding / library**。学生 draft の Knowledge `layout` は Slice 2 では採用しない
5. load error → 既存 error。silent fixture なし

## 12.4 Production readiness with zero movable cards

Form3 分解前は可動 Card 0 件でよい。selection / empty drag 対象なし / save 経路は生きている。後続 Slice で Card が増えたら同じ interaction が動く。

---

# 13. Save lifecycle

## 13.1 Adopted autosave

Form2（600–1000ms）/ Form3（1000ms、dirty / conflict）に寄せる。Card 移動は離散操作なので **やや短く**する。

```text
drag 中     → local only
drop        → dirty
400–600ms debounce → updateRelatedDiagramWithVersion
```

短時間に複数 Card を動かしたら **まとめて 1 version update** してよい。

`from === to`（実質未移動）は dirty にしない。

## 13.2 Flush

次では debounce を待たず flush する。

- workspace unmount
- 必要な navigation（事例切替など）
- 印刷直前（位置が print に載るため）

## 13.3 What is written

1 回の save は **その時点の student graph**（layout 更新済み）を `semantic_graph` に書く。

- Knowledge foundation を student graph に複製して Knowledge `x/y` を学生値で上書きしない
- viewport を書かない
- 仮 route / drag preview を書かない
- topology を Slice 2 で新規作成・改変しない

---

# 14. Error / retry

## 14.1 Network / server failure

- Card を drag 開始位置へ **revert しない**
- local dirty を保持
- retry 可能
- 小さめの unsaved indication のみ

Toolbar（Slice 1 Frozen）を大きなステータスバーへ拡張しない。既存ノートの保存失敗表示に寄せる。正確な置き場は実装時に Toolbar を壊さない範囲で決める。

viewport は保存対象外なので、失敗しても pan/zoom を巻き戻さない。

## 14.2 Optimistic lock conflict

silent unconditional merge は禁止（Form3 / spec 25 と同じ）。

conflict（`expectedVersion` 不一致で 0 row）時：

1. server 最新 draft を取得する
2. move 対象 Card を確認する
3. Card が存在する
4. 引き続き movable（`!isLocked && cardType !== "knowledge"`）
5. その Card の semantic（text / type / state / origin）が local の意図と競合していない

**上記をすべて満たす場合のみ**、move intent `{cardId, from, to}` を最新 server graph へ **layout-only rebase** し、**1 回だけ** retry する。

rebase しない（conflict UI）:

- Card 削除
- Card lock
- Card type 変更
- その他 semantic conflict
- **2 回目の conflict**

複数タブで同じ Card を別位置へ動かした場合: 条件 5 を「layout 以外が同じなら rebase」とし、後着の `to` を採用してよい。これは layout-only であり semantic merge ではない。text が食い違うなら rebase しない。

---

# 15. Routing lifecycle

## 15.1 During drag

毎 pointermove の full `planOrthogonalRoutes` は禁止。

採用:

- 移動 Card に **incident する Connection だけ**
- rAF 単位
- 軽量な temporary orthogonal preview
  - simple L
  - simple HV / VH
  - endpoint-following orthogonal

禁止（drag 中）:

- full graph routing
- full Independent Crossing detection
- bridge 再計算
- Junction 生成
- Knowledge authored route の変更

仮 route は保存しない。preview は drop で捨て、正式 plan に置き換える。

Knowledge にだけ付く線は、Knowledge が動かないので **描画したままでよい**。

## 15.2 After drop

clamp + Legend nudge の確定座標で **1 回** `planOrthogonalRoutes`。

そのとき再計算するもの:

- student / auto-route（topology に authored が無い connection）
- proper H×V crossing 分類
- Independent Crossing
- semicircle bridge

維持するもの:

- explicit Junction（topology から生成。geometry 推測しない）
- Knowledge authored polyline
- Slice 1 の Connection visual semantics

DEV でデモ Card を動かし、その connection に古い authored 点が残って剥離したら、**その connection だけ** authored を使わず auto-route する。Knowledge の authored は触らない。Junction 集合を「交差したから」増やさない。

---

# 16. Topology preservation

Slice 1 原則を継続する。

```text
Junction は検出しない。生成する。
```

Slice 2 では Connection 作成 / 削除を実装しない。

| 対象 | Slice 2 の扱い |
|---|---|
| Knowledge topology（trunk / branchPoint / routeGroup / authored route） | **immutable** |
| student existing connection（topology 無し） | drop 後 auto-route |
| 「交差したから Junction」 | **追加しない** |
| Independent Crossing / bridge | drop 後の既存分類器に任せる |

geometry からの Junction 推測（頂点一致検出）には戻さない。

---

# 17. Undo / Redo compatibility

Slice 2 では Undo / Redo **UI を実装しない**。

ただし 1 完了 drag を 1 command として扱う。

```text
{
  type: "moveCard",
  cardId: string,
  from: { x: number, y: number },
  to:   { x: number, y: number }
}
```

- pointermove 単位では記録しない
- DROP 確定後（clamp + Legend 解決後）に 1 件
- `from === to` は command にしない
- 今回 stack を持たなくても、`commitMove(from, to)` を save から分離する

後続で stack と逆操作（`to → from`）を足せる。

---

# 18. Desktop minimum support

iPad first。desktop を壊さない最小。

| Slice 2 で入れる | 後続 |
|---|---|
| mouse select | 矢印キー空間移動 |
| mouse Card drag | 本格的 keyboard spatial |
| Card 上 pointerdown では Canvas pan を開始しない | 完全な SR / roving tabindex |
| 空白 Canvas の mouse drag は Slice 1 pan | |
| 空白 click / Escape で deselect | |

`useA3Viewport` の desktop mouse pan は、target が `[data-rd-card-id]` のとき `mousePanRef` を立てない。これが Slice 1 desktop を守る必須 extension。

---

# 19. Performance

iPad Safari 優先。Card 数は増える前提。

1. pointermove → rAF throttle（最新 1 件）
2. 更新するのは active Card 1 枚（`left/top` または `transform`）
3. drag 中 full graph routing 禁止
4. drop 後も full graph routing はしない。affected route だけ incremental update
5. DB save は debounce。move ごと version bump しない
6. viewport 非 persist
7. Knowledge route は drag 中再計算しない
8. ConnectionLayer の「毎 render で full plan」は、drag 中 preview モードで回避する

---

# 20. DEV acceptance

production に可動 Card が無いため、Slice 2 の DEV fixture で非 Knowledge Card を `isLocked: false` にする（追加または変更）。

- Knowledge Card は locked のまま
- Knowledge compact visual / authored topology は Slice 1 のまま
- **fixture 専用の別 drag 実装は禁止**

DEV で最低限確認する:

- select
- drag
- zoom 52% 前後
- 100%
- pinch 後 drag（移動量が scale 補正されている）
- 2本指 handoff（Card が飛ばない、Canvas だけ動く）
- A3 boundary
- Legend collision（完全被覆しない）
- save
- reload restore

実機の最終 PASS はユーザーが判定する。Cursor は実機 PASS を宣言しない。

---

# 21. Production readiness

Slice 2 完成時点の production:

- Knowledge overlay を読む
- empty または既存 student draft を読む
- Form3 分解 Card が無ければ可動 0 件でも正常
- empty / error / no-fixture は Slice 1 と同じ

後続 Slice で学生 Card が追加されたら、同じ movable 判定 / drag / `draftMoveCardLayout` / autosave がそのまま動くこと。

---

# 22. iPad Safari acceptance criteria

最低限:

1. 1本指で Card を選択できる
2. 1本指 drag で Card だけ動く
3. 2本指では Canvas pan / pinch
4. Card と Canvas が同時に動かない
5. 1→2 finger handoff で Card が飛ばない
6. zoom 倍率に関係なく drag 量が正しい
7. Card 位置は A3 logical で保存される
8. reload 後に Card 位置が復元される（DEV draft / 学生 draft）
9. Connection endpoint が Card に追従する（drop 後）
10. drop 後に orthogonal route が再計算される
11. explicit Junction を geometry から推測しない
12. Independent Crossing / semicircle bridge が維持される
13. A3 外へ Card が消えない
14. Legend を完全に覆わない
15. Knowledge Card を drag できない
16. save 失敗時に local dirty を保持し、位置を失わない
17. optimistic lock conflict が silent merge しない
18. Slice 1 gesture regression がない

---

# 23. Tests

## 23.1 Unit (pure functions first)

- client Δ → logical Δ（scale 0.4 / 1 / 1.5 など）
- scale 別 drag 量が `Δclient / scale` になる
- A3 clamp（四辺・四隅）
- Legend nudge（交差 → 非交差、完全被覆にならない）
- interaction state machine 遷移
- second pointer handoff（Card delta 停止、revert しない）
- locked / Knowledge の `moveCardLayout` 拒否
- `draftMoveCardLayout` が x/y 以外を変えない
- layout-only conflict rebase（成功条件と拒否条件）
- drop 後 route: Knowledge authored 不変、移動 Card の endpoint 追従
- Junction を geometry 交差から増やさない

## 23.2 Regression (do not “fix” unrelated FAIL)

- Slice 1 routing
- Slice 1 fixture
- visual
- gesture
- legend
- semantic
- Form2
- Form3 Day3
- Form3 Phase B4 の既知 3 FAIL を確認する（コピー禁止注記等。RD ではない。直さない）
- `tsc --noEmit`

## 23.3 Device

iPad Safari。ユーザーが最終 PASS 判定。Cursor は実機 PASS を宣言しない。

---

# 24. Out of scope

Slice 2 では実装しない。

- Form3 からの Card 分解
- 新規 Card 作成
- Card 削除
- 新しい気づき Card
- Connection 作成
- Connection 削除
- Connection semantic chooser
- Nursing Problem 作成
- Nursing Problem integration action
- priority
- Undo / Redo UI
- submission
- AI Coach
- AI evaluation
- teacher review
- auto-layout
- freehand
- infinite canvas
- Phase 2 rectilinear pathfinder / visibility graph / A*
- Slice 2B
- 他 Card を連鎖的に押し出す collision resolution

---

# 25. Slice 1 Frozen boundary

変更禁止（`6b3360b`）:

- Toolbar の構成と基本配置
- zoom / pinch / pan の基本挙動（1本指空白 no-op、2本指 pan/pinch、desktop 空白 pan）
- A3 logical size（1587 × 1122）
- Legend visual と右下固定
- Connection visual semantics（current solid / potential dashed / treatment thick / NP は current 相当）
- semicircle bridge visual
- Junction 原則（検出しない、生成する）
- Knowledge compact visual
- monochrome design
- NP double-line 廃止
- semantic graph の既存意味

Slice 2 で許す extension の例:

- Card 上の pointer 処理と selection ring
- `useA3Viewport` の Card vs mouse-pan 仲裁、2本指 handoff フック
- draft get-or-create / layout save
- DEV デモ Card の `isLocked: false`（Knowledge は true のまま）
- drag 中の temporary route preview

extension は Frozen 仕様を破壊しないこと。

---

# 26. Implementation file candidates

実装開始は別依頼。候補のみ。

## 26.1 New

- `lib/v2/relatedDiagram/a3PointerMath.ts` — client ↔ logical
- `lib/v2/relatedDiagram/a3CardBoundary.ts` — A3 clamp + Legend nudge
- `lib/v2/relatedDiagram/cardInteractionState.ts` — state machine 純関数
- `components/v2/relatedDiagram/useCardInteraction.ts`
- `app/v2/actions/relatedDiagramDraft.ts` — get-or-create + layout save
- 対応 `*.test.ts`

実ファイル名に `RelatedDiagramA3Canvas` は無い。表面は `RelatedDiagramA3Surface`。

## 26.2 Extend

- `semanticGraph.ts` / `relatedDiagramService.ts` — `moveCardLayout` / `draftMoveCardLayout`
- `RelatedDiagramCardNode.tsx` — selection、pointer、`user-select`
- `useA3Viewport.ts` — Card 上 mouse pan 抑制、handoff
- `RelatedDiagramA3Surface.tsx` — selectedId / interaction を渡す
- `RelatedDiagramConnectionLayer.tsx` — drag 中 preview モード
- DEV fixture — 非 Knowledge の `isLocked: false`
- 編集 workspace（readonly を残すか opt-in）。Slice 1 の empty / error / no-fixture は維持

## 26.3 Do not edit for Slice 2 cosmetics

- bridge SVG の Frozen 形状
- Toolbar レイアウト
- Legend の見た目・文言
- `visualStyle` の NP / connection 規則
- A3 寸法定数
- Form2 / Form3 production 修正

---

# 27. Open questions (do not block the design)

実装時に決めてよい。設計判断は本書で足りる。

1. unsaved indication の正確な DOM 置き場（Toolbar を大きく変えない前提）
2. tap/drag 閾値の最終値（6px vs 8px）
3. drag 中 preview を L にするか HV/VH にするか（どちらも full route ではない）
4. 編集 workspace を readonly と別コンポーネントにするか、同一 WS の mode にするか
5. 複数タブが同じ Card を動かしたときの「後着 `to`」を、衝突 UI なしで 1 回 rebase してよいか（本書は layout-only なら可）

---

# 28. Document history

| Date | Change |
|---|---|
| 2026-09-12 | Slice 2 design approved and written. Implementation not started. |
| 2026-09-12 | Knowledge policy: semantic locked / layout movable. Individual + group drag. |
| 2026-09-12 | Route Stability / Mental Map Preservation. Incremental reroute only. |
| 2026-09-12 | Card Collision Policy. Drop-time nearest legal position. Moved object only. |
| 2026-09-12 | Phase 2 local rectilinear pathfinder. Dynamic edges. Undo/Redo. |

---

# 29. Route Stability / Mental Map Preservation

Card を移動しても、意味的に関係のない route geometry は変更しない。

原則：

- individual move は incremental reroute
- group move は rigid translation（同一 dx/dy、再 plan 禁止）
- full graph reroute は将来の明示的「自動整列」だけ。通常 drag では行わない

## 29.1 Stable route state

semantic topology とは別に、画面上の resolved route geometry を local scene state として持つ。

```text
routeGeometryByConnectionId[connectionId] = {
  points, sourcePin, targetPin, sourceEdge, targetEdge, ...
}
lastValidRoute[connectionId]
```

影響を受けない Connection の points は保持する。再生成しない。normalize しない。candidate を選び直さない。

## 29.2 Affected route set

Card 1 枚の drop 後、最終 legal position を基準に次だけを更新する。

1. moved Card の incident connections
2. moved Card の keep-out と交差する existing routes
3. explicit topology 上の最小 branch / trunk dependency

graph 全 Connection を入れない。

## 29.3 Fan / Branch Point

- fan child 移動: その child leg と endpoint だけ。sibling / trunk / BP は不変
- fan source 移動: source → BP trunk と source endpoint。BP は可能な限り固定
- explicit Branch Point は stable layout object。Card 移動を理由に毎回再計算しない

## 29.4 Endpoint repair

incident route は live pin へ接続する。ただし route 全体を normalize し直さない。最後の 1〜2 segment だけ調整する。

再計算に失敗しても Connection を消さない。lastValidRoute をベースに moved endpoint 区間だけ修正する。

## 29.5 Bridges

変わっていない route 同士の bridge は維持する。変更 route との交差だけで Independent Crossing / bridge を再分類する。Junction membership は不変。

## 29.6 Phase 2 境界

Phase 2 pathfinder は、affected route の endpoint / tail repair だけでは合法 route が作れなかった場合に使う。最初から全 Connection を A* 等へ投げない。

---

# 30. Card Collision Policy

Mental Map Preservation の一部。

原則：

- drag 中は temporary overlap 可
- drop 時は overlap 禁止
- minimum gap `CARD_MIN_GAP = 12` logical px
- moved object のみ移動。他 Card は動かさない
- Knowledge group は rigid body
- nearest legal position
- route update は final legal position 確定後

## 30.1 Drop 解決順

1. raw drag position
2. A3 hard clamp
3. Card-vs-Card collision resolution
4. Legend collision resolution
5. A3 final clamp
6. 再度 Card collision validation
7. final legal position 確定
8. affected route set → endpoint repair → local reroute

## 30.2 Resolution

他 Card は動かさない。moved Card（または Knowledge group bbox）だけを、left / right / up / down の最短合法移動、だめなら近傍探索、それでもだめなら last legal position へ戻す。

selection outline / group handle は collision rect に含めない。Card 本体 layout のみ。

Card gap 12 と route clearance 12 は別概念。

---

# 31. Phase 2 Local Rectilinear Routing

affected route だけを対象にする。full graph reroute には戻らない。

```text
existing route
→ endpoint local repair
→ 合法なら採用
→ 合法でない
→ orthogonal visibility graph + A*
```

## 31.1 Dynamic Edge Attachment

`sourceEdge` / `targetEdge` は semantic ではない。相手 Card が明確に反対側へ移ったときだけ再選択する。hysteresis（1.4）で頻繁な flip を防ぐ。

## 31.2 Pathfinder

直交 visibility graph。node は pin / stub / approach / BP / Card keep-out の辺。edge は障害物なしの水平・垂直。cost は距離 + bend + near-card + crossing。既存 geometry への closeness に stability bonus。

## 31.3 Fan / Branch

- child: BP 固定。BP → child だけ pathfind。sibling deepEqual
- source: BP 固定。source → BP trunk だけ pathfind
- BP を動かすのは合法 trunk が無い場合だけ。membership / id は不変。child は BP 側先頭だけ追従

## 31.4 Validation gate

source/target pin exact、orthogonal、continuous、no zero/dup、unrelated Card 貫通 0、arrow approach ≥ 24、最終 segment が target edge を向くこと。貫通 route は valid として採用しない。

## 31.5 Bridge

routing 後に changed route vs stable だけ再分類。unsafe なら changed route のみ再 pathfind。unrelated bridge は動かさない。

---

# 32. Undo / Redo History

関連図は完成図を一発で作るものではない。学生が配置する → 見直す → 戻す → 別の配置を試す、という試行錯誤を安全に行えることを学習体験として保証する。

- 1 drop = 1 action。pointermove ごとには積まない
- 再計算せず before / after scene fragment を復元する
- 対象: Card 位置、affected route geometry、BP、bridge
- group drag も 1 action（rigid な before/after）
- collision snap 後の after は final legal position
- 上限 50。local memory のみ。reload で消える
- viewport / zoom / pan は undo しない
- Toolbar 右側: ↶ ↷ のあと倍率。iPad 44px。disabled は history 無し
- Cmd/Ctrl+Z、Cmd/Ctrl+Shift+Z（Ctrl+Y）。input/textarea focus 時は発火しない
- Persistence は Slice 2B 以降
