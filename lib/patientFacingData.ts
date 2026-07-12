// Sprint10.7「患者発言と関連情報の紐付け」用データ＆会話エンジン。
// Version1は外部AI/有料API不要。ルールベースで以下を実現する。
//  - 主ルート（mainRoute）＋話題（topics）の二層構造。主ルート外の話題も返答可能。
//  - 各話題は開示レベル（level）を持ち、再質問で段階的に情報を開示する。
//  - Compass Coach は行き詰まり時のみ段階的に支援する。
//  - 主ルートの到達点で relatedResources を複数提示し、学生が選択してカルテへ遷移する。

import type { ChartTabId } from "./chartTabs";
import type { ChartFocus } from "./chartNav";

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
  mainRoute: MainNode[];
  greetings: Record<GreetingKind, string>;
  topics: Record<string, TopicDef>;
  unknownReplies: string[];
  alreadyReplies: string[];
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
    weak: ["いかが", "どうです", "元気", "様子", "加減", "活動"],
  },
  sleep: {
    strong: ["睡眠", "眠れ", "寝れ", "眠り", "中途覚醒", "不眠", "夜中", "目が覚", "何度も起き", "早朝"],
    weak: ["眠", "寝", "ねむ", "夜は", "休め"],
  },
  daytime: {
    strong: ["日中", "昼間", "昼寝"],
    weak: ["昼", "過ごし", "眠気", "だるさ"],
  },
  meal: {
    strong: ["食事", "食欲", "ご飯", "ごはん", "食べ", "朝食", "昼食", "夕食"],
    weak: ["召し上", "栄養"],
  },
  medication: {
    strong: ["薬", "服薬", "内服", "くすり", "服用", "副作用"],
    weak: ["飲み", "飲む", "効か", "効き"],
  },
  family: {
    strong: ["家族", "面会", "お母", "母さん", "息子", "娘", "孫", "奥さん", "旦那", "妻", "夫", "父"],
    weak: ["母", "家の人"],
  },
  discharge: {
    strong: ["退院", "帰宅", "家に帰", "帰りたい", "いつ出", "出られ", "退院後"],
    weak: ["帰り", "帰る", "家に"],
  },
  hobby: {
    strong: ["趣味", "好きなこと", "楽しみ", "詰将棋", "将棋", "盆栽", "編み物", "アプリ"],
    weak: ["好き", "過ごし方", "休みの日"],
  },
  ot: {
    strong: ["作業療法", "ot", "リハビリ", "リハ"],
    weak: ["プログラム", "活動療法"],
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
  "paranoia",
  "self_blame",
  "medication",
  "discharge",
  "hope",
  "plan",
  "meal",
  "sleep",
  "ot",
  "hobby",
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

// ===== 患者別会話定義 =====
const CONVO: Record<string, PatientConvo> = {
  // Aさん（統合失調症・回復期）: 慎重・礼儀正しい。被注察感はすぐには詳しく話さない。
  A: {
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
        relatedResources: [
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "睡眠状況" },
          { type: "看護記録", recordId: "nursing-a-20250705-01", title: "夜間観察" },
          { type: "フローシート", date: "2025/07/05", title: "睡眠時間" },
          { type: "処方", orderId: "rx-a-20250705-tonpuku", title: "睡眠薬" },
        ],
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
    topics: {
      condition: { levels: [{ reply: "だいぶ落ち着いてきました。ただ、少し疲れが残っている感じがします。", fact: "本人：全体的には落ち着き、疲労感が残る" }] },
      sleep: { levels: [
          { reply: "夜は、あまり眠れませんでした。", fact: "本人：夜間の睡眠が不十分" },
          { reply: "何度か目が覚めてしまって……。そのたびに、なかなか寝つけませんでした。", fact: "本人：中途覚醒あり・再入眠困難" },
          { reply: "……廊下の音が気になって。あと、人に見られているような感じが、少し残っていて。", fact: "本人：物音・被注察感が睡眠を妨げている" },
        ] },
      daytime: { levels: [{ reply: "昼間は少し眠気が残ります。でも、作業療法には出るようにしています。", fact: "本人：日中に眠気が残るが活動は継続" }] },
      meal: { levels: [{ reply: "食事は、少しずつですが食べられています。", fact: "本人：摂取量は少なめだが摂取可" }] },
      medication: { levels: [
          { reply: "薬は、きちんと飲んでいます。", fact: "本人：服薬アドヒアランス良好" },
          { reply: "飲むと、少し落ち着く気がします。", fact: "本人：服薬で安心感" },
        ] },
      family: { levels: [
          { reply: "母が時々、面会に来てくれます。", fact: "本人：母の面会あり" },
          { reply: "……あまり、心配をかけたくないんです。", fact: "本人：母への気づかい" },
        ] },
      discharge: { levels: [
          { reply: "早く家に帰りたい気持ちはあります。", fact: "本人：退院願望あり" },
          { reply: "でも、まだ少し不安もあって……。", fact: "本人：退院への不安" },
        ] },
      hobby: { levels: [{ reply: "静かな場所で、詰将棋をするのが好きです。", fact: "本人：詰将棋を好む" }] },
      ot: { levels: [{ reply: "作業療法には出ています。手を動かしていると、気がまぎれるので。", fact: "本人：OT参加・気晴らしになる" }] },
      anxiety: { levels: [
          { reply: "……少し、落ち着かないことはあります。", fact: "本人：漠然とした不安" },
          { reply: "人の視線が、気になるときがあって。", fact: "本人：視線への過敏" },
        ] },
      paranoia: { levels: [
          { reply: "……人に見られているような感じが、することがあります。", fact: "本人：被注察感の訴え" },
          { reply: "悪口を言われているような気がして……。でも、気のせいかもしれません。", fact: "本人：関係念慮様の訴え" },
        ] },
    },
    unknownReplies: [
      "……すみません、うまく答えられません。",
      "もう少し具体的に聞いてもらえますか。",
      "そのことは、今はよく分かりません。",
      "えっと……何を聞きたいのでしょうか。",
    ],
    alreadyReplies: [
      "それは、さきほどお話しした通りです。",
      "……その話は、もうお伝えしたかと。",
      "同じことになりますが、変わりはありません。",
    ],
  },

  // Eさん（うつ病）: 返答が短く、自責的。開示はゆっくり。
  E: {
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
        relatedResources: [
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "睡眠の経過" },
          { type: "看護記録", recordId: "nursing-e-20250707-01", title: "気持ちの記録" },
          { type: "フローシート", date: "2025/07/08", title: "睡眠・活動" },
          { type: "生活歴", title: "家族の記載" },
        ],
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
      sleep: { levels: [
          { reply: "早くに目が覚めてしまって。", fact: "本人：早朝覚醒" },
          { reply: "それからは、ただ横になっていました。", fact: "本人：覚醒後の臥床" },
        ] },
      meal: { levels: [
          { reply: "あまり、食べられていません。", fact: "本人：食欲低下" },
          { reply: "食べたい気持ちが、わかなくて。", fact: "本人：食思不振の自覚" },
        ] },
      self_blame: { levels: [
          { reply: "こんな自分で、情けなくて。", fact: "本人：自責的思考" },
          { reply: "家族にも、申し訳ないんです。", fact: "本人：家族への罪責感" },
        ] },
      hope: { levels: [{ reply: "孫には、また会いたいなとは思います。……でも、今の自分では。", fact: "本人：孫に会いたい思いが希望として残る" }] },
      family: { levels: [{ reply: "家族は、時々来てくれます。", fact: "本人：家族面会あり" }] },
      medication: { levels: [
          { reply: "薬は、言われた通りに飲んでいます。", fact: "本人：服薬遵守" },
          { reply: "効いているのかは、よく分かりません。", fact: "本人：効果実感の乏しさ" },
        ] },
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
  F: {
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
        relatedResources: [
          { type: "処方", orderId: "rx-f-20250707-teiki", title: "定期処方" },
          { type: "診療録", recordId: "clinical-f-20250707-med-01", title: "服薬の経過" },
          { type: "生活歴", title: "退院後の生活" },
        ],
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
      sleep: { levels: [
          { reply: "睡眠は短いけど平気です。", fact: "本人：睡眠時間短縮を問題視せず" },
          { reply: "やりたいことがたくさんあって、寝るのがもったいなくて。", fact: "本人：睡眠欲求の低下" },
        ] },
      medication: { levels: [
          { reply: "薬は……正直、もう飲まなくてもいい気がします。", fact: "本人：服薬に消極的" },
          { reply: "眠くなるのが、少し嫌なんですよね。", fact: "本人：副作用（眠気）忌避" },
          { reply: "調子いいのに、飲む意味あります？", fact: "本人：病識・必要感の乏しさ" },
        ] },
      plan: { levels: [{ reply: "退院したら、すぐアプリ開発です！　休むのはもったいなくて。", fact: "本人：退院後の過活動計画・休息軽視" }] },
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
  看護記録: "看護記録",
  OT: "OT",
  PSW: "PSW",
  フローシート: "フローシート",
  検査: "検査",
  処方: "処方",
};

export function getObservation(patientId: string): FacingObservation {
  return OBSERVATIONS[patientId] ?? FALLBACK_OBSERVATION;
}

function getConvo(patientId: string): PatientConvo {
  return CONVO[patientId] ?? FALLBACK_CONVO;
}

// ===== 会話状態 =====
export type FacingEntry =
  | { role: "student"; text: string }
  | { role: "patient"; text: string; unknown?: boolean }
  | { role: "coach"; resources: RelatedResource[] };

export interface FacingConvoState {
  mainRouteProgress: number;
  completedMainSteps: string[];
  topicLevels: Record<string, number>;
  askedTopics: string[];
  unknownStreak: number;
  stalledTurns: number;
  hintLevel: 0 | 1 | 2;
  disclosedFacts: string[];
  history: FacingEntry[];
  unknownTotal: number;
  alreadyTotal: number;
}

export function initialFacingState(): FacingConvoState {
  return {
    mainRouteProgress: 0,
    completedMainSteps: [],
    topicLevels: {},
    askedTopics: [],
    unknownStreak: 0,
    stalledTurns: 0,
    hintLevel: 0,
    disclosedFacts: [],
    history: [],
    unknownTotal: 0,
    alreadyTotal: 0,
  };
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
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

  const strong = ids.filter((id) =>
    (TOPIC_KW[id]?.strong ?? []).some((kw) => text.includes(normalize(kw))),
  );
  if (strong.length) return byPriority(strong);

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
  return "unknown";
}

interface Acc {
  topicLevels: Record<string, number>;
  askedTopics: string[];
  disclosedFacts: string[];
  completedMainSteps: string[];
  advancedMain: boolean;
  repeated: boolean;
  alreadyTotal: number;
}

export function advanceConversation(
  patientId: string,
  state: FacingConvoState,
  input: string,
): FacingConvoState {
  const text = input.trim();
  if (text === "") return state;

  const convo = getConvo(patientId);
  const history: FacingEntry[] = [...state.history, { role: "student", text }];
  const greetingKind = detectGreeting(text);
  const topic = detectTopic(convo, text, state);

  const acc: Acc = {
    topicLevels: { ...state.topicLevels },
    askedTopics: [...state.askedTopics],
    disclosedFacts: [...state.disclosedFacts],
    completedMainSteps: [...state.completedMainSteps],
    advancedMain: false,
    repeated: false,
    alreadyTotal: state.alreadyTotal,
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

  const discloseTopic = (id: string) => {
    const def = convo.topics[id];
    if (!def) return;
    const level = acc.topicLevels[id] ?? 0;
    if (level >= def.levels.length) {
      acc.alreadyTotal += 1;
      acc.repeated = true;
      history.push({
        role: "patient",
        text: convo.alreadyReplies[(acc.alreadyTotal - 1) % convo.alreadyReplies.length],
      });
      return;
    }
    const disc = def.levels[level];
    history.push({ role: "patient", text: disc.reply });
    acc.topicLevels[id] = level + 1;
    if (!acc.askedTopics.includes(id)) acc.askedTopics.push(id);
    if (disc.fact) acc.disclosedFacts.push(disc.fact);

    const node = convo.mainRoute.find((n) => n.topic === id && n.level === level);
    const key = `${id}@${level}`;
    if (node && !acc.completedMainSteps.includes(key)) {
      acc.completedMainSteps.push(key);
      acc.advancedMain = true;
      const mainInfos = acc.completedMainSteps.filter(
        (k) => !k.startsWith("greeting"),
      ).length;
      if (node.relatedResources && (mainInfos >= 3 || level >= 2)) {
        history.push({
          role: "coach",
          resources: node.relatedResources,
        });
      }
    }
  };

  const finalize = (opts: { unknown: boolean }): FacingConvoState => {
    const stalledTurns = acc.advancedMain ? 0 : state.stalledTurns + 1;
    let hintLevel: 0 | 1 | 2;
    if (opts.unknown) {
      hintLevel = computeHint(state.hintLevel, state.unknownStreak + 1, stalledTurns);
    } else if (acc.advancedMain) {
      hintLevel = 0;
    } else {
      const base = acc.repeated ? (Math.max(state.hintLevel, 1) as 0 | 1 | 2) : state.hintLevel;
      hintLevel = computeHint(base, 0, stalledTurns);
    }
    return {
      ...state,
      topicLevels: acc.topicLevels,
      askedTopics: acc.askedTopics,
      disclosedFacts: acc.disclosedFacts,
      completedMainSteps: acc.completedMainSteps,
      mainRouteProgress: acc.completedMainSteps.length,
      alreadyTotal: acc.alreadyTotal,
      unknownStreak: opts.unknown ? state.unknownStreak + 1 : 0,
      unknownTotal: opts.unknown ? state.unknownTotal + 1 : state.unknownTotal,
      stalledTurns,
      hintLevel,
      history,
    };
  };

  if (greetingKind) {
    history.push({ role: "patient", text: convo.greetings[greetingKind] });
    completeGreetingNode();
    if (topic !== "unknown" && convo.topics[topic]) {
      discloseTopic(topic);
    }
    return finalize({ unknown: false });
  }

  if (topic === "unknown" || !convo.topics[topic]) {
    const unknownTotal = state.unknownTotal + 1;
    history.push({
      role: "patient",
      text: convo.unknownReplies[(unknownTotal - 1) % convo.unknownReplies.length],
      unknown: true,
    });
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

export interface CoachHintView {
  done: boolean;
  direction: string;
  example: string;
}

export function getCoachHint(
  patientId: string,
  state: FacingConvoState,
): CoachHintView {
  const convo = getConvo(patientId);
  const node = nextMainNode(convo, state);
  if (!node) {
    return {
      done: true,
      direction:
        "ひと通りお話を聞けました。気づいたことをメモに残し、カルテと照らし合わせてみましょう。",
      example: "",
    };
  }
  return { done: false, direction: node.direction, example: node.example };
}
