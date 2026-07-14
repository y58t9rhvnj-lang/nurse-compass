// Sprint10.7「患者発言と関連情報の紐付け」用データ＆会話エンジン。
// Version1は外部AI/有料API不要。ルールベースで以下を実現する。
//  - 主ルート（mainRoute）＋話題（topics）の二層構造。主ルート外の話題も返答可能。
//  - 各話題は開示レベル（level）を持ち、再質問で段階的に情報を開示する。
//  - Compass Coach は行き詰まり時のみ段階的に支援する。
//  - 主ルートの到達点で relatedResources を複数提示し、学生が選択してカルテへ遷移する。

import type { ChartTabId } from "./chartTabs";
import type { ChartFocus } from "./chartNav";
import {
  type PatientPersona,
  PATIENT_A_PERSONA,
  composeReply,
  detectSmalltalkKind,
  hasEmpathyWord,
  hasOvergeneralization,
  hasReflectiveMarker,
  pickDeterministic,
} from "./conversation/naturalness";

export interface FacingObservation {
  avatar: string;
  expression: string;
  posture: string;
  gaze: string;
  location: string;
}

// 患者発言に関連する情報（複数）。学生がどれを見るか選択する教材構造。
// 将来: ゴードン分類・関連図・看護問題 等へ type を追加可能。
export type RelatedResource =
  | { type: "診療録"; recordId: string; title: string }
  | { type: "看護記録"; recordId: string; title: string }
  | { type: "フローシート"; date: string; title: string }
  | { type: "処方"; orderId: string; title: string }
  | { type: "サマリー"; title: string }
  | { type: "生活歴"; title: string };

// 関連情報 → 電子カルテ遷移（既存のフォーカス機構を利用）
export function resourceToNav(
  res: RelatedResource,
): { tab: ChartTabId; focus?: ChartFocus } {
  switch (res.type) {
    case "診療録":
      return { tab: "診療録", focus: { type: "recordId", id: res.recordId } };
    case "看護記録":
      return { tab: "診療録", focus: { type: "nursingId", id: res.recordId } };
    case "フローシート":
      return {
        tab: "フローシート",
        focus: { type: "flowsheetDate", date: res.date },
      };
    case "処方":
      return { tab: "処方", focus: { type: "rxId", id: res.orderId } };
    case "サマリー":
      return { tab: "医療サマリー" };
    case "生活歴":
      return { tab: "生活歴" };
  }
}

// 挨拶の種別（入力に合わせて返答を分ける）
type GreetingKind =
  | "morning"
  | "day"
  | "evening"
  | "firstmeet"
  | "regards"
  | "excuse"
  | "casual";

// 判定順（先に一致した種別を採用）
const GREETING_KINDS: { kw: string; kind: GreetingKind }[] = [
  { kw: "おはよう", kind: "morning" },
  { kw: "こんにちは", kind: "day" },
  { kw: "こんばんは", kind: "evening" },
  { kw: "はじめまして", kind: "firstmeet" },
  { kw: "よろしく", kind: "regards" },
  { kw: "失礼します", kind: "excuse" },
  { kw: "ごきげん", kind: "morning" },
  { kw: "どうも", kind: "casual" },
];

// 話題の1レベル分の開示内容
interface Disclosure {
  reply: string;
  fact?: string;
}

interface TopicDef {
  levels: Disclosure[];
  // Sprint10.8B: 話題ごとの関連情報と解放しきい値（睡眠を特別扱いしない）。
  relatedResources?: RelatedResource[];
  sufficientAt?: number;
}

// 主ルート（初期の学習導線）
interface MainNode {
  topic: string;
  level: number;
  direction: string;
  example: string;
  relatedResources?: RelatedResource[];
}

interface PatientConvo {
  // coreThemes: 患者ごとに最終的に十分確認したい重要テーマ群（会話は一本道にしない）。
  // 学生には一覧表示せず、Coach が自然な戻しを判断する内部材料としてのみ使う。
  // 配列の先頭ほど重要度が高い（pending 選択の優先度に用いる）。
  coreThemes: string[];
  mainRoute: MainNode[];
  greetings: Record<GreetingKind, string>;
  topics: Record<string, TopicDef>;
  unknownReplies: string[];
  alreadyReplies: string[];
  // Sprint A-2.1: 話し方（ペルソナ）。持つ患者のみ自然さレイヤーが有効になる（A のみ）。
  persona?: PatientPersona;
}

// ===== 話題キーワード（全患者共通・strong=具体/優先, weak=一般） =====
const GREETING_KW = [
  "おはよう",
  "こんにちは",
  "こんばんは",
  "はじめまして",
  "よろしく",
  "どうも",
  "失礼します",
  "ごきげん",
];

const TOPIC_KW: Record<string, { strong: string[]; weak: string[] }> = {
  greeting: { strong: GREETING_KW, weak: [] },
  condition: {
    strong: ["体調", "気分", "調子", "具合", "意欲", "やる気", "気力"],
    weak: ["いかが", "どうです", "元気", "様子", "加減"],
  },
  sleep: {
    strong: ["睡眠", "眠れ", "寝れ", "眠り", "寝つけ", "中途覚醒", "不眠", "夜中", "目が覚", "何度も起き", "早朝"],
    weak: ["眠", "寝", "ねむ", "夜は", "休め"],
  },
  // 幻聴（Aの中核症状）。声・幻聴・幻覚を独立話題として扱う。
  hallucination: {
    strong: ["幻聴", "幻覚", "声が聞こえ", "声が", "聞こえる声", "声のこと"],
    weak: ["声", "聞こえ"],
  },
  // ラジオ（Aの対処行動・楽しみ）。
  radio: {
    strong: ["ラジオ", "らじお", "深夜番組"],
    weak: [],
  },
  // 朝の様子・目覚め（睡眠と関連する午前の倦怠感）。
  morning: {
    strong: ["起床", "寝起き", "寝覚め", "朝方", "朝の", "朝は"],
    weak: ["朝"],
  },
  daytime: {
    strong: ["日中", "昼間", "昼寝", "活動量"],
    weak: ["昼", "過ごし", "眠気", "だるさ", "活動"],
  },
  meal: {
    strong: ["食事", "食欲", "ご飯", "ごはん", "食べ", "朝食", "昼食", "夕食"],
    weak: ["召し上", "栄養"],
  },
  medication: {
    strong: ["薬", "服薬", "内服", "くすり", "服用", "副作用"],
    weak: ["飲み", "飲む", "効か", "効き"],
  },
  // 服薬の自己管理（Iさんを見ての関心）。medication より具体的。
  med_selfmgmt: {
    strong: ["自己管理", "自分で管理", "自分で薬", "自分で飲", "薬の管理", "服薬管理"],
    weak: [],
  },
  // 同室Iさんとの関係（安心できる相手・回復のモデル）。
  roommate: {
    strong: ["iさん", "同室", "相部屋", "ルームメイト", "中庭", "同じ部屋"],
    weak: [],
  },
  // SST（対人技能訓練・参加が改善傾向）。
  sst: {
    strong: ["sst", "エスエスティー", "ソーシャルスキル", "スキル訓練", "対人技能"],
    weak: [],
  },
  ot: {
    strong: ["作業療法", "ot", "リハビリ", "リハ"],
    weak: ["プログラム", "活動療法"],
  },
  family: {
    strong: ["家族", "面会", "きょうだい", "兄弟", "姉妹", "親戚", "身内", "お母", "母さん", "息子", "娘", "孫", "奥さん", "旦那", "妻", "夫", "父"],
    weak: ["母", "家の人"],
  },
  // 叔父（キーパーソン）。family の「父」より具体的に優先させる。
  uncle: {
    strong: ["叔父さん", "叔父", "おじさん", "おじ"],
    weak: [],
  },
  // 母（入院中に死去）。family と競合するため mother を先に定義して優先。
  mother: {
    strong: ["お母さん", "母さん", "母親", "お母", "亡くなった母", "母"],
    weak: [],
  },
  // 金銭・生活費への不安。
  money: {
    strong: ["金銭", "お金", "生活費", "小遣い", "こづかい", "前借り"],
    weak: [],
  },
  discharge: {
    strong: ["退院", "帰宅", "家に帰", "帰りたい", "いつ出", "出られ", "退院後"],
    weak: ["帰り", "帰る", "家に"],
  },
  // 入院生活・病院という環境（安心できる場）。
  hospital: {
    strong: ["入院生活", "病院", "病棟", "入院は", "入院して", "ここにいる", "ここが"],
    weak: ["入院"],
  },
  // 体重・間食（向精神薬の影響を意識）。
  weight: {
    strong: ["体重", "間食", "太", "痩", "肥満", "ダイエット"],
    weak: [],
  },
  // 便秘・排便（緩下剤の使用）。
  constipation: {
    strong: ["便秘", "便通", "お通じ", "排便", "お腹が張", "下剤"],
    weak: [],
  },
  // 清潔・整容（入浴・身だしなみ）。
  hygiene: {
    strong: ["入浴", "お風呂", "風呂", "歯みがき", "歯磨き", "洗濯", "清潔", "身だしなみ", "シャワー", "整容"],
    weak: [],
  },
  // 得意なこと・強み（自己肯定感は低い）。
  strengths: {
    strong: ["得意", "できること", "強み", "長所", "いいところ", "自信のある"],
    weak: [],
  },
  hobby: {
    strong: ["趣味", "好きなこと", "楽しみ", "楽しみに"],
    weak: ["好き", "過ごし方", "休みの日"],
  },
  // 大切にしていること・価値観。
  values: {
    strong: ["大切", "価値観", "大事にして", "こだわり", "信条"],
    weak: [],
  },
  anxiety: {
    strong: ["不安", "心配", "気がかり", "こわい", "怖い"],
    weak: ["気になる", "落ち着かない"],
  },
  plan: {
    strong: ["計画", "予定", "仕事", "アプリ開発", "開発"],
    weak: ["退院後", "休息", "これから"],
  },
  self_blame: {
    strong: ["自責", "情けない", "申し訳", "自分が悪", "ダメな自分"],
    weak: ["つらい", "苦しい", "情けな"],
  },
  hope: {
    strong: ["希望", "楽しみ", "楽しみに", "会いたい", "孫"],
    weak: ["これから", "将来", "待ち遠し"],
  },
  paranoia: {
    strong: ["見られ", "監視", "被害", "盗聴", "悪口", "狙わ", "視線を感じ"],
    weak: ["誰か", "気配"],
  },
};

