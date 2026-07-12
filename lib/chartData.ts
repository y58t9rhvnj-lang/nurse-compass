// Compass Chart ダミーデータ（Sprint9A）
// 受け持ち3名（A・E・F）を詳細記述。他患者は wardData から最小データを生成。

import { PATIENTS, type Patient } from "./wardData";

// ── 型定義 ──────────────────────────────────────────

export interface ClinicalRecord {
  id?: string; // 一意な記録ID（外部導線から特定の1件へ厳密にリンクするため）
  date: string;
  time: string;
  profession: string;
  author: string;
  content: string;
  medicationChangeId?: string; // 対応する処方オーダーと共有するID（処方開始・変更・中止に関連する記録）
  nursingRecordId?: string; // フローシート特記事項と共有するID（大元の看護記録）
  restrictionEventId?: string; // 行動制限イベントの原記録を束ねる共通ID
  restrictionType?: string; // 隔離 / 身体拘束
  restrictionPhase?: "開始" | "観察" | "再評価" | "解除"; // フェーズ（マーク導出に使用）
}

export interface PatientInfoFields {
  patientNo: string;
  name: string;
  age: number;
  sex: string;
  room: string;
  diagnosis: string;
  admit: string;
  doctor: string;
  nurse: string;
  family: string;
  address: string;
  phone: string;
  emergencyContact: string;
  occupation: string;
  bloodType: string;
}

export interface LifeHistoryItem {
  title: string;
  content: string;
}

export interface EpisodeItem {
  date: string;
  type: string;
  facility: string;
  description: string;
}

export interface NursingRecord {
  date: string;
  time: string;
  author: string;
  observation: string;
  intervention: string;
  evaluation: string;
}

export interface OTRecord {
  date: string;
  participation: string;
  activity: string;
  concentration: string;
  social: string;
  staffNote: string;
}

export interface PSWRecord {
  date: string;
  family: string;
  discharge: string;
  system: string;
  community: string;
}

// 服薬実施状況の記号（自立・声かけ・介助・拒否・保留・未実施）
export type MedAdminStatus = "自" | "促" | "介" | "拒" | "保" | "未";
// フローシートの服薬区分
export type MedSlot = "朝" | "昼" | "夕" | "就寝前";

export interface FlowsheetDay {
  date: string;
  dayOfStay: number;
  sleep: string;
  meal: string;
  elimination: string;
  activity: string;
  medication: string; // レガシー（フローシートには非表示。詳細は処方タブで確認）
  vitals: string;
  sleepDetail?: string; // 日別詳細（入眠・覚醒・睡眠の質）
  activityDetail?: string; // 日別詳細（参加プログラム・活動量）
  specialNote?: string; // 看護記録行の特記事項タイトル（無ければ「特記事項なし」）
  nursingRecordId?: string; // 診療録の看護記録と共有するID
  // 服薬実施状況（区分ごとの記号）。既定は処方から導出したスロット=「自」。
  // 服薬上の問題がある日だけ上書きする（薬剤名・用量は持たない＝二重管理しない）。
  medicationAdmin?: Partial<Record<MedSlot, MedAdminStatus>>;
}

// 行動制限は診療録（ClinicalRecord）の原記録に一元化。
// フローシートの日別マークは診療録から派生する（下記 deriveRestrictionMap）。
export interface DailyRestriction {
  eventId: string; // restrictionEventId
  type: string; // 隔離 / 身体拘束
  label: string; // 隔離 / 隔離継続 / 隔離解除 など（自動生成）
}

// 検査：一覧→詳細の2段階。カテゴリごとに種別が異なる。
export interface ExamItemRow {
  name: string;
  value: string;
  unit: string;
  reference: string;
  flag?: "H" | "L"; // 異常時のみ
}

export interface BloodExam {
  kind: "blood";
  date: string;
  category: string; // 血液検査（一般）/ 肝機能 / 腎機能 / 電解質 / 脂質 / 血糖 など
  summary: string; // 代表結果
  judgement: string; // 判定（正常 / 要経過観察 など）
  comment: string;
  rows: ExamItemRow[];
}

export interface PsychExam {
  kind: "psych";
  date: string;
  category: string; // 心理検査
  summary: string;
  judgement: string;
  comment: string;
  testName: string;
  score: string;
  reference: string;
  finding: string;
}

export interface ImagingExam {
  kind: "imaging";
  date: string;
  category: string; // 胸部X線 など
  summary: string;
  judgement: string;
  comment: string;
  purpose: string;
  finding: string;
}

export type ExamRecord = BloodExam | PsychExam | ImagingExam;

// 処方は「医師オーダー」として Rp 単位で読む。
export interface RpDrug {
  name: string; // 例: リスペリドン錠1mg
  amount: string; // 例: 2錠
}

export interface RpGroup {
  no: number; // Rp番号
  drugs: RpDrug[];
  usage: string; // 服用方法・回数（例: 分3 毎食後 / 不眠時 就寝前）
  days?: string; // 日数・回数分（例: 28日分 / 5回分）
}

export type PrescriptionCategory = "定期" | "頓服" | "注射";

export interface PrescriptionOrder {
  datetime: string; // 例: 2025/07/09 09:32
  doctor: string; // 例: 精神科 鈴木 一郎 医師
  category: PrescriptionCategory;
  reason?: string; // 変更理由
  comment?: string; // コメント（眠気に注意 等）
  groups: RpGroup[];
  medicationChangeId?: string; // 対応する診療録記録と共有するID
}

export interface PrescriptionHistoryItem {
  date: string;
  label: string; // 例: リスペリドン増量 / 頓服追加
}

export interface ChartData {
  clinicalRecords: ClinicalRecord[];
  patientInfo: PatientInfoFields;
  lifeHistory: LifeHistoryItem[];
  episodes: EpisodeItem[];
  nursingRecords: NursingRecord[];
  otRecords: OTRecord[];
  pswRecords: PSWRecord[];
  flowsheet: FlowsheetDay[];
  exams: ExamRecord[];
  prescriptionOrders: PrescriptionOrder[];
  prescriptionHistory: PrescriptionHistoryItem[];
}

// バイタル文字列（例: "T36.5 P72 R16 BP118/72"）を数値へ分解。グラフ用。
export interface ParsedVitals {
  temp: number | null;
  pulse: number | null;
  resp: number | null;
  sysBP: number | null;
  diaBP: number | null;
}

export function parseVitals(vitals: string): ParsedVitals {
  const temp = vitals.match(/T([\d.]+)/);
  const pulse = vitals.match(/P(\d+)/);
  const resp = vitals.match(/R(\d+)/);
  const bp = vitals.match(/BP(\d+)\/(\d+)/);
  return {
    temp: temp ? Number(temp[1]) : null,
    pulse: pulse ? Number(pulse[1]) : null,
    resp: resp ? Number(resp[1]) : null,
    sysBP: bp ? Number(bp[1]) : null,
    diaBP: bp ? Number(bp[2]) : null,
  };
}

// ── Aさん ──────────────────────────────────────────

