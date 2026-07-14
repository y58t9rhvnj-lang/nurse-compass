// Sprint12.1: 情報整理ノートの表示用純粋関数の最小検証。
// UI では Information Card を「データ」として表示する。ここでは種類ラベルと
// 日時整形が安全に動くことのみを確認する（解釈・分類は行わない）。

import {
  formatDataTimestamp,
  sourceTypeLabel,
} from "../lib/organization/informationDisplay";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`[OK]   ${label}`);
  } else {
    console.error(`[FAIL] ${label}`);
    failures += 1;
  }
}

// ---- sourceTypeLabel ----
check("patient_conversation → 患者との会話", sourceTypeLabel("patient_conversation") === "患者との会話");
check("student_note → 学生メモ", sourceTypeLabel("student_note") === "学生メモ");
check("flowsheet → フローシート", sourceTypeLabel("flowsheet") === "フローシート");
check("prescription → 処方", sourceTypeLabel("prescription") === "処方");
check("未知の値 → データ（フォールバック）", sourceTypeLabel("unknown_kind") === "データ");
check("空文字 → データ（フォールバック）", sourceTypeLabel("") === "データ");

// ---- formatDataTimestamp ----
check("空/未指定 → 空文字", formatDataTimestamp("") === "" && formatDataTimestamp(undefined) === "" && formatDataTimestamp(null) === "");
check("不正な日時 → 空文字", formatDataTimestamp("not-a-date") === "");
{
  const out = formatDataTimestamp("2026-07-01T09:30:00.000Z");
  check("有効な ISO → YYYY/MM/DD HH:mm 形式", /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(out));
}

console.log(`\nWorkspace display validation: ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("All workspace display checks passed.");