// 複数候補時の優先度（先頭ほど優先＝より具体的/臨床的に取り違えを避けたい話題）
const PRIORITY = [
  "hallucination",
  "paranoia",
  "self_blame",
  "med_selfmgmt",
  "medication",
  "constipation",
  "weight",
  "sleep",
  "morning",
  "radio",
  "discharge",
  "hospital",
  "money",
  "uncle",
  "mother",
  "roommate",
  "sst",
  "ot",
  "hope",
  "plan",
  "meal",
  "hygiene",
  "hobby",
  "strengths",
  "values",
  "daytime",
  "anxiety",
  "family",
  "condition",
  "greeting",
];

function pIdx(id: string): number {
  const i = PRIORITY.indexOf(id);
  return i < 0 ? 999 : i;
}

// キーワードを持たない一般的なフォローアップ（「その時はどうしていますか」「もう少し詳しく」等）。
// 話題語ではなく、直前の話題を続けたい合図。現在の話題が進行中のときだけ継続に用いる。
// 新しい返答テンプレートは追加しない（既存の開示レベルを続けるだけ）。
const CONTINUATION_MARKERS = [
  "どうし", // どうして / どうしている / どうします / どうしたら
  "どうやって",
  "どうなる",
  "どうなり",
  "くわしく",
  "詳しく",
  "たとえば",
  "例えば",
  "ほかに",
  "他に",
  "それから",
  "そのあと",
  "そのとき",
  "その時",
];

function isContinuationFollowup(normalizedText: string): boolean {
  return CONTINUATION_MARKERS.some((m) => normalizedText.includes(normalize(m)));
}

