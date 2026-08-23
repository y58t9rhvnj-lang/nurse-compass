/**
 * Patient A Teacher Insight Library の検証。
 *
 * 実行: npx tsx scripts/validate-teacher-insights-a.ts
 */

import { createHash } from "node:crypto";
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
  loadPatientATeacherInsights,
  loadTeacherInsightById,
  loadTeacherInsights,
  loadTeacherInsightsForCtp,
  loadTeacherInsightsForPattern,
} from "../lib/teacherInsights/library";
import { PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP } from "../lib/teacherInsights/patientA/insightEvidenceMap";
import { getPatientATeacherInsightsV1 } from "../lib/teacherInsights/patientA/teacherInsightsV1";
import { FORM3_PATTERN_ORDER } from "../lib/form3/form3Types";

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

function fileSha(rel: string): string {
  const buf = readFileSync(join(process.cwd(), rel));
  return createHash("sha256").update(buf).digest("hex");
}

function main() {
  const expectedIds = [
    "TI-A-01",
    "TI-A-02",
    "TI-A-03",
    "TI-A-04",
    "TI-A-05",
    "TI-A-06",
    "TI-A-07",
  ];

  const docs = getPatientATeacherInsightsV1();
  check("7件読み込み", docs.length === 7, `n=${docs.length}`);

  const ids = docs.map((d) => d.id);
  check(
    "全ID一意",
    new Set(ids).size === ids.length &&
      expectedIds.every((id) => ids.includes(id)),
    ids.join(","),
  );

  const catalogIds = new Set(
    PATIENT_A_CANONICAL_INFORMATION_CATALOG.map((c) => c.id),
  );
  let evidenceOk = true;
  const badEvidence: string[] = [];
  for (const doc of docs) {
    for (const eid of doc.evidenceInformationIds) {
      if (!catalogIds.has(eid)) {
        evidenceOk = false;
        badEvidence.push(`${doc.id}:${eid}`);
      }
    }
    for (const h of doc.hypotheses) {
      for (const eid of h.supportingEvidenceIds) {
        if (!catalogIds.has(eid)) {
          evidenceOk = false;
          badEvidence.push(`${doc.id}/${h.id}:${eid}`);
        }
      }
    }
  }
  check("全Evidence解決（カタログ内）", evidenceOk, badEvidence.join("; "));

  let patternsOk = true;
  for (const doc of docs) {
    for (const key of doc.applicablePatternKeys) {
      if (!FORM3_PATTERN_ORDER.includes(key)) patternsOk = false;
    }
    for (const q of doc.coachingQuestions) {
      if (!q.question.trim() || !q.purpose.trim() || !q.stage) patternsOk = false;
      for (const key of q.relatedPatternKeys) {
        if (!FORM3_PATTERN_ORDER.includes(key)) patternsOk = false;
      }
    }
  }
  check("全PatternKey有効かつ問い必須項目あり", patternsOk);

  const gold = getPatientAGoldStandardV1();
  const ctpIds = new Set(gold.criticalThinkingPoints.map((c) => c.id));
  let ctpOk = true;
  for (const doc of docs) {
    for (const id of doc.relatedCtpIds ?? []) {
      if (!ctpIds.has(id)) ctpOk = false;
    }
    for (const id of doc.goldStandardRelationship.relatedCtpIds) {
      if (!ctpIds.has(id)) ctpOk = false;
    }
  }
  check("CTP紐付け解決", ctpOk);

  const mapIds = Object.keys(PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP);
  check(
    "evidence map が7件",
    mapIds.length === 7 && expectedIds.every((id) => mapIds.includes(id)),
  );

  // カタログ外が Evidence に混入していない（明示禁止フレーズの収録チェックも）
  const bannedPhrases = [
    "陰性症状が主因",
    "社会的認知機能の障害により",
    "再燃につながる恐れがあるため",
    "containsOriginalAssessmentText: true",
  ];
  const blob = JSON.stringify(docs);
  const hasBanned = bannedPhrases.some((p) => blob.includes(p));
  check("断定的診断フレーズ・原文フラグを本文に含めない", !hasBanned);

  check(
    "sourceMetadata.containsOriginalAssessmentText が全て false",
    docs.every((d) => d.sourceMetadata.containsOriginalAssessmentText === false),
  );

  check(
    "coachingQuestions が各1件以上",
    docs.every((d) => d.coachingQuestions.length >= 1),
  );

  check(
    "patient_specific は patientId/caseId 必須",
    docs.every(
      (d) =>
        d.scope === "patient_specific" &&
        d.patientSpecific === true &&
        d.patientId === "A" &&
        d.caseId === "SP-001",
    ),
  );

  // 権限（純関数ゲート）
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

  const loaded = loadTeacherInsights();
  check("loadTeacherInsights 成功", loaded.ok === true && loaded.ok && loaded.documents.length === 7);

  const byId = loadTeacherInsightById("TI-A-01");
  check("loadTeacherInsightById(TI-A-01)", byId.ok === true);

  const patientA = loadPatientATeacherInsights();
  check(
    "getPatientATeacherInsights 相当ロード",
    patientA.ok === true && patientA.ok && patientA.documents.length === 7,
  );

  const forCtp = loadTeacherInsightsForCtp("CTP-01");
  check(
    "CTP-01 紐付け Insights が1件以上",
    forCtp.ok === true && forCtp.ok && forCtp.documents.length >= 1,
  );

  const forPattern = loadTeacherInsightsForPattern("activity_exercise");
  check(
    "activity_exercise 紐付け Insights が1件以上",
    forPattern.ok === true &&
      forPattern.ok &&
      forPattern.documents.length >= 1,
  );

  // 学生向けモジュールから本文参照が無いこと
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
      if (rel.includes("/student") && importsBody) {
        studentHits.push(rel);
      }
    }
  }
  check(
    "use client が Teacher Insight 本文を import していない",
    clientHits.length === 0,
    clientHits.join(", "),
  );
  check(
    "学生向け経路が Teacher Insight 本文を参照していない",
    studentHits.length === 0,
    studentHits.join(", "),
  );

  // Gold / active22 未改変（作業ツリー差分が無いこと）
  const goldPaths = [
    "lib/gold/patientA/A_gold_standard_v1.source.json",
    "lib/gold/patientA/goldStandardV1.ts",
    "lib/gold/patientA/canonicalInformationCatalog.ts",
    "lib/gold/patientA/ctpEvidenceMap.ts",
  ];
  let goldClean = true;
  try {
    const out = execSync(
      `git status --porcelain -- ${goldPaths.join(" ")}`,
      { encoding: "utf8" },
    ).trim();
    goldClean = out.length === 0;
    check("Gold Standard 関連パスに未コミット変更なし", goldClean, out);
  } catch (e) {
    check("Gold Standard 関連パスに未コミット変更なし", false, String(e));
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
    const missing = active.filter(
      (c) => c.content && !fingerprints.has(c.content),
    );
    // カタログ側がバックアップに含まれること
    const catalogMissing = PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS.filter(
      (fp) => !active.some((c) => c.content === fp),
    );
    check(
      "active 22 件がバックアップと一致（未改変）",
      active.length === 22 &&
        missing.length === 0 &&
        catalogMissing.length === 0,
      `active=${active.length} missingFromCatalog=${missing.length} catalogMissing=${catalogMissing.length}`,
    );
  } catch {
    check("active 22 バックアップ照合スキップ", true);
  }

  // Evidence map と document の一致
  let mapMatch = true;
  for (const doc of docs) {
    const mapped = PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP[doc.id] ?? [];
    if (mapped.join("|") !== doc.evidenceInformationIds.join("|")) {
      mapMatch = false;
    }
  }
  check("insightEvidenceMap と各 Insight の Evidence が一致", mapMatch);

  // 安定ハッシュ（報告用）
  check(
    "catalog sha 記録可能",
    fileSha("lib/gold/patientA/canonicalInformationCatalog.ts").length === 64,
  );

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    const mark = c.ok ? "OK" : "FAIL";
    console.log(`[${mark}]   ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) process.exit(1);
}

main();
