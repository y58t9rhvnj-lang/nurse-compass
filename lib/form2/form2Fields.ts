import type { Form2SectionId } from "./form2Types";

// 各入力欄のメタ情報。helper は「答え」ではなく「整理の観点」を示す補助文。
export interface Form2FieldMeta {
  id: Form2SectionId;
  label: string;
  helper: string;
}

// 入力欄を帳票のまとまりへグルーピングする。
export interface Form2FieldGroup {
  id: string;
  title: string;
  // 帳票（様式表示）でこのまとまりを一枠として扱うか。
  fields: Form2FieldMeta[];
}

// 「受け持つまでの経過（生育歴・現病歴）」は、入力時は小項目に分けるが
// 様式表示では一つのまとまりとして確認できるようにする。
export const FORM2_PROGRESS_GROUP_ID = "progress";

export const FORM2_FIELD_GROUPS: Form2FieldGroup[] = [
  {
    id: "chiefComplaint",
    title: "主訴",
    fields: [
      {
        id: "chiefComplaint",
        label: "主訴",
        helper:
          "患者本人が現在最も困っていることや、入院時に訴えていた内容を整理してください。",
      },
    ],
  },
  {
    id: FORM2_PROGRESS_GROUP_ID,
    title: "受け持つまでの経過（生育歴・現病歴）",
    fields: [
      {
        id: "developmentalHistory",
        label: "生育歴",
        helper:
          "家族関係、学校生活、就労歴、対人関係など、現在の患者理解に関係する情報を整理してください。",
      },
      {
        id: "familyBackground",
        label: "家族背景",
        helper:
          "家族構成、キーパーソン、家族との関係性や支援状況を整理してください。",
      },
      {
        id: "onsetHistory",
        label: "発症までの経過",
        helper:
          "発症時期や、そのころの生活・症状のあらわれ方を時系列で整理してください。",
      },
      {
        id: "firstAdmissionHistory",
        label: "初回入院までの経過",
        helper:
          "初回受診・初回入院に至るまでの経過（きっかけ・症状・受診状況）を整理してください。",
      },
      {
        id: "admissionHistory",
        label: "その後の入退院歴",
        helper:
          "これまでの入退院の流れや、地域生活・再発の経過を時系列で整理してください。",
      },
      {
        id: "currentAdmissionHistory",
        label: "今回の入院に至る経過",
        helper:
          "今回の入院のきっかけとなった状況や、入院時の症状・経緯を整理してください。",
      },
    ],
  },
  {
    id: "currentStatus",
    title: "現在の状態",
    fields: [
      {
        id: "currentCondition",
        label: "現在の病状",
        helper:
          "現在みられる精神症状、生活状況、治療参加状況、本人の発言を整理してください。",
      },
      {
        id: "currentLife",
        label: "現在の生活状況",
        helper:
          "睡眠・食事・活動・対人交流など、病棟での一日の過ごし方を整理してください。",
      },
      {
        id: "insight",
        label: "本人の病識",
        helper:
          "自分の病気や症状を本人がどう受けとめているか、発言をもとに整理してください。",
      },
      {
        id: "medicationRecognition",
        label: "服薬に対する認識",
        helper:
          "服薬の必要性やこれまでの服薬状況を、本人がどうとらえているか整理してください。",
      },
      {
        id: "dischargeThoughts",
        label: "退院に対する思い",
        helper:
          "退院や退院後の生活について、本人がどのような思いや不安を持っているか整理してください。",
      },
      {
        id: "currentIssues",
        label: "現在の課題",
        helper:
          "患者理解をふまえ、いま支援が必要と考えられる課題を整理してください。",
      },
    ],
  },
  {
    id: "treatmentPolicy",
    title: "医師の治療方針・内容",
    fields: [
      {
        id: "treatmentPolicy",
        label: "医師の治療方針",
        helper:
          "主治医が目標としている治療・退院支援の方向性を整理してください。",
      },
    ],
  },
  {
    id: "therapies",
    title: "薬物療法・各種療法",
    fields: [
      {
        id: "medicationTherapy",
        label: "薬物療法",
        helper:
          "処方内容をふまえ、何を目的にどのような薬物療法が行われているか整理してください。",
      },
      {
        id: "psychotherapy",
        label: "精神療法",
        helper:
          "面接や医師・看護師との関わりなど、精神療法的な支援の内容を整理してください。",
      },
      {
        id: "occupationalTherapy",
        label: "作業療法",
        helper:
          "作業療法への参加状況や、そこでの様子・ねらいを整理してください。",
      },
      {
        id: "sst",
        label: "SST",
        helper:
          "SST（生活技能訓練）への参加状況や、取り組んでいる課題を整理してください。",
      },
      {
        id: "psychoeducation",
        label: "心理教育",
        helper:
          "病気や服薬についての心理教育の内容や、本人の反応を整理してください。",
      },
      {
        id: "otherSupport",
        label: "その他の治療・支援",
        helper:
          "上記以外の治療・支援（多職種連携・地域資源など）があれば整理してください。",
      },
    ],
  },
];

// id からメタ情報を引く（Coach 連携やバリデーションでの利用を想定）。
export const FORM2_FIELD_META: Record<Form2SectionId, Form2FieldMeta> =
  FORM2_FIELD_GROUPS.reduce(
    (acc, group) => {
      for (const field of group.fields) acc[field.id] = field;
      return acc;
    },
    {} as Record<Form2SectionId, Form2FieldMeta>,
  );