// ===== 患者別会話定義 =====
const CONVO: Record<string, PatientConvo> = {
  // Aさん（統合失調症・長期入院／回復期）: 物静かで控えめ。夜間の残遺幻聴、服薬自己管理への関心、
  //   叔父との関係、退院・地域生活への不安が背景。同室Iさんは安心できる存在で回復のモデル。
  // 重要テーマ: 睡眠・幻聴 / 服薬自己管理 / 退院と地域生活への不安 / 叔父との関係。
  A: {
    coreThemes: ["sleep", "hallucination", "medication", "discharge"],
    mainRoute: [
      {
        topic: "greeting",
        level: 0,
        direction: "まずは挨拶から始めてみましょう。",
        example: "例えば「おはようございます」と声をかけてみましょう。",
      },
      {
        topic: "condition",
        level: 0,
        direction: "今日の体調や気分から確かめてみましょう。",
        example: "例えば「今日の調子はいかがですか？」と尋ねられます。",
      },
      {
        topic: "sleep",
        level: 0,
        direction: "睡眠がとれているか確かめてみましょう。",
        example: "例えば「昨日はよく眠れましたか？」と尋ねられます。",
      },
      {
        topic: "sleep",
        level: 1,
        direction: "眠りの中身を、もう少し具体的に確認してみましょう。",
        example: "例えば「夜中に目が覚めることはありましたか？」と尋ねられます。",
      },
      {
        topic: "sleep",
        level: 2,
        direction: "眠れない背景に、気がかりがないか尋ねてみましょう。",
        example: "例えば「眠れないとき、気になることはありますか？」と尋ねられます。",
      },
      {
        topic: "daytime",
        level: 0,
        direction: "睡眠が日中の生活にどう影響しているか尋ねてみましょう。",
        example: "例えば「日中はどのように過ごしていますか？」と尋ねられます。",
      },
    ],
    greetings: {
      morning: "……おはようございます。",
      day: "……こんにちは。",
      evening: "……こんばんは。",
      firstmeet: "……はじめまして。よろしくお願いします。",
      regards: "こちらこそ、よろしくお願いします。",
      excuse: "はい、どうぞ。",
      casual: "……どうも。",
    },
    // 話題は患者ごとに独立して検出される（この患者が持つ話題だけが候補）。
    // 母・叔父は family より前に並べ、キーワード競合時に優先して当たるようにする。
    topics: {
      condition: {
        levels: [
          { reply: "……だいぶ、落ち着いています。ただ、夜になると、声が聞こえることがあって。", fact: "本人：全体的に安定、夜間の幻聴が残る" },
          { reply: "昼間は、わりと穏やかに過ごせています。", fact: "本人：日中は比較的安定" },
        ],
      },
      sleep: {
        levels: [
          { reply: "夜、なかなか寝つけないことがあります。", fact: "本人：入眠困難あり" },
          { reply: "「だめな人間だ」とか……そういう声が、聞こえてくることがあって。", fact: "本人：夜間の幻聴（自己否定的な内容）" },
          { reply: "そういう時は、ラジオを小さくかけて、やり過ごしています。眠れない時は、頓服をもらうこともあります。", fact: "本人：ラジオで対処・頓用睡眠薬の使用あり" },
        ],
        sufficientAt: 3,
        relatedResources: [
          { type: "診療録", recordId: "clinical-a-sleep-voices", title: "幻聴と不眠の経過" },
          { type: "看護記録", recordId: "nursing-a-night-voices", title: "夜間の観察" },
          { type: "フローシート", date: "2025/07/06", title: "睡眠・頓服" },
          { type: "処方", orderId: "rx-a-tonpuku", title: "頓用睡眠薬" },
        ],
      },
      hallucination: {
        levels: [
          { reply: "……夜になると、声が聞こえることがあります。", fact: "本人：夜間中心の幻聴" },
          { reply: "「怠け者だ」とか、責めるような声で……。でも、気のせいかもしれません。", fact: "本人：自己否定的な幻聴（半信半疑）" },
          { reply: "昼間は、あまり気になりません。ラジオを聴いていると、少し紛れるんです。", fact: "本人：日中は軽減・ラジオで対処" },
        ],
        sufficientAt: 3,
        relatedResources: [
          { type: "診療録", recordId: "clinical-a-sleep-voices", title: "幻聴と不眠の経過" },
          { type: "看護記録", recordId: "nursing-a-night-voices", title: "夜間の観察" },
          { type: "フローシート", date: "2025/07/06", title: "夜間の幻聴・頓服" },
        ],
      },
      radio: {
        levels: [
          { reply: "夜は、ラジオを小さくかけて聴いています。声が気になる時も、少し楽になるので。", fact: "本人：ラジオが幻聴・不眠への対処" },
          { reply: "……深夜番組を、よく聴きます。それくらいが、ちょうどいいんです。", fact: "本人：深夜ラジオを好む" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "看護記録", recordId: "nursing-a-night-voices", title: "夜間の過ごし方" },
          { type: "生活歴", title: "生活歴" },
        ],
      },
      morning: {
        levels: [
          { reply: "朝は……少し、だるいことが多いです。夜、眠れないと、なおさらで。", fact: "本人：朝の倦怠感（睡眠と関連）" },
          { reply: "起きるのは、6時半くらいです。朝は、ぼんやりしていることが多くて。", fact: "本人：起床6時半・午前は不活発" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "フローシート", date: "2025/07/06", title: "起床・睡眠" },
        ],
      },
      daytime: {
        levels: [
          { reply: "昼間は、部屋で過ごすことが多いです。ラジオを聴いたり、横になったり。", fact: "本人：日中は室内中心・活動量低下" },
          { reply: "夕方に、少し中庭を歩くくらいで……。", fact: "本人：軽い活動はあるが少ない" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "フローシート", date: "2025/07/05", title: "日中の活動" },
        ],
      },
      meal: {
        levels: [
          { reply: "食事は、毎回きちんと食べています。間食は、一つだけにしているんです。", fact: "本人：食事は全量・間食制限に取り組む" },
          { reply: "体重のことがあるので、少し気をつけています。", fact: "本人：体重を意識した食事管理" },
        ],
        sufficientAt: 1,
      },
      medication: {
        levels: [
          { reply: "薬は、きちんと飲んでいます。今は、看護師さんが管理してくれています。", fact: "本人：服薬遵守・現在は看護管理" },
          { reply: "同室のIさんは、自分で薬を管理していて……。自分にもできるかな、と思うことがあります。", fact: "本人：Iさんを見て服薬自己管理に関心" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "処方", orderId: "rx-a-teiki-current", title: "定期処方" },
          { type: "診療録", recordId: "clinical-a-med-selfmgmt", title: "服薬指導の記録" },
        ],
      },
      med_selfmgmt: {
        levels: [
          { reply: "いつか、自分で薬を管理できるようになりたいと思っています。Iさんみたいに。", fact: "本人：服薬自己管理への意欲（Iさんがモデル）" },
          { reply: "……でも、間違えたら怖いな、とも思って。まだ、自信はないです。", fact: "本人：自己管理への不安・自信のなさ" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "診療録", recordId: "clinical-a-med-selfmgmt", title: "服薬自己管理の記録" },
          { type: "看護記録", recordId: "nursing-a-med-interest", title: "服薬への関心の記録" },
        ],
      },
      roommate: {
        levels: [
          { reply: "同室のIさんとは、時々、中庭で一緒に過ごします。", fact: "本人：Iさんと中庭で過ごす" },
          { reply: "Iさんは、自分よりずっと長く入院していて……。落ち着いていて、尊敬しています。", fact: "本人：Iさんを回復のモデルとして見ている" },
          { reply: "Iさんと話していると、少し気が楽になります。……数少ない、話せる人です。", fact: "本人：Iさんが数少ない安心できる相手" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "看護記録", recordId: "nursing-a-courtyard-i", title: "Iさんと過ごす様子" },
          { type: "生活歴", title: "生活歴" },
        ],
      },
      sst: {
        levels: [
          { reply: "SSTには、最近は出るようにしています。", fact: "本人：SST参加が改善傾向" },
          { reply: "人と話す練習は、緊張しますが……。少しずつ、慣れてきた気がします。", fact: "本人：対人場面に緊張も改善を自覚" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "フローシート", date: "2025/07/04", title: "SST参加" },
        ],
      },
      ot: {
        levels: [
          { reply: "作業療法は……気が向かない日も、多くて。", fact: "本人：OT辞退が多い" },
          { reply: "人が多い場所は、少し疲れてしまうんです。", fact: "本人：集団場面での易疲労" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "フローシート", date: "2025/07/06", title: "OTの参加状況" },
        ],
      },
      uncle: {
        levels: [
          { reply: "叔父が、時々面会に来てくれます。……最近は、少し減っていて。", fact: "本人：キーパーソンは叔父・面会は減少" },
          { reply: "……嫌われてしまったのかな、と思うことがあります。電話で確かめたわけではないのですが。", fact: "本人：叔父に嫌われた不安（未確認）" },
          { reply: "昔は、よく面倒を見てもらいました。感謝は、しているんです。", fact: "本人：叔父への感謝と複雑な思い" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "看護記録", recordId: "nursing-a-uncle", title: "叔父の話題の記録" },
          { type: "生活歴", title: "家族背景" },
        ],
      },
      mother: {
        levels: [
          { reply: "母は……もう、亡くなりました。入院している間に。", fact: "本人：母は入院中に死去" },
          { reply: "……最期に、あまり何もできなくて。それが、心残りです。", fact: "本人：母の死への心残り" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "生活歴", title: "生活歴" },
        ],
      },
      family: {
        levels: [
          { reply: "家族は……もう、叔父くらいです。両親は、亡くなりました。", fact: "本人：近親者は叔父のみ・両親死去" },
          { reply: "きょうだいは、いません。ずっと、母と二人でした。", fact: "本人：同胞なし・母と二人暮らしだった" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "生活歴", title: "家族背景" },
          { type: "看護記録", recordId: "nursing-a-uncle", title: "家族・叔父の記録" },
        ],
      },
      money: {
        levels: [
          { reply: "お金のことは……あまり、余裕はないです。", fact: "本人：金銭的余裕が乏しい" },
          { reply: "退院後の生活費のことは、少し心配です。", fact: "本人：退院後の生活費への不安" },
        ],
        sufficientAt: 1,
      },
      discharge: {
        levels: [
          { reply: "正直、ここにいる方が安心なんです。", fact: "本人：入院環境に安心感（単なる退院拒否ではない）" },
          { reply: "外で一人でやっていける自信が、まだなくて。", fact: "本人：地域生活への自信のなさ" },
          { reply: "少しずつ、練習していけたら……とは、思っています。", fact: "本人：段階的な退院準備への意欲の芽生え" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "サマリー", title: "現在サマリー" },
          { type: "生活歴", title: "退院への思い" },
          { type: "診療録", recordId: "clinical-a-discharge", title: "退院に関する経過" },
        ],
      },
      hospital: {
        levels: [
          { reply: "入院生活は……もう、長いです。ここは、落ち着きます。", fact: "本人：長期入院・院内に安心感" },
          { reply: "決まった時間に、決まったことをするのが、性に合っているのかもしれません。", fact: "本人：構造化された環境を好む" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "サマリー", title: "現在サマリー" },
          { type: "生活歴", title: "生活歴" },
        ],
      },
      weight: {
        levels: [
          { reply: "体重は、少し多めで……。間食は、一つだけにしているんです。", fact: "本人：体重やや多め・間食制限に取り組む" },
          { reply: "薬の影響も、あるみたいで。気をつけるように、言われています。", fact: "本人：向精神薬による体重増加を意識" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "フローシート", date: "2025/07/01", title: "体重測定" },
          { type: "看護記録", recordId: "nursing-a-20250701-weight", title: "体重・間食の記録" },
        ],
      },
      constipation: {
        levels: [
          { reply: "……お通じは、あまり良くないです。時々、薬をもらっています。", fact: "本人：便秘傾向・緩下剤の使用あり" },
          { reply: "お腹が張ると、少しつらいです。", fact: "本人：腹部膨満の訴え" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "フローシート", date: "2025/07/06", title: "排便・緩下剤" },
        ],
      },
      hygiene: {
        levels: [
          { reply: "お風呂は、決まった日に入っています。", fact: "本人：入浴は定期的" },
          { reply: "身だしなみは……あまり、気が回らない時もあります。", fact: "本人：整容への関心が低下する時がある" },
        ],
        sufficientAt: 1,
      },
      strengths: {
        levels: [
          { reply: "得意なこと……あまり、思いつかないです。", fact: "本人：自己肯定感が低い" },
          { reply: "……決めたことは、こつこつ続けられる方かもしれません。間食を一つにする、とか。", fact: "本人：地道な継続はできる（自覚は乏しい）" },
        ],
        sufficientAt: 1,
      },
      hobby: {
        levels: [
          { reply: "楽しみ……ラジオを聴いている時間は、好きです。", fact: "本人：ラジオを楽しみにしている" },
          { reply: "中庭で、Iさんと静かに過ごすのも、いいものです。", fact: "本人：Iさんと過ごす時間を楽しむ" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "生活歴", title: "生活歴" },
          { type: "看護記録", recordId: "nursing-a-courtyard-i", title: "Iさんと過ごす様子" },
        ],
      },
      values: {
        levels: [
          { reply: "大切にしていること……Iさんと過ごす、静かな時間、でしょうか。", fact: "本人：静かな時間・Iさんとの関係を大切にする" },
          { reply: "……あまり、人に迷惑をかけたくない、とは思っています。", fact: "本人：他者に迷惑をかけたくない価値観" },
        ],
        sufficientAt: 1,
      },
      anxiety: {
        levels: [
          { reply: "……少し、落ち着かないことはあります。", fact: "本人：漠然とした不安" },
          { reply: "夜に、声が気になるときがあって。", fact: "本人：夜間の幻聴への不安" },
        ],
      },
    },
    unknownReplies: [
      "うーん……ちょっと、分からないですね。",
      "もう少し、詳しく聞いてもらえますか。",
      "それは、どういう意味ですか？",
      "あまり、考えたことがなくて……。",
    ],
    alreadyReplies: [
      "そうですね……、さっきと同じで、あまり変わらないです。",
      "……さっき話したのと、同じ感じです。",
      "同じことになりますが……、変わりはないです。",
    ],
    persona: PATIENT_A_PERSONA,
  },

  // Eさん（うつ病）: 返答が短く、自責的。開示はゆっくり。
  // 重要テーマ: 気分 / 自責感 / 睡眠・食事 / 希望や支え。
  E: {
    coreThemes: ["self_blame", "condition", "sleep", "meal", "hope"],
    mainRoute: [
      {
        topic: "greeting",
        level: 0,
        direction: "まずは挨拶から始めてみましょう。",
        example: "例えば「おはようございます」と声をかけてみましょう。",
      },
      {
        topic: "condition",
        level: 0,
        direction: "今の気分や意欲を確かめてみましょう。",
        example: "例えば「今日の気分はいかがですか？」と尋ねられます。",
      },
      {
        topic: "sleep",
        level: 0,
        direction: "睡眠の状況も確かめてみましょう。",
        example: "例えば「夜はよく眠れていますか？」と尋ねられます。",
      },
      {
        topic: "meal",
        level: 0,
        direction: "食事や食欲について確かめてみましょう。",
        example: "例えば「食事はとれていますか？」と尋ねられます。",
      },
      {
        topic: "self_blame",
        level: 0,
        direction: "つらさの背景にある気持ちを、そっと尋ねてみましょう。",
        example: "例えば「今、どんなことがつらいですか？」と尋ねられます。",
      },
      {
        topic: "self_blame",
        level: 1,
        direction: "その気持ちを、もう少し聞かせてもらいましょう。",
        example: "例えば「ご家族のことも、気にされていますか？」と尋ねられます。",
      },
      {
        topic: "hope",
        level: 0,
        direction: "支えや、これからの希望について尋ねてみましょう。",
        example: "例えば「これから楽しみにしていることはありますか？」と尋ねられます。",
      },
    ],
    greetings: {
      morning: "……おはようございます。",
      day: "……こんにちは。",
      evening: "……こんばんは。",
      firstmeet: "……はじめまして。",
      regards: "……よろしく、お願いします。",
      excuse: "……はい。",
      casual: "……どうも。",
    },
    topics: {
      condition: { levels: [
          { reply: "何もやる気が起きないんです。", fact: "本人：意欲低下の訴え" },
          { reply: "……ずっと、このままな気がして。", fact: "本人：将来への悲観" },
        ] },
      sleep: {
        levels: [
          { reply: "早くに目が覚めてしまって。", fact: "本人：早朝覚醒" },
          { reply: "それからは、ただ横になっていました。", fact: "本人：覚醒後の臥床" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "睡眠の経過" },
          { type: "フローシート", date: "2025/07/08", title: "睡眠・活動" },
        ],
      },
      meal: { levels: [
          { reply: "あまり、食べられていません。", fact: "本人：食欲低下" },
          { reply: "食べたい気持ちが、わかなくて。", fact: "本人：食思不振の自覚" },
        ] },
      self_blame: {
        levels: [
          { reply: "こんな自分で、情けなくて。", fact: "本人：自責的思考" },
          { reply: "家族にも、申し訳ないんです。", fact: "本人：家族への罪責感" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "看護記録", recordId: "nursing-e-20250707-01", title: "気持ちの記録" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "経過の記録" },
        ],
      },
      hope: {
        levels: [{ reply: "孫には、また会いたいなとは思います。……でも、今の自分では。", fact: "本人：孫に会いたい思いが希望として残る" }],
        sufficientAt: 1,
        relatedResources: [
          { type: "生活歴", title: "家族の記載" },
          { type: "看護記録", recordId: "nursing-e-20250709-01", title: "日中の様子" },
        ],
      },
      family: {
        levels: [{ reply: "家族は、時々来てくれます。", fact: "本人：家族面会あり" }],
        sufficientAt: 1,
        relatedResources: [
          { type: "生活歴", title: "家族の記載" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "経過の記録" },
        ],
      },
      medication: {
        levels: [
          { reply: "薬は、言われた通りに飲んでいます。", fact: "本人：服薬遵守" },
          { reply: "効いているのかは、よく分かりません。", fact: "本人：効果実感の乏しさ" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "処方", orderId: "rx-e-20250708-teiki", title: "処方内容" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "経過の記録" },
        ],
      },
      discharge: { levels: [{ reply: "家に帰っても、迷惑をかけるだけな気がして。", fact: "本人：退院への自信のなさ" }] },
      hobby: { levels: [{ reply: "前は、編み物を……。今は、何かをする気になれなくて。", fact: "本人：以前の趣味への関心低下" }] },
      anxiety: { levels: [{ reply: "……これからのことが、不安で。", fact: "本人：将来不安" }] },
    },
    unknownReplies: [
      "……うまく言葉にできません。",
      "すみません、よく分からなくて。",
      "そのことは、今は考えたくないです。",
      "……少し、答えるのが難しいです。",
    ],
    alreadyReplies: [
      "……さっき、お話ししたと思います。",
      "それは、もう言ったかもしれません。",
      "……変わりは、ないです。",
    ],
  },

  // Fさん（双極性障害・軽躁）: 多弁で話題が広がる。服薬・休息の必要感が乏しい。
  // 重要テーマ: 活動性 / 睡眠 / 服薬への認識 / 休息と今後の計画。
  F: {
    coreThemes: ["medication", "sleep", "condition", "plan"],
    mainRoute: [
      {
        topic: "greeting",
        level: 0,
        direction: "まずは挨拶から始めてみましょう。",
        example: "例えば「おはようございます」と声をかけてみましょう。",
      },
      {
        topic: "condition",
        level: 0,
        direction: "今の気分や活動の様子を確かめてみましょう。",
        example: "例えば「今日の調子はいかがですか？」と尋ねられます。",
      },
      {
        topic: "sleep",
        level: 0,
        direction: "睡眠や休息のとれ方を確かめてみましょう。",
        example: "例えば「昨日はどのくらい眠れましたか？」と尋ねられます。",
      },
      {
        topic: "medication",
        level: 0,
        direction: "服薬の状況や、薬への思いを確かめてみましょう。",
        example: "例えば「お薬は飲めていますか？」と尋ねられます。",
      },
      {
        topic: "medication",
        level: 1,
        direction: "薬について気になる点を、否定せずに尋ねてみましょう。",
        example: "例えば「お薬で困っていることはありますか？」と尋ねられます。",
      },
      {
        topic: "plan",
        level: 0,
        direction: "退院後の計画や、休息のとり方を尋ねてみましょう。",
        example: "例えば「退院したら何をしたいですか？」と尋ねられます。",
      },
    ],
    greetings: {
      morning: "おはようございます！",
      day: "こんにちは！",
      evening: "こんばんは！",
      firstmeet: "はじめまして！　どうも。",
      regards: "こちらこそ、よろしく！",
      excuse: "はいはい、どうぞ！",
      casual: "やあ、どうも！",
    },
    topics: {
      condition: { levels: [
          { reply: "絶好調です！　アイデアが止まらなくて。", fact: "本人：高揚感・観念奔逸傾向" },
          { reply: "じっとしていられないんですよ。", fact: "本人：多動・静止困難" },
        ] },
      sleep: {
        levels: [
          { reply: "睡眠は短いけど平気です。", fact: "本人：睡眠時間短縮を問題視せず" },
          { reply: "やりたいことがたくさんあって、寝るのがもったいなくて。", fact: "本人：睡眠欲求の低下" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "フローシート", date: "2025/07/08", title: "睡眠時間" },
          { type: "看護記録", recordId: "nursing-f-20250708-01", title: "夜間の記録" },
        ],
      },
      medication: {
        levels: [
          { reply: "薬は……正直、もう飲まなくてもいい気がします。", fact: "本人：服薬に消極的" },
          { reply: "眠くなるのが、少し嫌なんですよね。", fact: "本人：副作用（眠気）忌避" },
          { reply: "調子いいのに、飲む意味あります？", fact: "本人：病識・必要感の乏しさ" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "処方", orderId: "rx-f-20250707-teiki", title: "処方内容" },
          { type: "診療録", recordId: "clinical-f-20250707-med-01", title: "服薬の経過" },
        ],
      },
      plan: {
        levels: [{ reply: "退院したら、すぐアプリ開発です！　休むのはもったいなくて。", fact: "本人：退院後の過活動計画・休息軽視" }],
        sufficientAt: 1,
        relatedResources: [
          { type: "処方", orderId: "rx-f-20250707-teiki", title: "定期処方" },
          { type: "診療録", recordId: "clinical-f-20250707-med-01", title: "服薬の経過" },
          { type: "生活歴", title: "退院後の生活" },
        ],
      },
      meal: { levels: [{ reply: "食事はしっかり食べてます！　話しながらでも、どんどんいけますよ。", fact: "本人：食欲良好・多弁" }] },
      family: { levels: [{ reply: "家族は心配性でね。でも僕はこの通り元気なので。", fact: "本人：家族の心配を軽視" }] },
      discharge: { levels: [{ reply: "早く退院したいです。やりたいことが山ほどあって。", fact: "本人：退院希望・活動意欲過剰" }] },
      hobby: { levels: [{ reply: "新しいアプリを作るのが好きなんです。", fact: "本人：開発への没頭" }] },
      anxiety: { levels: [{ reply: "不安？　いやー、今はまったくないですね。", fact: "本人：不安の否認" }] },
    },
    unknownReplies: [
      "ん？　何の話でしたっけ。",
      "うーん、それはよく分からないなあ。",
      "その話は、今はいいかな。",
      "もっと別の話をしましょうよ。",
    ],
    alreadyReplies: [
      "さっき言いましたよ！",
      "それはもう話したじゃないですか、ははは。",
      "同じ話ですけど、まあいいか。",
    ],
  },
};

