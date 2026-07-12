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

export type PrescriptionCategory = "定期" | "頓服" | "注射" | "臨時";

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

// サマリー（時点ごとの要約。作成時点の情報のみを含み、後日の知識は混入させない）
export interface SummaryRecord {
  id: string;
  date: string; // 作成日
  timepoint: string; // 例: 入院時 / 任意入院への移行時 / 現在
  title: string;
  author: string;
  content: string;
}

// 臨床文書（入院診療計画・各種アセスメント・計画・多職種記録など）
export interface ClinicalDocumentSection {
  heading: string;
  body: string;
}

export interface ClinicalDocument {
  id: string;
  date: string;
  category: string; // 例: 入院診療計画書 / 転倒転落リスク / 退院支援計画
  title: string;
  author: string;
  sections: ClinicalDocumentSection[];
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
  summaries: SummaryRecord[];
  clinicalDocuments: ClinicalDocument[];
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
      id: "clinical-a-conference-20250707",
      date: "2025/07/07",
      time: "14:00",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【精神科 経過記録】多職種カンファレンス。症状は概ね安定。残遺する幻聴と入眠困難、日中活動の低下が継続課題。最近はSSTへの参加が定着し、体重管理も進行。服薬の自己管理には関心が芽生えつつある。退院支援としてグループホーム等の地域生活を段階的に検討する方針を共有。GAF 50。",
    },
    {
      id: "clinical-a-problemlist",
      date: "2025/07/01",
      time: "10:00",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【問題リスト（POS）】#1 統合失調症（維持療法中）／#2 残遺する幻聴（夜間に「だめな人間だ」等）／#3 不眠（入眠困難、幻聴と関連）／#4 過体重・以前の脂質異常（改善傾向）／#5 便秘（3〜5日間隔）／#6 日中活動の低下（OT辞退が多い）／#7 服薬自己管理の困難（必要性は理解、自信に乏しい）／#8 退院・地域生活への不安。以上を継続評価する。",
    },
    {
      id: "clinical-a-sleep-voices",
      date: "2025/07/06",
      time: "09:20",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【精神科 経過記録】#2#3 夜間に幻聴が強まり入眠困難が続く。「だめな人間だ」「怠け者」といった声を自覚。ラジオを聴いて対処し、不眠時は頓用睡眠薬（ブロチゾラム）を使用。翌朝に持ち越しの眠気と起床の遅れあり。日中活動の低下と関連。頓用は連用を避け経過観察とする。",
    },
    {
      date: "2025/07/06",
      time: "07:00",
      profession: "看護",
      author: "看護師 佐々木",
      nursingRecordId: "nursing-a-night-voices",
      content:
        "【看護記録】夜間、幻聴により入眠困難。「だめな人間だ、と聞こえる」と表出。ラジオを小音で流して対処。0時過ぎに不眠時ブロチゾラムを使用し2時頃入眠。翌朝は促しで起床、やや眠気が残る。",
    },
    {
      date: "2025/07/05",
      time: "15:40",
      profession: "看護",
      author: "田中 花子",
      nursingRecordId: "nursing-a-courtyard-i",
      content:
        "【看護記録】午後、同室のIさんに誘われ中庭で過ごす。菓子を一つずつ分け合い、穏やかに会話。Aさんが自分から人と過ごす数少ない場面。「Iさんといると落ち着く」と話す。",
    },
    {
      date: "2025/07/04",
      time: "11:10",
      profession: "看護",
      author: "田中 花子",
      nursingRecordId: "nursing-a-med-interest",
      content:
        "【看護記録】Iさんが自分で服薬を管理している様子を見て、「Iさんがやっているなら自分にもできるかな」「うらやましいなぁ」と発言。服薬の必要性は理解しているが自己管理には自信がない様子。関心の芽生えとして共有。",
    },
    {
      id: "clinical-a-med-selfmgmt",
      date: "2025/07/04",
      time: "09:30",
      profession: "薬剤",
      author: "薬剤師 中村",
      medicationChangeId: "rx-a-teiki-current",
      content:
        "【服薬指導】定期薬（ロフラゼプ酸エチル・リスペリドン・クエチアピン・ゾピクロン）の効果と副作用を再説明。飲み忘れなし。同室者の様子から自己管理に関心を示す。段階的な服薬自己管理（まず就寝前薬から）を医師・看護と検討する方針。",
    },
    {
      id: "clinical-a-cold-20250703",
      date: "2025/07/03",
      time: "13:20",
      profession: "医師",
      author: "鈴木 一郎 医師",
      medicationChangeId: "rx-a-20250703-kanbou",
      content:
        "【精神科 経過記録】咽頭痛・鼻汁の訴えで診察。体温37.2℃の微熱。咽頭発赤軽度、呼吸音清、肺炎を疑う所見なし。感冒として対症療法（カルボシステイン・トラネキサム酸、発熱時アセトアミノフェン）を臨時処方。数日で軽快を見込み、悪化時は再診とする。",
    },
    {
      date: "2025/07/03",
      time: "10:00",
      profession: "看護",
      author: "看護師 佐々木",
      nursingRecordId: "nursing-a-cold",
      content:
        "【看護記録】朝より咽頭痛と鼻汁。微熱あり。水分摂取を促す。食事はやや減量したが摂取可能。診察の結果、感冒として臨時処方開始。安静と水分補給を説明。",
    },
    {
      date: "2025/07/02",
      time: "16:10",
      profession: "看護",
      author: "田中 花子",
      nursingRecordId: "nursing-a-uncle",
      content:
        "【看護記録】面会の話題から、叔父の面会が最近減っていることに触れる。「嫌われてしまったのかな」と沈んだ表情。電話で確認したかを尋ねると「していない」との返答。自己評価の低下がうかがえ、傾聴した。",
    },
    {
      date: "2025/07/01",
      time: "11:30",
      profession: "看護",
      author: "田中 花子",
      nursingRecordId: "nursing-a-20250701-weight",
      content:
        "【看護記録】体重測定70.2kg（前回より微減）。間食は一つ・非甘味飲料を継続できている。以前の脂質異常も改善傾向。本人は「少し軽くなった」と前向きな反応。",
    },
    {
      date: "2025/06/25",
      time: "10:30",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【精神科 経過記録】症状は概ね安定。残遺する幻聴は持続するが日中の被害的訴えは目立たない。OTは気が向かず辞退する日が多いが、SSTには継続参加。退院に向けた自己管理能力の向上を目標に支援を継続する。",
    },
    {
      date: "2025/06/20",
      time: "11:00",
      profession: "栄養",
      author: "管理栄養士 林",
      content:
        "【栄養指導】間食は一つ・非甘味飲料の継続を確認。体重は約70kg、腹囲約85cmまで減少。以前の脂質異常は改善。BMIは過体重域が続くため、間食制限と活動量確保の継続を助言。",
    },
    {
      id: "clinical-a-orders-20250620",
      date: "2025/06/20",
      time: "09:40",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【指示記録】定期採血（CBC・生化学・脂質・HbA1c・肝腎機能）をオーダー。抗精神病薬使用中のため心電図（QT評価）も併せて依頼。体重・腹囲の定期測定を継続する。",
    },
    {
      date: "2025/06/15",
      time: "13:30",
      profession: "PSW",
      author: "MSW 伊藤",
      content:
        "【ソーシャルワーク記録】退院後の生活の場としてグループホームやアパート生活の情報提供。キーパーソンの叔父は高齢で協力は限定的。障害年金と生活保護の併用を含め、経済・住居面の支援を継続検討。",
    },
    {
      id: "clinical-a-discharge",
      date: "2025/06/10",
      time: "10:20",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【精神科 経過記録】#8 退院・地域生活について本人と面談。「ここにいる方が安心」との発言。単なる退院拒否ではなく、地域生活への自信のなさ・不安、入院環境の安心感が背景にある。焦らず段階的に外の生活のイメージづくりを進める。",
    },
    {
      date: "2023/07/10",
      time: "11:00",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【精神科 経過記録】症状が安定し、病識も一定程度得られている。本人の同意のもと、医療保護入院から任意入院へ移行する。退院先は未定であり、今後、地域生活に向けた支援を進める方針。",
    },
    {
      date: "2021/09/15",
      time: "10:00",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【精神科 指示記録】就寝前のクロルプロマジンで過鎮静と起床困難がみられたため中止し、就寝前をクエチアピン50mgへ変更する。日中の眠気と朝の遅寝の改善を期待し経過をみる。",
    },
    {
      id: "clinical-a-admission",
      date: "2021/06/18",
      time: "14:00",
      profession: "医師",
      author: "鈴木 一郎 医師",
      content:
        "【精神科 入院時記録】5回目の入院。幻覚妄想の増悪と生活の破綻、自宅退去により住居を喪失。自傷他害の防止と安定化を目的に医療保護入院とする。保護的環境で薬物療法を開始し、まず生活の立て直しを図る。入院時処方開始。",
    },
    {
      date: "2021/06/19",
      time: "10:30",
      profession: "看護",
      author: "田中 花子",
      content:
        "【看護記録】入院時アセスメント実施。表情硬く、被害的な訴えあり。セルフケアは促しを要する。睡眠・食事・保清の状況を継続観察とする。",
    },
  ],
  patientInfo: {
    patientNo: "P-2021-0308",
    name: "Aさん",
    age: 47,
    sex: "男性",
    room: "308",
    diagnosis: "統合失調症",
    admit: "2021/06/18",
    doctor: "鈴木医師",
    nurse: "田中 花子",
    family:
      "未婚・同胞なし。両親は他界（父は行方不明のまま消息不明、母は本人が20代後半の頃に死去）。高齢の叔父がキーパーソンだが面会は減少している。",
    address: "現在、帰る家がない（元自宅は退去済み）。退院先を調整中。",
    phone: "—（本人の携帯電話なし）",
    emergencyContact: "叔父 ○○（自宅 0XX-XXX-XXXX）",
    occupation: "無職（かつて叔父の店を短期間手伝った経験あり）",
    bloodType: "A型",
  },
  lifeHistory: [
    {
      title: "生活歴（生育・生活史）",
      content:
        "子どもの頃から集団になじみにくく、友人は少なかった。高校時に不登校の時期があったが卒業。卒業後は叔父の店を短期間手伝ったが続かず、次第に自宅にひきこもるようになった。食事・睡眠・入浴が不規則になり、外出時に家族と衝突することもあった。",
    },
    {
      title: "現病歴",
      content:
        "22歳で初回入院し統合失調症と診断。薬物療法と作業療法で改善し、デイケアに通いながら自宅退院。以後、再発と再入院を繰り返した。20代後半に母が死去し、その後は自宅での生活が立ち行かなくなり住居も失った。今回（5回目）は数年前に医療保護入院し、約2年前に症状の安定を受けて任意入院へ移行。現在は残遺する幻聴と不眠、日中活動の低下がありつつ、SST参加・体重管理・服薬管理への関心といった回復のサインもみられる。",
    },
    {
      title: "家族背景",
      content:
        "未婚で同胞はいない。父は本人が幼い頃に行方不明となり、そのまま消息不明。母は本人が20代後半の頃に死去。母は本人の調子が良いと過干渉になり、不調時には放任的になるなど、関わりが不安定だった。現在のキーパーソンは高齢の叔父だが、近ごろ面会が減っており、本人は『嫌われたのではないか』と受けとめている（電話で確認はしていない）。",
    },
    {
      title: "現在の対人関係",
      content:
        "もともと周囲の人にあまり関心を向けないが、同室の年長者Iさんとは安心して過ごせる数少ない相手。中庭で菓子を分け合って過ごすことがある。Iさんが服薬を自己管理する姿は、本人にとって現実的な回復のモデルとなっている。",
    },
    {
      title: "価値観・思い",
      content:
        "静かに自分のペースで過ごしたい。人の多い場所や新しい環境は苦手。『Iさんがやっているなら自分にもできるかな』と、少しずつ前を向く気持ちも芽生えている。",
    },
    {
      title: "退院への思い",
      content:
        "『ここ（病院）にいる方が安心』と話す。これは単なる退院拒否ではなく、地域生活への自信のなさや不安、入院環境の安心感、病気に関連した考え方が背景にあると考えられる。",
    },
    {
      title: "職業歴",
      content:
        "安定した就労歴はない。若い頃に叔父の店を短期間手伝った経験がある程度で、その後は社会的なひきこもりの状態が続いた。",
    },
  ],
  episodes: [
    { date: "2023/07/10", type: "入院形態変更", facility: "本院 精神科3病棟", description: "症状安定により医療保護入院から任意入院へ移行。" },
    { date: "2021/06/18", type: "入院", facility: "本院 精神科3病棟", description: "5回目の入院。幻覚妄想の増悪・生活破綻・住居喪失。医療保護入院。" },
    { date: "2015/09/03", type: "入院", facility: "本院 精神科3病棟", description: "4回目の入院。自宅生活の破綻と再発。" },
    { date: "2009/05/20", type: "入院", facility: "本院 精神科", description: "3回目の入院。服薬中断後の再発。" },
    { date: "2004/08/11", type: "入院", facility: "本院 精神科", description: "2回目の入院。再発。" },
    { date: "2000/12/15", type: "退院", facility: "本院", description: "初回入院から退院。デイケア通所を開始。" },
    { date: "2000/05/22", type: "入院", facility: "本院 精神科", description: "初回入院（22歳）。統合失調症と診断。" },
  ],
  nursingRecords: [
    {
      date: "2025/07/09",
      time: "16:00",
      author: "田中 花子",
      observation: "午後、Iさんに誘われ中庭で過ごす。表情は穏やか。「Iさんといると落ち着く」と話す。",
      intervention: "見守り。無理のない範囲での交流を尊重。",
      evaluation: "自発的な対人交流の場面。強みとして継続支援。",
    },
    {
      date: "2025/07/09",
      time: "10:00",
      author: "田中 花子",
      observation: "午前のOTに参加。革細工に取り組む。集中は続くが「疲れる」と早めに切り上げる。",
      intervention: "参加を肯定し、活動量は本人のペースに合わせる。",
      evaluation: "OT参加は良好。日により気が向かない日もあり継続観察。",
    },
    {
      date: "2025/07/09",
      time: "07:30",
      author: "看護師 佐々木",
      observation: "23:30入眠、6:30起床。中途覚醒なし。朝食全量摂取。",
      intervention: "起床時に体調確認。",
      evaluation: "睡眠は良好な日。日々の変動を継続観察。",
    },
    {
      date: "2025/07/08",
      time: "09:30",
      author: "田中 花子",
      observation: "SSTに参加。ロールプレイでは緊張するが最後まで参加。「少しは言えた」と発言。",
      intervention: "参加できたことを一緒に振り返り肯定。",
      evaluation: "SST参加は定着傾向。自己効力感の高まりを支援。",
    },
    {
      date: "2025/07/08",
      time: "07:40",
      author: "看護師 佐々木",
      observation: "入浴日。促しで入浴・洗濯を実施。歯みがきは声かけで実施。",
      intervention: "セルフケアは促しを継続。できた点を伝える。",
      evaluation: "促しで保清は保たれる。自発性の向上が課題。",
    },
    {
      date: "2025/07/07",
      time: "08:30",
      author: "看護師 佐々木",
      observation: "前夜の頓用睡眠薬使用の影響か、8時頃までやや遅く起床。眠気と身体の重さを訴える。",
      intervention: "日中の傾眠に注意し、無理のない範囲で活動を促す。",
      evaluation: "翌朝への持ち越しあり。頓用の連用回避を継続。",
    },
    {
      date: "2025/07/07",
      time: "14:00",
      author: "田中 花子",
      observation: "OTは「気が向かない」と辞退。室内でラジオを聴いて過ごす。感冒症状は軽快傾向。",
      intervention: "辞退を尊重しつつ、SSTなど参加できる活動を確認。",
      evaluation: "活動の低下は残るが強要はしない。関心のある活動を糸口に支援。",
    },
    {
      date: "2025/07/06",
      time: "07:00",
      author: "看護師 佐々木",
      observation: "夜間、幻聴により入眠困難。「だめな人間だ、と聞こえる」と表出。ラジオで対処し0時過ぎに頓用薬使用、2時頃入眠。",
      intervention: "傾聴し安心できる環境を整える。頓用薬の使用を確認。",
      evaluation: "幻聴と不眠の関連が明確。翌朝の眠気に留意。",
    },
    {
      date: "2025/07/05",
      time: "15:40",
      author: "田中 花子",
      observation: "午後、Iさんと中庭で菓子を分け合い過ごす。会話は穏やか。",
      intervention: "自然な交流を見守る。",
      evaluation: "安心できる関係の中での交流。回復の資源として支援。",
    },
    {
      date: "2025/07/05",
      time: "10:30",
      author: "田中 花子",
      observation: "昼食全量摂取。間食は一つ・非甘味の飲み物を選択できている。",
      intervention: "本人の取り組みを肯定。",
      evaluation: "食事・間食管理は良好に継続。",
    },
    {
      date: "2025/07/04",
      time: "11:10",
      author: "田中 花子",
      observation: "Iさんの服薬自己管理を見て「自分にもできるかな」「うらやましい」と発言。",
      intervention: "関心を受け止め、段階的な自己管理の可能性を医師・薬剤師と共有。",
      evaluation: "服薬自己管理への動機づけの芽。強みとして関わる。",
    },
    {
      date: "2025/07/04",
      time: "07:30",
      author: "看護師 佐々木",
      observation: "3日ぶりに排便あり（前日センノシド使用）。腹部症状の訴えなし。",
      intervention: "排便間隔を観察。水分・活動を促す。",
      evaluation: "便秘は3〜5日間隔。頓用で対応可能。",
    },
    {
      date: "2025/07/03",
      time: "10:00",
      author: "看護師 佐々木",
      observation: "咽頭痛・鼻汁と微熱(37.2℃)。食事はやや減量したが摂取可能。",
      intervention: "水分補給・安静を促す。診察につなぐ。臨時処方を確認。",
      evaluation: "感冒症状。悪化なく経過観察。",
    },
    {
      date: "2025/07/02",
      time: "16:10",
      author: "田中 花子",
      observation: "叔父の面会が減っていることに触れ「嫌われたのかな」と沈む。電話確認はしていない。",
      intervention: "気持ちを傾聴。事実確認を急かさず受け止める。",
      evaluation: "対人関係と自己評価の低下が関連。継続的な傾聴が必要。",
    },
    {
      date: "2025/07/02",
      time: "07:30",
      author: "看護師 佐々木",
      observation: "前夜、幻聴で入眠がやや遅れる。頓用薬は使用せず経過。朝食全量。",
      intervention: "睡眠状況を確認。日中の活動を促す。",
      evaluation: "軽度の入眠困難。頓用なしで経過した日。",
    },
    {
      date: "2025/07/01",
      time: "11:30",
      author: "田中 花子",
      observation: "体重測定70.2kg。「少し軽くなった」と前向きな反応。間食制限を継続。",
      intervention: "体重減少を一緒に確認し肯定。",
      evaluation: "体重管理は順調。動機づけを維持。",
    },
    {
      date: "2025/07/01",
      time: "09:30",
      author: "田中 花子",
      observation: "SSTに参加。挨拶の練習に取り組む。",
      intervention: "参加を肯定。",
      evaluation: "SST参加が定着。",
    },
    {
      date: "2025/06/30",
      time: "10:00",
      author: "看護師 佐々木",
      observation: "洗濯を実施。入浴後にため込んでいた下着をまとめて洗う様子。",
      intervention: "洗濯物のため込みに気づき、こまめに行えるよう声かけ。",
      evaluation: "保清行動は促しで維持。生活動作の自立度を継続評価。",
    },
    {
      date: "2025/06/29",
      time: "08:30",
      author: "看護師 佐々木",
      observation: "前夜の頓用薬の影響で午前は臥床がち。午後はIさんと中庭へ。",
      intervention: "日中の活動を無理なく促す。",
      evaluation: "睡眠薬使用翌日の活動低下。交流はできている。",
    },
    {
      date: "2025/06/28",
      time: "07:00",
      author: "看護師 佐々木",
      observation: "夜間、幻聴で入眠困難。0時過ぎに頓用ブロチゾラム使用。",
      intervention: "ラジオでの対処を確認。頓用薬の使用を記録。",
      evaluation: "幻聴による不眠。頓用で対応。",
    },
    {
      date: "2025/06/27",
      time: "09:30",
      author: "田中 花子",
      observation: "SST参加。入浴・洗濯も促しで実施。",
      intervention: "参加とセルフケアを肯定。",
      evaluation: "活動・保清ともに促しで維持。",
    },
    {
      date: "2025/06/26",
      time: "14:00",
      author: "田中 花子",
      observation: "OTは辞退し室内でラジオを聴く。日中の活動量は少なめ。",
      intervention: "辞退を尊重。関心のある活動を確認。",
      evaluation: "OT辞退が多い。活動低下は継続課題。",
    },
    {
      date: "2025/06/25",
      time: "10:30",
      author: "看護師 佐々木",
      observation: "日中は病室で過ごすことが多い。促しでデイルームへ短時間。",
      intervention: "無理のない範囲で日中活動を促す。",
      evaluation: "日中活動の低下が続く。段階的な働きかけを継続。",
    },
    {
      date: "2025/06/22",
      time: "20:30",
      author: "看護師 佐々木",
      observation: "「お金が足りなくなった」と2週間分の前借りを希望。金銭管理に困難。",
      intervention: "金銭管理の状況を確認し、計画的な使い方を一緒に整理。",
      evaluation: "金銭管理は支援を要する。継続的な関わりが必要。",
    },
    {
      date: "2025/06/20",
      time: "11:00",
      author: "田中 花子",
      observation: "栄養指導を受ける。間食・飲み物の選び方を確認。",
      intervention: "取り組みを肯定し継続を励ます。",
      evaluation: "体重・脂質改善への意欲は保たれている。",
    },
    {
      date: "2025/06/18",
      time: "21:00",
      author: "看護師 佐々木",
      observation: "便秘の訴えあり。「お腹が張る」とセンノシドを希望。",
      intervention: "頓用センノシドを確認し使用。水分・活動を促す。",
      evaluation: "便秘は自ら訴え頓用を希望できる。セルフモニタリングは可能。",
    },
    {
      date: "2025/06/15",
      time: "10:00",
      author: "田中 花子",
      observation: "心理教育の案内をするが「今日はいい」と辞退。SSTには参加すると話す。",
      intervention: "本人の選択を尊重。参加できる活動を確認。",
      evaluation: "心理教育は辞退が多い。参加できる活動を糸口に支援。",
    },
    {
      date: "2025/06/10",
      time: "14:30",
      author: "田中 花子",
      observation: "退院の話題に「ここにいる方が安心」と発言。表情は穏やか。",
      intervention: "気持ちを傾聴し、焦らせない関わりを心がける。",
      evaluation: "地域生活への不安が背景。段階的な支援を継続。",
    },
    {
      date: "2025/06/05",
      time: "08:00",
      author: "看護師 佐々木",
      observation: "歯みがきを忘れがち。声かけで実施。洗面は自立。",
      intervention: "セルフケアの声かけを継続。",
      evaluation: "口腔ケアは促しを要する。習慣化を支援。",
    },
    {
      date: "2025/05/28",
      time: "13:30",
      author: "田中 花子",
      observation: "Iさんと将棋盤を挟んで過ごす。穏やかな時間。",
      intervention: "交流を見守る。",
      evaluation: "安心できる関係が活動の広がりにつながる。",
    },
  ],
  otRecords: [
    {
      date: "2025/07/09",
      participation: "参加",
      activity: "革細工（小物作り）",
      concentration: "良好（20分程度）",
      social: "スタッフと短いやり取り",
      staffNote: "手先は器用。「疲れる」と早めに切り上げるが、参加はできた。",
    },
    {
      date: "2025/07/02",
      participation: "辞退",
      activity: "—",
      concentration: "—",
      social: "—",
      staffNote: "「気が向かない」とOTを辞退。強要はせず、SSTなど参加できる活動を確認。",
    },
    {
      date: "2025/06/24",
      participation: "参加",
      activity: "塗り絵・軽作業",
      concentration: "普通",
      social: "同席者との会話は少ない",
      staffNote: "落ち着いて取り組める。集団活動への参加は不安定。",
    },
    {
      date: "2021/07/05",
      participation: "参加",
      activity: "作業療法 初期評価",
      concentration: "低下（易疲労）",
      social: "ほぼ交流なし",
      staffNote: "入院初期。易疲労と自発性低下が目立つ。段階的な導入を計画。",
    },
  ],
  pswRecords: [
    {
      date: "2025/07/05",
      family: "叔父は高齢で面会は減少。協力は限定的と見込む。",
      discharge: "グループホームやアパート生活を段階的に検討。自己管理能力の向上が鍵。",
      system: "障害年金を受給中。生活保護の併用可能性を検討。",
      community: "退院後の日中活動先（就労継続支援・デイケア）の情報を収集。",
    },
    {
      date: "2025/06/15",
      family: "叔父と電話連絡。高齢のため頻回な支援は難しいとの意向。",
      discharge: "帰る家がないため、住居確保が退院支援の前提課題。",
      system: "グループホームの見学先を情報提供予定。",
      community: "地域移行支援の利用を検討。",
    },
    {
      date: "2023/07/12",
      family: "任意入院移行にあたり、支援体制を再確認。",
      discharge: "退院先は未定。地域生活に向けた準備を段階的に開始。",
      system: "障害年金・自立支援医療を継続。",
      community: "将来的な社会資源の利用を視野に情報整理。",
    },
  ],
  flowsheet: [
    { date: "2025/07/09", dayOfStay: 1483, sleep: "入眠23:30 / 起床6:30", meal: "朝全量 昼全量 夕全量 / 水分1300ml", elimination: "排便あり（普通便）", activity: "OT参加 / 中庭でIさんと", medication: "全量", vitals: "T36.5 P72 R16 BP122/78", sleepDetail: "入眠良好・中途覚醒なし・約7時間", activityDetail: "午前OT（革細工）、午後は中庭でIさんと過ごす" },
    { date: "2025/07/08", dayOfStay: 1482, sleep: "入眠23:00 / 起床6:30", meal: "朝全量 昼全量 夕全量 / 水分1200ml", elimination: "排便あり", activity: "SST参加 / 入浴・洗濯", medication: "全量", vitals: "T36.4 P70 R16 BP120/76", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "SST参加、入浴日（保清は促しで実施）" },
    { date: "2025/07/07", dayOfStay: 1481, sleep: "入眠0:30 / 起床8:00", meal: "朝8割 昼9割 夕9割 / 水分1100ml", elimination: "排便なし", activity: "OT辞退・室内でラジオ", medication: "全量", vitals: "T36.8 P76 R18 BP124/80", sleepDetail: "前夜の頓用睡眠薬の影響で起床遅く、眠気残る", activityDetail: "感冒は軽快傾向。OTは辞退し室内で過ごす", medicationAdmin: { 朝: "促" } },
    { date: "2025/07/06", dayOfStay: 1480, sleep: "入眠2:00 / 中途覚醒2回 / 起床6:30", meal: "朝8割 昼9割 夕9割 / 水分1000ml", elimination: "排便あり（センノシド後）", activity: "OT辞退・室内", medication: "全量＋頓服", vitals: "T37.0 P78 R18 BP126/82", sleepDetail: "「だめな人間だ」等の幻聴で入眠困難、不眠時ブロチゾラム使用", activityDetail: "日中は室内中心、活動量少なめ", specialNote: "夜間の幻聴と不眠・頓用睡眠薬使用", nursingRecordId: "nursing-a-night-voices", medicationAdmin: { 朝: "促" } },
    { date: "2025/07/05", dayOfStay: 1479, sleep: "入眠23:15 / 起床6:30", meal: "朝9割 昼全量 夕全量 / 水分1200ml", elimination: "排便なし", activity: "中庭でIさんと / 入浴", medication: "全量", vitals: "T37.0 P74 R16 BP122/78", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "午後Iさんと中庭で過ごす、入浴日", specialNote: "中庭でIさんと過ごす", nursingRecordId: "nursing-a-courtyard-i" },
    { date: "2025/07/04", dayOfStay: 1478, sleep: "入眠23:00 / 起床6:30", meal: "朝9割 昼全量 夕全量 / 水分1100ml", elimination: "排便あり（センノシド後）", activity: "SST参加 / 日中室内", medication: "全量＋頓服", vitals: "T37.2 P78 R18 BP124/80", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "SST参加。Iさんの服薬管理を見て関心を示す", specialNote: "服薬自己管理への関心（Iさんの様子から）", nursingRecordId: "nursing-a-med-interest" },
    { date: "2025/07/03", dayOfStay: 1477, sleep: "入眠23:00 / 起床6:30", meal: "朝9割 昼8割 夕8割 / 水分1000ml", elimination: "排便なし", activity: "室内・受診", medication: "全量＋臨時", vitals: "T37.2 P80 R18 BP126/82", sleepDetail: "入眠良好", activityDetail: "咽頭痛・鼻汁で受診、感冒として臨時処方", specialNote: "咽頭痛・鼻汁、診察のうえ臨時処方", nursingRecordId: "nursing-a-cold" },
    { date: "2025/07/02", dayOfStay: 1476, sleep: "入眠1:30 / 中途覚醒1回 / 起床6:30", meal: "朝全量 昼9割 夕9割 / 水分1100ml", elimination: "排便なし", activity: "OT辞退・室内 / 午後に叔父の話題", medication: "全量", vitals: "T36.6 P74 R16 BP122/78", sleepDetail: "幻聴により入眠困難（頓用なしで経過）", activityDetail: "午後、叔父の面会減少の話題で沈む場面", specialNote: "叔父の面会減少に触れ自己評価低下", nursingRecordId: "nursing-a-uncle", medicationAdmin: { 朝: "促" } },
    { date: "2025/07/01", dayOfStay: 1475, sleep: "入眠23:00 / 起床6:30", meal: "朝全量 昼全量 夕全量 / 水分1200ml", elimination: "排便あり", activity: "SST参加 / 体重測定", medication: "全量", vitals: "T36.5 P72 R16 BP120/76", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "SST参加、体重測定70.2kg", specialNote: "体重測定70.2kg・間食制限継続", nursingRecordId: "nursing-a-20250701-weight" },
    { date: "2025/06/30", dayOfStay: 1474, sleep: "入眠23:15 / 起床6:30", meal: "朝全量 昼全量 夕9割 / 水分1200ml", elimination: "排便あり（3日ぶり）", activity: "室内・ラジオ / 洗濯", medication: "全量", vitals: "T36.4 P70 R16 BP118/74", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "洗濯を実施、ため込んだ下着をまとめて洗う" },
    { date: "2025/06/29", dayOfStay: 1473, sleep: "入眠0:30 / 起床8:00", meal: "朝8割 昼9割 夕9割 / 水分1000ml", elimination: "排便なし", activity: "午前臥床・午後中庭でIさんと", medication: "全量", vitals: "T36.5 P74 R16 BP120/78", sleepDetail: "前夜の頓用睡眠薬の影響で起床遅い", activityDetail: "午前は臥床がち、午後Iさんと中庭へ", medicationAdmin: { 朝: "促" } },
    { date: "2025/06/28", dayOfStay: 1472, sleep: "入眠2:00 / 中途覚醒2回 / 起床6:30", meal: "朝8割 昼9割 夕9割 / 水分1000ml", elimination: "排便なし", activity: "OT辞退・室内", medication: "全量＋頓服", vitals: "T36.6 P76 R18 BP122/80", sleepDetail: "幻聴で入眠困難、不眠時ブロチゾラム使用", activityDetail: "日中は室内中心", medicationAdmin: { 朝: "促" } },
    { date: "2025/06/27", dayOfStay: 1471, sleep: "入眠23:00 / 起床6:30", meal: "朝全量 昼全量 夕全量 / 水分1200ml", elimination: "排便あり", activity: "SST参加 / 入浴", medication: "全量", vitals: "T36.4 P70 R16 BP118/74", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "SST参加、入浴日" },
    { date: "2025/06/26", dayOfStay: 1470, sleep: "入眠23:15 / 起床6:30", meal: "朝全量 昼全量 夕全量 / 水分1200ml", elimination: "排便あり（普通便）", activity: "OT辞退・室内でラジオ", medication: "全量", vitals: "T36.5 P72 R16 BP120/76", sleepDetail: "入眠良好・中途覚醒なし", activityDetail: "OTは辞退、室内でラジオを聴いて過ごす" },
  ],
  exams: [
    {
      kind: "blood",
      date: "2025/06/20",
      category: "脂質",
      summary: "LDL 118 / TG 130",
      judgement: "正常",
      comment: "間食制限と体重減少により以前の脂質異常は改善。",
      rows: [
        { name: "LDL-C", value: "118", unit: "mg/dL", reference: "70〜139" },
        { name: "HDL-C", value: "48", unit: "mg/dL", reference: "40以上" },
        { name: "TG", value: "130", unit: "mg/dL", reference: "30〜149" },
        { name: "T-Cho", value: "190", unit: "mg/dL", reference: "150〜219" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/20",
      category: "血糖",
      summary: "HbA1c 5.6",
      judgement: "正常",
      comment: "抗精神病薬使用中のため定期的にモニタリング。安定して推移。",
      rows: [
        { name: "FBS", value: "95", unit: "mg/dL", reference: "73〜109" },
        { name: "HbA1c", value: "5.6", unit: "%", reference: "4.9〜6.0" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/20",
      category: "血液検査（一般）",
      summary: "WBC 6,400 / Hb 13.8",
      judgement: "正常",
      comment: "Hbは軽度低めながら安定。急性の異常なし。",
      rows: [
        { name: "WBC", value: "6,400", unit: "/μL", reference: "3,300〜8,600" },
        { name: "RBC", value: "455万", unit: "/μL", reference: "435〜555万" },
        { name: "Hb", value: "13.8", unit: "g/dL", reference: "13.7〜16.8" },
        { name: "Ht", value: "42.0", unit: "%", reference: "40.7〜50.1" },
        { name: "Plt", value: "22.0万", unit: "/μL", reference: "15.8〜34.8万" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/20",
      category: "肝機能",
      summary: "AST 24 / ALT 22",
      judgement: "正常",
      comment: "向精神薬による肝機能への影響なし。安定。",
      rows: [
        { name: "AST", value: "24", unit: "U/L", reference: "13〜30" },
        { name: "ALT", value: "22", unit: "U/L", reference: "10〜42" },
        { name: "γ-GTP", value: "30", unit: "U/L", reference: "13〜64" },
        { name: "ALP", value: "80", unit: "U/L", reference: "38〜113" },
        { name: "T-Bil", value: "0.8", unit: "mg/dL", reference: "0.4〜1.5" },
      ],
    },
    {
      kind: "blood",
      date: "2025/06/20",
      category: "腎機能",
      summary: "Cr 0.85 / eGFR 76",
      judgement: "正常",
      comment: "腎機能は保たれ安定して推移。",
      rows: [
        { name: "BUN", value: "15", unit: "mg/dL", reference: "8〜20" },
        { name: "Cr", value: "0.85", unit: "mg/dL", reference: "0.65〜1.07" },
        { name: "eGFR", value: "76", unit: "mL/min/1.73㎡", reference: "60以上" },
      ],
    },
    {
      kind: "imaging",
      date: "2025/06/20",
      category: "心電図",
      summary: "洞調律・QTc 420ms",
      judgement: "異常なし",
      comment: "抗精神病薬使用中のQT評価。延長なし。",
      purpose: "抗精神病薬使用中のQT間隔評価",
      finding: "洞調律。心拍数72/分。QTc 420ms（正常範囲）。明らかな伝導障害なし。",
    },
    {
      kind: "blood",
      date: "2024/06/15",
      category: "脂質",
      summary: "LDL 138 / TG 158 (H)",
      judgement: "要経過観察",
      comment: "境界〜軽度高値。食事・活動の見直しを継続。",
      rows: [
        { name: "LDL-C", value: "138", unit: "mg/dL", reference: "70〜139" },
        { name: "HDL-C", value: "44", unit: "mg/dL", reference: "40以上" },
        { name: "TG", value: "158", unit: "mg/dL", reference: "30〜149", flag: "H" },
        { name: "T-Cho", value: "208", unit: "mg/dL", reference: "150〜219" },
      ],
    },
    {
      kind: "blood",
      date: "2024/06/15",
      category: "血糖",
      summary: "HbA1c 5.7",
      judgement: "正常",
      comment: "安定して推移。",
      rows: [
        { name: "FBS", value: "98", unit: "mg/dL", reference: "73〜109" },
        { name: "HbA1c", value: "5.7", unit: "%", reference: "4.9〜6.0" },
      ],
    },
    {
      kind: "blood",
      date: "2021/07/02",
      category: "脂質",
      summary: "LDL 162 (H) / TG 185 (H)",
      judgement: "要経過観察",
      comment: "入院初期。過体重と脂質異常あり。食事・活動の見直しを要する。",
      rows: [
        { name: "LDL-C", value: "162", unit: "mg/dL", reference: "70〜139", flag: "H" },
        { name: "HDL-C", value: "38", unit: "mg/dL", reference: "40以上", flag: "L" },
        { name: "TG", value: "185", unit: "mg/dL", reference: "30〜149", flag: "H" },
        { name: "T-Cho", value: "225", unit: "mg/dL", reference: "150〜219", flag: "H" },
      ],
    },
    {
      kind: "blood",
      date: "2021/07/02",
      category: "血糖",
      summary: "HbA1c 5.8",
      judgement: "正常",
      comment: "入院時。正常上限。抗精神病薬使用中のためモニタリング開始。",
      rows: [
        { name: "FBS", value: "102", unit: "mg/dL", reference: "73〜109" },
        { name: "HbA1c", value: "5.8", unit: "%", reference: "4.9〜6.0" },
      ],
    },
    {
      kind: "imaging",
      date: "2021/06/18",
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
      datetime: "2025/07/03 13:30",
      doctor: "精神科 鈴木 一郎 医師",
      category: "臨時",
      medicationChangeId: "rx-a-20250703-kanbou",
      reason: "感冒症状（咽頭痛・鼻汁・微熱）に対する対症療法",
      comment: "数日で軽快を見込む。発熱時のみアセトアミノフェンを使用。悪化時は再診。",
      groups: [
        {
          no: 1,
          drugs: [
            { name: "カルボシステイン錠250mg", amount: "3錠" },
            { name: "トラネキサム酸錠250mg", amount: "3錠" },
          ],
          usage: "分3　毎食後",
          days: "4日分",
        },
        {
          no: 2,
          drugs: [{ name: "アセトアミノフェン錠300mg", amount: "1錠" }],
          usage: "発熱時",
          days: "5回分",
        },
      ],
    },
    {
      datetime: "2025/07/01 09:30",
      doctor: "精神科 鈴木 一郎 医師",
      category: "定期",
      medicationChangeId: "rx-a-teiki-current",
      reason: "統合失調症の維持療法（幻覚・妄想の再燃予防と睡眠の確保）",
      comment: "眠気・ふらつきに注意。起床困難が強い場合は報告。",
      groups: [
        {
          no: 1,
          drugs: [
            { name: "ロフラゼプ酸エチル錠1mg", amount: "1錠" },
            { name: "リスペリドン錠2mg", amount: "2錠" },
          ],
          usage: "分1　朝食後",
          days: "28日分",
        },
        {
          no: 2,
          drugs: [
            { name: "クエチアピン錠50mg", amount: "1錠" },
            { name: "ゾピクロン錠7.5mg", amount: "1錠" },
          ],
          usage: "分1　就寝前",
          days: "28日分",
        },
      ],
    },
    {
      datetime: "2025/07/01 09:30",
      doctor: "精神科 鈴木 一郎 医師",
      category: "頓服",
      medicationChangeId: "rx-a-tonpuku",
      reason: "不眠時・便秘時の頓用",
      comment: "睡眠薬は連用を避け、ふらつき・転倒に注意。便秘時は排便状況に応じて使用。",
      groups: [
        {
          no: 1,
          drugs: [{ name: "ブロチゾラム錠0.25mg", amount: "1錠" }],
          usage: "不眠時　就寝前",
          days: "10回分",
        },
        {
          no: 2,
          drugs: [{ name: "センノシド錠12mg", amount: "1錠" }],
          usage: "便秘時",
          days: "10回分",
        },
      ],
    },
  ],
  prescriptionHistory: [
    { date: "2025/07/03", label: "臨時処方（感冒症状：カルボシステイン・トラネキサム酸・発熱時アセトアミノフェン）" },
    { date: "2025/07/01", label: "定期・頓服処方 継続（維持量）" },
    { date: "2023/07/10", label: "任意入院への移行。定期・頓服処方を継続確認" },
    { date: "2021/09/15", label: "クロルプロマジンを中止し、就寝前をクエチアピン50mgへ変更（過鎮静・起床困難のため）" },
    { date: "2021/06/18", label: "入院時処方 開始（医療保護入院）" },
  ],
  summaries: [
    {
      id: "sum-a-admission",
      date: "2021/06/18",
      timepoint: "入院時",
      title: "入院時サマリー",
      author: "鈴木 一郎 医師",
      content:
        "47歳（当時44歳）男性、統合失調症。5回目の入院。幻覚妄想の増悪と生活の破綻、自宅退去による住居喪失を背景に、安全確保と安定化を目的として医療保護入院とした。当面は保護的環境で薬物療法を行い、生活リズムの立て直しを図る。キーパーソンは高齢の叔父。",
    },
    {
      id: "sum-a-early",
      date: "2021/09/20",
      timepoint: "入院初期",
      title: "初期経過サマリー",
      author: "田中 花子",
      content:
        "入院後、被害的な訴えは徐々に軽減。就寝前のクロルプロマジンで過鎮静と起床困難がみられたため中止し、クエチアピンへ変更。日中の眠気は軽減した。セルフケアは促しを要する状態が続く。",
    },
    {
      id: "sum-a-voluntary",
      date: "2023/07/10",
      timepoint: "任意入院への移行時",
      title: "任意入院への移行時サマリー",
      author: "鈴木 一郎 医師",
      content:
        "症状が安定し、病識も一定程度得られたため、本人の同意のもと任意入院へ移行。残遺する幻聴はあるが日中の生活は保たれつつある。退院先は未定で、今後は地域生活に向けた支援を段階的に進める。",
    },
    {
      id: "sum-a-lastyear",
      date: "2024/12/25",
      timepoint: "前年",
      title: "前年サマリー",
      author: "田中 花子",
      content:
        "概ね安定して経過。夜間の残遺幻聴と入眠困難が持続。日中活動は低下しOT辞退が多い。服薬は看護管理で確実だが、自己管理には自信がない。体重・脂質はやや高値で、間食制限に取り組み始めた。",
    },
    {
      id: "sum-a-current",
      date: "2025/07/01",
      timepoint: "現在",
      title: "現在サマリー",
      author: "鈴木 一郎 医師",
      content:
        "症状は概ね安定。残遺する幻聴（夜間）と不眠、日中活動の低下は継続。一方で、SST参加の定着、体重管理の進行、同室Iさんの影響による服薬自己管理への関心など、回復のサインがみられる。退院支援として、自己管理能力の向上と、グループホーム等の地域生活の検討を進める。",
    },
    {
      id: "sum-a-nursing",
      date: "2025/07/01",
      timepoint: "現在",
      title: "看護サマリー",
      author: "田中 花子",
      content:
        "セルフケア（入浴・洗濯・口腔ケア）は促しで維持。夜間の幻聴と不眠に対しラジオでの対処や頓用薬を使用。翌朝の眠気に留意。数少ない安心できる関係であるIさんとの交流が活動の広がりにつながっている。強みは、便秘や体調を自ら訴えられること、体重管理に取り組めること。課題は日中活動の低下と服薬・金銭の自己管理。",
    },
    {
      id: "sum-a-ot",
      date: "2025/06/24",
      timepoint: "現在",
      title: "OT・リハビリサマリー",
      author: "作業療法士 山本",
      content:
        "OTは気が向かず辞退する日が多いが、参加時は手先の課題を落ち着いて行える。集団活動への参加は不安定。一方、SSTは最近参加が定着しており、対人技能の練習に前向きな面がみられる。関心のある活動を糸口とした段階的な参加を継続する。",
    },
    {
      id: "sum-a-nutrition",
      date: "2025/06/20",
      timepoint: "現在",
      title: "栄養サマリー",
      author: "管理栄養士 林",
      content:
        "以前の脂質異常は、間食を一つ・非甘味の飲み物にする取り組みと体重減少（約80kg→約70kg、腹囲約90cm→約85cm）により改善。食事は概ね全量摂取。BMIは過体重域が続くため、間食制限と活動量確保の継続が必要。",
    },
    {
      id: "sum-a-discharge",
      date: "2025/07/05",
      timepoint: "現在",
      title: "退院支援中間サマリー",
      author: "MSW 伊藤",
      content:
        "帰る家がないため住居確保が退院支援の前提。グループホームやアパート生活を段階的に検討中。キーパーソンの叔父は高齢で協力は限定的。自己管理能力（服薬・金銭・生活）の向上が地域生活の鍵。『ここにいる方が安心』という思いに配慮し、焦らず進める。",
    },
  ],
  clinicalDocuments: [
    {
      id: "doc-a-treatment-plan",
      date: "2021/06/18",
      category: "入院診療計画書",
      title: "入院診療計画書",
      author: "鈴木 一郎 医師",
      sections: [
        { heading: "病名", body: "統合失調症" },
        { heading: "入院の目的", body: "幻覚妄想の増悪に対する安全確保と安定化、生活の立て直し。" },
        { heading: "治療計画", body: "薬物療法（抗精神病薬の調整）、保護的環境の提供、生活リズムの再構築。" },
        { heading: "推定入院期間", body: "状態に応じて調整（当面は安定化を優先）。" },
        { heading: "特記事項", body: "医療保護入院。キーパーソンは高齢の叔父。住居喪失のため退院先の調整を要する。" },
      ],
    },
    {
      id: "doc-a-nursing-admission",
      date: "2021/06/19",
      category: "看護入院時アセスメント",
      title: "看護入院時アセスメント",
      author: "田中 花子",
      sections: [
        { heading: "主訴・現状", body: "被害的な訴えと不眠。表情硬く、緊張が強い。" },
        { heading: "セルフケア", body: "食事・保清・整容は促しを要する。金銭管理に困難。" },
        { heading: "睡眠", body: "入眠困難。幻聴の影響が疑われる。" },
        { heading: "対人関係", body: "周囲への関心は乏しい。集団は苦手。" },
        { heading: "看護上の着眼点", body: "安全確保、生活リズムの支援、安心できる関係づくり。" },
      ],
    },
    {
      id: "doc-a-nursing-plan",
      date: "2025/07/01",
      category: "看護計画",
      title: "看護計画",
      author: "田中 花子",
      sections: [
        { heading: "#1 睡眠と幻聴", body: "夜間の幻聴・不眠に対し、ラジオ等の対処を支持し、頓用薬の適切な使用と翌朝の眠気を観察する。" },
        { heading: "#2 セルフケア", body: "入浴・洗濯・口腔ケアを促しで維持し、できた点を伝えて自発性を育てる。" },
        { heading: "#3 日中活動", body: "OT辞退を尊重しつつ、SST等参加できる活動を糸口に活動量を保つ。" },
        { heading: "#4 服薬自己管理", body: "関心の芽（Iさんの影響）を活かし、就寝前薬から段階的な自己管理を検討する。" },
        { heading: "#5 退院・地域生活", body: "『ここが安心』という思いに配慮し、多職種と退院支援を進める。" },
      ],
    },
    {
      id: "doc-a-fall-risk",
      date: "2025/07/01",
      category: "転倒転落リスクアセスメント",
      title: "転倒転落リスクアセスメント",
      author: "田中 花子",
      sections: [
        { heading: "総合評価", body: "低〜中リスク。歩行は自立しており、日常的な転倒リスクは高くない。" },
        { heading: "リスク要因", body: "就寝前の睡眠薬・頓用睡眠薬の使用、翌朝の眠気・ふらつきの可能性、過体重。" },
        { heading: "対策", body: "夜間・早朝の移動時に注意喚起。頓用薬使用翌朝は特に見守る。環境整備を行う。" },
      ],
    },
    {
      id: "doc-a-pressure-injury",
      date: "2025/07/01",
      category: "褥瘡リスクアセスメント",
      title: "褥瘡リスクアセスメント",
      author: "田中 花子",
      sections: [
        { heading: "総合評価", body: "低リスク。" },
        { heading: "根拠", body: "自力体動・歩行が保たれ、栄養状態・皮膚状態も良好。持続的な圧迫の要因なし。" },
        { heading: "対策", body: "定期的な皮膚観察を継続。特別な予防具は不要。" },
      ],
    },
    {
      id: "doc-a-nutrition",
      date: "2025/06/20",
      category: "栄養スクリーニング・アセスメント",
      title: "栄養スクリーニング・アセスメント",
      author: "管理栄養士 林",
      sections: [
        { heading: "体格", body: "身長165cm、体重約70kg、腹囲約85cm。BMIは過体重域。" },
        { heading: "経過", body: "以前は約80kg・腹囲約90cm。間食制限と活動で減量、脂質異常も改善。" },
        { heading: "食事摂取", body: "概ね全量摂取。間食は一つ・非甘味の飲み物を選択できている。" },
        { heading: "計画", body: "間食制限と活動量確保を継続。急激な減量は避け、緩やかな管理を行う。" },
      ],
    },
    {
      id: "doc-a-med-mgmt",
      date: "2025/07/04",
      category: "服薬管理アセスメント",
      title: "服薬管理アセスメント",
      author: "薬剤師 中村",
      sections: [
        { heading: "現状", body: "服薬は看護管理。飲み忘れなし。必要性は理解しているが自己管理には自信がない。" },
        { heading: "変化", body: "同室Iさんの自己管理を見て『自分にもできるかな』と関心を示す。" },
        { heading: "計画", body: "就寝前薬など負担の少ない薬から段階的に自己管理を導入。理解度と実施状況を評価する。" },
      ],
    },
    {
      id: "doc-a-ot-eval",
      date: "2025/06/24",
      category: "OT評価",
      title: "OT 初期・現在評価",
      author: "作業療法士 山本",
      sections: [
        { heading: "初期評価（2021/07）", body: "易疲労と自発性低下が強く、活動導入は困難。段階的導入を計画。" },
        { heading: "現在評価", body: "手先の課題は落ち着いて行える。OT辞退は多いが、SSTは参加が定着。集団参加は不安定。" },
        { heading: "方針", body: "関心のある活動を糸口に、無理のない範囲で活動量と対人交流を広げる。" },
      ],
    },
    {
      id: "doc-a-sst-eval",
      date: "2025/07/08",
      category: "SST参加評価",
      title: "SST参加評価",
      author: "作業療法士 山本",
      sections: [
        { heading: "参加状況", body: "最近は継続参加が定着。ロールプレイでは緊張するが最後まで取り組む。" },
        { heading: "本人の反応", body: "『少しは言えた』と手応えを語る場面あり。" },
        { heading: "課題と方針", body: "対人技能の般化が課題。成功体験を積み重ね、自己効力感を高める。" },
      ],
    },
    {
      id: "doc-a-psw-interview",
      date: "2025/07/05",
      category: "PSW面接記録",
      title: "PSW 面接記録",
      author: "MSW 伊藤",
      sections: [
        { heading: "家族・支援", body: "叔父は高齢で面会減少、協力は限定的。他に支援者は乏しい。" },
        { heading: "住居", body: "帰る家がなく、住居確保が退院の前提課題。" },
        { heading: "退院支援", body: "グループホーム・アパート生活を段階的に検討。地域移行支援の活用を想定。" },
        { heading: "経済", body: "障害年金を受給。生活保護の併用可能性を検討。" },
      ],
    },
    {
      id: "doc-a-pharmacist",
      date: "2025/07/01",
      category: "薬剤師 服薬指導記録",
      title: "薬剤師 服薬指導記録",
      author: "薬剤師 中村",
      sections: [
        { heading: "指導内容", body: "定期薬（ロフラゼプ酸エチル・リスペリドン・クエチアピン・ゾピクロン）と頓用薬の目的・副作用を説明。" },
        { heading: "理解・反応", body: "飲み忘れなし。自己管理に関心。眠気・ふらつきの自己観察を助言。" },
        { heading: "留意点", body: "市販薬・アルコールとの相互作用に注意（本人は飲酒・喫煙なし）。" },
      ],
    },
    {
      id: "doc-a-dietitian",
      date: "2025/06/20",
      category: "管理栄養士記録",
      title: "管理栄養士記録",
      author: "管理栄養士 林",
      sections: [
        { heading: "面談", body: "間食・飲み物の選び方を一緒に確認。本人は減量に前向き。" },
        { heading: "評価", body: "取り組みは定着。脂質改善・体重減少がみられる。" },
        { heading: "計画", body: "無理のない範囲で継続。活動量の確保を看護・OTと連携。" },
      ],
    },
    {
      id: "doc-a-conference",
      date: "2025/07/07",
      category: "多職種カンファレンス記録",
      title: "多職種カンファレンス記録",
      author: "多職種チーム",
      sections: [
        { heading: "参加者", body: "医師・看護師・薬剤師・作業療法士・管理栄養士・PSW。" },
        { heading: "共有事項", body: "症状は安定。残遺幻聴・不眠・日中活動低下が課題。回復のサイン（SST定着・体重管理・服薬関心）を確認。" },
        { heading: "方針", body: "自己管理能力の向上と地域生活（グループホーム等）の段階的検討。住居確保が前提。" },
        { heading: "各職種の役割", body: "看護：生活・服薬支援／薬剤：段階的自己管理／OT：活動・対人技能／栄養：体重管理／PSW：住居・制度。" },
      ],
    },
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
  summaries: [],
  clinicalDocuments: [],
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
  summaries: [],
  clinicalDocuments: [],
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
    summaries: [],
    clinicalDocuments: [],
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
  // A：14日分の直近フローシートは CHART_A に直接記述（数年に及ぶ入院のため代表週生成は行わない）。
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
