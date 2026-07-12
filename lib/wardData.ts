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
    admit: "2021/06/18",
    doctor: "鈴木医師",
    nurse: "田中 花子",
    loc: "room",
    locNote: "病室でラジオを聴いている",
    mine: true,
    goal: "生活リズムと自己管理を整え、退院後の地域生活の準備を少しずつ進める。",
    observations: ["夜間の幻聴と睡眠", "服薬自己管理への関心", "日中の活動量とセルフケア"],
    risks: ["幻聴による不眠", "退院・地域生活への不安"],
    schedule: [
      { time: "09:00", label: "SST" },
      { time: "12:00", label: "昼食" },
      { time: "14:00", label: "作業療法（参加は不定）" },
      { time: "17:00", label: "夕食" },
    ],
    activeScheduleIndex: 0,
    profile: {
      lifeHistory:
        "子どもの頃から集団になじみにくく、友人は少なかった。高校で不登校の時期を経て卒業。叔父の店を短期間手伝ったが続かず、次第に社会的なひきこもりとなった。安定した就労歴はない。",
      story:
        "22歳で初回入院し統合失調症と診断。再発と再入院を繰り返し、20代後半に母が死去、その後は自宅での生活が破綻し住居も失った。今回（5回目）は数年前に医療保護入院し、約2年前に任意入院へ移行して現在に至る。",
      values: [
        "静かに自分のペースで過ごしたい",
        "苦手な場所や新しい環境は避けたい",
        "Iさんのように、自分も少しずつできるようになりたい",
      ],
      worries: [
        "夜になると「だめな人間だ」と声が聞こえる",
        "外で一人でやっていけるか自信がない",
        "叔父に嫌われたのではないか",
      ],
      dischargeHope:
        "急がず、まずは安心して過ごしたい。いずれは自分でも生活を管理できるようになりたい。",
      personality:
        "物静かで内向的。人にはあまり関心を向けないが、心を許した相手とは穏やかに過ごせる。まじめで、決めたことには取り組もうとする。",
      family:
        "未婚・同胞なし。父は幼少期に行方不明となり消息不明、母は本人が20代後半の頃に死去。高齢の叔父がキーパーソンだが面会は減少している。",
      hobbies: ["ラジオ（特に夜の番組）を聴くこと", "中庭でIさんと過ごすこと"],
      dailyRhythm:
        "夜は幻聴で寝つけないことがあり、ラジオを聴いて過ごす。日中は活動が低下し、室内で過ごすことが多い。",
      strengths: [
        "便秘など体調の変化を自分で訴え、頓服を求められる",
        "間食を控えるなど体重管理に取り組める",
        "服薬の必要性を理解している",
        "Iさんとの安心できる関係がある",
      ],
      coachQuestions: [
        "「ここにいる方が安心」という言葉の背景には、どんな思いがあるだろう？",
        "Iさんの存在は、Aさんの回復にどんな意味を持っているだろう？",
        "服薬自己管理への関心の芽を、どう大切に育てられるだろう？",
      ],
    },
  },
  I: {
    id: "I",
    name: "Iさん",
    room: "308",
    age: 58,
    sex: "男性",
    diagnosis: "統合失調症",
    admit: "2020/09/14",
    doctor: "鈴木医師",
    loc: "dayroom",
    locNote: "中庭で過ごしている",
    goal: "安定した生活を続け、退院後の一人暮らしに備える。",
    observations: ["服薬自己管理の状況", "他患者との交流"],
    risks: ["再発の予防"],
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