const FALLBACK_CONVO: PatientConvo = {
  coreThemes: ["sleep"],
  mainRoute: [
    {
      topic: "greeting",
      level: 0,
      direction: "まずは挨拶から始めてみましょう。",
      example: "例えば「おはようございます」と声をかけてみましょう。",
    },
    {
      topic: "condition",
      level: 0,
      direction: "今日の体調や気分を確かめてみましょう。",
      example: "例えば「今日の調子はいかがですか？」と尋ねられます。",
    },
    {
      topic: "sleep",
      level: 0,
      direction: "睡眠がとれているか確かめてみましょう。",
      example: "例えば「昨日はよく眠れましたか？」と尋ねられます。",
    },
  ],
  greetings: {
    morning: "おはようございます。",
    day: "こんにちは。",
    evening: "こんばんは。",
    firstmeet: "はじめまして。",
    regards: "こちらこそ、よろしくお願いします。",
    excuse: "はい、どうぞ。",
    casual: "どうも。",
  },
  topics: {
    condition: { levels: [{ reply: "体調は、まあまあです。", fact: "本人：体調はまずまず" }] },
    sleep: { levels: [{ reply: "睡眠は、まずまずとれています。", fact: "本人：睡眠はまずまず" }] },
  },
  unknownReplies: [
    "すみません、うまく答えられません。",
    "もう少し具体的に聞いてもらえますか。",
    "そのことは、今は分かりません。",
  ],
  alreadyReplies: ["それは、さきほどお話ししました。", "同じことになりますが、変わりません。"],
};

const OBSERVATIONS: Record<string, FacingObservation> = {
  A: {
    avatar: "😐",
    expression: "落ち着いているが、時折こわばる表情を見せる",
    posture: "椅子に浅く腰かけ、両手を膝の上に置いてやや前かがみ",
    gaze: "ときどきこちらを見るが、すぐに視線を落とす",
    location: "デイルームの窓際",
  },
  E: {
    avatar: "😔",
    expression: "硬くうつむきがちで、笑顔は少ない",
    posture: "ベッドの端に浅く座り、肩を落として動きが少ない",
    gaze: "床に向いていることが多く、目が合いにくい",
    location: "病室のベッドサイド",
  },
  F: {
    avatar: "🙂",
    expression: "明るく高揚ぎみで、表情の変化が大きい",
    posture: "浅く座ってすぐ立ち上がろうとし、身振り手振りが多い",
    gaze: "よく合うが、次々に別の方へ移っていく",
    location: "デイルーム",
  },
};

const FALLBACK_OBSERVATION: FacingObservation = {
  avatar: "🙂",
  expression: "穏やかで落ち着いている",
  posture: "椅子に腰かけている",
  gaze: "ときどき合う",
  location: "デイルーム",
};

export const TAB_LABEL: Record<ChartTabId, string> = {
  診療録: "診療録",
  患者情報: "基本情報",
  生活歴: "生活歴",
  エピソード: "エピソード",
  医療サマリー: "医療サマリー",
  看護記録: "看護記録",
  OT: "OT",
  PSW: "PSW",
  フローシート: "フローシート",
  検査: "検査",
  処方: "処方",
  書類: "書類",
};

export function getObservation(patientId: string): FacingObservation {
  return OBSERVATIONS[patientId] ?? FALLBACK_OBSERVATION;
}

function getConvo(patientId: string): PatientConvo {
  return CONVO[patientId] ?? FALLBACK_CONVO;
}

// ===== 会話状態 =====
// 判別共用体に対して各メンバーへ分配して Omit する（共通プロパティのみへ潰さない）。
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

// Sprint11.2: 各エントリに安定IDを持たせ、患者発言を Information Card から一意に参照できるようにする。
// ID は作成時に一度だけ確定し、再レンダリング・カルテ往復でも変わらない。
// 古い state（ID なし）でも壊れないよう、getEntryId が索引ベースの安全なフォールバックを返す。
export type FacingEntry =
  | { id: string; role: "student"; text: string }
  | { id: string; role: "patient"; text: string; unknown?: boolean }
  | { id: string; role: "coach"; resources: RelatedResource[] };

// エントリの安定ID（未設定の旧 state では索引ベースのフォールバックを返す）。
export function getEntryId(
  patientId: string,
  entry: FacingEntry,
  index: number,
): string {
  const withId = entry as { id?: string };
  return withId.id && withId.id !== "" ? withId.id : `${patientId}-${index}`;
}

export interface FacingConvoState {
  mainRouteProgress: number;
  completedMainSteps: string[];
  topicLevels: Record<string, number>;
  askedTopics: string[];
  // currentTopic: 現在話している話題（学生は自由に切り替えられる）。
  currentTopic: string | null;
  // lastMeaningfulTopic: 最後に意味のある話題（unknown 時は維持）。
  lastMeaningfulTopic: string | null;
  // pendingImportantTopics: 一度触れたが、まだ十分に深められていない重要な話題。
  pendingImportantTopics: string[];
  // unlockedResourcesByTopic: 話題ごとに解放済みの関連情報（表示は currentTopic のみ）。
  unlockedResourcesByTopic: Record<string, RelatedResource[]>;
  unknownStreak: number;
  stalledTurns: number;
  hintLevel: 0 | 1 | 2;
  disclosedFacts: string[];
  history: FacingEntry[];
  unknownTotal: number;
  alreadyTotal: number;
  // Sprint A-2.1: 自然さレイヤー用の状態（既存の保存データには無くてよい）。
  // reflectionStreak: 探索（新開示）を伴わない反射・共感・雑談が連続した回数。
  reflectionStreak: number;
  // lastAck: 直前に使ったあいづち（連続で同じものを避けるため）。
  lastAck: string | null;
  // turnCount: 学生の発話ターン数（決定的な変化とタイミング判定に使う）。
  turnCount: number;
  // reciprocalCount: 患者からの逆質問を返した回数（会話全体でごく稀にする）。
  reciprocalCount: number;
}

