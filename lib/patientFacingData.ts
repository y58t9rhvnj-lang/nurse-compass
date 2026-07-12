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
  // 重要テーマ: 睡眠 / 不安・被注察感 / 日中生活への影響。
  A: {
    coreThemes: ["sleep", "anxiety", "paranoia", "daytime"],
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
    topics: {
      condition: { levels: [{ reply: "だいぶ落ち着いてきました。ただ、少し疲れが残っている感じがします。", fact: "本人：全体的には落ち着き、疲労感が残る" }] },
      sleep: {
        levels: [
          { reply: "夜は、あまり眠れませんでした。", fact: "本人：夜間の睡眠が不十分" },
          { reply: "何度か目が覚めてしまって……。そのたびに、なかなか寝つけませんでした。", fact: "本人：中途覚醒あり・再入眠困難" },
          { reply: "……廊下の音が気になって。あと、人に見られているような感じが、少し残っていて。", fact: "本人：物音・被注察感が睡眠を妨げている" },
        ],
        sufficientAt: 3,
        relatedResources: [
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "睡眠状況" },
          { type: "看護記録", recordId: "nursing-a-20250705-01", title: "夜間観察" },
          { type: "フローシート", date: "2025/07/05", title: "睡眠時間" },
          { type: "処方", orderId: "rx-a-20250705-tonpuku", title: "睡眠薬" },
        ],
      },
      daytime: { levels: [{ reply: "昼間は少し眠気が残ります。でも、作業療法には出るようにしています。", fact: "本人：日中に眠気が残るが活動は継続" }] },
      meal: { levels: [{ reply: "食事は、少しずつですが食べられています。", fact: "本人：摂取量は少なめだが摂取可" }] },
      medication: {
        levels: [
          { reply: "薬は、きちんと飲んでいます。", fact: "本人：服薬アドヒアランス良好" },
          { reply: "飲むと、少し落ち着く気がします。", fact: "本人：服薬で安心感" },
        ],
        sufficientAt: 2,
        relatedResources: [
          { type: "処方", orderId: "rx-a-20250709-teiki", title: "処方内容" },
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "経過記録" },
          { type: "フローシート", date: "2025/07/05", title: "服薬状況" },
        ],
      },
      family: {
        levels: [
          { reply: "母が時々、面会に来てくれます。", fact: "本人：母の面会あり" },
          { reply: "……あまり、心配をかけたくないんです。", fact: "本人：母への気づかい" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "生活歴", title: "家族の記載" },
          { type: "看護記録", recordId: "nursing-a-20250704-01", title: "面会時の様子" },
        ],
      },
      discharge: {
        levels: [
          { reply: "早く家に帰りたい気持ちはあります。", fact: "本人：退院願望あり" },
          { reply: "でも、まだ少し不安もあって……。", fact: "本人：退院への不安" },
        ],
        sufficientAt: 1,
        relatedResources: [
          { type: "生活歴", title: "退院後の生活" },
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "経過記録" },
        ],
      },
      hobby: {
        levels: [{ reply: "静かな場所で、詰将棋をするのが好きです。", fact: "本人：詰将棋を好む" }],
        sufficientAt: 1,
        relatedResources: [
          { type: "生活歴", title: "生活歴" },
          { type: "看護記録", recordId: "nursing-a-20250709-01", title: "活動の記録" },
        ],
      },
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
  return "unknown";
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
  const history: FacingEntry[] = [...state.history, { role: "student", text }];
  const greetingKind = detectGreeting(text);
  const topic = detectTopic(convo, text, state);

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
    acc.currentTopic = id;
    acc.lastMeaningfulTopic = id;
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
    const stalledTurns = acc.advancedMain || acc.disclosedNew ? 0 : state.stalledTurns + 1;
    let hintLevel: 0 | 1 | 2;
    if (opts.unknown) {
      hintLevel = computeHint(state.hintLevel, state.unknownStreak + 1, stalledTurns);
    } else if (acc.advancedMain || acc.disclosedNew) {
      // 成功ターン（主ルート進行 or 新レベル開示）は Coach を idle へ戻す（Bug1）。
      hintLevel = 0;
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
  const messages: Record<string, string> = {
    sleep: "睡眠について確認できる情報があります。",
    medication: "服薬について確認できる情報があります。",
    hobby: "生活や活動について確認できる情報があります。",
    ot: "生活や活動について確認できる情報があります。",
    daytime: "生活や活動について確認できる情報があります。",
    family: "家族との関係について確認できる情報があります。",
    condition: "気分や心理状態について確認できる情報があります。",
    self_blame: "気分や心理状態について確認できる情報があります。",
    anxiety: "気分や心理状態について確認できる情報があります。",
    hope: "気分や心理状態について確認できる情報があります。",
    meal: "食事について確認できる情報があります。",
    discharge: "退院や将来について確認できる情報があります。",
    plan: "退院や将来について確認できる情報があります。",
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
  sleep: "先ほどのお話で気になった睡眠についても、もう少し確認できそうですね。",
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
