import type {
  Form2BasicInformation,
  Form2History,
} from "./form2Types";

// 各入力欄のメタ情報。helper は「答え」ではなく、
// 情報を探す観点・整理の観点のみを示す（患者の具体情報や模範解答は含めない）。

export interface Form2BasicFieldMeta {
  key: keyof Form2BasicInformation;
  label: string;
  helper: string;
  multiline?: boolean; // 主訴など長文になりうる欄
}

export interface Form2HistoryFieldMeta {
  key: keyof Form2History;
  label: string;
  helper: string;
}

// 患者基本情報（すべて学生入力。自動表示しない）。
export const FORM2_BASIC_FIELDS: Form2BasicFieldMeta[] = [
  {
    key: "patientName",
    label: "患者氏名",
    helper: "電子カルテで受け持ち患者の氏名を確認して記入してください。",
  },
  {
    key: "age",
    label: "年齢",
    helper: "電子カルテのどこに年齢が記載されているか確認してください。",
  },
  {
    key: "sex",
    label: "性別",
    helper: "電子カルテで性別を確認してください。",
  },
  {
    key: "diagnosis",
    label: "診断名",
    helper: "電子カルテのどこに診断名が記載されているか確認してください。",
  },
  {
    key: "pastHistory",
    label: "既往歴",
    helper:
      "これまでに治療を受けた疾患や入院歴とは区別して整理してください。",
    multiline: true,
  },
  {
    key: "admissionType",
    label: "入院形態",
    helper: "現在の入院形態を確認してください。",
  },
  {
    key: "chiefComplaint",
    label: "主訴",
    helper:
      "患者本人が困っていること、つらいと感じていることを整理してください。",
    multiline: true,
  },
];

// 受け持つまでの経過（生育歴・現病歴）— 編集時の小項目。
export const FORM2_HISTORY_FIELDS: Form2HistoryFieldMeta[] = [
  {
    key: "familyBackground",
    label: "家族背景",
    helper:
      "家族構成やキーパーソン、家族との関係が分かる情報を確認して整理してください。",
  },
  {
    key: "developmentalHistory",
    label: "生育歴",
    helper: "生い立ちや、現在の患者理解につながる育ちの情報を整理してください。",
  },
  {
    key: "schoolHistory",
    label: "学校生活",
    helper: "学校生活での様子や対人関係に関する情報を確認してください。",
  },
  {
    key: "employmentHistory",
    label: "就労歴",
    helper: "就労の有無や働き方の経過に関する情報を確認してください。",
  },
  {
    key: "beforeOnset",
    label: "発症までの経過",
    helper:
      "発症時期や、そのころの生活・様子が分かる情報を時系列で整理してください。",
  },
  {
    key: "firstAdmission",
    label: "初回入院までの経過",
    helper:
      "初回受診・初回入院に至るまでの経過を、出所を意識して整理してください。",
  },
  {
    key: "subsequentCourse",
    label: "その後の入退院歴",
    helper: "その後の入退院や地域生活の経過を時系列で整理してください。",
  },
  {
    key: "currentAdmissionCourse",
    label: "今回または現在の入院に至る経過",
    helper: "今回の入院のきっかけや、入院に至る経緯を確認して整理してください。",
  },
  {
    key: "currentCondition",
    label: "現在の病状",
    helper:
      "現在みられる精神症状や、治療参加状況、本人の発言が分かる情報を整理してください。",
  },
  {
    key: "currentLife",
    label: "現在の生活状況",
    helper: "睡眠・食事・活動・対人交流など、病棟での過ごし方を整理してください。",
  },
  {
    key: "insight",
    label: "本人の病識",
    helper:
      "自分の病気や症状を本人がどう受けとめているか、発言をもとに整理してください。",
  },
  {
    key: "medicationRecognition",
    label: "服薬に対する認識",
    helper:
      "服薬の必要性や服薬状況を本人がどうとらえているか、発言や記録から整理してください。",
  },
  {
    key: "dischargeThoughts",
    label: "退院に対する思い",
    helper:
      "退院や退院後の生活について、本人がどう感じているか整理してください。",
  },
];

// 医師の治療方針・内容（1欄に統合）。何を整理するかの観点のみ提示する。
export const FORM2_TREATMENT_HELPER =
  "電子カルテと患者会話をもとに、次の観点をふまえて自分の言葉で整理してください：治療の目標／退院に向けた方向性／薬物療法・精神療法・作業療法・SST・心理教育・その他の治療や支援／現在参加している治療／不参加または拒否している治療／治療に対する本人の反応や認識。単なる一覧の転記ではなく、治療方針と各治療内容の関係が分かるようにまとめてください。";

export const FORM2_TREATMENT_LABEL = "医師の治療方針・内容";