export function initialFacingState(): FacingConvoState {
  return {
    mainRouteProgress: 0,
    completedMainSteps: [],
    topicLevels: {},
    askedTopics: [],
    currentTopic: null,
    lastMeaningfulTopic: null,
    pendingImportantTopics: [],
    unlockedResourcesByTopic: {},
    unknownStreak: 0,
    stalledTurns: 0,
    hintLevel: 0,
    disclosedFacts: [],
    history: [],
    unknownTotal: 0,
    alreadyTotal: 0,
    reflectionStreak: 0,
    lastAck: null,
    turnCount: 0,
    reciprocalCount: 0,
  };
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[　\s]+/g, "")
    .replace(/[？?。、，．.,!！「」]/g, "");
}

// Coach 質問例とセットで保持するマッチフレーズ。
// detectTopic が例文そのものを正しく話題判定できるようにする。
const COACH_MATCH_PHRASES: Record<string, string[]> = {
  condition: [
    "今日の調子はいかが",
    "今日の気分はいかが",
    "いつ頃からその感じ",
    "体調はいかが",
  ],
  sleep: [
    "夜中に目が覚める",
    "途中で起きる",
    "中途覚醒",
    "夜中に起きる",
    "昨日はよく眠れ",
    "夜はよく眠れ",
    "眠れないとき",
    "気になることはありますか",
  ],
  daytime: ["日中はどのように過ごし", "日中の過ごし方"],
  meal: ["食事はとれてい", "食べる量に変化", "食欲", "食べる量"],
  medication: [
    "お薬について",
    "お薬は飲めてい",
    "お薬で困っている",
    "薬について",
    "服薬",
  ],
  family: [
    "ご家族とは",
    "ご家族のことも",
    "ご家族",
    "家族とは",
    "面会",
  ],
  discharge: ["退院後のこと", "退院後", "帰宅"],
  hobby: [
    "どんなときに楽しんで",
    "趣味",
    "好きなこと",
    "詰将棋",
  ],
  ot: ["作業療法では", "作業療法", "リハビリ"],
  anxiety: ["気になっていること", "何か不安", "心配"],
  plan: ["退院したら何をしたい", "退院したら", "退院後の計画", "休息"],
  self_blame: [
    "どんなことがつらい",
    "つらいこと",
    "情けない",
    "ご家族のことも",
    "気にされていますか",
  ],
  hope: ["楽しみにしていること", "これからの希望", "希望"],
  paranoia: ["その感じは", "いつ頃からあります", "見られている"],
  hallucination: ["その声", "声のこと", "どんな声", "いつ頃聞こえ", "幻聴"],
  radio: ["どんな番組", "ラジオ"],
  roommate: ["iさんとは", "iさんと", "同室の"],
  med_selfmgmt: ["自分で管理", "自分で薬"],
  uncle: ["叔父さん", "叔父"],
  mother: ["お母さんのこと", "お母さん"],
  hospital: ["入院生活", "ここでの生活"],
};

function topicMatchPhrases(id: string): string[] {
  const base = TOPIC_KW[id]?.strong ?? [];
  const coach = COACH_MATCH_PHRASES[id] ?? [];
  return [...new Set([...base, ...coach])];
}

/** Coach 例文から「」内の質問文を取り出す。 */
export function extractQuotedExample(example: string): string | null {
  const m = example.match(/「([^」]+)」/);
  return m ? m[1] : null;
}

function byPriority(ids: string[]): string {
  return [...ids].sort((a, b) => pIdx(a) - pIdx(b))[0];
}

function nextMainNode(
  convo: PatientConvo,
  state: FacingConvoState,
): MainNode | undefined {
  return convo.mainRoute.find(
    (n) => !state.completedMainSteps.includes(`${n.topic}@${n.level}`),
  );
}

// 挨拶種別を判定（挨拶が含まれなければ null）。
function detectGreeting(input: string): GreetingKind | null {
  const text = normalize(input);
  for (const g of GREETING_KINDS) {
    if (text.includes(normalize(g.kw))) return g.kind;
  }
  return null;
}

// 入力を全話題（挨拶を除く）のキーワード・同義語から判定する。
function detectTopic(
  convo: PatientConvo,
  input: string,
  state: FacingConvoState,
): string {
  const text = normalize(input);
  if (text === "") return "unknown";
  const ids = Object.keys(convo.topics);

  // より長いフレーズ一致を優先（例: 「退院したら」>「退院」、「ご家族のことも」>「家族」）。
  let bestId = "";
  let bestLen = 0;
  for (const id of ids) {
    for (const kw of topicMatchPhrases(id)) {
      const nkw = normalize(kw);
      if (nkw.length > 0 && text.includes(nkw) && nkw.length > bestLen) {
        bestLen = nkw.length;
        bestId = id;
      }
    }
  }
  if (bestId) return bestId;

  const weak = ids.filter((id) =>
    (TOPIC_KW[id]?.weak ?? []).some((kw) => text.includes(normalize(kw))),
  );
  if (weak.length) {
    const nextTopic = nextMainNode(convo, state)?.topic;
    if (nextTopic && weak.includes(nextTopic)) return nextTopic;
    const asked = weak.filter((id) => state.askedTopics.includes(id));
    if (asked.length) return byPriority(asked);
    return byPriority(weak);
  }

  // キーワードが無くても、現在の話題が進行中なら、一般的なフォローアップは現在の話題を続ける。
  // 例:「その時はどうしていますか」→ 現在の話題の次のレベル（対処など）を開示する。
  // 話題が一区切り済み、または現在の話題が無い場合は従来どおり unknown（曖昧入力は unknown のまま）。
  const cur = state.currentTopic;
  if (cur && convo.topics[cur]) {
    const level = state.topicLevels[cur] ?? 0;
    if (level < convo.topics[cur].levels.length && isContinuationFollowup(text)) {
      return cur;
    }
  }
  return "unknown";
}

// 正規化済みテキスト中に strong キーワードが現れる話題の集合（要約検出に使う）。
// weak は含めない（誤検出を避けるため）。
function strongTopicsPresent(convo: PatientConvo, norm: string): string[] {
  const found: string[] = [];
  for (const id of Object.keys(convo.topics)) {
    const strong = TOPIC_KW[id]?.strong ?? [];
    if (strong.some((kw) => kw && norm.includes(normalize(kw)))) found.push(id);
  }
  return found;
}

// 学生の入力を会話的クラスへ分類する（persona を持つ患者のみ使用）。
// 反射・共感・要約・雑談を、臨床話題より前に自然に処理するための判定。
type ConversationalKind =
  | { kind: "summary"; overgeneralized: boolean; topic: string | null }
  | { kind: "reflection_on_topic"; topic: string }
  | { kind: "empathy" }
  | { kind: "generic_reflection" }
  | { kind: "smalltalk"; sub: string }
  | { kind: "none" };

function classifyConversational(
  convo: PatientConvo,
  persona: PatientPersona,
  rawInput: string,
  topic: string,
): ConversationalKind {
  const norm = normalize(rawInput);
  const reflective = hasReflectiveMarker(norm);
  const strongTopics = strongTopicsPresent(convo, norm);
  const overgen = hasOvergeneralization(norm);

  // 要約：反射表現かつ（過度な一般化 or 複数の具体話題）。
  if (reflective && (overgen || strongTopics.length >= 2)) {
    const primary = topic !== "unknown" ? topic : (strongTopics[0] ?? null);
    return { kind: "summary", overgeneralized: overgen, topic: primary };
  }

  // 反射（話題あり）：反射表現＋話題が特定できる → 現在の話題を少しだけ進める。
  if (reflective && topic !== "unknown" && convo.topics[topic]) {
    return { kind: "reflection_on_topic", topic };
  }

  // 雑談：天気・テレビ・実習など（話題語ではない・低stakes）。
  // 「今日は暑いですね」のように反射表現を伴っても、まず雑談として扱う。
  if (topic === "unknown") {
    const sub = detectSmalltalkKind(norm, persona);
    if (sub) return { kind: "smalltalk", sub };
  }

  // 共感：反射表現＋共感語（話題語なし）。
  if (reflective && hasEmpathyWord(norm)) {
    return { kind: "empathy" };
  }

  // 一般的な反射：反射表現のみ（話題語も共感語もなし）。
  if (reflective) {
    return { kind: "generic_reflection" };
  }

  return { kind: "none" };
}

interface Acc {
  topicLevels: Record<string, number>;
  askedTopics: string[];
  disclosedFacts: string[];
  completedMainSteps: string[];
  advancedMain: boolean;
  disclosedNew: boolean;
  repeated: boolean;
  alreadyTotal: number;
  currentTopic: string | null;
  lastMeaningfulTopic: string | null;
  unlockedResourcesByTopic: Record<string, RelatedResource[]>;
  // Sprint A-2.1: このターンが探索（新開示）を伴わない反射・共感・雑談だったか。
  reflectionTurn: boolean;
  // 新規開示は無いが「成功した傾聴」として扱うターン（要約の確認・訂正など）。
  softSuccess: boolean;
  // このターンで使ったあいづち（連続重複回避のため次ターンへ持ち越す）。
  ackUsed: string | null;
  // このターンで逆質問を返したか。
  reciprocalUsed: boolean;
}

// 話題が「十分に深まった」とみなすしきい値（sufficientAt があればそれ、無ければ全レベル）。
function sufficientThreshold(def: TopicDef): number {
  return def.sufficientAt ?? def.levels.length;
}

// coreTheme の重要テーマが、まだ sufficientAt に到達していない（＝深める余地がある）か。
function isThemeUnfinished(
  convo: PatientConvo,
  id: string,
  topicLevels: Record<string, number>,
): boolean {
  const def = convo.topics[id];
  if (!def) return false;
  return (topicLevels[id] ?? 0) < sufficientThreshold(def);
}

