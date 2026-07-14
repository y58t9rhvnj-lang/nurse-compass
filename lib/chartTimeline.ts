// 診療録タブ用の経過記録タイムライン（Sprint: 電子カルテ改善）。
// 医師などが記載した診療録（clinicalRecords の看護以外）と、看護師が記載した看護記録
// （nursingRecords）を、表示時にのみ共通形式 TimelineRecord へ変換する。
// 元データは統合・複製せず分離したまま維持する（責任主体が異なるため）。
import type {
  ChartData,
  ClinicalRecord,
  NursingRecord,
  PhysicianSoap,
} from "./chartData";
import {
  inferNursingType,
  normalizeSoapFields,
  type NursingRecordType,
} from "./nursingChart";

/** 記録種別（少なくとも診療録=medical / 看護記録=nursing を判別できる） */
export type ClinicalRecordType = "medical" | "nursing";

/** 表示用の共通レコード。元データ（ClinicalRecord / NursingRecord）は複製しない。 */
export interface TimelineRecord {
  id: string;
  patientId: string;
  recordType: ClinicalRecordType;
  recordedAt: string; // "YYYY/MM/DD HH:mm"
  date: string;
  time: string;
  author: string;
  profession: string; // 医師 / 看護 / PSW / 栄養 / 薬剤
  department: string; // 診療科または所属
  content?: string;
  soap?: PhysicianSoap;
  // 看護記録の見出し・形式
  focus?: string;
  nursingType?: NursingRecordType;
  // タブ間リンク・強調用（既存機能の維持）
  problems?: number[];
  medicationChangeId?: string;
  orderId?: string;
  nursingRecordId?: string;
  restrictionEventId?: string;
  restrictionType?: string;
  recordId?: string; // 元 ClinicalRecord.id（recordId ナビ用）
}

export const RECORD_TYPE_LABEL: Record<ClinicalRecordType, string> = {
  medical: "診療録",
  nursing: "看護記録",
};

const PROFESSION_DEPARTMENT: Record<string, string> = {
  医師: "精神科",
  看護: "看護部",
  PSW: "医療福祉相談室",
  栄養: "栄養管理科",
  薬剤: "薬剤部",
};

export function professionDepartment(profession: string): string {
  return PROFESSION_DEPARTMENT[profession] ?? profession;
}

function medicalToTimeline(
  r: ClinicalRecord,
  patientId: string,
  i: number,
): TimelineRecord {
  return {
    id: r.id ?? `med-${patientId}-${r.date}-${r.time}-${i}`,
    patientId,
    recordType: "medical",
    recordedAt: `${r.date} ${r.time}`,
    date: r.date,
    time: r.time,
    author: r.author,
    profession: r.profession,
    department: professionDepartment(r.profession),
    content: r.content,
    soap: r.soap,
    problems: r.problems,
    medicationChangeId: r.medicationChangeId,
    orderId: r.orderId,
    restrictionEventId: r.restrictionEventId,
    restrictionType: r.restrictionType,
    recordId: r.id,
  };
}

function nursingToTimeline(
  r: NursingRecord,
  patientId: string,
  i: number,
): TimelineRecord {
  const type = inferNursingType(r);
  let soap: PhysicianSoap | undefined;
  let content: string | undefined;
  if (type === "soap") {
    // 看護記録側の S/O/A/P をそのまま参照（再作成・別データへのコピーはしない）。
    const n = normalizeSoapFields(r);
    soap = { s: n.s, o: n.o, a: n.a, p: n.p };
  } else if (type === "pos") {
    content = [
      r.body,
      r.course,
      r.posEvaluation ? `評価：${r.posEvaluation}` : "",
      r.posPlan ? `計画：${r.posPlan}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    content = r.narrative ?? r.content ?? "";
  }
  return {
    id: r.id ?? r.nursingRecordId ?? `nursing-${patientId}-${r.date}-${r.time}-${i}`,
    patientId,
    recordType: "nursing",
    recordedAt: `${r.date} ${r.time}`,
    date: r.date,
    time: r.time,
    author: r.author,
    profession: "看護",
    department: professionDepartment("看護"),
    content,
    soap,
    focus: r.focus,
    nursingType: type,
    nursingRecordId: r.nursingRecordId,
  };
}

/**
 * 診療録タブに表示する経過記録タイムラインを組み立てる。
 * - 医師などの診療録: clinicalRecords のうち「看護」以外（看護は nursingRecords を正とする）
 * - 看護記録: nursingRecords（看護記録タブと同一の元データ）
 * 元データは移動・複製せず、この関数の中で表示用に変換するだけ。
 */
export function buildClinicalTimeline(
  data: ChartData,
  patientId: string,
): TimelineRecord[] {
  const medical = data.clinicalRecords
    .filter((r) => r.profession !== "看護")
    .map((r, i) => medicalToTimeline(r, patientId, i));
  const nursing = data.nursingRecords.map((r, i) =>
    nursingToTimeline(r, patientId, i),
  );
  return [...medical, ...nursing];
}
