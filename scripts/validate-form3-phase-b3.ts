/**
 * Form3 Phase B3 — Information Card UI / ops 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b3.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEmptyForm3V2 } from "../lib/form3/v2/form3V2Factory";
import {
  addForm3InformationCard,
  archiveForm3InformationCard,
  listForm3InformationCards,
  moveForm3InformationCard,
  unarchiveForm3InformationCard,
  updateForm3InformationCard,
} from "../lib/form3/v2/form3V2InformationOps";
import { getForm3PhaseBPersistLabel } from "../components/v2/form3/form3PhaseBLabels";
import { FEATURE_FLAGS } from "../lib/featureFlags";

type Check = { name: string; ok: boolean };
const checks: Check[] = [];

function check(name: string, ok: boolean) {
  checks.push({ name, ok });
}

const PATIENT = "A";
const NOW = "2026-08-17T00:00:00.000Z";

{
  let data = createEmptyForm3V2(PATIENT);
  check("empty list", listForm3InformationCards(data).length === 0);

  data = addForm3InformationCard(data, { now: NOW });
  check("add card", data.informationCards.length === 1);
  const id1 = data.informationCards[0]!.id;

  data = updateForm3InformationCard(
    data,
    id1,
    {
      content: "食欲が落ちている",
      soType: "S",
      sourceType: "patient_conversation",
      patternKeys: ["nutritional_metabolic", "activity_exercise"],
    },
    { now: NOW },
  );
  const c1 = data.informationCards[0]!;
  check("edit content", c1.content === "食欲が落ちている");
  check("edit S/O", c1.soType === "S");
  check("edit source", c1.sourceType === "patient_conversation");
  check("pattern multi", c1.patternKeys.length === 2);

  data = addForm3InformationCard(data, { now: NOW });
  const id2 = data.informationCards[1]!.id;
  data = updateForm3InformationCard(data, id2, { content: "体重減少" }, { now: NOW });
  data = moveForm3InformationCard(data, id2, "up");
  check(
    "reorder",
    data.informationCards[0]!.id === id2 &&
      data.informationCards[0]!.order === 0 &&
      data.informationCards[1]!.order === 1,
  );

  data = archiveForm3InformationCard(data, id2, { now: NOW });
  check(
    "archive hides from default list",
    listForm3InformationCards(data).length === 1 &&
      listForm3InformationCards(data, { includeArchived: true }).length === 2,
  );
  data = unarchiveForm3InformationCard(data, id2, { now: NOW });
  check(
    "unarchive",
    listForm3InformationCards(data).some((c) => c.id === id2),
  );
}

{
  check(
    "Draft label",
    getForm3PhaseBPersistLabel({
      dirty: true,
      saveStatus: "dirty",
      hydrated: true,
      hasPersistedV2: false,
    }).label === "Draft",
  );
  check(
    "Saving label",
    getForm3PhaseBPersistLabel({
      dirty: false,
      saveStatus: "saving",
      hydrated: true,
      hasPersistedV2: true,
    }).label === "Saving",
  );
  check(
    "Saved only when persisted + clean",
    getForm3PhaseBPersistLabel({
      dirty: false,
      saveStatus: "idle",
      hydrated: true,
      hasPersistedV2: true,
    }).label === "Saved",
  );
  check(
    "memory hydrate only → Ready (not Saved)",
    getForm3PhaseBPersistLabel({
      dirty: false,
      saveStatus: "idle",
      hydrated: true,
      hasPersistedV2: false,
    }).label === "Ready",
  );
  check(
    "error → Save failed",
    getForm3PhaseBPersistLabel({
      dirty: false,
      saveStatus: "error",
      hydrated: true,
      hasPersistedV2: true,
    }).label === "Save failed",
  );
  check(
    "dirty persisted → Draft not Saved",
    getForm3PhaseBPersistLabel({
      dirty: true,
      saveStatus: "dirty",
      hydrated: true,
      hasPersistedV2: true,
    }).label === "Draft",
  );
}

{
  const root = process.cwd();
  const ws = readFileSync(
    join(root, "components/v2/form3/Form3PhaseBWorkspace.tsx"),
    "utf8",
  );
  const host = readFileSync(
    join(root, "components/v2/learning/workspace/WorkspaceHost.tsx"),
    "utf8",
  );
  check(
    "Workspace が markUserEditedV2 を使う",
    ws.includes("markUserEditedV2"),
  );
  check(
    "Workspace が saveNowV2 を呼ばない",
    !/\bsaveNowV2\s*\(/.test(ws) && !/\bsaveNowV2\s*,/.test(ws) && !/\bsaveNowV2\s*\}/.test(ws),
  );
  check(
    "Workspace が hasPersistedV2 をラベルに渡す",
    ws.includes("hasPersistedV2"),
  );
  check(
    "Workspace が AutosaveReason を渡す",
    ws.includes("information_added") && ws.includes("information_updated"),
  );
  check(
    "WorkspaceHost が Form3PhaseBWorkspace を使う",
    host.includes("Form3PhaseBWorkspace"),
  );
  check(
    "Assessment UI を入れない",
    !ws.includes("AssessmentCard") && !ws.includes("Form3Assessment"),
  );
  check("FEATURE_FLAGS.form3PhaseB false", FEATURE_FLAGS.form3PhaseB === false);
}

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? "OK  " : "FAIL"} ${c.name}`);
}
console.log(
  `\n===== form3 Phase B3: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
);
process.exit(failed.length === 0 ? 0 : 1);