export function advanceConversation(
  patientId: string,
  state: FacingConvoState,
  input: string,
): FacingConvoState {
  const text = input.trim();
  if (text === "") return state;

  const convo = getConvo(patientId);
  const history: FacingEntry[] = [...state.history];
  // 追加時の索引を安定IDとして確定する（append-only なので再レンダリング・往復で不変、
  // かつ同一会話の再現で同じIDになる）。
  const pushEntry = (entry: DistributiveOmit<FacingEntry, "id">) => {
    history.push({ ...entry, id: `${patientId}-${history.length}` } as FacingEntry);
  };
  pushEntry({ role: "student", text });
  const greetingKind = detectGreeting(text);
  const topic = detectTopic(convo, text, state);
  const turnCount = (state.turnCount ?? 0) + 1;

  const acc: Acc = {
    topicLevels: { ...state.topicLevels },
    askedTopics: [...state.askedTopics],
    disclosedFacts: [...state.disclosedFacts],
    completedMainSteps: [...state.completedMainSteps],
    advancedMain: false,
    disclosedNew: false,
    repeated: false,
    alreadyTotal: state.alreadyTotal,
    currentTopic: state.currentTopic,
    lastMeaningfulTopic: state.lastMeaningfulTopic,
    unlockedResourcesByTopic: { ...(state.unlockedResourcesByTopic ?? {}) },
    reflectionTurn: false,
    softSuccess: false,
    ackUsed: null,
    reciprocalUsed: false,
  };

  // あいづちを決定的に選ぶ（直前と同じものは避ける）。
  const pickAck = (seed: number): string => {
    if (!convo.persona) return "";
    const ack = pickDeterministic(convo.persona.acks, seed, state.lastAck);
    acc.ackUsed = ack;
    return ack;
  };

  // Version1（第1回講義）では患者からの逆質問を行わない。
  // 面接は「聞かれたことに答える」ことに集中させ、学生が戸惑う逆質問を避ける。
  // persona.reciprocal のデータは将来のために残すが、ここでは常に無効化する。
  const RECIPROCAL_ENABLED: boolean = false;
  const maybeReciprocal = (id: string): string | undefined => {
    if (!RECIPROCAL_ENABLED) return undefined;
    const persona = convo.persona;
    if (!persona) return undefined;
    const q = persona.reciprocal[id];
    if (!q) return undefined;
    if ((state.reciprocalCount ?? 0) >= 1) return undefined;
    if (turnCount < 6) return undefined;
    acc.reciprocalUsed = true;
    return q;
  };

  const completeGreetingNode = () => {
    const node = convo.mainRoute.find((n) => n.topic === "greeting");
    if (!node) return;
    const key = `greeting@${node.level}`;
    if (!acc.completedMainSteps.includes(key)) {
      acc.completedMainSteps.push(key);
      acc.advancedMain = true;
    }
  };

  // discloseTopic は最大3レイヤー（あいづち・本文・逆質問）を1発話に合成する。
  // opts を渡さなければ従来どおり本文のみ（既存の通常Q&Aは不変）。
  const discloseTopic = (
    id: string,
    opts?: { ack?: string; reciprocal?: string },
  ) => {
    const def = convo.topics[id];
    if (!def) return;
    acc.currentTopic = id;
    acc.lastMeaningfulTopic = id;
    const level = acc.topicLevels[id] ?? 0;
    if (level >= def.levels.length) {
      acc.alreadyTotal += 1;
      acc.repeated = true;
      // 繊細な話題（母 等）は、繰り返し時に自然な境界表現を用いる。
      const boundary = convo.persona?.boundary?.[id];
      const body =
        boundary ??
        convo.alreadyReplies[(acc.alreadyTotal - 1) % convo.alreadyReplies.length];
      pushEntry({
        role: "patient",
        text: composeReply([opts?.ack, body, opts?.reciprocal]),
      });
      return;
    }
    const disc = def.levels[level];
    pushEntry({
      role: "patient",
      text: composeReply([opts?.ack, disc.reply, opts?.reciprocal]),
    });
    const newLevel = level + 1;
    acc.topicLevels[id] = newLevel;
    acc.disclosedNew = true;
    if (!acc.askedTopics.includes(id)) acc.askedTopics.push(id);
    if (disc.fact) acc.disclosedFacts.push(disc.fact);

    const node = convo.mainRoute.find((n) => n.topic === id && n.level === level);
    const key = `${id}@${level}`;
    if (node && !acc.completedMainSteps.includes(key)) {
      acc.completedMainSteps.push(key);
      acc.advancedMain = true;
    }

    // 話題別の関連情報：開示レベルが sufficientAt に到達したら解放（睡眠を特別扱いしない）。
    if (
      def.relatedResources &&
      def.sufficientAt !== undefined &&
      newLevel >= def.sufficientAt &&
      !acc.unlockedResourcesByTopic[id]
    ) {
      acc.unlockedResourcesByTopic[id] = def.relatedResources;
    }
  };

  const finalize = (opts: { unknown: boolean }): FacingConvoState => {
    const explored = acc.advancedMain || acc.disclosedNew || acc.softSuccess;
    // 反射・共感・雑談・要約はいずれも「不作為の沈黙」ではなく生産的なやり取り。
    const productive = explored || acc.reflectionTurn;
    const stalledTurns = productive ? 0 : state.stalledTurns + 1;
    // 探索があれば streak をリセット。反射・共感が続く間だけ加算する。
    const prevStreak = state.reflectionStreak ?? 0;
    const reflectionStreak = explored
      ? 0
      : acc.reflectionTurn
        ? prevStreak + 1
        : prevStreak;
    let hintLevel: 0 | 1 | 2;
    if (opts.unknown) {
      hintLevel = computeHint(state.hintLevel, state.unknownStreak + 1, stalledTurns);
    } else if (explored) {
      // 成功ターン（主ルート進行・新レベル開示・要約の確認/訂正）は Coach を idle へ。
      hintLevel = 0;
    } else if (acc.reflectionTurn) {
      // 反射・共感・雑談は即座に Coach を出さない（自然に進む思考を中断しない）。
      // 探索を伴わない反射が3回以上続いたときだけ、やんわり促す。
      hintLevel =
        reflectionStreak >= 3
          ? (Math.max(state.hintLevel, 1) as 0 | 1 | 2)
          : state.hintLevel;
    } else {
      const base = acc.repeated ? (Math.max(state.hintLevel, 1) as 0 | 1 | 2) : state.hintLevel;
      hintLevel = computeHint(base, 0, stalledTurns);
    }
    // pendingImportantTopics を再計算（Sprint10.8C）。次の全条件を満たす話題のみ保持する:
    //   - coreThemes に含まれる重要テーマである
    //   - 一度は話題に出た（askedTopics）
    //   - sufficientAt にまだ到達していない（深める余地がある）
    //   - 現在の話題ではない（別の話題へ移動した）
    // まだ触れていないテーマは登録しない。askedTopics は一意なので重複しない。
    // 十分に深まった時点で条件から外れ、自動的に pending から削除される。
    const pendingImportantTopics = acc.askedTopics.filter(
      (t) =>
        t !== acc.currentTopic &&
        convo.coreThemes.includes(t) &&
        isThemeUnfinished(convo, t, acc.topicLevels),
    );
    return {
      ...state,
      topicLevels: acc.topicLevels,
      askedTopics: acc.askedTopics,
      currentTopic: acc.currentTopic,
      lastMeaningfulTopic: acc.lastMeaningfulTopic,
      pendingImportantTopics,
      unlockedResourcesByTopic: acc.unlockedResourcesByTopic,
      disclosedFacts: acc.disclosedFacts,
      completedMainSteps: acc.completedMainSteps,
      mainRouteProgress: acc.completedMainSteps.length,
      alreadyTotal: acc.alreadyTotal,
      unknownStreak: opts.unknown ? state.unknownStreak + 1 : 0,
      unknownTotal: opts.unknown ? state.unknownTotal + 1 : state.unknownTotal,
      stalledTurns,
      hintLevel,
      history,
      reflectionStreak,
      lastAck: acc.ackUsed ?? state.lastAck ?? null,
      turnCount,
      reciprocalCount: (state.reciprocalCount ?? 0) + (acc.reciprocalUsed ? 1 : 0),
    };
  };

  if (greetingKind) {
    pushEntry({ role: "patient", text: convo.greetings[greetingKind] });
    completeGreetingNode();
    if (topic !== "unknown" && convo.topics[topic]) {
      discloseTopic(topic);
    }
    return finalize({ unknown: false });
  }

  // Sprint A-2.1: 自然さレイヤー（persona を持つ患者のみ）。
  // 反射・共感・要約・雑談を、臨床話題判定より前に自然に処理する。
  // 反射マーカー（「〜ですね」等）を伴わない通常の質問は、この分岐を素通りして
  // 従来どおりの話題開示に進む（既存の会話・検証は不変）。
  if (convo.persona) {
    const persona = convo.persona;
    const cls = classifyConversational(convo, persona, text, topic);
    const seed = turnCount;

    if (cls.kind === "summary") {
      // 要約：正確なら確認、過度な一般化ならやんわり訂正（患者として、教師としてではなく）。
      if (cls.topic) {
        acc.currentTopic = cls.topic;
        acc.lastMeaningfulTopic = cls.topic;
      }
      const body = cls.overgeneralized
        ? (persona.summaryCorrect[cls.topic ?? "_"] ?? persona.summaryCorrect._)
        : pickDeterministic(persona.summaryConfirm, seed);
      pushEntry({ role: "patient", text: body });
      acc.softSuccess = true;
      return finalize({ unknown: false });
    }

    if (cls.kind === "reflection_on_topic") {
      // 反射（話題あり）：あいづち＋現在の話題を一段だけ進める。
      const ack = pickAck(seed);
      const reciprocal = maybeReciprocal(cls.topic);
      acc.reflectionTurn = true;
      discloseTopic(cls.topic, { ack, reciprocal });
      return finalize({ unknown: false });
    }

    if (cls.kind === "empathy") {
      // 共感：短い受け止め・控えめな打ち消し・不確かさ。話題は変えない。
      pushEntry({
        role: "patient",
        text: pickDeterministic(persona.empathy, seed),
      });
      acc.reflectionTurn = true;
      acc.currentTopic = state.currentTopic;
      return finalize({ unknown: false });
    }

    if (cls.kind === "generic_reflection") {
      pushEntry({
        role: "patient",
        text: pickDeterministic(persona.genericReflection, seed),
      });
      acc.reflectionTurn = true;
      acc.currentTopic = state.currentTopic;
      return finalize({ unknown: false });
    }

    if (cls.kind === "smalltalk") {
      pushEntry({
        role: "patient",
        text: pickDeterministic(persona.smalltalk[cls.sub] ?? [], seed),
      });
      acc.reflectionTurn = true;
      acc.currentTopic = state.currentTopic;
      return finalize({ unknown: false });
    }
  }

  if (topic === "unknown" || !convo.topics[topic]) {
    const unknownTotal = state.unknownTotal + 1;
    pushEntry({
      role: "patient",
      text: convo.unknownReplies[(unknownTotal - 1) % convo.unknownReplies.length],
      unknown: true,
    });
    // unknown は currentTopic を変えない。lastMeaningfulTopic を維持。
    acc.currentTopic = state.currentTopic;
    return finalize({ unknown: true });
  }

  discloseTopic(topic);
  return finalize({ unknown: false });
}

