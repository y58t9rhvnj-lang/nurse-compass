// 病棟ホームで共有する患者・病室データ
// Sprint5: 患者タップで右パネルを切り替えるため、データを一元管理する

export type Loc = "room" | "dayroom" | "bath" | "interview" | "out" | "rest";

// 患者の現在の場所（凡例・アバター色に使用）
export const LOC: Record<Loc, { label: string; color: string; soft: string }> = {
  room: { label: "病室", color: "#0A84FF", soft: "#E9F2FF" },
  dayroom: { label: "デイルーム", color: "#34C759", soft: "#E7F8ED" },
  bath: { label: "入浴中", color: "#32ADE6", soft: "#E5F5FC" },
  interview: { label: "面談中", color: "#AF52DE", soft: "#F4EBFB" },
  out: { label: "外出中", color: "#FF9500", soft: "#FFF2E1" },
  rest: { label: "休憩・その他", color: "#8E8E93", soft: "#F2F2F7" },
};

export interface ScheduleItem {
  time: string;
  label: string;
}

export interface Patient {
  id: string;
  name: string;
  room: string;
  age: number;
  sex: string;
  diagnosis: string;
  admit: string;
  doctor: string;
  loc: Loc;
  locNote?: string; // 例: 外出中（OT）
  mine?: boolean; // 受け持ち患者
  goal: string;
  observations: string[];
  risks: string[];
  schedule: ScheduleItem[];
  activeScheduleIndex?: number;
}

export const PATIENTS: Record<string, Patient> = {
  A: {
    id: "A",
    name: "Aさん",
    room: "308",
    age: 47,
    sex: "男性",
    diagnosis: "統合失調症",
    admit: "2025/04/12",
    doctor: "鈴木医師",
    loc: "out",
    locNote: "外出中（OT）",
    mine: true,
    goal: "デイルームでの参加を通して、他者との関わりを増やす。",
    observations: ["朝の不安の強さ", "服薬の自己管理", "他者との会話状況"],
    risks: ["睡眠リズムの乱れ", "対人関係のストレス"],
    schedule: [
      { time: "09:30", label: "OT（作業療法）" },
      { time: "12:00", label: "昼食" },
      { time: "14:00", label: "面談（医師）" },
      { time: "17:00", label: "夕食" },
    ],
    activeScheduleIndex: 0,
  },
  I: {
    id: "I",
    name: "Iさん",
    room: "308",
    age: 50,
    sex: "男性",
    diagnosis: "統合失調症",
    admit: "2025/03/20",
    doctor: "鈴木医師",
    loc: "dayroom",
    locNote: "デイルームで過ごしている",
    goal: "他患者との交流を無理なく続ける。",
    observations: ["対人交流の様子", "服薬状況"],
    risks: ["自閉的傾向"],
    schedule: [
      { time: "13:00", label: "レクリエーション" },
      { time: "17:00", label: "夕食" },
    ],
  },
  E: {
    id: "E",
    name: "Eさん",
    room: "311",
    age: 62,
    sex: "女性",
    diagnosis: "うつ病",
    admit: "2025/05/02",
    doctor: "佐藤医師",
    loc: "room",
    locNote: "病室で臥床中",
    mine: true,
    goal: "生活リズムを整え、日中の活動量を増やす。",
    observations: ["食事摂取量", "日中の臥床時間", "気分の変動"],
    risks: ["食欲低下", "自責的な発言"],
    schedule: [
      { time: "10:00", label: "リハビリ" },
      { time: "12:00", label: "昼食" },
      { time: "15:00", label: "面談（医師）" },
      { time: "17:00", label: "夕食" },
    ],
  },
  F: {
    id: "F",
    name: "Fさん",
    room: "312",
    age: 35,
    sex: "男性",
    diagnosis: "双極性障害",
    admit: "2025/06/01",
    doctor: "高橋医師",
    loc: "room",
    locNote: "病室で過ごしている",
    mine: true,
    goal: "睡眠と活動のバランスを整える。",
    observations: ["睡眠時間", "多弁・多動の程度", "金銭管理"],
    risks: ["気分の高揚", "衝動性"],
    schedule: [
      { time: "09:00", label: "SST" },
      { time: "12:00", label: "昼食" },
      { time: "14:00", label: "作業療法" },
      { time: "17:00", label: "夕食" },
    ],
  },
  G: {
    id: "G",
    name: "Gさん",
    room: "312",
    age: 28,
    sex: "女性",
    diagnosis: "不安障害",
    admit: "2025/06/10",
    doctor: "高橋医師",
    loc: "dayroom",
    locNote: "デイルームで過ごしている",
    goal: "不安時の対処法を身につける。",
    observations: ["不安の訴え", "頓服使用の状況"],
    risks: ["過呼吸発作"],
    schedule: [
      { time: "11:00", label: "心理教育" },
      { time: "17:00", label: "夕食" },
    ],
  },
};

// 病室ごとのベッド配置（患者ID または null=空床）。個室は1床。
export const ROOM_LAYOUT: Record<
  string,
  { type: "個室" | "4人部屋"; beds: (string | null)[] }
> = {
  "307": { type: "個室", beds: [null] },
  "308": { type: "4人部屋", beds: ["A", "I", null, null] },
  "309": { type: "個室", beds: [null] },
  "310": { type: "個室", beds: [null] },
  "311": { type: "4人部屋", beds: ["E", null, null, null] },
  "312": { type: "4人部屋", beds: ["F", "G", null, null] },
};

export const DEFAULT_PATIENT_ID = "A";
