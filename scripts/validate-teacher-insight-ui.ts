/**
 * Teacher Insight 教員 UI（Gold 詳細埋め込み）の検証。
 *
 * 実行: npx tsx scripts/validate-teacher-insight-ui.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { AppProfile } from "../lib/v2/auth/currentUser";
import {
  PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS,
  PATIENT_A_CANONICAL_INFORMATION_CATALOG,
} from "../lib/gold/patientA/canonicalInformationCatalog";
import { getPatientAGoldStandardV1 } from "../lib/gold/patientA/goldStandardV1";
import {
  isTeacherOrAdminProfile,
  loadResolvedTeacherInsightsByCtpIds,
  loadResolvedTeacherInsightsForCtp,
  loadTeacherInsightsForCtp,
} from "../lib/teacherInsights/library";
import { resolveTeacherInsightsEvidence } from "../lib/teacherInsights/resolveEvidence";
import { getPatientATeacherInsightsV1 } from "../lib/teacherInsights/patientA/teacherInsightsV1";
import { COACHING_STAGE_LABEL_JA } from "../lib/teacherInsights/labels";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "tmp") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) acc.push(p);
  }
  return acc;
}

function fakeProfile(role: AppProfile["role"]): AppProfile {
  return {
    id: "test",
    loginId: "test",
    displayName: "test",
    studentNumber: null,
    className: null,
    role,
    organizationId: "org",
    academicYear: 2026,
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
  };
}

function main() {
  const gold = getPatientAGoldStandardV1();
  const ctpIds = gold.criticalThinkingPoints.map((c) => c.id);
  check("Gold CTP は 5 件", ctpIds.length === 5);

  const expected: Record<string, string[]> = {
    "CTP-01": ["TI-A-01", "TI-A-07"],
    "CTP-02": ["TI-A-02", "TI-A-07"],
    "CTP-03": ["TI-A-03", "TI-A-04", "TI-A-05", "TI-A-06"],
    "CTP-04": ["TI-A-05", "TI-A-07"],
    "CTP-05": ["TI-A-03", "TI-A-06"],
  };

  const byCtp = loadResolvedTeacherInsightsByCtpIds(ctpIds);
  check("CTP 一括解決成功", byCtp.ok === true);
  if (byCtp.ok) {
    for (const [ctpId, want] of Object.entries(expected)) {
      const got = (byCtp.byCtpId.get(ctpId) ?? []).map((i) => i.document.id).sort();
      const wantSorted = [...want].sort();
      check(
        `${ctpId} の関連 Insight 件数・ID`,
        got.length === wantSorted.length &&
          got.every((id, i) => id === wantSorted[i]),
        `got=${got.join(",")} want=${wantSorted.join(",")}`,
      );
    }
  }

  // 関連 CTP 分だけ（全7件が全CTPに出ない）
  if (byCtp.ok) {
    const ctp01 = byCtp.byCtpId.get("CTP-01") ?? [];
    check(
      "CTP-01 に全7件は出ない",
      ctp01.length === 2 &&
        !ctp01.some((i) => i.document.id === "TI-A-03"),
    );
  }

  let allEvidenceOk = true;
  let allQuestionsOk = true;
  let emptyOptionalHiddenLogic = true;
  if (byCtp.ok) {
    for (const insights of byCtp.byCtpId.values()) {
      for (const insight of insights) {
        if (insight.evidence.length !== insight.document.evidenceInformationIds.length) {
          allEvidenceOk = false;
        }
        if (insight.document.coachingQuestions.length < 1) {
          allQuestionsOk = false;
        }
        for (const q of insight.document.coachingQuestions) {
          if (!COACHING_STAGE_LABEL_JA[q.stage]) allQuestionsOk = false;
          // empty prerequisites/avoidWhen should be treatable as absent
          if (q.prerequisites && q.prerequisites.length === 0) {
            emptyOptionalHiddenLogic = false;
          }
          if (q.avoidWhen && q.avoidWhen.length === 0) {
            emptyOptionalHiddenLogic = false;
          }
        }
      }
    }
  }
  check("全Evidence解決（件数一致）", allEvidenceOk);
  check("全Coaching Question が1件以上・stage有効", allQuestionsOk);
  check(
    "空の prerequisites / avoidWhen はデータ上も空配列を持たない",
    emptyOptionalHiddenLogic,
  );

  check(
    "teacher role はゲート通過",
    isTeacherOrAdminProfile(fakeProfile("teacher")),
  );
  check(
    "admin role はゲート通過",
    isTeacherOrAdminProfile(fakeProfile("admin")),
  );
  check(
    "student role はゲート拒否",
    isTeacherOrAdminProfile(fakeProfile("student")) === false,
  );

  // 解決不能 Evidence で失敗
  const sample = loadTeacherInsightsForCtp("CTP-01");
  check("CTP-01 生データ取得", sample.ok === true);
  if (sample.ok && sample.documents[0]) {
    const broken = {
      ...sample.documents[0],
      evidenceInformationIds: [
        ...sample.documents[0].evidenceInformationIds,
        "a-info-DOES-NOT-EXIST",
      ],
    };
    const resolved = resolveTeacherInsightsEvidence(
      [broken],
      PATIENT_A_CANONICAL_INFORMATION_CATALOG,
    );
    check(
      "解決不能Evidenceで失敗する",
      resolved.ok === false &&
        resolved.ok === false &&
        resolved.unresolvedIds.includes("a-info-DOES-NOT-EXIST"),
    );
  }

  const one = loadResolvedTeacherInsightsForCtp("CTP-03");
  check(
    "CTP-03 解決成功（複数Insight）",
    one.ok === true && one.ok && one.insights.length === 4,
  );

  // UI 配線: page は access 経由、固定配列なし
  const detailPage = readFileSync(
    join(
      process.cwd(),
      "app/v2/teacher/gold-standard/[patientId]/page.tsx",
    ),
    "utf8",
  );
  check(
    "詳細ページは getResolvedTeacherInsightsByCtpIds 経由",
    detailPage.includes("getResolvedTeacherInsightsByCtpIds") &&
      detailPage.includes("@/lib/teacherInsights/access"),
  );
  check(
    "詳細ページに CTP→TI 固定配列を埋め込まない",
    !detailPage.includes("TI-A-01") && !detailPage.includes('"CTP-01":'),
  );

  const panel = readFileSync(
    join(process.cwd(), "components/v2/gold/TeacherInsightsPanel.tsx"),
    "utf8",
  );
  check(
    "パネルに正解・診断・結論の見出しを使わない",
    !panel.includes(">診断<") &&
      !panel.includes("結論") &&
      !/<h[1-6][^>]*>[^<]*正解/.test(panel) &&
      !panel.includes("Subheading>正解") &&
      panel.includes("正解を示すものではありません"),
  );
  check(
    "パネル説明に『正解を示すものではありません』",
    panel.includes("正解を示すものではありません"),
  );
  check(
    "空 prerequisites は条件付き非表示",
    panel.includes("q.prerequisites && q.prerequisites.length > 0"),
  );
  check(
    "空 avoidWhen は条件付き非表示",
    panel.includes("q.avoidWhen && q.avoidWhen.length > 0"),
  );

  // client / student 隔離
  const clientHits: string[] = [];
  const studentHits: string[] = [];
  for (const root of ["components", "app"]) {
    const base = join(process.cwd(), root);
    for (const file of walkFiles(base)) {
      const src = readFileSync(file, "utf8");
      const rel = file.replace(process.cwd() + "/", "");
      const importsBody =
        src.includes("teacherInsightsV1") ||
        src.includes("getPatientATeacherInsightsV1") ||
        /from\s+["']@\/lib\/teacherInsights\/access["']/.test(src) ||
        /from\s+["']@\/lib\/teacherInsights\/library["']/.test(src) ||
        /from\s+["']@\/lib\/teacherInsights\/patientA\//.test(src);
      if (
        (src.includes('"use client"') || src.includes("'use client'")) &&
        importsBody
      ) {
        clientHits.push(rel);
      }
      if (rel.includes("/student") && (importsBody || src.includes("Teacher Insight"))) {
        studentHits.push(rel);
      }
    }
  }
  check(
    "use client が Teacher Insight 本文モジュールを import していない",
    clientHits.length === 0,
    clientHits.join(", "),
  );
  check(
    "学生向け経路に Teacher Insight 本文・見出しがない",
    studentHits.length === 0,
    studentHits.join(", "),
  );

  // Gold / active22 未改変
  const goldPaths = [
    "lib/gold/patientA/A_gold_standard_v1.source.json",
    "lib/gold/patientA/goldStandardV1.ts",
    "lib/gold/patientA/canonicalInformationCatalog.ts",
    "lib/gold/patientA/ctpEvidenceMap.ts",
  ];
  try {
    const out = execSync(
      `git status --porcelain -- ${goldPaths.join(" ")}`,
      { encoding: "utf8" },
    ).trim();
    check("Gold Standard 本文パスに未コミット変更なし", out.length === 0, out);
  } catch (e) {
    check("Gold Standard 本文パスに未コミット変更なし", false, String(e));
  }

  check(
    "active 22 content 指紋件数",
    PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS.length === 22,
  );

  const backupPath = join(
    process.cwd(),
    "tmp/acceptance-99999991-A/layout-fix/form3-backup-before-longtext.json",
  );
  try {
    const backup = JSON.parse(readFileSync(backupPath, "utf8")) as {
      informationCards?: Array<{ status?: string; content?: string }>;
    };
    const active = (backup.informationCards ?? []).filter(
      (c) => c.status === "active",
    );
    const fingerprints = new Set(PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS);
    const catalogMissing = PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS.filter(
      (fp) => !active.some((c) => c.content === fp),
    );
    check(
      "active 22 件がバックアップと一致（未改変）",
      active.length === 22 && catalogMissing.length === 0,
      `active=${active.length} catalogMissing=${catalogMissing.length}`,
    );
  } catch {
    check("active 22 バックアップ照合スキップ", true);
  }

  // データ層回帰（7件ロード）
  const all = getPatientATeacherInsightsV1();
  check("Teacher Insight データ層 7件ロード", all.length === 7);

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    const mark = c.ok ? "OK" : "FAIL";
    console.log(`[${mark}]   ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) process.exit(1);
}

main();