function computeHint(
  current: 0 | 1 | 2,
  unknownStreak: number,
  stalledTurns: number,
): 0 | 1 | 2 {
  let auto: 0 | 1 | 2 = 0;
  if (unknownStreak >= 1 || stalledTurns >= 3) auto = 1;
  if (unknownStreak >= 3 || stalledTurns >= 5) auto = 2;
  return Math.max(current, auto) as 0 | 1 | 2;
}

export function requestHint(state: FacingConvoState): FacingConvoState {
  return { ...state, hintLevel: (state.hintLevel >= 1 ? 2 : 1) as 0 | 1 | 2 };
}

/** 「Compass Coachに相談する」押下：level-1 の視点のみ表示（質問例は出さない）。 */
export function requestCoachConsultation(
  state: FacingConvoState,
): FacingConvoState {
  return { ...state, hintLevel: 1 };
}

/** Coach のヒント本文を表示すべきか（成功ターン後は idle に戻す）。 */
export function shouldShowCoachHint(state: FacingConvoState): boolean {
  return state.hintLevel >= 1;
}

/** 表示対象の意味ある話題（unknown 時は lastMeaningfulTopic を維持）。 */
export function getMeaningfulTopic(state: FacingConvoState): string | null {
  return state.currentTopic ?? state.lastMeaningfulTopic;
}

// Sprint10.8C: 学生には表示しない「会話の見守り」内部状態。
// UI に一覧・進捗・チェックリストとして出さず、Coach の判断材料としてのみ使う。
export interface ConversationGuidanceState {
  currentFocus: string | null;
  pendingImportantTopics: string[];
}

/** 内部の会話ガイダンス状態（Coach 判断用・UI 常時表示は禁止）。 */
export function getGuidanceState(
  state: FacingConvoState,
): ConversationGuidanceState {
  return {
    currentFocus: getMeaningfulTopic(state),
    pendingImportantTopics: state.pendingImportantTopics,
  };
}

/** 右ペインに表示する関連情報（現在の意味ある話題の解放済みのみ）。 */
export function getDisplayTopicResources(
  state: FacingConvoState,
): { topicId: string; resources: RelatedResource[] } | null {
  const topicId = getMeaningfulTopic(state);
  if (!topicId) return null;
  const resources = state.unlockedResourcesByTopic?.[topicId];
  if (!resources?.length) return null;
  return { topicId, resources };
}

/** 話題に応じた関連情報メッセージ（結論を示さない中立表現）。 */
export function getResourceMessage(topicId: string): string {
  // 結論は示さず、根拠（カルテ）へ目を向けるよう促す中立的な表現にする。
  const messages: Record<string, string> = {
    sleep: "睡眠については、看護記録やフローシートも見てみると、何か気付くことがあるかもしれません。",
    hallucination: "声（幻聴）については、看護記録や診療録も見てみると、気付くことがあるかもしれません。",
    radio: "夜の過ごし方については、看護記録も見てみると、背景が見えてくるかもしれません。",
    morning: "朝の様子については、フローシートの睡眠・起床も見てみると、つながりが見えるかもしれません。",
    medication: "服薬については、処方や診療録も見てみると、確認できることがあるかもしれません。",
    med_selfmgmt: "服薬の自己管理については、診療録や看護記録も見てみるとよいかもしれません。",
    roommate: "Iさんとの関わりについては、看護記録や生活歴も見てみるとよいかもしれません。",
    sst: "SSTの様子については、フローシートや看護記録も見てみるとよいかもしれません。",
    hobby: "生活や活動については、生活歴や看護記録も見てみるとよいかもしれません。",
    ot: "作業療法や日中の活動については、フローシートも見てみるとよいかもしれません。",
    daytime: "日中の過ごし方については、フローシートも見てみるとよいかもしれません。",
    uncle: "叔父さんとの関係については、看護記録や生活歴も見てみるとよいかもしれません。",
    mother: "ご家族のことについては、生活歴も見てみるとよいかもしれません。",
    family: "ご家族のことについては、生活歴や看護記録も見てみるとよいかもしれません。",
    weight: "体重については、フローシートや看護記録も見てみるとよいかもしれません。",
    constipation: "お通じについては、フローシートも見てみるとよいかもしれません。",
    condition: "気分や様子については、看護記録も見てみるとよいかもしれません。",
    self_blame: "気持ちの背景については、看護記録や診療録も見てみるとよいかもしれません。",
    anxiety: "気がかりなことについては、看護記録も見てみるとよいかもしれません。",
    hope: "支えや楽しみについては、生活歴も見てみるとよいかもしれません。",
    meal: "食事については、フローシートも見てみるとよいかもしれません。",
    discharge: "退院について話されていますが、生活歴や現在サマリーを見ると、背景も考えられるかもしれません。",
    hospital: "入院生活については、現在サマリーや生活歴も見てみるとよいかもしれません。",
    plan: "退院後の生活については、生活歴や現在サマリーも見てみるとよいかもしれません。",
  };
  return (
    messages[topicId] ??
    "患者さんの発言に関連する情報があります。"
  );
}

export interface CoachExampleValidation {
  patientId: string;
  topicId: string;
  example: string;
  question: string;
  detected: string;
  ok: boolean;
}

// 話題ごとの短いラベルと、深掘り／質問例。会話を一本道にせず、
// 現在の話題に沿った「一つの視点」を提示するために使う。
const TOPIC_META: Record<
  string,
  { label: string; deepen: string; example: string }
> = {
  condition: {
    label: "体調",
    deepen: "体調や気分の変化について、もう少し聞けそうです。",
    example: "例えば「いつ頃からその感じがありますか？」と尋ねられます。",
  },
  sleep: {
    label: "睡眠",
    deepen: "睡眠の様子を、もう少し具体的に確認してみましょう。",
    example: "例えば「夜中に目が覚めることはありましたか？」と尋ねられます。",
  },
  daytime: {
    label: "日中の過ごし方",
    deepen: "日中の過ごし方や活動について、もう少し聞けそうです。",
    example: "例えば「日中はどのように過ごしていますか？」と尋ねられます。",
  },
  meal: {
    label: "食事",
    deepen: "食事や食欲の変化について、もう少し聞けそうです。",
    example: "例えば「食べる量に変化はありますか？」と尋ねられます。",
  },
  medication: {
    label: "薬",
    deepen: "薬を飲むことを、患者さんがどのように感じているか聞けそうです。",
    example: "例えば「お薬について、どんな気持ちがありますか？」と尋ねられます。",
  },
  family: {
    label: "家族",
    deepen: "家族との関係について、患者さん自身がどう感じているか聞けそうです。",
    example: "例えば「ご家族とは、どんなふうに過ごしていますか？」と尋ねられます。",
  },
  discharge: {
    label: "退院",
    deepen: "退院や将来について、患者さんがどう感じているか聞けそうです。",
    example: "例えば「退院後のことを考えていますか？」と尋ねられます。",
  },
  hobby: {
    label: "好きなこと",
    deepen: "好きなことが、患者さんにとってどのような意味を持つか聞けそうです。",
    example: "例えば「それはどんなときに楽しんでいましたか？」と尋ねられます。",
  },
  ot: {
    label: "作業療法",
    deepen: "作業療法や日中の活動について、もう少し聞けそうです。",
    example: "例えば「作業療法では、どんなことをしていますか？」と尋ねられます。",
  },
  anxiety: {
    label: "不安",
    deepen: "不安や気がかりについて、患者さんのペースで聞けそうです。",
    example: "例えば「気になっていることはありますか？」と尋ねられます。",
  },
  plan: {
    label: "退院後の計画",
    deepen: "退院後の計画や、休息のとり方について聞けそうです。",
    example: "例えば「退院したら何をしたいですか？」と尋ねられます。",
  },
  self_blame: {
    label: "気持ちのつらさ",
    deepen: "つらさの背景にある気持ちを、そっと聞けそうです。",
    example: "例えば「今、どんなことがつらいですか？」と尋ねられます。",
  },
  hope: {
    label: "これからの希望",
    deepen: "支えや、これからの希望について聞けそうです。",
    example: "例えば「これから楽しみにしていることはありますか？」と尋ねられます。",
  },
  paranoia: {
    label: "気がかりな感覚",
    deepen: "急がず、患者さんのペースに合わせて聞いてみましょう。",
    example: "例えば「その感じは、いつ頃からありますか？」と尋ねられます。",
  },
  hallucination: {
    label: "幻聴",
    deepen: "声について、いつ・どんな内容かを、患者さんのペースで聞けそうです。",
    example: "例えば「その声は、いつ頃聞こえますか？」と尋ねられます。",
  },
  radio: {
    label: "ラジオ",
    deepen: "ラジオが、患者さんにとってどんな意味を持つか聞けそうです。",
    example: "例えば「ラジオは、どんな番組を聴きますか？」と尋ねられます。",
  },
  morning: {
    label: "朝の様子",
    deepen: "朝の目覚めや、午前中の調子について聞けそうです。",
    example: "例えば「朝は、すっきり起きられますか？」と尋ねられます。",
  },
  med_selfmgmt: {
    label: "服薬の自己管理",
    deepen: "薬を自分で管理することへの思いを、聞けそうです。",
    example: "例えば「お薬を自分で管理してみたいですか？」と尋ねられます。",
  },
  roommate: {
    label: "Iさんとの関係",
    deepen: "同室のIさんとの関わりが、患者さんにとってどんな意味を持つか聞けそうです。",
    example: "例えば「Iさんとは、どんなふうに過ごしますか？」と尋ねられます。",
  },
  sst: {
    label: "SST",
    deepen: "SSTでの様子や、参加してみての気持ちを聞けそうです。",
    example: "例えば「SSTには参加していますか？」と尋ねられます。",
  },
  uncle: {
    label: "叔父との関係",
    deepen: "叔父さんとの関係を、患者さん自身がどう感じているか聞けそうです。",
    example: "例えば「叔父さんは、面会に来られますか？」と尋ねられます。",
  },
  mother: {
    label: "お母さんのこと",
    deepen: "お母さんのことを、患者さんのペースでそっと聞けそうです。",
    example: "例えば「お母さんのことを、聞いてもいいですか？」と尋ねられます。",
  },
  money: {
    label: "お金のこと",
    deepen: "生活費や金銭面での心配について、聞けそうです。",
    example: "例えば「金銭面で、困っていることはありますか？」と尋ねられます。",
  },
  hospital: {
    label: "入院生活",
    deepen: "入院生活を、患者さんがどう感じているか聞けそうです。",
    example: "例えば「入院生活は、いかがですか？」と尋ねられます。",
  },
  weight: {
    label: "体重",
    deepen: "体重や間食について、患者さんがどう受けとめているか聞けそうです。",
    example: "例えば「体重のことは、気になりますか？」と尋ねられます。",
  },
  constipation: {
    label: "排便",
    deepen: "お通じの様子について、聞けそうです。",
    example: "例えば「お通じは、いかがですか？」と尋ねられます。",
  },
  hygiene: {
    label: "清潔・整容",
    deepen: "入浴や身だしなみの様子について、聞けそうです。",
    example: "例えば「お風呂には、入れていますか？」と尋ねられます。",
  },
  strengths: {
    label: "得意なこと",
    deepen: "患者さん自身の得意なことや、続けられていることを聞けそうです。",
    example: "例えば「得意なことは、ありますか？」と尋ねられます。",
  },
  values: {
    label: "大切にしていること",
    deepen: "患者さんが大切にしていることを、聞けそうです。",
    example: "例えば「大切にしていることは、何ですか？」と尋ねられます。",
  },
};

