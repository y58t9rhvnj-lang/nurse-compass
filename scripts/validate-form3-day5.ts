/**
 * Compass Version2.1 Day 5 — Form3 統合の純関数・配線不変条件の検証。
 *
 * 実行: npx tsx scripts/validate-form3-day5.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isLearningWorkspaceView } from "../components/v2/learning/workspace/learningWorkspaceView";
import { FORM3_FIELD_ORDER } from "../components/v2/form3/form3UiLabels";

type Check = { name: string; ok: boolean };
const checks: Check[] = [];
function check(name: string, ok: boolean) {
  checks.push({ name, ok });
}

check(
  "isLearningWorkspaceView(form3)",
  isLearningWorkspaceView("form3"),
);
check(
  "isLearningWorkspaceView(clinical-workspace) 維持",
  isLearningWorkspaceView("clinical-workspace"),
);
check(
  "form2 は LearningWorkspaceView ではない（提出用画面のまま）",
  !isLearningWorkspaceView("form2"),
);

const sideNavSrc = readFileSync(
  join(__dirname, "../components/SideNav.tsx"),
  "utf8",
);
check(
  "STUDENT_NAV に様式3がある",
  sideNavSrc.includes('{ label: "様式3"') && sideNavSrc.includes('view: "form3"'),
);
check(
  "AppView に form3 を含む",
  /export type AppView =[\s\S]*\| "form3"/.test(sideNavSrc),
);

check(
  "様式3入力順は学校指定どおり（転記・再構成していない）",
  FORM3_FIELD_ORDER.join(",") ===
    [
      "relatedInformation",
      "interpretation",
      "crossPatternRelations",
      "judgment",
      "judgmentRationale",
      "additionalInformationNeeded",
    ].join(","),
);

const cluesSrc = readFileSync(
  join(__dirname, "../components/v2/form3/Form3CluesSheet.tsx"),
  "utf8",
);
const workspaceSrc = readFileSync(
  join(__dirname, "../components/v2/form3/Form3Workspace.tsx"),
  "utf8",
);
const headerSrc = readFileSync(
  join(__dirname, "../components/v2/form3/Form3Header.tsx"),
  "utf8",
);
const studentSrc = readFileSync(
  join(__dirname, "../app/v2/student/page.tsx"),
  "utf8",
);
const hostSrc = readFileSync(
  join(__dirname, "../components/v2/learning/workspace/WorkspaceHost.tsx"),
  "utf8",
);

check(
  "手がかりタイトルが患者理解の手がかり",
  cluesSrc.includes("患者理解の手がかり"),
);
check(
  "私が捉えた患者さんを参照表示する",
  cluesSrc.includes("私が捉えた患者さん"),
);
check("様式2を参照表示する", cluesSrc.includes("様式2"));
check(
  "転記ではないと明示する",
  cluesSrc.includes("転記するための資料ではありません"),
);
check(
  "転記ボタンを作らない（Form3CluesSheet）",
  !cluesSrc.includes("様式2から転記") &&
    !cluesSrc.includes("一括転記") &&
    !cluesSrc.includes("コピーして貼り付け") &&
    !cluesSrc.includes("自動入力する") &&
    !cluesSrc.includes("onClick={handleTranscript"),
);
check(
  "転記ボタンを作らない（Form3Workspace）",
  !workspaceSrc.includes("様式2から転記") &&
    !workspaceSrc.includes("一括転記") &&
    !workspaceSrc.includes("コピーして様式3"),
);
check(
  "保存ボタンをヘッダーに置かない",
  !headerSrc.includes(">保存<") && !headerSrc.includes("保存する"),
);
check(
  "Form3Workspace が useForm3Supabase を使う",
  workspaceSrc.includes("useForm3Supabase"),
);
check(
  "Student page が getForm3 で初期 Snapshot を取得",
  studentSrc.includes("getForm3") && studentSrc.includes("initialForm3"),
);
check(
  "Student page が患者理解を参照用に取得",
  studentSrc.includes("getPatientUnderstanding") &&
    studentSrc.includes("initialPatientOverviewText"),
);
check(
  "WorkspaceHost が form3 ケースを持つ",
  hostSrc.includes('case "form3"') && hostSrc.includes("Form3Workspace"),
);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`[${c.ok ? "OK" : "FAIL"}] ${c.name}`);
}
console.log(
  `\n===== form3 Day5: ${checks.length - failed.length} OK / ${failed.length} FAIL =====`,
);
process.exit(failed.length > 0 ? 1 : 0);
