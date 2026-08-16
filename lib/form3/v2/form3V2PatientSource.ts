// Form3 Phase B5 — Patient Source 参照ビュー（読取専用・純関数）
// 自動抽出・自動入力・Card 下書き作成はしない。

import { getChartData, type ChartData, type NursingRecord } from "@/lib/chartData";
import type { FacingConvoState } from "@/lib/patientFacingData";
import { getObservation } from "@/lib/patientFacingData";
import { PATIENTS, type Patient } from "@/lib/wardData";

export const FORM3_PATIENT_SOURCE_SECTION_IDS = [
  "basics",
  "chart",
  "conversation",
  "laboratory",
  "treatment",
] as const;

export type Form3PatientSourceSectionId =
  (typeof FORM3_PATIENT_SOURCE_SECTION_IDS)[number];

export type Form3PatientSourceItem = {
  id: string;
  title: string;
  body: string;
  meta?: string;
};

export type Form3PatientSourceSection = {
  id: Form3PatientSourceSectionId;
  title: string;
  description: string;
  items: Form3PatientSourceItem[];
};

export type Form3PatientSourceView = {
  patientId: string;
  patientName: string;
  sections: Form3PatientSourceSection[];
};

function nursingRecordBody(r: NursingRecord): string {
  if (typeof r.narrative === "string" && r.narrative.trim()) return r.narrative.trim();
  if (typeof r.content === "string" && r.content.trim()) return r.content.trim();
  if (typeof r.body === "string" && r.body.trim()) return r.body.trim();
  const soap = [r.s, r.o, r.a, r.p]
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((x) => x.trim());
  if (soap.length > 0) return soap.join("\n");
  const legacy = [r.observation, r.intervention, r.evaluation]
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((x) => x.trim());
  return legacy.join("\n");
}

function limitItems<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return items.slice(0, max);
}

