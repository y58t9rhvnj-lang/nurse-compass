// 病棟ホームで共有する患者・病室データ
// Sprint5: 患者タップで右パネルを切り替えるため、データを一元管理する
// 状態色は Design System(docs/03) に一本化する

export type Loc = "room" | "dayroom" | "interview" | "out" | "exam";

// 患者の現在の場所（凡例・アバター色に使用）
// Design System: 病室=Blue / デイルーム=Green / 面談=Purple / 外出=Orange / 検査=Gray
export const LOC: Record<Loc, { label: string; color: string; soft: string }> = {
  room: { label: "病室", color: "#0A84FF", soft: "#E9F2FF" },
  dayroom: { label: "デイルーム", color: "#34C759", soft: "#E7F8ED" },
  interview: { label: "面談", color: "#AF52DE", soft: "#F4EBFB" },
  out: { label: "外出", color: "#FF9500", soft: "#FFF2E1" },
  exam: { label: "検査", color: "#8E8E93", soft: "#F2F2F7" },
};

export interface ScheduleItem {
  time: string;
  label: string;
}

// 患者トップ用「一人の人」情報（Patient First）。任意フィールド。
export interface PatientProfile {
  lifeHistory?: string; // 生活歴（職業・家族構成・生い立ち）
  story?: string; // 入院までの経緯（物語として）
  values?: string[]; // 大切にしていること・価値観
  worries?: string[]; // 困りごと（本人の主観）
  dischargeHope?: string; // 退院への思い
  hobbies?: string[]; // 趣味・好きなこと
  personality?: string; // 性格・人柄（短文）
  family?: string; // 家族構成・キーパーソン
  dailyRhythm?: string; // 入院前の生活リズム
  strengths?: string[]; // その人の強み・できていること
  coachQuestions?: string[]; // Compass Coach の問い（患者別・手書き）
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
  nurse?: string; // 担当看護師
  loc: Loc;
  locNote?: string; // 例: 外出（OT）
  mine?: boolean; // 受け持ち患者
  goal: string;
  observations: string[];
  risks: string[];
  schedule: ScheduleItem[];
  activeScheduleIndex?: number;
  profile?: PatientProfile; // 患者トップの人物情報（未入力の場合あり）
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
    nurse: "田中 花子",
    loc: "out",
    locNote: "外出（OT）",
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
    profile: {
      lifeHistory:
        "高校卒業後、地元の印刷会社で長く製本の仕事に従事してきた。父の他界後は母と二人暮らし。もともと物静かで、まじめな働き者だったと母は語る。",
      story:
        "5年ほど前から「見られている」という訴えが増え、仕事を休みがちに。半年前から不眠と食欲低下が強まり、近医を経て今回が2回目の入院となった。",
      values: [
        "母に心配をかけたくない",
        "自分のペースを保ちたい",
        "静かな環境で過ごしたい",
      ],
      worries: [
        "また同じ症状が出ないか不安",
        "退院後に一人でやっていけるか",
        "人が多い場所が苦手",
      ],
      dischargeHope:
        "母と穏やかに暮らしながら、少しずつでも働くことを取り戻したい。",
      personality:
        "口数は少ないが、頼まれたことは最後まで丁寧にやり遂げる実直な人。一度心を許すと冗談も言う。",
      family:
        "母（78歳）と二人暮らし。母がキーパーソンで、面会にもよく訪れる。妹は他県に在住。",
      hobbies: ["ラジオの深夜番組を聴くこと", "将棋（詰将棋を解く）", "盆栽の手入れ"],
      dailyRhythm:
        "朝は6時起床。日中は製本の仕事、帰宅後は母と夕食をとり、夜はラジオを聴いて23時就寝という規則正しい生活だった。",
      strengths: [
        "決めたことをこつこつ続けられる",
        "手先が器用で細かい作業が得意",
        "服薬の必要性を理解している",
      ],
      coachQuestions: [
        "「母に心配をかけたくない」という思いを、退院支援の目標づくりにどう活かせるか？",
        "静かな環境を好むAさんにとって、安心できる日中の過ごし方は？",
        "詰将棋や盆栽など集中できる活動を、回復のリズムづくりに使えないか？",
      ],
    },
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
  H: {
    id: "H",
    name: "Hさん",
    room: "308",
    age: 39,
    sex: "男性",
    diagnosis: "統合失調症",
    admit: "2025/04/28",
    doctor: "鈴木医師",
    loc: "room",
    locNote: "病室で過ごしている",
    goal: "規則的な服薬習慣を身につける。",
    observations: ["服薬アドヒアランス", "幻聴の訴え"],
    risks: ["症状の増悪"],
    schedule: [
      { time: "14:00", label: "作業療法" },
      { time: "17:00", label: "夕食" },
    ],
  },
  B: {
    id: "B",
    name: "Bさん",
    room: "307",
    age: 58,
    sex: "男性",
    diagnosis: "アルコール依存症",
    admit: "2025/05/20",
    doctor: "佐藤医師",
    loc: "room",
    locNote: "病室で過ごしている",
    goal: "断酒への動機を維持する。",
    observations: ["離脱症状の有無", "睡眠状況"],
    risks: ["再飲酒欲求"],
    schedule: [
      { time: "10:00", label: "集団療法" },
      { time: "17:00", label: "夕食" },
    ],
  },
  C: {
    id: "C",
    name: "Cさん",
    room: "310",
    age: 41,
    sex: "女性",
    diagnosis: "パニック障害",
    admit: "2025/06/05",
    doctor: "高橋医師",
    loc: "exam",
    locNote: "検査中",
    goal: "発作時の対処法を身につける。",
    observations: ["発作の頻度", "予期不安の程度"],
    risks: ["外出回避"],
    schedule: [
      { time: "09:00", label: "検査（心電図）" },
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
    nurse: "田中 花子",
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
    profile: {
      lifeHistory:
        "専業主婦として3人の子を育て上げ、長く地域の民生委員も務めた。世話好きで頼られる存在だったが、末子の独立と夫の退職が重なった頃から気力が続かなくなった。",
      story:
        "1年ほど前から早朝覚醒と強い倦怠感が出現。「自分は役に立たない」という発言が増え、食事量も低下。外来治療で改善が乏しく今回入院となった。",
      values: [
        "家族に迷惑をかけたくない",
        "人の役に立ちたい",
        "きちんとしていたい",
      ],
      worries: [
        "食欲がわかない",
        "夜眠れない",
        "何もできない自分を責めてしまう",
      ],
      dischargeHope: "また家族のために台所に立てるようになりたい。",
      personality:
        "面倒見がよく、周囲に気を配る世話好き。責任感が強い一方、自分のことは後回しにしがち。",
      family:
        "夫（65歳・退職）と二人暮らし。長女が近隣に住みキーパーソン。孫が2人おり会うのを楽しみにしていた。",
      hobbies: ["家庭菜園", "手芸（編み物）", "近所の友人とのおしゃべり"],
      dailyRhythm:
        "早起きで、朝は畑の水やりから一日が始まっていた。家事全般を担い、午後は近所付き合いや趣味の時間を持っていた。",
      strengths: [
        "人の気持ちに気づき、寄り添える",
        "家事や段取りの力が高い",
        "困っている人を放っておけない優しさ",
      ],
      coachQuestions: [
        "「人の役に立ちたい」というEさんの価値観を、回復期の小さな役割づくりにどう結びつけるか？",
        "「何もできない自分を責める」訴えに対し、できていることをどう一緒に確認するか？",
        "孫や家族との再会を、退院後の希望としてどう支援計画に位置づけるか？",
      ],
    },
  },
  K: {
    id: "K",
    name: "Kさん",
    room: "311",
    age: 55,
    sex: "女性",
    diagnosis: "うつ病",
    admit: "2025/05/15",
    doctor: "佐藤医師",
    loc: "interview",
    locNote: "面談中",
    goal: "気分の変化を言葉にできる。",
    observations: ["表情・発語量", "睡眠状況"],
    risks: ["希死念慮"],
    schedule: [
      { time: "11:00", label: "面談（医師）" },
      { time: "17:00", label: "夕食" },
    ],
  },
  L: {
    id: "L",
    name: "Lさん",
    room: "311",
    age: 30,
    sex: "男性",
    diagnosis: "双極性障害",
    admit: "2025/06/08",
    doctor: "高橋医師",
    loc: "room",
    locNote: "病室で過ごしている",
    goal: "睡眠リズムを整える。",
    observations: ["睡眠時間", "活動量"],
    risks: ["衝動性"],
    schedule: [
      { time: "15:00", label: "心理教育" },
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
    nurse: "田中 花子",
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
    profile: {
      lifeHistory:
        "大学卒業後、IT企業で営業として活躍。行動力があり社交的だが、以前から気分の波を指摘されていた。現在は独身で一人暮らし。",
      story:
        "3週間ほど前から睡眠時間が2〜3時間でも活動的になり、高額な買い物や多弁が目立つように。家族の勧めで受診し、躁状態のため入院となった。",
      values: [
        "仕事で成果を出したい",
        "人とのつながりを大切にしたい",
        "自由でいたい",
      ],
      worries: [
        "じっとしていられない",
        "気分の波を自分で止められない",
        "衝動的に買い物をしてしまう",
      ],
      dischargeHope: "気分の波とうまく付き合いながら、仕事に復帰したい。",
      personality:
        "明るく社交的で、初対面でもすぐ打ち解ける。アイデア豊富で行動が早いが、勢い任せになりやすい面も。",
      family:
        "独身・一人暮らし。両親は同市内に在住でキーパーソン。会社の同僚とのつながりも強い。",
      hobbies: ["フットサル", "カフェ巡り", "ガジェット・新しいアプリを試すこと"],
      dailyRhythm:
        "調子の良い時期は朝型で活動的だが、躁の波が来ると睡眠を削って夜通し活動してしまう不安定さがあった。",
      strengths: [
        "発想力と行動力がある",
        "人と関係を築くのが得意",
        "調子の良い時は段取りよく物事を進められる",
      ],
      coachQuestions: [
        "「自由でいたい」というFさんの価値観を尊重しつつ、休息の必要性をどう共有するか？",
        "気分の波のサインを、Fさん自身と一緒にどう見つけていけるか？",
        "仕事復帰への意欲を、焦りではなく段階的な目標にどう変換するか？",
      ],
    },
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
  M: {
    id: "M",
    name: "Mさん",
    room: "312",
    age: 46,
    sex: "女性",
    diagnosis: "統合失調感情障害",
    admit: "2025/05/28",
    doctor: "鈴木医師",
    loc: "room",
    locNote: "病室で過ごしている",
    goal: "日中活動への参加を増やす。",
    observations: ["活動量", "気分の変動"],
    risks: ["意欲低下"],
    schedule: [
      { time: "13:00", label: "レクリエーション" },
      { time: "17:00", label: "夕食" },
    ],
  },
};

// 病室ごとのベッド配置（患者ID または null=空床）。個室は1床。
export const ROOM_LAYOUT: Record<
  string,
  { type: "個室" | "4人部屋"; beds: (string | null)[] }
> = {
  "307": { type: "個室", beds: ["B"] },
  "308": { type: "4人部屋", beds: ["A", "I", "H", null] },
  "309": { type: "個室", beds: [null] },
  "310": { type: "個室", beds: ["C"] },
  "311": { type: "4人部屋", beds: ["E", "K", "L", null] },
  "312": { type: "4人部屋", beds: ["F", "G", "M", null] },
};

export const DEFAULT_PATIENT_ID = "A";

// --- 病棟サマリー（マップ表示と上部カードの数値を一致させるために算出） ---
export const TOTAL_BEDS = Object.values(ROOM_LAYOUT).reduce(
  (sum, r) => sum + r.beds.length,
  0,
);
export const ADMITTED_COUNT = Object.keys(PATIENTS).length;
export const MY_PATIENTS = Object.values(PATIENTS).filter((p) => p.mine);
