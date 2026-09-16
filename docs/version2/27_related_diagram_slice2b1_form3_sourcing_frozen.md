# Nurse Compass V2.2 Related Diagram — Slice 2B-1
## Form3 Card Sourcing Frozen

**Status:** Frozen 2026-09-16 (iPad Safari landscape PASS).  
**Parent:** `24_related_diagram_v1_integrated_spec_frozen.md`, `26_related_diagram_slice2_card_interaction_design.md` (Slice 2A Freeze).  
**Rule:** Form3 / Form2 body unchanged. Slice 2A canvas / drag / collision / routing Frozen. Slice 2B-2 is not authorized by this document.

---

## Information

`form3.informationCards[]` → Information Card. 原文改変なし。AI要約なし。  
Keep: S/O, `patternKeys[]` (tags, not ownership), `sourceExcerpt`.  
Drawer list shows **S / O only**. `patternKeys[]` stay as metadata.  
A tagged Information is visible from each matching pattern tab.  
Duplicate: `form3RecordId + informationId` → one Card on canvas.

## Assessment

`assessmentCards[].interpretation` → student selection → Card Compose → Understanding Card.

- Quote (read-only): `selectedText`
- Card text: `editedText` (`card.text`)
- State: student 顕在=`current` / 潜在=`potential`

Invariant: `selectedText === sourceExcerpt.slice(selectionStart, selectionEnd)`.  
Editing `card.text` must not change `selectedText` / offsets / `sourceExcerpt`.

Keep: `sourceExcerpt`, `assessmentId`, `form3RecordId`, `patternId`, `sourceVersion`, `sourceClassification`, `selectedText`, `selectionStart`, `selectionEnd`.

Duplicate: `form3RecordId + assessmentId + selectionStart + selectionEnd`.  
`editedText` / `state` are not part of identity. Overlapping ranges are allowed.

## State

Form3 classification is an initial hint only, never the final Card state.

- problem → initial current
- risk → initial potential
- strength / functioning_normally / insufficient_information / null → unselected
- student may override (problem→potential, risk→current)
- add disabled until 顕在 / 潜在 is chosen
- AI must not estimate state
- `origin ⊥ state`

## History / source trace

Information add and Assessment add are one history action each.  
Undo / Redo restore the exact Card (id, editedText, state, origin, provenance, offsets, position) without re-Compose.

Information trace: 様式3の情報から追加 / S or O / pattern.  
Assessment trace: 様式3のアセスメントから追加 / pattern / 状態：顕在|潜在.  
「元の様式3を見る」opens the matching Drawer tab, mode, source, and Assessment highlight.