export function buildForm3PatientSourceView(args: {
  patientId: string;
  patient?: Patient | null;
  chart?: ChartData | null;
  facing?: FacingConvoState | null;
}): Form3PatientSourceView {
  const patient =
    args.patient ?? PATIENTS[args.patientId] ?? null;
  const chart = args.chart ?? getChartData(args.patientId);
  const facing = args.facing ?? null;
  const patientName = patient?.name ?? chart.patientInfo.name ?? args.patientId;
  const info = chart.patientInfo;
  const observation = getObservation(args.patientId);

  const basicsItems: Form3PatientSourceItem[] = [
    {
      id: "basics-identity",
      title: "基本情報",
      body: [
        `氏名: ${info.name}`,
        `年齢・性別: ${info.age}歳 / ${info.sex}`,
        `病室: ${info.room}`,
        `診断: ${info.diagnosis}`,
        `入院日: ${info.admit}`,
        `担当医: ${info.doctor}`,
        `担当看護師: ${info.nurse}`,
      ].join("\n"),
    },
    {
      id: "basics-context",
      title: "生活・連絡",
      body: [
        `家族: ${info.family}`,
        `職業: ${info.occupation}`,
        `住所: ${info.address}`,
        `緊急連絡先: ${info.emergencyContact}`,
      ].join("\n"),
    },
    {
      id: "basics-observation",
      title: "いまの様子（観察）",
      meta: observation.location,
      body: [
        `表情: ${observation.expression}`,
        `姿勢: ${observation.posture}`,
        `視線: ${observation.gaze}`,
      ].join("\n"),
    },
  ];

  if (patient?.profile?.story) {
    basicsItems.push({
      id: "basics-story",
      title: "入院までの経緯",
      body: patient.profile.story,
    });
  }

  const chartItems: Form3PatientSourceItem[] = [];
  for (const [index, r] of limitItems(chart.nursingRecords, 12).entries()) {
    const body = nursingRecordBody(r);
    if (!body) continue;
    chartItems.push({
      id: r.id ?? r.nursingRecordId ?? `nursing-${index}`,
      title: "看護記録",
      meta: `${r.date} ${r.time} · ${r.author}`,
      body,
    });
  }
  for (const [index, r] of limitItems(chart.clinicalRecords, 12).entries()) {
    const body = typeof r.content === "string" ? r.content.trim() : "";
    if (!body) continue;
    chartItems.push({
      id: r.id ?? `clinical-${index}`,
      title: `${r.profession}記録`,
      meta: `${r.date} ${r.time} · ${r.author}`,
      body,
    });
  }

  const conversationItems: Form3PatientSourceItem[] = [];
  if (facing) {
    for (const [index, entry] of facing.history.entries()) {
      if (entry.role !== "patient") continue;
      const text = entry.text.trim();
      if (!text) continue;
      const id =
        "id" in entry && typeof entry.id === "string" && entry.id
          ? entry.id
          : `facing-patient-${index}`;
      conversationItems.push({
        id,
        title: "患者の発言",
        body: text,
      });
    }
    for (const [index, fact] of facing.disclosedFacts.entries()) {
      const text = fact.trim();
      if (!text) continue;
      conversationItems.push({
        id: `disclosed-${index}`,
        title: "開示された事実",
        body: text,
      });
    }
  }
  if (patient?.profile?.worries?.length) {
    conversationItems.push({
      id: "profile-worries",
      title: "困りごと（本人）",
      body: patient.profile.worries.join("\n"),
    });
  }
  if (patient?.profile?.values?.length) {
    conversationItems.push({
      id: "profile-values",
      title: "大切にしていること",
      body: patient.profile.values.join("\n"),
    });
  }

  const laboratoryItems: Form3PatientSourceItem[] = limitItems(
    chart.exams,
    20,
  ).map((exam, index) => ({
    id: `exam-${exam.kind}-${exam.date}-${index}`,
    title: exam.category,
    meta: `${exam.date} · ${exam.judgement}`,
    body: [exam.summary, exam.comment].filter(Boolean).join("\n"),
  }));

  const treatmentItems: Form3PatientSourceItem[] = [];
  for (const [index, order] of limitItems(
    chart.prescriptionOrders,
    16,
  ).entries()) {
    const drugs = order.groups
      .flatMap((g) =>
        g.drugs.map(
          (d) =>
            `Rp${g.no} ${d.name} ${d.amount}（${g.usage}${g.days ? ` / ${g.days}` : ""}）`,
        ),
      )
      .join("\n");
    treatmentItems.push({
      id: order.medicationChangeId ?? `rx-${index}`,
      title: `処方（${order.category}）`,
      meta: `${order.datetime} · ${order.doctor}`,
      body: [drugs, order.reason, order.comment].filter(Boolean).join("\n"),
    });
  }
  for (const [index, item] of limitItems(
    chart.prescriptionHistory,
    8,
  ).entries()) {
    treatmentItems.push({
      id: `rx-history-${index}`,
      title: "処方歴",
      meta: item.date,
      body: item.label,
    });
  }

  const sections: Form3PatientSourceSection[] = [
    {
      id: "basics",
      title: "患者基本情報",
      description: "氏名・診断・入院・いまの様子など。",
      items: basicsItems,
    },
    {
      id: "chart",
      title: "電子カルテ",
      description: "看護記録・診療録などの一次記録。",
      items: chartItems,
    },
    {
      id: "conversation",
      title: "患者との会話",
      description: "会話で得た発言・開示事実。転記せず参照してください。",
      items: conversationItems,
    },
    {
      id: "laboratory",
      title: "検査",
      description: "血液・心理・画像などの検査結果。",
      items: laboratoryItems,
    },
    {
      id: "treatment",
      title: "治療・薬剤",
      description: "処方オーダーと処方歴。",
      items: treatmentItems,
    },
  ];

  return {
    patientId: args.patientId,
    patientName,
    sections,
  };
}
