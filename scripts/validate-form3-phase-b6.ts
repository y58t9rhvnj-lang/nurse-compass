/**
 * Form3 Phase B6 — Final Form Artifact UI / ops 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b6.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORM3_PATTERN_ORDER } from "../lib/form3/form3Types";
import { createEmptyForm3V2 } from "../lib/form3/v2/form3V2Factory";
import { updateForm3FinalPattern } from "../lib/form3/v2/form3V2FinalOps";
import {
  FORM3_V2_FINAL_AUTOSAVE_REASONS,
  isForm3V2AutosaveReason,
} from "../lib/form3/v2/form3V2AutosaveReasons";
import {
  applyForm3V2SaveConflict,
  applyForm3V2SaveSuccess,
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

async function main() {
  {
    check("11 patterns", FORM3_PATTERN_ORDER.length === 11);
    let data = createEmptyForm3V2("A");
    for (const key of FORM3_PATTERN_ORDER) {
      check(
        `empty final ${key}`,
        data.finalForm[key].informationSO === "" &&
          data.finalForm[key].interpretationAnalysisCareNeed === "",
      );
    }

    data = updateForm3FinalPattern(data, "sleep_rest", {
      informationSO: "夜間中途覚醒がある（O）",
      interpretationAnalysisCareNeed: "睡眠パターンの乱れへの支援が必要",
    });
    check(
      "edit informationSO",
      data.finalForm.sleep_rest.informationSO.includes("中途覚醒"),
    );
    check(
      "edit interpretationAnalysisCareNeed",
      data.finalForm.sleep_rest.interpretationAnalysisCareNeed.includes("支援"),
    );
    check(
      "other pattern untouched",
      data.finalForm.nutritional_metabolic.informationSO === "",
    );
  }

  {
    check(
      "Final AutosaveReason",
      FORM3_V2_FINAL_AUTOSAVE_REASONS.length === 1 &&
        isForm3V2AutosaveReason("final_updated"),
    );

    let flags = createInitialForm3V2WriteFlags({ hasPersistedV2: false });
    check(
      "Ready before edit",
      getForm3PhaseBPersistLabel({
        dirty: flags.dirty,
        saveStatus: flags.saveStatus,
        hydrated: true,
        hasPersistedV2: false,
      }).label === "Ready",
    );

    flags = markForm3V2UserEdited(flags).flags;
    check(
      "Draft after edit",
      getForm3PhaseBPersistLabel({
        dirty: flags.dirty,
        saveStatus: flags.saveStatus,
        hydrated: true,
        hasPersistedV2: false,
      }).label === "Draft",
    );

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
        flags = applyForm3V2SaveSuccess(flags);
        return { ok: true, kind: "saved" };
      },
      enableTimer: true,
      debounceMs: 20,
    });
    controller.notifyDirty({
      dirty: flags.dirty,
      hasUserEdited: flags.hasUserEdited,
      reason: "final_updated",
    });
    await new Promise((r) => setTimeout(r, 60));
    check("Final Autosave", saveCalls === 1);
    check(
      "Saved after autosave",
      getForm3PhaseBPersistLabel({
        dirty: flags.dirty,
        saveStatus: flags.saveStatus,
        hydrated: true,
        hasPersistedV2: flags.hasPersistedV2,
      }).label === "Saved",
    );
    controller.cancel();

    flags = applyForm3V2SaveConflict(
      markForm3V2UserEdited(
        createInitialForm3V2WriteFlags({ hasPersistedV2: true }),
      ).flags,
    );
    check(
      "Conflict → Draft",
      getForm3PhaseBPersistLabel({
        dirty: flags.dirty,
        saveStatus: flags.saveStatus,
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
    const editor = readFileSync(
      join(root, "components/v2/form3/Form3FinalFormEditor.tsx"),
      "utf8",
    );
    const ref = readFileSync(
      join(root, "components/v2/form3/Form3FinalReferencePanel.tsx"),
      "utf8",
    );
    check(
      "Workspace に Final 導線",
      ws.includes('"final"') &&
        ws.includes("Form3FinalFormEditor") &&
        (ws.includes("様式表示") || ws.includes("Final Form")),
    );
    check("Workspace が final_updated を渡す", ws.includes('"final_updated"'));
    check("Workspace が saveNowV2 を呼ばない", !/\bsaveNowV2\s*\(/.test(ws));
    check("2欄のみ informationSO", editor.includes("informationSO"));
    check(
      "2欄のみ interpretationAnalysisCareNeed",
      editor.includes("interpretationAnalysisCareNeed"),
    );
    check("自動転記禁止注記", editor.includes("自動転記"));
    check("参照は転記しない", ref.includes("転記・コピーしません"));
    check("参照に onClick 転記なし", !ref.includes("onClick") && !ref.includes("navigator.clipboard"));
    check("DnD なし", !editor.includes("onDrag") && !ws.includes("onDrop"));
    check("Coach なし", !ws.includes("Coach") && !editor.includes("Coach"));
    check("Related Map なし", !ws.includes("RelatedMap"));
    check("FEATURE_FLAGS.form3PhaseB false", FEATURE_FLAGS.form3PhaseB === false);
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? "OK  " : "FAIL"} ${c.name}`);
  }
  console.log(
    `\n===== form3 Phase B6: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

void main();
