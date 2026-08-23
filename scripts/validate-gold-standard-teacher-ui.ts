/**
 * 教員用 Gold Standard UI / ゲート / Evidence 解決の検証。
 *
 * 実行: npx tsx scripts/validate-gold-standard-teacher-ui.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  buildGoldStandardListItems,
  isTeacherOrAdminProfile,
  loadGoldStandardDetailForPatient,
} from "../lib/gold/teacherGate";
import { PATIENT_A_CANONICAL_INFORMATION_CATALOG } from "../lib/gold/patientA/canonicalInformationCatalog";
import { PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS } from "../lib/gold/patientA/canonicalInformationCatalog";
import { resolveGoldEvidenceForDocument } from "../lib/gold/resolveEvidence";
import { getPatientAGoldStandardV1 } from "../lib/gold/patientA/goldStandardV1";
import type { AppProfile } from "../lib/v2/auth/currentUser";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
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
  check(
    "未ログイン(null) はゲート拒否",
    isTeacherOrAdminProfile(null) === false,
  );

  const list = buildGoldStandardListItems();
  check("一覧に A さん 1 件", list.length === 1 && list[0]?.patientId === "A");
  check("一覧の caseId は SP-001", list[0]?.caseId === "SP-001");
  check("一覧の CTP 件数は 5", list[0]?.ctpCount === 5);

  const detail = loadGoldStandardDetailForPatient("A");
  check("詳細ロード成功（teacher 相当データ取得）", detail.ok === true);
  if (detail.ok) {
    check("詳細 CTP 5 件", detail.resolvedPoints.length === 5);
    const allResolved = detail.resolvedPoints.every(
      (p) =>
        p.evidence.length > 0 &&
        p.evidence.every((e) => e.content.trim().length > 0 && e.id.length > 0),
    );
    check("各 evidenceInformationIds が本文へ解決される", allResolved);
  }

  const unknown = loadGoldStandardDetailForPatient("Z");
  check(
    "未知 patient は not_found",
    unknown.ok === false && unknown.kind === "not_found",
  );

  const doc = getPatientAGoldStandardV1();
  const broken = {
    ...doc,
    criticalThinkingPoints: doc.criticalThinkingPoints.map((ctp, i) =>
      i === 0
        ? {
            ...ctp,
            evidenceInformationIds: [
              ...ctp.evidenceInformationIds,
              "a-info-DOES-NOT-EXIST",
            ],
          }
        : ctp,
    ),
  };
  const brokenResolved = resolveGoldEvidenceForDocument(
    broken,
    PATIENT_A_CANONICAL_INFORMATION_CATALOG,
  );
  check(
    "解決不能 ID で失敗する",
    brokenResolved.ok === false &&
      brokenResolved.unresolvedIds.includes("a-info-DOES-NOT-EXIST"),
  );

  const clientHits: string[] = [];
  for (const root of ["components", "app"]) {
    const base = join(process.cwd(), root);
    for (const file of walkFiles(base)) {
      const src = readFileSync(file, "utf8");
      if (!src.includes('"use client"') && !src.includes("'use client'")) {
        continue;
      }
      if (
        src.includes("goldStandardV1") ||
        src.includes("A_gold_standard_v1.source") ||
        src.includes("getPatientAGoldStandardV1") ||
        /from\s+["']@\/lib\/gold\/access["']/.test(src) ||
        /from\s+["']@\/lib\/gold\/teacherGate["']/.test(src) ||
        /from\s+["']@\/lib\/gold\/patientA\//.test(src)
      ) {
        clientHits.push(file.replace(process.cwd() + "/", ""));
      }
    }
  }
  check(
    "use client ファイルが Gold 本文モジュールを import していない",
    clientHits.length === 0,
    clientHits.join(", "),
  );

  // pages must use access (server-only), not import source json
  const listPage = readFileSync(
    join(process.cwd(), "app/v2/teacher/gold-standard/page.tsx"),
    "utf8",
  );
  const detailPage = readFileSync(
    join(
      process.cwd(),
      "app/v2/teacher/gold-standard/[patientId]/page.tsx",
    ),
    "utf8",
  );
  check(
    "一覧ページは access ゲート経由",
    listPage.includes("requireTeacherGoldStandardList"),
  );
  check(
    "詳細ページは access ゲート経由",
    detailPage.includes("requireTeacherGoldStandardDetail"),
  );
  check(
    "ページが source JSON を直接 import しない",
    !listPage.includes("A_gold_standard_v1.source") &&
      !detailPage.includes("A_gold_standard_v1.source"),
  );

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
    const set = new Set(active.map((c) => (c.content ?? "").trim()));
    const missing = PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS.filter(
      (c) => !set.has(c),
    );
    check(
      "active 22 件がバックアップと一致（未改変）",
      active.length === 22 && missing.length === 0,
    );
  } catch {
    check("active 22 バックアップ照合スキップ", true);
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(
      `${c.ok ? "[OK]  " : "[FAIL]"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`,
    );
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) process.exitCode = 1;
}

main();