function topicLabel(id: string): string {
  return TOPIC_META[id]?.label ?? "その話題";
}

// Coach が示す「一つの視点」。kind は表示の意味づけ（デバッグ・将来拡張用）。
export interface CoachFocusView {
  kind: "onboard" | "deepen" | "return" | "broaden";
  direction: string;
  example: string;
}

// 現在の話題を深める視点（患者別の主ルート文言があればそれを優先）。
function deepenView(
  convo: PatientConvo,
  id: string,
  level: number,
): CoachFocusView {
  const node = convo.mainRoute.find((n) => n.topic === id && n.level === level);
  if (node) {
    return { kind: "deepen", direction: node.direction, example: node.example };
  }
  const meta = TOPIC_META[id];
  return {
    kind: "deepen",
    direction: meta?.deepen ?? "もう少し詳しく聞いてみましょう。",
    example: meta?.example ?? "",
  };
}

// 未完了の重要テーマ（pending）へ自然に戻すときの、押し付けにならない文面。
// 患者ごとの臨床像に配慮した中立表現。定義がなければ汎用文にフォールバックする。
const RETURN_GUIDANCE: Record<string, string> = {
  sleep: "睡眠については、看護記録やフローシートも見てみると、何か気付くことがあるかもしれません。",
  hallucination: "先ほどの声（幻聴）のお話について、看護記録や診療録も見ると、気付くことがあるかもしれません。",
  discharge: "退院について話されていますが、生活歴や現在サマリーを見ると、背景も考えられるかもしれません。",
  medication: "先ほど話されていた薬への思いにも、まだ聞けそうなことがありそうです。",
  anxiety: "先ほど触れられていた不安なお気持ちにも、もう少し寄り添えそうです。",
  paranoia: "先ほどのお話にあった気がかりについて、まだ伺えることがありそうです。",
  self_blame: "先ほどのご自身を責めるお気持ちにも、もう少し耳を傾けられそうです。",
  condition: "先ほどの体調やお気持ちの変化について、もう少し伺えそうです。",
  meal: "先ほどのお食事の様子についても、まだ確認できそうなことがありそうです。",
  hope: "先ほど話されていた支えや楽しみについて、もう少し聞けそうです。",
  daytime: "先ほどのお話と、日中の過ごし方には何かつながりがあるでしょうか。",
  plan: "先ほどの退院後の計画について、休息の面からも聞けそうです。",
};

// pending の重要テーマから、Coach が示す「一つ」を選ぶ（一覧表示はしない）。
// 優先度: (1) coreThemes 上の重要度（配列の先頭ほど高い） →
//         (2) 最後に触れた順序（より最近を優先）。
function pickPendingTopic(
  convo: PatientConvo,
  state: FacingConvoState,
): string | null {
  const cur = getMeaningfulTopic(state);
  const pend = state.pendingImportantTopics.filter((t) => t !== cur);
  if (pend.length === 0) return null;
  const importance = (t: string) => {
    const i = convo.coreThemes.indexOf(t);
    return i < 0 ? 999 : i;
  };
  const recency = (t: string) => state.askedTopics.lastIndexOf(t);
  return [...pend].sort((a, b) => {
    const imp = importance(a) - importance(b);
    if (imp !== 0) return imp;
    return recency(b) - recency(a);
  })[0];
}

// pending テーマへ自然に戻す視点（強制しない・一つだけ）。
function returnView(topicId: string): CoachFocusView {
  const meta = TOPIC_META[topicId];
  return {
    kind: "return",
    direction:
      RETURN_GUIDANCE[topicId] ??
      `先ほどの${topicLabel(topicId)}について、まだ確認できそうなことがありそうです。`,
    example: meta?.example ?? "",
  };
}

// 会話は一本道にしない。現在の話題を軸に、常に「一つの視点」だけ返す。
// 優先順位（Sprint10.8C）:
//   1. 現在の話題が「進行中」（sufficientAt 未到達）なら深める。前の話題へは戻さない。
//   2. 現在の話題が一区切り（sufficientAt 到達）で pending があれば、一つだけ自然に戻す。
//   3. 現在の話題にまだ開示レベルが残っていれば、続けて深める。
//   4. 主ルートに続きがあれば、次の自然な視点を示す。
//   5. coreThemes にまだ深められる重要テーマがあれば、そちらへ。
//   6. まだ触れていない側面へ広げる／一般的な内省の問いを返す。
export function getCoachFocus(
  patientId: string,
  state: FacingConvoState,
): CoachFocusView {
  const convo = getConvo(patientId);
  const cur = getMeaningfulTopic(state);
  const curDef = cur ? convo.topics[cur] : undefined;
  const curLevel = cur ? state.topicLevels[cur] ?? 0 : 0;

  // 0. 反射・共感だけが続いているとき（探索を伴わない傾聴が3回以上）に限り、
  //    やんわりと次の一歩を促す（受け止めを否定せず、探索を促す）。即座には出さない。
  if ((state.reflectionStreak ?? 0) >= 3) {
    return {
      kind: "broaden",
      direction:
        "患者さんの話を、しっかり受け止められています。次は、その時どのように過ごしているかを聞いてみてもよいかもしれません。",
      example: cur ? TOPIC_META[cur]?.example ?? "" : "",
    };
  }

  // 1. 現在の話題が進行中（一区切り前）なら深める。前の話題へ戻す提案はしない。
  if (cur && curDef && curLevel < sufficientThreshold(curDef)) {
    return deepenView(convo, cur, curLevel);
  }

  // 2. 一区切り → 未完了の重要テーマ（pending）へ自然に戻す（強制しない・一つだけ）。
  const pendingTop = pickPendingTopic(convo, state);
  if (pendingTop) {
    return returnView(pendingTop);
  }

  // 3. 現在の話題にまだ開示レベルが残っていれば、続けて深める。
  if (cur && curDef && curLevel < curDef.levels.length) {
    return deepenView(convo, cur, curLevel);
  }

  // 4. 主ルートにまだ続きがあれば、次の自然な視点。
  const node = nextMainNode(convo, state);
  if (node) {
    return {
      kind: cur ? "deepen" : "onboard",
      direction: node.direction,
      example: node.example,
    };
  }

  // 5. coreThemes のうち、まだ深めきれていない重要テーマへ（強制しない）。
  const nextCore = convo.coreThemes.find(
    (t) =>
      t !== cur &&
      convo.topics[t] &&
      isThemeUnfinished(convo, t, state.topicLevels),
  );
  if (nextCore) {
    if ((state.topicLevels[nextCore] ?? 0) > 0) return returnView(nextCore);
    return deepenView(convo, nextCore, state.topicLevels[nextCore] ?? 0);
  }

  // 6a. まだ触れていない側面へ自然に広げる。
  const untouched = PRIORITY.filter(
    (t) => convo.topics[t] && (state.topicLevels[t] ?? 0) === 0,
  );
  if (untouched.length > 0) {
    const next = untouched[0];
    const meta = TOPIC_META[next];
    return {
      kind: "broaden",
      direction: `${topicLabel(next)}についても聞いてみるとよいかもしれません。`,
      example: meta?.example ?? "",
    };
  }

  // 6b. 一般的な内省の問い（focus も pending もない・全体を話し終えた場合）。
  return {
    kind: "broaden",
    direction:
      "患者さんの言葉で、まだ気になっていることはありますか？　引き続き話してみましょう。",
    example: "",
  };
}

/** 全患者の Coach 質問例が detectTopic で正しく判定されるか検証する。 */
export function validateCoachExamples(): CoachExampleValidation[] {
  const results: CoachExampleValidation[] = [];
  const patients = Object.keys(CONVO);

  for (const patientId of patients) {
    const convo = CONVO[patientId];
    const seen = new Set<string>();

    for (const node of convo.mainRoute) {
      if (node.topic === "greeting") continue;
      const key = `${node.topic}:${node.example}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const question = extractQuotedExample(node.example);
      if (!question) continue;
      const state = initialFacingState();
      const detected = detectTopic(convo, question, state);
      results.push({
        patientId,
        topicId: node.topic,
        example: node.example,
        question,
        detected,
        ok: detected === node.topic,
      });
    }

    for (const [topicId, meta] of Object.entries(TOPIC_META)) {
      if (!convo.topics[topicId] || !meta.example) continue;
      const key = `meta:${topicId}:${meta.example}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const question = extractQuotedExample(meta.example);
      if (!question) continue;
      const state = initialFacingState();
      const detected = detectTopic(convo, question, state);
      results.push({
        patientId,
        topicId,
        example: meta.example,
        question,
        detected,
        ok: detected === topicId,
      });
    }
  }
  return results;
}