const CHART_A: ChartData = {
  clinicalRecords: [
    {
      date: "2025/07/09",
      time: "14:30",
      profession: "医師",
      author: "鈴木医師",
      content:
        "【精神科 経過記録】デイルーム参加後、表情はやや穏やか。OT帰院後に「人が多いと疲れる」と訴えあり。症状は安定傾向。服薬コンプライアンス良好。引き続き社会機能回復を目標にプログラム参加を促す。GAF 55。",
    },
    {
      date: "2025/07/09",
      time: "11:15",
      profession: "看護",
      author: "田中 花子",
      nursingRecordId: "nursing-a-20250709-01",
      content:
        "【看護記録】09:30 OT外出。帰院後、疲労感を訴え病室で休息。昼食は8割摂取。午後はデイルームで将棋の詰将棋に集中。他患者との会話は1回、短い応答にとどまったが拒否はなし。",
    },
    {
      date: "2025/07/09",
      time: "08:40",
      profession: "薬剤",
      author: "薬剤師 中村",
      medicationChangeId: "rx-a-20250709-teiki",
      content:
        "【服薬指導】自己管理継続中。飲み忘れなし。手指の軽い振戦を自覚しているが日常生活に支障なしとのこと。定期処方（リスペリドン・ビペリデン）の効果と副作用について再説明。次回、血中濃度の必要性を医師と相談予定。",
    },
    {
      date: "2025/07/08",
      time: "16:00",
      profession: "OT",
      author: "作業療法士 山本",
      content:
        "【作業療法記録】木工プログラムに参加。30分間集中して作業、途中離席なし。他参加者2名と道具の受け渡しで短い会話あり。終了後「少し疲れたが、できてよかった」との発言。",
    },
    {
      date: "2025/07/08",
      time: "09:20",
      profession: "看護",
      author: "田中 花子",
      nursingRecordId: "nursing-a-20250708-01",
      content:
        "【看護記録】朝の申し送り時、やや硬い表情。「まだ見られている感じが少し残る」と軽度の被害的訴えあり。頓服は使用せず経過。傾聴後、詰将棋を始めて落ち着く。",
    },
    {
      date: "2025/07/07",
      time: "15:10",
      profession: "心理",
      author: "公認心理師 大野",
      content:
        "【心理面接】被害的な考えは入院時より軽減。対人場面での緊張は残存。「人の輪に入るのが苦手」と語る。強みとして「集中して物事に取り組める」点を本人と共有。",
    },
    {
      date: "2025/07/07",
      time: "10:00",
      profession: "医師",
      author: "鈴木医師",
      content:
        "【精神科 経過記録】多職種カンファレンス実施。母の面会報告より、退院後は母と二人暮らしを継続予定。地域包括支援センターとの連携を検討。日中活動の場の確保が課題。",
    },
    {
      date: "2025/07/06",
      time: "13:30",
      profession: "PSW",
      author: "MSW 伊藤",
      content:
        "【ソーシャルワーク記録】母と面談。退院後の生活リズム維持について話し合い。近隣のデイケア利用に前向きな意向。次回、利用施設の情報提供を予定。経済面は障害年金と母の年金で対応可能。",
    },
    {
      id: "clinical-a-20250705-sleep-01",
      date: "2025/07/05",
      time: "23:45",
      profession: "看護",
      author: "看護師 佐々木",
      nursingRecordId: "nursing-a-20250705-01",
      content:
        "【看護記録】夜間、不眠の訴えあり。ラジオの深夜番組を聴いて落ち着く。23:30頃入眠。翌朝6:30起床。服薬は自己管理で実施、確認済み。",
    },
    {
      date: "2025/07/05",
      time: "21:00",
      profession: "医師",
      author: "鈴木 一郎 医師",
      medicationChangeId: "rx-a-20250705-tonpuku",
      content:
        "【精神科 指示記録】夜間の不眠が続くため、就寝前の頓服（ロラゼパム0.5mg）を追加する。ふらつき・転倒に注意し、連用を避けて経過をみる。",
    },
    {
      date: "2025/07/04",
      time: "15:30",
      profession: "看護",
      author: "看護師 佐々木",
      nursingRecordId: "nursing-a-20250704-01",
      content:
        "【看護記録】面会に来た母が菓子折りを持参。スタッフへの差し入れは丁重に辞退する旨を説明。売店でコーヒーを購入し、談話室で母と穏やかに過ごす。面会後「母は元気そうだった」と話す。",
    },
    {
      date: "2025/07/03",
      time: "10:15",
      profession: "看護",
      author: "田中 花子",
      content:
        "【看護記録・事務連絡】健康保険証の更新書類を本人より受領し、医事課へ提出。盆栽の手入れがしたいと希望あり、作業療法士へ相談予定と伝える。",
    },
    {
      date: "2025/04/13",
      time: "09:30",
      profession: "医師",
      author: "鈴木 一郎 医師",
      restrictionEventId: "restriction-a-20250412-seclusion",
      restrictionType: "隔離",
      restrictionPhase: "解除",
      content:
        "【精神科 指示記録】状態改善により隔離解除。解除日時 2025/04/13 09:30。疎通良好、被害的訴えの軽減と危険行動の消失を確認。解除判断：非代替性が解消したと評価。解除後は一般病室で15〜30分ごとの観察を継続し、開放処遇へ段階的に移行する。",
    },
    {
      date: "2025/04/12",
      time: "14:00",
      profession: "医師",
      author: "鈴木 一郎 医師",
      restrictionEventId: "restriction-a-20250412-seclusion",
      restrictionType: "隔離",
      restrictionPhase: "再評価",
      content:
        "【精神科 指示記録】隔離継続の必要性を再評価。依然として被害妄想に基づく興奮が残存し、他害・自傷リスクの非代替性を確認。継続理由：刺激遮断による鎮静が必要。翌朝に再評価予定。",
    },
    {
      date: "2025/04/12",
      time: "10:40",
      profession: "看護",
      author: "看護師 佐々木",
      restrictionEventId: "restriction-a-20250412-seclusion",
      restrictionType: "隔離",
      restrictionPhase: "観察",
      content:
        "【看護記録】隔離室入室後の状態観察。表情は硬く、独語あり。「見張られている」との発言。バイタル安定（T36.6 P88 BP132/82）。飲水・排尿は促しで可能。危険行動なし。15分ごとに巡視し記録を継続。",
    },
    {
      date: "2025/04/12",
      time: "10:20",
      profession: "医師",
      author: "鈴木 一郎 医師",
      restrictionEventId: "restriction-a-20250412-seclusion",
      restrictionType: "隔離",
      restrictionPhase: "開始",
      content:
        "【精神科 指示記録】隔離開始。著しい興奮と他害リスクがあり、投薬・環境調整では代替できない（非代替性）ことを確認したうえで隔離を開始する。開始日時 2025/04/12 10:20。理由：被害妄想に基づく興奮・易刺激性。医師指示：精神保健指定医の診察に基づき隔離を指示。再評価予定：本日14時および翌朝に評価。",
    },
  ],
  patientInfo: {
    patientNo: "P-2025-0308",
    name: "Aさん",
    age: 47,
    sex: "男性",
    room: "308",
    diagnosis: "統合失調症",
    admit: "2025/04/12",
    doctor: "鈴木医師",
    nurse: "田中 花子",
    family: "母（78歳）と二人暮らし。妹は他県在住。母がキーパーソン。",
    address: "〒123-4567 東京都○○区△△町1-2-3",
    phone: "03-1234-5678",
    emergencyContact: "母 ○○（携帯 090-XXXX-XXXX）",
    occupation: "印刷会社勤務（休職中）",
    bloodType: "A型",
  },
  lifeHistory: [
    {
      title: "生活歴",
      content:
        "高校卒業後、地元の印刷会社で長く製本の仕事に従事。父の他界後は母と二人暮らし。もともと物静かで、まじめな働き者だった。趣味は将棋と盆栽。",
    },
    {
      title: "現病歴",
      content:
        "5年ほど前から「見られている」という訴えが増え、仕事を休みがちに。半年前から不眠と食欲低下が強まり、近医を経て今回が2回目の入院。",
    },
    {
      title: "家族背景",
      content:
        "母（78歳）がキーパーソン。面会に週1回訪問。妹は他県在住で電話連絡。父は10年前に他界。家族関係はおおむね良好。",
    },
    {
      title: "職業歴",
      content:
        "印刷会社に20年以上勤務。製本・断裁の技術職。上司からは「黙々と仕事ができる」と評価。休職前は残業も多かった。",
    },
    {
      title: "価値観",
      content:
        "母に心配をかけたくない。自分のペースを保ちたい。静かな環境で過ごしたい。",
    },
    {
      title: "退院への思い",
      content:
        "母と穏やかに暮らしながら、少しずつでも働くことを取り戻したい。",
    },
  ],
  episodes: [
    { date: "2025/04/12", type: "入院", facility: "本院 精神科3病棟", description: "2回目の入院。不眠・被害妄想の増悪。" },
    { date: "2024/11/20", type: "退院", facility: "本院", description: "前回入院から3ヶ月。母宅へ退院。" },
    { date: "2024/08/15", type: "入院", facility: "本院 精神科3病棟", description: "初回入院。仕事のストレスと不眠。" },
    { date: "2023/06/01", type: "外来", facility: "近医 精神科", description: "不眠・不安の主訴で初診。" },
    { date: "2020/03/15", type: "外来", facility: "内科", description: "健康診断。異常なし。" },
  ],
  nursingRecords: [
    {
      date: "2025/07/09",
      time: "14:30",
      author: "田中 花子",
      observation: "デイルームで将棋に集中。表情は穏やか。会話は短いが拒否なし。",
      intervention: "水分補給を促す。16:00の面談予定を伝える。",
      evaluation: "活動参加は良好。疲労時は休息を取るよう声かけ継続。",
    },
    {
      date: "2025/07/09",
      time: "09:00",
      author: "田中 花子",
      observation: "起床後、やや緊張した表情。OT外出前に「人が多いのが心配」と発言。",
      intervention: "OTの内容を事前説明。帰院後の休息時間を確保するよう調整。",
      evaluation: "外出は実施。帰院後に疲労訴えあり、休息後は落ち着く。",
    },
    {
      date: "2025/07/08",
      time: "22:00",
      author: "看護師 佐々木",
      observation: "就寝前、ラジオを聴いている。23:00頃消灯。",
      intervention: "夜間巡視で入眠確認。",
      evaluation: "23:30頃入眠。夜間覚醒なし。",
    },
    {
      date: "2025/07/07",
      time: "16:30",
      author: "田中 花子",
      observation: "カンファレンス後、「退院してやっていけるか不安」と表出。表情はやや硬い。",
      intervention: "不安の内容を傾聴。退院はまだ先であり、一つずつ準備することを説明。",
      evaluation: "「少し気が楽になった」と発言。不安表出を受け止める関わりを継続。",
    },
    {
      date: "2025/07/04",
      time: "15:40",
      author: "看護師 佐々木",
      observation: "母の面会あり。表情は穏やか。売店で買い物、院内を短時間歩行。",
      intervention: "面会・外出の様子を見守り。疲労がないか確認。",
      evaluation: "疲労の訴えなし。対人交流・活動の広がりを継続支援。",
    },
  ],
  otRecords: [
    {
      date: "2025/07/09",
      participation: "参加",
      activity: "木工プログラム（小物作り）",
      concentration: "良好（30分持続）",
      social: "他参加者2名と道具の受け渡しで短い会話",
      staffNote: "終了後「少し疲れたが、できてよかった」との発言。",
    },
    {
      date: "2025/07/08",
      participation: "参加",
      activity: "作業療法評価（ADL確認）",
      concentration: "普通",
      social: "スタッフとの一対一",
      staffNote: "手先の器用さは維持。集団活動への段階的参加を計画。",
    },
  ],
  pswRecords: [
    {
      date: "2025/07/06",
      family: "母と面談。退院後の生活リズム維持について話し合い。",
      discharge: "母宅への退院を予定。段階的な外出許可を検討。",
      system: "地域包括支援センターへの照会予定。",
      community: "近隣のデイケア利用に前向きな意向。",
    },
    {
      date: "2025/06/20",
      family: "妹と電話面談。遠方のため面会は困難だが、電話での声かけは継続。",
      discharge: "退院後の見守り体制について家族で協議中。",
      system: "生活保護の該当なし。",
      community: "以前通っていた作業所への復帰希望あり。",
    },
  ],
  flowsheet: [
    { date: "2025/07/09", dayOfStay: 89, sleep: "23:30就寝 / 6:30起床", meal: "朝8割 昼8割 夕予定", elimination: "排便1回", activity: "OT参加・デイルーム", medication: "全量自己管理", vitals: "T36.5 P72 R16 BP118/72", sleepDetail: "入眠23:30・中途覚醒なし・熟眠感あり（約7時間）", activityDetail: "午前OT（木工）30分参加、午後デイルームで詰将棋", specialNote: "OT参加後に疲労訴え", nursingRecordId: "nursing-a-20250709-01" },
    { date: "2025/07/08", dayOfStay: 88, sleep: "23:00就寝 / 6:00起床", meal: "朝7割 昼9割 夕8割", elimination: "排便1回", activity: "デイルーム・作業療法", medication: "全量", vitals: "T36.4 P70 R16 BP115/70", sleepDetail: "入眠23:00・覚醒1回（トイレ）・再入眠良好", activityDetail: "作業療法評価に参加、集団活動は短時間", specialNote: "朝に軽度の被害的訴え", nursingRecordId: "nursing-a-20250708-01" },
    { date: "2025/07/07", dayOfStay: 87, sleep: "24:00就寝 / 7:00起床", meal: "朝6割 昼8割 夕7割", elimination: "排便なし", activity: "病室内で過ごす", medication: "全量", vitals: "T36.6 P74 R18 BP120/74", sleepDetail: "入眠までやや時間を要する・熟眠感乏しい", activityDetail: "カンファレンス日。日中は病室で読書、活動量少なめ" },
    { date: "2025/07/06", dayOfStay: 86, sleep: "23:30就寝 / 6:30起床", meal: "朝8割 昼8割 夕8割", elimination: "排便1回", activity: "面会・デイルーム", medication: "全量", vitals: "T36.5 P72 R16 BP118/72", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "母の面会あり。午後デイルームで談話" },
    { date: "2025/07/05", dayOfStay: 85, sleep: "24:30就寝 / 6:30起床", meal: "朝7割 昼7割 夕8割", elimination: "排便1回", activity: "病室内", medication: "全量", vitals: "T36.4 P76 R16 BP122/76", sleepDetail: "不眠の訴えあり・ラジオで入眠（約6時間）", activityDetail: "日中は病室中心、活動量少なめ", specialNote: "中途覚醒あり（不眠）", nursingRecordId: "nursing-a-20250705-01", medicationAdmin: { 就寝前: "自" } },
    { date: "2025/07/04", dayOfStay: 84, sleep: "23:00就寝 / 6:40起床", meal: "朝8割 昼9割 夕8割", elimination: "排便1回", activity: "面会・売店", medication: "全量", vitals: "T36.5 P70 R16 BP116/70", sleepDetail: "入眠良好・熟眠感あり", activityDetail: "母の面会、売店へ外出（院内）", specialNote: "家族面会後に表情穏やか", nursingRecordId: "nursing-a-20250704-01" },
    { date: "2025/07/03", dayOfStay: 83, sleep: "23:30就寝 / 6:30起床", meal: "朝7割 昼8割 夕8割", elimination: "排便1回", activity: "デイルーム", medication: "全量", vitals: "T36.4 P72 R16 BP118/74", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "デイルームで盆栽の話題、活動意欲あり" },
  ],
  exams: [
    {
      kind: "blood",
      date: "2025/06/15",
      category: "血液検査（一般）",
      summary: "WBC 6,200 / Hb 14.2",
      judgement: "正常",
      comment: "異常なし。",
      rows: [
        { name: "WBC", value: "6,200", unit: "/μL", reference: "3,300〜8,600" },
        { name: "RBC", value: "465万", unit: "/μL", reference: "435〜555万" },
        { name: "Hb", value: "14.2", unit: "g/dL", reference: "13.7〜16.8" },
        { name: "Ht", value: "43.1", unit: "%", reference: "40.7〜50.1" },
        { name: "Plt", value: "22.0万", unit: "/μL", reference: "15.8〜34.8万" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/15",
      category: "肝機能",
      summary: "AST 22 / ALT 18",
      judgement: "正常",
      comment: "向精神薬による肝機能への影響なし。",
      rows: [
        { name: "AST", value: "22", unit: "U/L", reference: "13〜30" },
        { name: "ALT", value: "18", unit: "U/L", reference: "10〜42" },
        { name: "γ-GTP", value: "35", unit: "U/L", reference: "13〜64" },
        { name: "ALP", value: "78", unit: "U/L", reference: "38〜113" },
        { name: "T-Bil", value: "0.8", unit: "mg/dL", reference: "0.4〜1.5" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/15",
      category: "腎機能",
      summary: "Cr 0.82 / eGFR 78",
      judgement: "正常",
      comment: "腎機能は保たれている。",
      rows: [
        { name: "BUN", value: "14", unit: "mg/dL", reference: "8〜20" },
        { name: "Cr", value: "0.82", unit: "mg/dL", reference: "0.65〜1.07" },
        { name: "eGFR", value: "78", unit: "mL/min/1.73㎡", reference: "60以上" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/15",
      category: "電解質",
      summary: "Na 133 (L)",
      judgement: "要経過観察",
      comment: "軽度の低ナトリウム血症。多飲傾向や向精神薬の影響に留意し経過観察。",
      rows: [
        { name: "Na", value: "133", unit: "mEq/L", reference: "138〜145", flag: "L" },
        { name: "K", value: "4.2", unit: "mEq/L", reference: "3.6〜4.8" },
        { name: "Cl", value: "101", unit: "mEq/L", reference: "101〜108" },
        { name: "Ca", value: "9.2", unit: "mg/dL", reference: "8.8〜10.1" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/15",
      category: "血糖",
      summary: "HbA1c 5.4",
      judgement: "正常",
      comment: "抗精神病薬使用中のため定期的にモニタリング。",
      rows: [
        { name: "FBS", value: "92", unit: "mg/dL", reference: "73〜109" },
        { name: "HbA1c", value: "5.4", unit: "%", reference: "4.9〜6.0" },
      ],
    },
    {
      kind: "psych",
      date: "2025/05/20",
      category: "心理検査",
      summary: "不安9 / 抑うつ7",
      judgement: "要経過観察",
      comment: "軽度の不安傾向。対人緊張と関連。",
      testName: "HADS（不安・抑うつ尺度）",
      score: "不安 9点 / 抑うつ 7点",
      reference: "各8点以上で疑い",
      finding: "不安がカットオフをやや上回る。抑うつは境界域。対人場面での緊張の訴えと一致。",
    },
    {
      kind: "imaging",
      date: "2025/04/15",
      category: "胸部X線",
      summary: "異常陰影なし",
      judgement: "異常なし",
      comment: "入院時ルーチン。",
      purpose: "入院時スクリーニング",
      finding: "肺野に異常陰影なし。心胸郭比正常。肋骨横隔膜角シャープ。",
    },
  ],
  prescriptionOrders: [
    {
      datetime: "2025/07/09 09:32",
      doctor: "精神科 鈴木 一郎 医師",
      category: "定期",
      medicationChangeId: "rx-a-20250709-teiki",
      reason: "幻覚・妄想の再燃予防（維持量）",
      comment: "眠気・振戦に注意。ふらつき時は転倒に留意。",
      groups: [
        {
          no: 1,
          drugs: [{ name: "リスペリドン錠1mg", amount: "2錠" }],
          usage: "分1　夕食後",
          days: "28日分",
        },
        {
          no: 2,
          drugs: [{ name: "ビペリデン錠1mg", amount: "2錠" }],
          usage: "分2　朝夕食後",
          days: "28日分",
        },
      ],
    },
    {
      datetime: "2025/07/05 21:10",
      doctor: "精神科 鈴木 一郎 医師",
      category: "頓服",
      medicationChangeId: "rx-a-20250705-tonpuku",
      reason: "不眠時頓服の追加",
      comment: "不眠時のみ。連用を避ける。ふらつき・転倒に注意。",
      groups: [
        {
          no: 1,
          drugs: [{ name: "ロラゼパム錠0.5mg", amount: "1錠" }],
          usage: "不眠時　就寝前",
          days: "5回分",
        },
      ],
    },
  ],
  prescriptionHistory: [
    { date: "2025/07/09", label: "定期処方 継続（リスペリドン2mg・ビペリデン2mg）" },
    { date: "2025/07/05", label: "頓服追加（ロラゼパム0.5mg 不眠時）" },
    { date: "2025/06/20", label: "リスペリドン減量（3mg → 2mg）" },
    { date: "2025/04/12", label: "入院時処方 開始" },
  ],
};

// ── Eさん ──────────────────────────────────────────

const CHART_E: ChartData = {
  clinicalRecords: [
    { date: "2025/07/09", time: "15:00", profession: "医師", author: "佐藤医師", content: "【精神科 経過記録】臥床時間は短縮傾向。昼食9割摂取。気分は「まだしんどい」との訴えあるも、会話量は増加。早朝覚醒は残存。GAF 50。抗うつ薬は現用量を維持。" },
    { date: "2025/07/09", time: "11:30", profession: "看護", author: "田中 花子", nursingRecordId: "nursing-e-20250709-01", content: "【看護記録】10:00リハビリ参加。終了後「少し疲れた」との訴え。午後はデイルームで編み物。孫の写真を見て微笑む場面あり。水分摂取はやや少なめ。" },
    { date: "2025/07/08", time: "16:00", profession: "OT", author: "作業療法士 山本", content: "【作業療法記録】園芸プログラムに参加。30分間活動。土いじりに「昔を思い出す」と発言。他参加者との会話は短いが、笑顔が見られた。" },
    { date: "2025/07/08", time: "10:00", profession: "医師", author: "佐藤 恵 医師", medicationChangeId: "rx-e-20250708-teiki", content: "【精神科 指示記録】抑うつの改善が不十分なため、セルトラリンを50mgへ増量する。開始初期の悪心に注意し、食後内服とする。" },
    { date: "2025/07/08", time: "07:10", profession: "看護", author: "看護師 佐々木", nursingRecordId: "nursing-e-20250708-01", id: "clinical-e-20250708-sleep-01", content: "【看護記録】早朝4:30に覚醒し以降入眠できず臥床。「夜が長くてつらい」と訴え。朝食は6割にとどまる。傾聴し、日中の活動を一緒に確認。" },
    { date: "2025/07/07", time: "15:00", profession: "看護", author: "田中 花子", nursingRecordId: "nursing-e-20250707-01", content: "【看護記録】「何もできない自分が嫌」と自責的発言。編み物やリハビリ参加など、できていることを一緒に振り返る。発言後はやや落ち着く。" },
    { date: "2025/07/07", time: "13:00", profession: "PSW", author: "MSW 伊藤", content: "【ソーシャルワーク記録】長女と面談。退院後の家事分担について話し合い。訪問看護の導入を検討。長女は「無理をさせたくない」との思い。介護保険は非該当年齢のため福祉サービスを案内。" },
    { date: "2025/07/06", time: "14:00", profession: "心理", author: "公認心理師 大野", content: "【心理面接】「家族に迷惑をかけている」という認知が繰り返し語られる。認知の偏りを穏やかに確認し、傾聴中心に対応。自傷念慮は否定。" },
    { date: "2025/07/06", time: "10:30", profession: "医師", author: "佐藤医師", content: "【精神科 経過記録】抗うつ薬の効果は徐々に出現。自責的発言は減少傾向。食事摂取量の改善を継続評価。希死念慮は認めない。" },
    { date: "2025/07/06", time: "09:30", profession: "薬剤", author: "薬剤師 中村", content: "【服薬指導】セルトラリンを継続。開始初期にみられた悪心は消失。「薬を飲む意味がわからない時がある」との発言あり、服薬の目的を再度説明。" },
    { date: "2025/07/05", time: "12:40", profession: "看護", author: "看護師 佐々木", content: "【看護記録】昼食後、他患者と園芸の話題で会話。「毛糸を買ってきてほしい」と家族への依頼あり。編み物への意欲がうかがえる。売店の場所を案内。" },
    { date: "2025/07/04", time: "11:00", profession: "栄養", author: "管理栄養士 林", content: "【栄養指導】嗜好調査を実施。煮物や和食を好む。「昔は家族に作っていた」と話す。食事量は徐々に改善傾向。本人の好みを献立に反映予定。" },
  ],
  patientInfo: {
    patientNo: "P-2025-0311",
    name: "Eさん",
    age: 62,
    sex: "女性",
    room: "311",
    diagnosis: "うつ病",
    admit: "2025/05/02",
    doctor: "佐藤医師",
    nurse: "田中 花子",
    family: "夫（65歳）と二人暮らし。長女が近隣に住みキーパーソン。孫2人。",
    address: "〒234-5678 東京都○○区□□町4-5-6",
    phone: "03-2345-6789",
    emergencyContact: "長女 ○○（携帯 080-XXXX-XXXX）",
    occupation: "専業主婦",
    bloodType: "O型",
  },
  lifeHistory: [
    { title: "生活歴", content: "専業主婦として3人の子を育て上げ、長く地域の民生委員も務めた。世話好きで頼られる存在だった。" },
    { title: "現病歴", content: "1年ほど前から早朝覚醒と強い倦怠感が出現。「自分は役に立たない」という発言が増え、食事量も低下。外来治療で改善が乏しく今回入院。" },
    { title: "家族背景", content: "夫（65歳・退職）と二人暮らし。長女が近隣に住みキーパーソン。孫が2人おり会うのを楽しみにしていた。" },
    { title: "職業歴", content: "専業主婦。地域の民生委員を15年務めた。近所の世話好きとして知られていた。" },
    { title: "価値観", content: "家族に迷惑をかけたくない。人の役に立ちたい。きちんとしていたい。" },
    { title: "退院への思い", content: "また家族のために台所に立てるようになりたい。" },
  ],
  episodes: [
    { date: "2025/05/02", type: "入院", facility: "本院 精神科3病棟", description: "うつ状態の増悪。食事量低下・自責感。" },
    { date: "2024/12/10", type: "外来", facility: "本院 精神科外来", description: "抗うつ薬調整。効果不十分。" },
    { date: "2024/03/01", type: "外来", facility: "近医 内科", description: "倦怠感の主訴。精神科紹介。" },
    { date: "2020/08/15", type: "退院", facility: "本院", description: "20年前の産後うつ入院から退院。" },
    { date: "2020/05/20", type: "入院", facility: "本院 精神科2病棟", description: "産後うつ。初回入院。" },
  ],
  nursingRecords: [
    { date: "2025/07/09", time: "11:00", author: "田中 花子", observation: "リハビリ参加後、疲労感を訴えるも表情は穏やか。孫の写真を見て微笑む。", intervention: "休息を促す。水分補給。", evaluation: "活動参加は良好。気分の変動を継続観察。" },
    { date: "2025/07/08", time: "07:00", author: "看護師 佐々木", observation: "早朝4:30覚醒。以降、臥床。朝食6割。", intervention: "起床時間を徐々に遅らせる声かけ。", evaluation: "睡眠リズムの改善を継続支援。" },
    { date: "2025/07/07", time: "15:00", author: "田中 花子", observation: "「何もできない自分が嫌」と自責的発言。", intervention: "できていること（編み物・リハビリ参加）を一緒に振り返る。", evaluation: "発言後、やや落ち着く。傾聴を継続。" },
    { date: "2025/07/05", time: "12:45", author: "看護師 佐々木", observation: "昼食後、他患者と園芸の話題で会話。毛糸の購入を家族に依頼したいと発言。", intervention: "売店の場所を案内し、家族への連絡方法を確認。", evaluation: "趣味への関心が戻りつつある。活動の広がりを支援。" },
    { date: "2025/07/04", time: "11:20", author: "田中 花子", observation: "栄養指導を受ける。「昔は家族に煮物を作っていた」と話す。表情は穏やか。", intervention: "本人の得意だった料理の話題を傾聴。", evaluation: "過去の役割への肯定的な想起。強みとして共有。" },
  ],
  otRecords: [
    { date: "2025/07/09", participation: "参加", activity: "園芸プログラム", concentration: "良好", social: "他参加者1名と短い会話", staffNote: "笑顔が見られた。手先の動きは巧み。" },
    { date: "2025/07/07", participation: "参加", activity: "編み物・手芸", concentration: "良好（45分持続）", social: "スタッフとの会話", staffNote: "以前の趣味を活かした活動。達成感あり。" },
  ],
  pswRecords: [
    { date: "2025/07/07", family: "長女と面談。退院後の家事分担について話し合い。", discharge: "夫婦二人暮らしの継続。長女が週1回の見守り。", system: "訪問看護の導入を検討。", community: "地域のサロン活動への参加希望あり。" },
    { date: "2025/06/15", family: "夫と面談。Eさんの状態について情報共有。", discharge: "退院時期は未定。家族の理解は良好。", system: "介護保険の申請手続きを説明。", community: "デイケア利用の可能性を検討。" },
  ],
  flowsheet: [
    { date: "2025/07/09", dayOfStay: 69, sleep: "4:30覚醒→6:30起床", meal: "朝6割 昼9割 夕8割", elimination: "排便1回", activity: "リハビリ・デイルーム", medication: "全量", vitals: "T36.6 P68 R16 BP128/78", sleepDetail: "早朝4:30覚醒・以降入眠できず・睡眠約5.5時間", activityDetail: "午前リハビリ、午後デイルームで編み物", specialNote: "リハビリ後に疲労、笑顔あり", nursingRecordId: "nursing-e-20250709-01" },
    { date: "2025/07/08", dayOfStay: 68, sleep: "5:00覚醒→6:00起床", meal: "朝5割 昼8割 夕7割", elimination: "排便1回", activity: "デイルーム・園芸", medication: "全量", vitals: "T36.5 P70 R16 BP125/76", sleepDetail: "早朝5:00覚醒・熟眠感乏しい", activityDetail: "OT園芸に参加、笑顔あり", specialNote: "早朝覚醒・朝食摂取低下", nursingRecordId: "nursing-e-20250708-01" },
    { date: "2025/07/07", dayOfStay: 67, sleep: "4:00覚醒→6:30起床", meal: "朝5割 昼7割 夕7割", elimination: "排便なし", activity: "病室中心", medication: "全量", vitals: "T36.4 P72 R16 BP130/80", sleepDetail: "早朝4:00覚醒・「夜が長い」と訴え", activityDetail: "自責的発言あり、日中は病室中心", specialNote: "自責的発言あり", nursingRecordId: "nursing-e-20250707-01" },
    { date: "2025/07/06", dayOfStay: 66, sleep: "4:30覚醒→6:00起床", meal: "朝5割 昼8割 夕7割", elimination: "排便1回", activity: "面談・デイルーム", medication: "全量", vitals: "T36.5 P70 R16 BP126/78", sleepDetail: "早朝覚醒あり・中途覚醒2回", activityDetail: "心理面接、午後は談話室で過ごす" },
    { date: "2025/07/05", dayOfStay: 65, sleep: "4:00覚醒→6:30起床", meal: "朝4割 昼7割 夕7割", elimination: "排便なし", activity: "デイルーム", medication: "全量", vitals: "T36.4 P74 R16 BP132/82", sleepDetail: "早朝覚醒・熟眠感なし", activityDetail: "他患者と園芸の会話、活動意欲やや回復" },
    { date: "2025/07/04", dayOfStay: 64, sleep: "5:00覚醒→6:30起床", meal: "朝5割 昼8割 夕8割", elimination: "排便1回", activity: "栄養指導・病室", medication: "全量", vitals: "T36.5 P70 R16 BP128/80", sleepDetail: "早朝5:00覚醒・入眠は良好", activityDetail: "栄養指導を受ける、食事量は改善傾向" },
    { date: "2025/07/03", dayOfStay: 63, sleep: "4:30覚醒→6:30起床", meal: "朝4割 昼7割 夕7割", elimination: "排便1回", activity: "病室中心", medication: "全量", vitals: "T36.4 P72 R16 BP130/78", sleepDetail: "早朝覚醒・倦怠感強い", activityDetail: "臥床時間が長い、促しでデイルームへ短時間" },
  ],
  exams: [
    {
      kind: "blood",
      date: "2025/06/01",
      category: "血液検査（一般）",
      summary: "Hb 11.4 (L)",
      judgement: "要経過観察",
      comment: "軽度の貧血傾向。食事摂取量の低下と関連の可能性。",
      rows: [
        { name: "WBC", value: "5,800", unit: "/μL", reference: "3,300〜8,600" },
        { name: "RBC", value: "398万", unit: "/μL", reference: "386〜492万" },
        { name: "Hb", value: "11.4", unit: "g/dL", reference: "11.6〜14.8", flag: "L" },
        { name: "Ht", value: "35.8", unit: "%", reference: "35.1〜44.4" },
        { name: "Plt", value: "24.0万", unit: "/μL", reference: "15.8〜34.8万" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/01",
      category: "肝機能",
      summary: "AST 20 / ALT 16",
      judgement: "正常",
      comment: "抗うつ薬による影響なし。",
      rows: [
        { name: "AST", value: "20", unit: "U/L", reference: "13〜30" },
        { name: "ALT", value: "16", unit: "U/L", reference: "7〜23" },
        { name: "γ-GTP", value: "22", unit: "U/L", reference: "9〜32" },
        { name: "ALP", value: "82", unit: "U/L", reference: "38〜113" },
        { name: "T-Bil", value: "0.7", unit: "mg/dL", reference: "0.4〜1.5" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/01",
      category: "腎機能",
      summary: "Cr 0.68 / eGFR 72",
      judgement: "正常",
      comment: "腎機能は保たれている。",
      rows: [
        { name: "BUN", value: "15", unit: "mg/dL", reference: "8〜20" },
        { name: "Cr", value: "0.68", unit: "mg/dL", reference: "0.46〜0.79" },
        { name: "eGFR", value: "72", unit: "mL/min/1.73㎡", reference: "60以上" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/01",
      category: "電解質",
      summary: "Na 140 / K 4.0",
      judgement: "正常",
      comment: "電解質バランスは保たれている。",
      rows: [
        { name: "Na", value: "140", unit: "mEq/L", reference: "138〜145" },
        { name: "K", value: "4.0", unit: "mEq/L", reference: "3.6〜4.8" },
        { name: "Cl", value: "104", unit: "mEq/L", reference: "101〜108" },
        { name: "Ca", value: "9.0", unit: "mg/dL", reference: "8.8〜10.1" },
      ],
    },
    {
      kind: "blood",
      date: "2025/05/10",
      category: "甲状腺機能",
      summary: "TSH 2.1 / FT4 1.2",
      judgement: "正常",
      comment: "うつ症状の鑑別目的。甲状腺機能は正常。",
      rows: [
        { name: "TSH", value: "2.1", unit: "μIU/mL", reference: "0.5〜5.0" },
        { name: "FT4", value: "1.2", unit: "ng/dL", reference: "0.9〜1.7" },
      ],
    },
    {
      kind: "psych",
      date: "2025/05/05",
      category: "心理検査",
      summary: "SDS 56点",
      judgement: "要経過観察",
      comment: "中等度の抑うつ。自責感の訴えと一致。",
      testName: "SDS（うつ性自己評価尺度）",
      score: "56点",
      reference: "50点以上でうつ傾向",
      finding: "中等度の抑うつを示す。「役に立たない」という自責的認知と一致。経過での再評価を予定。",
    },
  ],
  prescriptionOrders: [
    {
      datetime: "2025/07/08 10:15",
      doctor: "精神科 佐藤 恵 医師",
      category: "定期",
      medicationChangeId: "rx-e-20250708-teiki",
      reason: "抑うつ症状の改善目的（増量後の維持）",
      comment: "食後内服。悪心が出た場合は報告。",
      groups: [
        {
          no: 1,
          drugs: [{ name: "セルトラリン錠25mg", amount: "2錠" }],
          usage: "分1　朝食後",
          days: "28日分",
        },
      ],
    },
    {
      datetime: "2025/07/03 20:40",
      doctor: "精神科 佐藤 恵 医師",
      category: "頓服",
      reason: "不安時・不眠時の頓服",
      comment: "不安時と不眠時で使い分け。ふらつきに注意。",
      groups: [
        {
          no: 1,
          drugs: [{ name: "ロラゼパム錠0.5mg", amount: "1錠" }],
          usage: "不安時　1日2回まで",
          days: "10回分",
        },
        {
          no: 2,
          drugs: [{ name: "ゾルピデム錠5mg", amount: "1錠" }],
          usage: "不眠時　就寝前",
          days: "10回分",
        },
      ],
    },
  ],
  prescriptionHistory: [
    { date: "2025/07/08", label: "セルトラリン増量（25mg → 50mg）" },
    { date: "2025/07/03", label: "頓服追加（ロラゼパム・ゾルピデム）" },
    { date: "2025/05/02", label: "入院時処方 開始（セルトラリン25mg）" },
  ],
};

// ── Fさん ──────────────────────────────────────────

const CHART_F: ChartData = {
  clinicalRecords: [
    { date: "2025/07/09", time: "14:00", profession: "医師", author: "高橋医師", content: "【精神科 経過記録】気分は安定。睡眠リズムは改善傾向。活動量はやや増加。GAF 58。退院に向けた準備を開始。躁転の兆候（多弁・易怒性）は認めない。" },
    { date: "2025/07/09", time: "10:30", profession: "看護", author: "田中 花子", nursingRecordId: "nursing-f-20250709-01", content: "【看護記録】6:30起床。朝食全量。午前は心理教育に参加。発言もあり、他患者との交流も見られる。日中の傾眠なし。" },
    { date: "2025/07/08", time: "23:00", profession: "看護", author: "看護師 佐々木", nursingRecordId: "nursing-f-20250708-01", content: "【看護記録】22:30消灯、23:00入眠。夜間覚醒なし。スマートフォンの使用は消灯前に自主的に終了できている。" },
    { date: "2025/07/08", time: "15:30", profession: "OT", author: "作業療法士 山本", content: "【作業療法記録】音楽療法プログラムに参加。積極的に参加し、選曲では他患者に配慮する場面あり。終了後「気分が良くなった」との発言。" },
    { date: "2025/07/07", time: "16:20", profession: "心理", author: "公認心理師 大野", content: "【心理面接】「早く復職したい」という焦りを表出。全か無かの思考の偏りを確認。睡眠と活動のバランスが再発予防に重要であることを共有。" },
    { date: "2025/07/07", time: "11:00", profession: "医師", author: "高橋 誠 医師", medicationChangeId: "rx-f-20250707-teiki", id: "clinical-f-20250707-med-01", content: "【精神科 経過記録】気分安定期。服薬コンプライアンス良好。退院後のフォロー体制について話し合い。リチウムは治療域を維持し、定期処方（炭酸リチウム・ラモトリギン）を継続する。" },
    { date: "2025/07/06", time: "13:30", profession: "PSW", author: "MSW 伊藤", content: "【ソーシャルワーク記録】兄と面談。退院後の一人暮らし継続の方針。近隣の友人が見守り役として協力。就労支援センターへの照会を検討。" },
    { date: "2025/07/06", time: "09:15", profession: "薬剤", author: "薬剤師 中村", content: "【服薬指導】リチウムの血中濃度と多飲水の必要性を説明。「濃度が大事なのは理解した」との反応。市販の鎮痛薬との相互作用にも注意を促す。" },
    { date: "2025/07/05", time: "14:10", profession: "看護", author: "田中 花子", content: "【看護記録】デイルームでギターや音楽の話題。他患者にプレイリストを紹介し交流。売店で音楽雑誌を購入。活動的だが逸脱はなし。" },
    { date: "2025/07/04", time: "10:40", profession: "PSW", author: "MSW 伊藤", content: "【ソーシャルワーク記録・事務連絡】職場の休職延長書類について本人より相談。人事担当への提出手順を整理し、次回面談で確認予定。" },
  ],
  patientInfo: {
    patientNo: "P-2025-0312",
    name: "Fさん",
    age: 35,
    sex: "男性",
    room: "312",
    diagnosis: "双極性障害",
    admit: "2025/06/01",
    doctor: "高橋医師",
    nurse: "田中 花子",
    family: "独身。兄（40歳）がキーパーソン。両親は他界。",
    address: "〒345-6789 東京都○○区◇◇町7-8-9",
    phone: "03-3456-7890",
    emergencyContact: "兄 ○○（携帯 070-XXXX-XXXX）",
    occupation: "IT企業勤務（休職中）",
    bloodType: "B型",
  },
  lifeHistory: [
    { title: "生活歴", content: "大学卒業後、IT企業でシステムエンジニアとして勤務。独身で一人暮らし。趣味は音楽と読書。" },
    { title: "現病歴", content: "3年前に躁エピソード（不眠・多弁・浪費）を経験。うつ期の入院が今回。睡眠リズムの乱れが主訴。" },
    { title: "家族背景", content: "兄がキーパーソン。両親は他界。兄は月1回面会。友人が近隣に住み連絡を取り合っている。" },
    { title: "職業歴", content: "IT企業に10年勤務。プロジェクトリーダー経験あり。休職前は残業が多かった。" },
    { title: "価値観", content: "仕事で成果を出したい。自分のペースで生活したい。友人との関係を大切にしたい。" },
    { title: "退院への思い", content: "睡眠と活動のバランスを整え、仕事に復帰したい。" },
  ],
  episodes: [
    { date: "2025/06/01", type: "入院", facility: "本院 精神科3病棟", description: "うつ期。睡眠リズムの乱れ・活動低下。" },
    { date: "2024/09/15", type: "外来", facility: "本院 精神科外来", description: "気分安定剤の調整。" },
    { date: "2023/03/20", type: "入院", facility: "本院 精神科3病棟", description: "躁エピソード。不眠・多弁・浪費。" },
    { date: "2022/06/01", type: "外来", facility: "近医 精神科", description: "初診。気分の変動の主訴。" },
    { date: "2020/01/10", type: "外来", facility: "内科", description: "健康診断。異常なし。" },
  ],
  nursingRecords: [
    { date: "2025/07/09", time: "10:00", author: "田中 花子", observation: "心理教育に参加。発言あり。表情は明るい。", intervention: "活動量の維持を促す。", evaluation: "参加は良好。気分安定を継続観察。" },
    { date: "2025/07/08", time: "23:00", author: "看護師 佐々木", observation: "22:30消灯。23:00入眠。", intervention: "睡眠リズムの維持を確認。", evaluation: "入眠は良好。6:30起床予定。" },
    { date: "2025/07/07", time: "14:00", author: "田中 花子", observation: "デイルームで読書。他患者と短い会話。", intervention: "水分補給を促す。", evaluation: "活動参加は良好。" },
    { date: "2025/07/05", time: "14:15", author: "田中 花子", observation: "デイルームで音楽の話題を他患者に紹介。活動的だが逸脱や多弁はなし。売店で雑誌購入。", intervention: "活動と休息のバランスを一緒に確認。", evaluation: "適度な活動量を維持。躁転の兆候なく経過。" },
    { date: "2025/07/04", time: "11:00", author: "看護師 佐々木", observation: "休職延長の書類について「早く復職したい」と焦りを表出。", intervention: "焦りを傾聴し、PSWへ相談をつなぐ。", evaluation: "復職への思いを受け止めつつ、段階的な準備を支援。" },
  ],
  otRecords: [
    { date: "2025/07/09", participation: "参加", activity: "音楽療法プログラム", concentration: "良好", social: "他参加者と積極的に交流", staffNote: "「気分が良くなった」との発言。" },
    { date: "2025/07/07", participation: "参加", activity: "レクリエーション（ボードゲーム）", concentration: "良好", social: "他参加者3名と会話", staffNote: "社交性は回復傾向。" },
  ],
  pswRecords: [
    { date: "2025/07/06", family: "兄と面談。退院後の一人暮らし継続。", discharge: "兄が近隣在住。週1回の見守り。", system: "障害者手帳の更新手続きを説明。", community: "以前通っていた作業所への復帰を検討。" },
    { date: "2025/06/20", family: "兄と面談。Fさんの状態について情報共有。", discharge: "退院時期は8月を目標。", system: "生活保護の該当なし。", community: "地域の就労支援センターへの照会予定。" },
  ],
  flowsheet: [
    { date: "2025/07/09", dayOfStay: 39, sleep: "23:00就寝 / 6:30起床", meal: "朝全量 昼全量 夕全量", elimination: "排便1回", activity: "心理教育・デイルーム", medication: "全量自己管理", vitals: "T36.5 P68 R14 BP112/68", sleepDetail: "入眠23:00・中途覚醒なし・約7.5時間", activityDetail: "午前心理教育に参加、午後デイルームで交流", specialNote: "心理教育に参加、表情明るい", nursingRecordId: "nursing-f-20250709-01" },
    { date: "2025/07/08", dayOfStay: 38, sleep: "22:30就寝 / 6:30起床", meal: "朝全量 昼全量 夕9割", elimination: "排便1回", activity: "音楽療法・デイルーム", medication: "全量", vitals: "T36.4 P70 R14 BP110/66", sleepDetail: "入眠22:30・熟眠感あり・約8時間", activityDetail: "OT音楽療法に積極参加", specialNote: "睡眠良好（22:30就寝）", nursingRecordId: "nursing-f-20250708-01" },
    { date: "2025/07/07", dayOfStay: 37, sleep: "23:00就寝 / 7:00起床", meal: "朝9割 昼全量 夕全量", elimination: "排便1回", activity: "面接・デイルーム・読書", medication: "全量", vitals: "T36.5 P72 R16 BP114/70", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "心理面接、午後は読書中心" },
    { date: "2025/07/06", dayOfStay: 36, sleep: "23:30就寝 / 6:40起床", meal: "朝全量 昼全量 夕全量", elimination: "排便1回", activity: "面談・デイルーム", medication: "全量", vitals: "T36.4 P70 R14 BP112/70", sleepDetail: "入眠良好・熟眠感あり", activityDetail: "PSW面談、服薬指導。日中活動良好" },
    { date: "2025/07/05", dayOfStay: 35, sleep: "23:00就寝 / 6:30起床", meal: "朝全量 昼全量 夕9割", elimination: "排便1回", activity: "デイルーム・売店", medication: "全量", vitals: "T36.5 P72 R14 BP110/68", sleepDetail: "入眠良好", activityDetail: "他患者と音楽の交流、売店へ外出（院内）" },
    { date: "2025/07/04", dayOfStay: 34, sleep: "22:45就寝 / 6:30起床", meal: "朝全量 昼全量 夕全量", elimination: "排便1回", activity: "面談・読書", medication: "全量", vitals: "T36.4 P70 R14 BP112/68", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "休職書類の相談、日中は読書" },
    { date: "2025/07/03", dayOfStay: 33, sleep: "23:15就寝 / 6:45起床", meal: "朝9割 昼全量 夕全量", elimination: "排便1回", activity: "デイルーム", medication: "全量", vitals: "T36.5 P72 R16 BP114/70", sleepDetail: "入眠良好", activityDetail: "デイルームで過ごす、交流は穏やか" },
  ],
  exams: [
    {
      kind: "blood",
      date: "2025/06/15",
      category: "血液検査（一般）",
      summary: "WBC 6,500 / Hb 15.0",
      judgement: "正常",
      comment: "異常なし。",
      rows: [
        { name: "WBC", value: "6,500", unit: "/μL", reference: "3,300〜8,600" },
        { name: "RBC", value: "498万", unit: "/μL", reference: "435〜555万" },
        { name: "Hb", value: "15.0", unit: "g/dL", reference: "13.7〜16.8" },
        { name: "Ht", value: "45.2", unit: "%", reference: "40.7〜50.1" },
        { name: "Plt", value: "25.0万", unit: "/μL", reference: "15.8〜34.8万" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/15",
      category: "肝機能",
      summary: "AST 24 / ALT 26",
      judgement: "正常",
      comment: "気分安定薬による影響なし。",
      rows: [
        { name: "AST", value: "24", unit: "U/L", reference: "13〜30" },
        { name: "ALT", value: "26", unit: "U/L", reference: "10〜42" },
        { name: "γ-GTP", value: "40", unit: "U/L", reference: "13〜64" },
        { name: "ALP", value: "88", unit: "U/L", reference: "38〜113" },
        { name: "T-Bil", value: "0.9", unit: "mg/dL", reference: "0.4〜1.5" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/15",
      category: "腎機能",
      summary: "Cr 0.90 / eGFR 85",
      judgement: "正常",
      comment: "リチウム使用中のため定期的に評価。",
      rows: [
        { name: "BUN", value: "13", unit: "mg/dL", reference: "8〜20" },
        { name: "Cr", value: "0.90", unit: "mg/dL", reference: "0.65〜1.07" },
        { name: "eGFR", value: "85", unit: "mL/min/1.73㎡", reference: "60以上" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/10",
      category: "リチウム血中濃度",
      summary: "0.8 mEq/L（治療域）",
      judgement: "正常",
      comment: "治療域内。多飲水を継続し定期モニタリング。",
      rows: [
        { name: "Li", value: "0.8", unit: "mEq/L", reference: "0.6〜1.2" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/05",
      category: "甲状腺機能",
      summary: "TSH 1.8 / FT4 1.1",
      judgement: "正常",
      comment: "リチウムの甲状腺への影響なし。",
      rows: [
        { name: "TSH", value: "1.8", unit: "μIU/mL", reference: "0.5〜5.0" },
        { name: "FT4", value: "1.1", unit: "ng/dL", reference: "0.9〜1.7" },
      ],
    },
    {
      kind: "imaging",
      date: "2025/06/02",
      category: "胸部X線",
      summary: "異常なし",
      judgement: "異常なし",
      comment: "入院時ルーチン。",
      purpose: "入院時スクリーニング",
      finding: "肺野に異常なし。心陰影正常。",
    },
  ],
  prescriptionOrders: [
    {
      datetime: "2025/07/07 11:20",
      doctor: "精神科 高橋 誠 医師",
      category: "定期",
      medicationChangeId: "rx-f-20250707-teiki",
      reason: "気分安定の維持（治療域維持）",
      comment: "血中濃度モニタリング。多飲水を心がける。皮疹出現時は報告。",
      groups: [
        {
          no: 1,
          drugs: [{ name: "炭酸リチウム錠200mg", amount: "4錠" }],
          usage: "分2　朝夕食後",
          days: "28日分",
        },
        {
          no: 2,
          drugs: [{ name: "ラモトリギン錠100mg", amount: "1錠" }],
          usage: "分1　朝食後",
          days: "28日分",
        },
      ],
    },
    {
      datetime: "2025/07/02 21:30",
      doctor: "精神科 高橋 誠 医師",
      category: "頓服",
      reason: "睡眠リズム調整目的の不眠時頓服",
      comment: "不眠時のみ。翌朝の眠気に注意。",
      groups: [
        {
          no: 1,
          drugs: [{ name: "ゾピクロン錠5mg", amount: "1錠" }],
          usage: "不眠時　就寝前",
          days: "7回分",
        },
      ],
    },
  ],
  prescriptionHistory: [
    { date: "2025/07/07", label: "定期処方 継続（リチウム800mg・ラモトリギン100mg）" },
    { date: "2025/06/15", label: "ラモトリギン増量（50mg → 100mg）" },
    { date: "2025/06/01", label: "入院時処方 開始（炭酸リチウム）" },
  ],
};

// ── データ取得 ──────────────────────────────────────

const CHART_BY_PATIENT: Record<string, ChartData> = {
  A: CHART_A,
  E: CHART_E,
  F: CHART_F,
};

function buildFallback(patient: Patient): ChartData {
  const p = patient.profile;
  return {
    clinicalRecords: [
      { date: patient.admit, time: "09:00", profession: "医師", author: patient.doctor, content: `【精神科 入院時記録】${patient.diagnosis}。${patient.goal}` },
      { date: patient.admit, time: "10:30", profession: "看護", author: patient.nurse ?? "担当看護師", content: `【看護記録】入院時アセスメント実施。${patient.observations.join("、")}を観察項目とする。` },
    ],
    patientInfo: {
      patientNo: `P-2025-${patient.room}`,
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      room: patient.room,
      diagnosis: patient.diagnosis,
      admit: patient.admit,
      doctor: patient.doctor,
      nurse: patient.nurse ?? "—",
      family: p?.family ?? "—",
      address: "—",
      phone: "—",
      emergencyContact: "—",
      occupation: "—",
      bloodType: "—",
    },
    lifeHistory: [
      { title: "生活歴", content: p?.lifeHistory ?? "未入力" },
      { title: "現病歴", content: p?.story ?? "未入力" },
      { title: "家族背景", content: p?.family ?? "未入力" },
      { title: "職業歴", content: "—" },
      { title: "価値観", content: p?.values?.join("、") ?? "未入力" },
      { title: "退院への思い", content: p?.dischargeHope ?? "未入力" },
    ],
    episodes: [
      { date: patient.admit, type: "入院", facility: "本院 精神科3病棟", description: `${patient.diagnosis}で入院。` },
    ],
    nursingRecords: [
      { date: patient.admit, time: "09:00", author: patient.nurse ?? "担当看護師", observation: patient.observations.join("。"), intervention: "観察継続。", evaluation: "経過観察中。" },
    ],
    otRecords: [
      { date: patient.admit, participation: "未参加", activity: "—", concentration: "—", social: "—", staffNote: "評価予定。" },
    ],
    pswRecords: [
      { date: patient.admit, family: "—", discharge: "—", system: "—", community: "—" },
    ],
    flowsheet: [
      { date: patient.admit, dayOfStay: 1, sleep: "入院日", meal: "朝— 昼— 夕—", elimination: "—", activity: "入院", medication: "開始", vitals: "T36.5 P72 R16 BP120/74", sleepDetail: "入院初日", activityDetail: "入院手続き・オリエンテーション" },
    ],
    exams: [
      {
        kind: "blood",
        date: patient.admit,
        category: "血液検査（一般）",
        summary: "WBC 6,000 / Hb 14.0",
        judgement: "正常",
        comment: "入院時ルーチン。",
        rows: [
          { name: "WBC", value: "6,000", unit: "/μL", reference: "3,300〜8,600" },
          { name: "RBC", value: "460万", unit: "/μL", reference: "435〜555万" },
          { name: "Hb", value: "14.0", unit: "g/dL", reference: "13.7〜16.8" },
          { name: "Ht", value: "42.0", unit: "%", reference: "40.7〜50.1" },
          { name: "Plt", value: "23.0万", unit: "/μL", reference: "15.8〜34.8万" },
        ],
      },
    ],
    prescriptionOrders: [
      {
        datetime: `${patient.admit} 10:00`,
        doctor: `精神科 ${patient.doctor}`,
        category: "定期",
        reason: "入院時処方",
        comment: "経過に応じて調整。",
        groups: [
          {
            no: 1,
            drugs: [{ name: "ブロチゾラム錠0.25mg", amount: "1錠" }],
            usage: "分1　就寝前",
            days: "14日分",
          },
        ],
      },
    ],
    prescriptionHistory: [{ date: patient.admit, label: "入院時処方 開始" }],
  };
}

// 日付文字列（YYYY/MM/DD）を delta 日ずらす。TZ非依存でUTC計算。
function shiftDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("/").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}/${mm}/${dd}`;
}

// 診療録の行動制限記録から、日別の要約マークを派生する（手入力の二重管理をしない）。
// 各イベント（restrictionEventId）ごとに開始〜解除の期間を求め、
// 開始日=「隔離」/ 解除日=「隔離解除」/ 中間日=「隔離継続」を自動導出。
export function deriveRestrictionMap(
  records: ClinicalRecord[],
): Map<string, DailyRestriction> {
  const byEvent = new Map<string, ClinicalRecord[]>();
  for (const r of records) {
    if (!r.restrictionEventId) continue;
    const arr = byEvent.get(r.restrictionEventId) ?? [];
    arr.push(r);
    byEvent.set(r.restrictionEventId, arr);
  }

  const map = new Map<string, DailyRestriction>();
  for (const [eventId, recs] of byEvent) {
    const type = recs.find((r) => r.restrictionType)?.restrictionType ?? "行動制限";
    const dates = recs.map((r) => r.date).sort();
    const startDate = dates[0];
    const releaseRec = recs.find((r) => r.restrictionPhase === "解除");
    const endDate = releaseRec ? releaseRec.date : dates[dates.length - 1];

    for (let d = startDate; d <= endDate; d = shiftDate(d, 1)) {
      const dayRecs = recs.filter((r) => r.date === d);
      let label: string;
      if (dayRecs.some((r) => r.restrictionPhase === "解除")) {
        label = `${type}解除`;
      } else if (d === startDate || dayRecs.some((r) => r.restrictionPhase === "開始")) {
        label = type;
      } else {
        label = `${type}継続`;
      }
      map.set(d, { eventId, type, label });
    }
  }
  return map;
}

// 処方（定期）の用法から、フローシートで管理する服薬スロットを導出する。
// 薬剤名・用量はフローシートに持たず、どの区分に定期薬があるかだけを処方から求める。
export function deriveMedSlots(
  orders: PrescriptionOrder[],
): Record<MedSlot, boolean> {
  const slots: Record<MedSlot, boolean> = {
    朝: false,
    昼: false,
    夕: false,
    就寝前: false,
  };
  for (const o of orders) {
    if (o.category !== "定期") continue;
    for (const g of o.groups) {
      const u = g.usage;
      if (u.includes("毎食")) {
        slots.朝 = slots.昼 = slots.夕 = true;
      }
      if (u.includes("朝")) slots.朝 = true;
      if (u.includes("昼")) slots.昼 = true;
      if (u.includes("夕")) slots.夕 = true;
      if (u.includes("就寝前") || u.includes("眠前")) slots.就寝前 = true;
    }
  }
  return slots;
}

// フローシートの1日分を既定値で作成（代表週の穏やかな日用）。overridesで上書き。
function fday(
  date: string,
  dayOfStay: number,
  o: Partial<FlowsheetDay> = {},
): FlowsheetDay {
  const sleep = o.sleep ?? "23:00就寝 / 6:30起床";
  const activity = o.activity ?? "デイルーム";
  return {
    date,
    dayOfStay,
    sleep,
    meal: o.meal ?? "朝8割 昼8割 夕8割",
    elimination: o.elimination ?? "排便1回",
    activity,
    medication: o.medication ?? "全量",
    vitals: o.vitals ?? "T36.5 P72 R16 BP118/72",
    sleepDetail: o.sleepDetail ?? `${sleep}・中途覚醒なし`,
    activityDetail: o.activityDetail ?? activity,
    specialNote: o.specialNote,
    nursingRecordId: o.nursingRecordId,
  };
}

// 代表週を生成（firstDate=週の最古日, firstDay=その入院日数）。返り値は新しい順。
function genWeek(
  firstDate: string,
  firstDay: number,
  overrides: Record<string, Partial<FlowsheetDay>> = {},
): FlowsheetDay[] {
  const week: FlowsheetDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = shiftDate(firstDate, i);
    week.push(fday(date, firstDay + i, overrides[date] ?? {}));
  }
  return week.reverse(); // 新しい順
}

// 受け持ち患者ごとの代表週（直近週より過去分）。
// ルール：診療録にある日付は必ずフローシートにも存在する。
const EXTRA_WEEKS: Record<string, FlowsheetDay[]> = {
  // A：4月第2週（入院・隔離）/ 5月第1週 / 6月第3週 ＋ 直近7月第1週（authored）
  A: [
    ...genWeek("2025/06/16", 66, {
      "2025/06/20": { medication: "全量（リスペリドン減量後）", activity: "デイルーム・面談" },
      "2025/06/18": { elimination: "排便なし（便秘傾向）" },
    }),
    ...genWeek("2025/05/01", 20, {
      "2025/05/03": { vitals: "T37.4 P84 R18 BP122/76", meal: "朝5割 昼6割 夕6割", activity: "病室中心（発熱）", sleepDetail: "発熱により浅眠" },
    }),
    ...genWeek("2025/04/12", 1, {
      "2025/04/12": {
        vitals: "T36.7 P90 R18 BP136/84",
        sleep: "不眠・浅眠",
        meal: "朝4割 昼5割 夕5割",
        elimination: "排便なし",
        activity: "保護室（隔離）",
        medication: "全量＋頓服",
        sleepDetail: "入眠困難・中途覚醒多い",
        activityDetail: "隔離室で15〜30分ごとの観察",
        medicationAdmin: { 朝: "介", 夕: "介", 就寝前: "自" },
      },
      "2025/04/13": {
        vitals: "T36.6 P84 R16 BP128/80",
        sleep: "22:30就寝 / 6:00起床",
        meal: "朝6割 昼7割 夕7割",
        activity: "隔離解除・一般室へ",
        sleepDetail: "入眠改善・中途覚醒1回",
        activityDetail: "解除後、病室で休息",
        medicationAdmin: { 朝: "促", 夕: "自" },
      },
      "2025/04/14": { meal: "朝7割 昼8割 夕7割", activity: "病室・短時間デイルーム" },
    }),
  ],
  // E：5月第1週（入院・抑うつ）/ 6月第3週 ＋ 直近7月第1週（authored）
  E: [
    ...genWeek("2025/06/16", 46, {
      "2025/06/16": { sleep: "5:00覚醒→6:30起床", sleepDetail: "早朝覚醒・熟眠感乏しい", meal: "朝5割 昼8割 夕7割" },
      "2025/06/19": { meal: "朝4割 昼6割 夕6割", activity: "病室中心（食欲低下）" },
    }),
    ...genWeek("2025/05/02", 1, {
      "2025/05/02": {
        vitals: "T36.5 P74 R16 BP132/82",
        sleep: "4:00覚醒→6:00起床",
        meal: "朝3割 昼5割 夕4割",
        activity: "入院・病室中心",
        elimination: "排便なし",
        sleepDetail: "早朝覚醒・入眠困難",
        activityDetail: "入院手続き、臥床がち・自発性低下",
        medicationAdmin: { 朝: "促", 就寝前: "自" },
      },
      "2025/05/03": { meal: "朝3割 昼4割 夕5割", activity: "病室中心（食欲低下）", sleep: "4:30覚醒→6:30起床", medicationAdmin: { 朝: "促" } },
      "2025/05/04": { meal: "朝4割 昼6割 夕6割" },
    }),
  ],
  // F：6月第1週（入院・軽躁）/ 6月第3週 ＋ 直近7月第1週（authored）
  F: [
    ...genWeek("2025/06/16", 16, {
      "2025/06/16": { activity: "音楽療法・デイルーム", activityDetail: "活動的、交流多い" },
    }),
    ...genWeek("2025/06/01", 1, {
      "2025/06/01": {
        vitals: "T36.6 P88 R18 BP122/76",
        sleep: "3:00就寝 / 6:00起床（短時間）",
        meal: "朝全量 昼全量 夕全量",
        activity: "入院・多弁",
        sleepDetail: "睡眠時間短い・多弁で入眠遅延",
        activityDetail: "入院手続き、活動的・多弁",
        medicationAdmin: { 朝: "拒", 夕: "拒" },
      },
      "2025/06/02": { sleep: "2:30就寝 / 5:30起床（短時間）", sleepDetail: "睡眠短時間・観念奔逸", activity: "デイルーム（多弁）", medicationAdmin: { 朝: "促", 夕: "促" } },
      "2025/06/03": { sleep: "23:30就寝 / 6:00起床", sleepDetail: "睡眠やや改善" },
    }),
  ],
};

export function getChartData(patientId: string): ChartData {
  const base = CHART_BY_PATIENT[patientId];
  if (base) {
    const extra = EXTRA_WEEKS[patientId] ?? [];
    return { ...base, flowsheet: [...base.flowsheet, ...extra] };
  }
  const patient = PATIENTS[patientId];
  if (!patient) return buildFallback(PATIENTS.A);
  return buildFallback(patient);
}
