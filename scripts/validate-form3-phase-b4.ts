/**
 * Form3 Phase B4 — Assessment Card UI / ops 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b4.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEmptyForm3V2 } from "../lib/form3/v2/form3V2Factory";
import {
  addForm3AssessmentCard,
  archiveForm3AssessmentCard,
  listForm3AssessmentCards,
  toggleForm3AssessmentEvidence,
  unarchiveForm3AssessmentCard,
  updateForm3AssessmentCard,
} from "../lib/form3/v2/form3V2AssessmentOps";
import {
  addForm3InformationCard,
  updateForm3InformationCard,
} from "../lib/form3/v2/form3V2InformationOps";
import {
  FORM3_V2_ASSESSMENT_AUTOSAVE_REASONS,
  isForm3V2AutosaveReason,
} from "../lib/form3/v2/form3V2AutosaveReasons";
import {
  applyForm3V2SaveConflict,
  createInitialForm3V2WriteFlags,
  markForm3V2UserEdited,
} from "../lib/form3/v2/form3V2WritePath";
import { createForm3V2AutosaveController } from "../lib/form3/v2/form3V2AutosaveController";
import { getForm3PhaseBPersistLabel } from "../components/v2/form3/form3PhaseBLabels";
import { FEATURE_FLAGS } from "../lib/featureFlags";

type Check = { name: string; ok: boolean };
const checks: Check[] = [];

function check(name: string, ok: boolean) {
  checks.push({ name, ok });
}

const NOW = "2026-08-18T00:00:00.000Z";

async function main() {
{
  let data = createEmptyForm3V2("A");
  check("empty assessments", listForm3AssessmentCards(data).length === 0);

  data = addForm3InformationCard(data, { now: NOW });
  const infoId = data.informationCards[0]!.id;
  data = updateForm3InformationCard(
    data,
    infoId,
    { content: "食欲が落ちている" },
    { now: NOW },
  );

  data = addForm3AssessmentCard(data, { now: NOW });
  check("add assessment", data.assessmentCards.length === 1);
  const assessId = data.assessmentCards[0]!.id;

  data = updateForm3AssessmentCard(
    data,
    assessId,
    {
      interpretation: "低栄養の可能性",
      classification: "problem",
      needMoreInformation: "体重の推移を確認したい",
      patternKey: "nutritional_metabolic",
    },
    { now: NOW },
  );
  let a = data.assessmentCards[0]!;
  check("edit interpretation", a.interpretation === "低栄養の可能性");
  check("classification", a.classification === "problem");
  check("need more", a.needMoreInformation.includes("体重"));

  data = toggleForm3AssessmentEvidence(data, assessId, infoId, { now: NOW });
  a = data.assessmentCards[0]!;
  check("evidence id only", a.evidenceInformationIds.length === 1);
  check("evidence stores id", a.evidenceInformationIds[0] === infoId);
  check(
    "no content copy into assessment",
    a.interpretation === "低栄養の可能性",
  );

  data = updateForm3AssessmentCard(
    data,
    assessId,
    { evidenceInformationIds: [infoId, "missing-id"] },
    { now: NOW },
  );
  check(
    "unknown evidence id dropped",
    data.assessmentCards[0]!.evidenceInformationIds.length === 1,
  );

  data = archiveForm3AssessmentCard(data, assessId, { now: NOW });
  check(
    "archive hides",
    listForm3AssessmentCards(data).length === 0 &&
      listForm3AssessmentCards(data, { includeArchived: true }).length === 1,
  );
  data = unarchiveForm3AssessmentCard(data, assessId, { now: NOW });
  check(
    "unarchive to draft",
    data.assessmentCards[0]!.status === "draft" &&
      listForm3AssessmentCards(data).length === 1,
  );
}

{
  check(
    "Assessment AutosaveReason 4種",
    FORM3_V2_ASSESSMENT_AUTOSAVE_REASONS.length === 4 &&
      FORM3_V2_ASSESSMENT_AUTOSAVE_REASONS.every((r) =>
        isForm3V2AutosaveReason(r),
      ),
  );
}

{
  let flags = markForm3V2UserEdited(
    createInitialForm3V2WriteFlags({ hasPersistedV2: true }),
  ).flags;
  let saveCalls = 0;
  const controller = createForm3V2AutosaveController({
    getGateInput: () => ({
      featureEnabled: true,
      hasUserEdited: flags.hasUserEdited,
      dirty: flags.dirty,
      saveStatus: flags.saveStatus,
      hasConflict: flags.saveStatus === "conflict",
    }),
    saveNowV2: async () => {
      saveCalls++;
      flags = {
        ...flags,
        dirty: false,
        hasPersistedV2: true,
        saveStatus: "saved",
      };
      return { ok: true, kind: "saved" };
    },
    enableTimer: true,
    debounceMs: 20,
  });
  controller.notifyDirty({
    dirty: flags.dirty,
    hasUserEdited: flags.hasUserEdited,
    reason: "assessment_updated",
  });
  check("assessment dirty → pending", controller.getState().pending === true);
  await new Promise((r) => setTimeout(r, 60));
  check("assessment autosave", saveCalls === 1);
  controller.cancel();

  flags = applyForm3V2SaveConflict(
    markForm3V2UserEdited(
      createInitialForm3V2WriteFlags({ hasPersistedV2: true }),
    ).flags,
  );
  const label = getForm3PhaseBPersistLabel({
    dirty: flags.dirty,
    saveStatus: flags.saveStatus,
    hydrated: true,
    hasPersistedV2: true,
  });
  check("conflict → Conflict", label.label === "Conflict" && flags.dirty === true);
}

{
  const root = process.cwd();
  const ws = readFileSync(
    join(root, "components/v2/form3/Form3PhaseBWorkspace.tsx"),
    "utf8",
  );
  const editor = readFileSync(
    join(root, "components/v2/form3/Form3AssessmentDialog.tsx"),
    "utf8",
  );
  check("Workspace に Assessment 一覧", ws.includes("Form3AssessmentCardList"));
  check("Workspace が saveNowV2 を呼ばない", !/\bsaveNowV2\s*\(/.test(ws));
  for (const reason of FORM3_V2_ASSESSMENT_AUTOSAVE_REASONS) {
    check(`Workspace が ${reason} を渡す`, ws.includes(`"${reason}"`));
  }
  check(
    "Evidence は checkbox / ID",
    editor.includes("checkbox") && editor.includes("evidenceInformationIds"),
  );
  check("コピー禁止注記", editor.includes("コピーしません"));
  check("看護問題ではない注記", editor.includes("看護問題"));
  check("Coach なし", !ws.includes("Coach"));
  check("FEATURE_FLAGS.form3PhaseB false", FEATURE_FLAGS.form3PhaseB === false);
}

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? "OK  " : "FAIL"} ${c.name}`);
}
console.log(
  `\n===== form3 Phase B4: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
);
process.exit(failed.length === 0 ? 0 : 1);
}

void main();
