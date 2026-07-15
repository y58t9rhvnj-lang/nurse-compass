// 「精神様式2」の自動表示項目を Patient A の既存データから導出する。
//
// 方針:
// - 既存データに存在する事実のみを表示する（存在しない項目は推測で補完しない）。
// - 学生が自分で整理すべき欄には完成文を出さない（ここは基本情報の転記のみ）。
// - 元データ（wardData / chartData）は一切変更しない。表示時の read-only 派生。

import { getChartData } from "@/lib/chartData";
import type { Patient } from "@/lib/wardData";

export interface Form2AutoMedication {
  category: string; // 定期 / 頓服 など
  drugs: string; // 例: "リスペリドン錠2mg 2錠"
  usage: string; // 例: 分1 朝食後
}

export interface Form2AutoData {
  patientName: string;
  age: string;
  sex: string;
  diagnosis: string;
  // 既存データに構造化された記載が無い場合は null（記載なし表示）。
  pastHistory: string | null;
  admissionType: string | null;
  admissionTypeNote: string | null;
  doctor: string;
  medications: Form2AutoMedication[];
  treatmentPrograms: string[];
}

// 入院形態を表すキーワード（新しいエピソードから優先的に判定）。
const ADMISSION_TYPE_KEYWORDS = [
  "任意入院",
  "医療保護入院",
  "措置入院",
  "緊急措置入院",
  "応急入院",
];

function deriveAdmissionType(
  episodes: { type: string; description: string }[],
): { type: string | null; note: string | null } {
  // エピソードは新しい順に並んでいる前提。最初にヒットした形態を現在の形態とみなす。
  for (const ep of episodes) {
    const text = `${ep.type} ${ep.description}`;
    for (const keyword of ADMISSION_TYPE_KEYWORDS) {
      if (text.includes(keyword)) {
        return { type: keyword, note: ep.description || null };
      }
    }
  }
  return { type: null, note: null };
}

function deriveMedications(
  orders: {
    category: string;
    status?: string;
    groups: { drugs: { name: string; amount: string }[]; usage: string }[];
  }[],
): Form2AutoMedication[] {
  const result: Form2AutoMedication[] = [];
  for (const order of orders) {
    // 現在有効な処方のみ（status 未指定は active とみなす）。
    const active = order.status === undefined || order.status === "active";
    if (!active) continue;
    if (order.category !== "定期" && order.category !== "頓服") continue;
    for (const group of order.groups) {
      const drugs = group.drugs
        .map((d) => `${d.name} ${d.amount}`)
        .join("・");
      result.push({
        category: order.category,
        drugs,
        usage: group.usage,
      });
    }
  }
  return result;
}

function deriveTreatmentPrograms(
  schedule: { label: string }[],
): string[] {
  // 食事など「治療プログラム」でない項目を除外し、重複を除いて列挙する。
  const seen = new Set<string>();
  const programs: string[] = [];
  for (const item of schedule) {
    if (item.label.includes("食")) continue;
    const label = item.label.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    programs.push(label);
  }
  return programs;
}

export function buildForm2AutoData(patient: Patient): Form2AutoData {
  const chart = getChartData(patient.id);
  const { type, note } = deriveAdmissionType(chart.episodes);

  return {
    patientName: patient.name,
    age: `${patient.age}歳`,
    sex: patient.sex,
    diagnosis: patient.diagnosis,
    // 構造化された一般的な既往歴は既存データに存在しないため補完しない。
    pastHistory: null,
    admissionType: type,
    admissionTypeNote: note,
    doctor: patient.doctor,
    medications: deriveMedications(chart.prescriptionOrders),
    treatmentPrograms: deriveTreatmentPrograms(patient.schedule),
  };
}
