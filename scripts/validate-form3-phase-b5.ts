/**
 * Form3 Phase B5 — Patient Source 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b5.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEmptyForm3V2 } from "../lib/form3/v2/form3V2Factory";
import {
  addForm3InformationCard,
  updateForm3InformationCard,
} from "../lib/form3/v2/form3V2InformationOps";
import {
  buildForm3PatientSourceView,
  FORM3_PATIENT_SOURCE_SECTION_IDS,
} from "../lib/form3/v2/form3V2PatientSource";
import { initialFacingState } from "../lib/patientFacingData";
import { FEATURE_FLAGS } from "../lib/featureFlags";

type Check = { name: string; ok: boolean };
const checks: Check[] = [];

function check(name: string, ok: boolean) {
  checks.push({ name, ok });
}

{
  const view = buildForm3PatientSourceView({ patientId: "A" });
  check("patient name", view.patientName.includes("A"));
  check(
    "5 sections",
    view.sections.length === 5 &&
      FORM3_PATIENT_SOURCE_SECTION_IDS.every((id) =>
        view.sections.some((s) => s.id === id),
      ),
  );
  check(
    "basics has items",
    (view.sections.find((s) => s.id === "basics")?.items.length ?? 0) > 0,
  );
  check(
    "chart has items",
    (view.sections.find((s) => s.id === "chart")?.items.length ?? 0) > 0,
  );
  check(
    "laboratory has items",
    (view.sections.find((s) => s.id === "laboratory")?.items.length ?? 0) > 0,
  );
  check(
    "treatment has items",
    (view.sections.find((s) => s.id === "treatment")?.items.length ?? 0) > 0,
  );
}

{
  const facing = initialFacingState();
  facing.history.push(
    { id: "s1", role: "student", text: "調子はどうですか" },
    { id: "p1", role: "patient", text: "あまり眠れなくて…" },
  );
  facing.disclosedFacts.push("夜間の不眠");
  const view = buildForm3PatientSourceView({ patientId: "A", facing });
  const convo = view.sections.find((s) => s.id === "conversation");
  check(
    "conversation shows patient speech",
    (convo?.items.some((i) => i.body.includes("眠れなく")) ?? false),
  );
  check(
    "conversation shows disclosed fact",
    (convo?.items.some((i) => i.body.includes("不眠")) ?? false),
  );
}

{
  let data = createEmptyForm3V2("A");
  data = addForm3InformationCard(data);
  const id = data.informationCards[0]!.id;
  data = updateForm3InformationCard(data, id, {
    content: "夜間眠れない",
    sourceType: "patient_conversation",
    sourceLabel: "患者との会話",
    sourceReference: {
      kind: "manual",
      sourceType: "patient_conversation",
      note: "患者との会話",
    },
  });
  const card = data.informationCards[0]!;
  check("sourceType kept", card.sourceType === "patient_conversation");
  check("sourceLabel kept", card.sourceLabel === "患者との会話");
  check(
    "sourceReference kept",
    card.sourceReference?.kind === "manual" &&
      card.sourceReference.note === "患者との会話",
  );
  data = updateForm3InformationCard(data, id, {
    sourceLabel: null,
    sourceReference: null,
  });
  check("sourceLabel clearable", data.informationCards[0]!.sourceLabel === undefined);
  check(
    "sourceReference clearable",
    data.informationCards[0]!.sourceReference === undefined,
  );
}

{
  const root = process.cwd();
  const ws = readFileSync(
    join(root, "components/v2/form3/Form3PhaseBWorkspace.tsx"),
    "utf8",
  );
  const panel = readFileSync(
    join(root, "components/v2/form3/Form3PatientSourcePanel.tsx"),
    "utf8",
  );
  const sheet = readFileSync(
    join(root, "components/v2/form3/Form3PatientSourceSheet.tsx"),
    "utf8",
  );
  const editor = readFileSync(
    join(root, "components/v2/form3/Form3InformationCardEditor.tsx"),
    "utf8",
  );
  const host = readFileSync(
    join(root, "components/v2/learning/workspace/WorkspaceHost.tsx"),
    "utf8",
  );

  check("Workspace に Patient Source Panel", ws.includes("Form3PatientSourcePanel"));
  check("Workspace に Sheet（iPad）", ws.includes("Form3PatientSourceSheet"));
  check("lg で左パネル", ws.includes("lg:flex") && ws.includes("hidden"));
  check("Sheet は lg:hidden", sheet.includes("lg:hidden"));
  check("折りたたみ toggle", panel.includes("toggleSection") || panel.includes("aria-expanded"));
  check("スクロール保持", panel.includes("sessionStorage") && panel.includes("scrollTop"));
  check("自動入力禁止コメント", editor.includes("自動入力しません"));
  check("sourceLabel 入力あり", editor.includes("sourceLabel"));
  check(
    "構造化参照を label 編集で上書きしない",
    editor.includes("isStructured") &&
      editor.includes('ref.kind === "fixture"') &&
      editor.includes("sourceLabel: trimmed === \"\" ? null : value"),
  );
  check("DnD なし", !panel.includes("onDrag") && !ws.includes("onDrop"));
  check("Coach UI なし", !ws.includes("Coach"));
  check("Host が patient / facing を渡す", host.includes("facingState={facingState}"));
  check("FEATURE_FLAGS.form3PhaseB false", FEATURE_FLAGS.form3PhaseB === false);
}

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? "OK  " : "FAIL"} ${c.name}`);
}
console.log(
  `\n===== form3 Phase B5: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
);
process.exit(failed.length === 0 ? 0 : 1);
