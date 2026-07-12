// Sprint10.8「全人的な患者理解を促すCoach」用データ＆会話エンジン。
// Version1は外部AI/有料API不要。ルールベースで以下を実現する。
//  - 主ルート（mainRoute）完了だけでは会話全体を終了しない。5領域（A〜E）を横断的に探索する。
//  - 各話題は開示レベル（level）・領域（domain）・Coach深掘り・関連情報・十分性判定を持つ。
//  - 話題完了後は次の領域へ広げる方向性を示し、wholePersonReady まで会話を継続できる。
//  - Compass Coach は段階的に支援し、「患者理解の広がり」で確認済み/未確認領域を控えめに表示する。

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

// 患者理解の領域（全人的アプローチ）
export type Domain = "A" | "B" | "C" | "D" | "E";

export const DOMAIN_AREA_HINTS: Record<Domain, string> = {
  A: "体調や睡眠など、心身の状態",
  B: "治療をどのように受け止めているか",
  C: "普段どのように過ごしているか",
  D: "支えになっている人",
  E: "今後の希望や不安",
};

// 話題メタ（領域・Coach深掘り・関連情報・十分に聞けた判定）
export interface TopicMeta {
  domain: Domain;
  label: string; // 「確認できたこと」表示用
  direction: string; // Coach第1段階
  example: string; // Coach第2段階
  sufficientAt: number; // このレベル到達で「十分に聞けた」
  relatedResources?: RelatedResource[];
}

// 話題の1レベル分の開示内容
interface Disclosure {
  reply: string;
  fact?: string;
}

interface TopicDef {
  meta: TopicMeta;
  levels: Disclosure[];
}

// 主ルート（初期の学習導線。完了しても会話全体は終了しない）
interface MainNode {
  topic: string;
  level: number;
  direction?: string; // 主ルート固有の方向（未指定なら話題メタを使用）
  example?: string;
}

interface PatientConvo {
  mainRoute: MainNode[];
  greetings: Record<GreetingKind, string>;
  topics: Record<string, TopicDef>;
  unknownReplies: string[];
  alreadyReplies: string[];
}

// 話題定義ヘルパー
function t(
  domain: Domain,
  label: string,
  direction: string,
  example: string,
  levels: Disclosure[],
  opts?: { sufficientAt?: number; relatedResources?: RelatedResource[] },
): TopicDef {
  return {
    meta: {
      domain,
      label,
      direction,
      example,
      sufficientAt: opts?.sufficientAt ?? levels.length,
      relatedResources: opts?.relatedResources,
    },
    levels,
  };
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
      condition: t(
        "A", "体調",
        "今日の体調や気分から確かめてみましょう。",
        "例えば「今日の調子はいかがですか？」と尋ねられます。",
        [{ reply: "だいぶ落ち着いてきました。ただ、少し疲れが残っている感じがします。", fact: "本人：全体的には落ち着き、疲労感が残る" }],
      ),
      sleep: t(
        "A", "睡眠",
        "睡眠がとれているか確かめてみましょう。",
        "例えば「昨日はよく眠れましたか？」と尋ねられます。",
        [
          { reply: "夜は、あまり眠れませんでした。", fact: "本人：夜間の睡眠が不十分" },
          { reply: "何度か目が覚めてしまって……。そのたびに、なかなか寝つけませんでした。", fact: "本人：中途覚醒あり・再入眠困難" },
          { reply: "……廊下の音が気になって。あと、人に見られているような感じが、少し残っていて。", fact: "本人：物音・被注察感が睡眠を妨げている" },
        ],
        {
          sufficientAt: 3,
          relatedResources: [
            { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "睡眠状況" },
            { type: "看護記録", recordId: "nursing-a-20250705-01", title: "夜間観察" },
            { type: "フローシート", date: "2025/07/05", title: "睡眠時間" },
            { type: "処方", orderId: "rx-a-20250705-tonpuku", title: "睡眠薬" },
          ],
        },
      ),
      daytime: t(
        "C", "日中の過ごし方",
        "睡眠が日中の生活にどう影響しているか尋ねてみましょう。",
        "例えば「日中はどのように過ごしていますか？」と尋ねられます。",
        [{ reply: "昼間は少し眠気が残ります。でも、作業療法には出るようにしています。", fact: "本人：日中に眠気が残るが活動は継続" }],
      ),
      meal: t(
        "A", "食事",
        "食事や食欲について確かめてみましょう。",
        "例えば「食事はとれていますか？」と尋ねられます。",
        [{ reply: "食事は、少しずつですが食べられています。", fact: "本人：摂取量は少なめだが摂取可" }],
        { relatedResources: [
          { type: "フローシート", date: "2025/07/09", title: "食事摂取" },
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "栄養の記録" },
        ]},
      ),
      medication: t(
        "B", "服薬",
        "薬を飲むことについて、患者さんがどのように感じているか尋ねてみましょう。",
        "例えば「お薬を飲んでいて気になることはありますか？」と尋ねられます。",
        [
          { reply: "薬は、きちんと飲んでいます。", fact: "本人：服薬アドヒアランス良好" },
          { reply: "飲むと、少し落ち着く気がします。", fact: "本人：服薬で安心感" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "処方", orderId: "rx-a-20250709-teiki", title: "定期処方" },
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "服薬指導" },
          { type: "フローシート", date: "2025/07/09", title: "服薬状況" },
        ]},
      ),
      family: t(
        "D", "家族",
        "家族との関係や、患者さんが家族にどのような思いを持っているか尋ねてみましょう。",
        "例えば「ご家族とは会えていますか？」と尋ねられます。",
        [
          { reply: "母が時々、面会に来てくれます。", fact: "本人：母の面会あり" },
          { reply: "……あまり、心配をかけたくないんです。", fact: "本人：母への気づかい" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "生活歴", title: "家族構成" },
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "面会の記録" },
        ]},
      ),
      discharge: t(
        "E", "退院",
        "帰りたいという希望の背景にある生活や不安も確認してみましょう。",
        "例えば「退院についてどう思いますか？」と尋ねられます。",
        [
          { reply: "早く家に帰りたい気持ちはあります。", fact: "本人：退院願望あり" },
          { reply: "でも、まだ少し不安もあって……。", fact: "本人：退院への不安" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "生活歴", title: "退院後の生活" },
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "退院支援" },
        ]},
      ),
      hobby: t(
        "C", "趣味",
        "好きなことが現在の生活の中でどのような意味を持つか、もう少し聞いてみましょう。",
        "例えば「入院してからも、楽しめることはありますか？」と尋ねられます。",
        [{ reply: "静かな場所で、詰将棋をするのが好きです。", fact: "本人：詰将棋を好む" }],
        { relatedResources: [
          { type: "生活歴", title: "趣味の記載" },
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "OT記録" },
        ]},
      ),
      ot: t(
        "C", "活動",
        "日中の活動や作業療法への参加について尋ねてみましょう。",
        "例えば「作業療法には出ていますか？」と尋ねられます。",
        [{ reply: "作業療法には出ています。手を動かしていると、気がまぎれるので。", fact: "本人：OT参加・気晴らしになる" }],
        { relatedResources: [
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "OT記録" },
          { type: "生活歴", title: "入院前の生活" },
        ]},
      ),
      anxiety: t(
        "A", "不安",
        "不安や気がかりについて、そっと尋ねてみましょう。",
        "例えば「何か心配なことはありますか？」と尋ねられます。",
        [
          { reply: "……少し、落ち着かないことはあります。", fact: "本人：漠然とした不安" },
          { reply: "人の視線が、気になるときがあって。", fact: "本人：視線への過敏" },
        ],
        { sufficientAt: 2 },
      ),
      paranoia: t(
        "A", "被注察感",
        "見られている感じについて、否定せずに聞いてみましょう。",
        "例えば「気になることがあるとき、どんな感じですか？」と尋ねられます。",
        [
          { reply: "……人に見られているような感じが、することがあります。", fact: "本人：被注察感の訴え" },
          { reply: "悪口を言われているような気がして……。でも、気のせいかもしれません。", fact: "本人：関係念慮様の訴え" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "精神症状の経過" },
          { type: "看護記録", recordId: "nursing-a-20250708-01", title: "観察記録" },
        ]},
      ),
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
      condition: t(
        "A", "気分",
        "今の気分や意欲を確かめてみましょう。",
        "例えば「今日の気分はいかがですか？」と尋ねられます。",
        [
          { reply: "何もやる気が起きないんです。", fact: "本人：意欲低下の訴え" },
          { reply: "……ずっと、このままな気がして。", fact: "本人：将来への悲観" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "気分の経過" },
          { type: "看護記録", recordId: "nursing-e-20250707-01", title: "気持ちの記録" },
        ]},
      ),
      sleep: t(
        "A", "睡眠",
        "睡眠の状況も確かめてみましょう。",
        "例えば「夜はよく眠れていますか？」と尋ねられます。",
        [
          { reply: "早くに目が覚めてしまって。", fact: "本人：早朝覚醒" },
          { reply: "それからは、ただ横になっていました。", fact: "本人：覚醒後の臥床" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "フローシート", date: "2025/07/08", title: "睡眠時間" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "睡眠の経過" },
        ]},
      ),
      meal: t(
        "A", "食事",
        "食事や食欲について確かめてみましょう。",
        "例えば「食事はとれていますか？」と尋ねられます。",
        [
          { reply: "あまり、食べられていません。", fact: "本人：食欲低下" },
          { reply: "食べたい気持ちが、わかなくて。", fact: "本人：食思不振の自覚" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "フローシート", date: "2025/07/08", title: "食事摂取" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "栄養の記録" },
        ]},
      ),
      self_blame: t(
        "E", "自責の思い",
        "つらさの背景にある気持ちを、そっと尋ねてみましょう。",
        "例えば「今、どんなことがつらいですか？」と尋ねられます。",
        [
          { reply: "こんな自分で、情けなくて。", fact: "本人：自責的思考" },
          { reply: "家族にも、申し訳ないんです。", fact: "本人：家族への罪責感" },
        ],
        { sufficientAt: 2 },
      ),
      hope: t(
        "E", "希望",
        "支えや、これからの希望について尋ねてみましょう。",
        "例えば「これから楽しみにしていることはありますか？」と尋ねられます。",
        [{ reply: "孫には、また会いたいなとは思います。……でも、今の自分では。", fact: "本人：孫に会いたい思いが希望として残る" }],
        { relatedResources: [
          { type: "生活歴", title: "家族の記載" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "支援の経過" },
        ]},
      ),
      family: t(
        "D", "家族",
        "家族との関係や、患者さんが家族にどのような思いを持っているか尋ねてみましょう。",
        "例えば「ご家族とは会えていますか？」と尋ねられます。",
        [{ reply: "家族は、時々来てくれます。", fact: "本人：家族面会あり" }],
        { relatedResources: [
          { type: "生活歴", title: "家族構成" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "面会の記録" },
        ]},
      ),
      medication: t(
        "B", "服薬",
        "薬を飲むことについて、患者さんがどのように感じているか尋ねてみましょう。",
        "例えば「お薬は飲めていますか？」と尋ねられます。",
        [
          { reply: "薬は、言われた通りに飲んでいます。", fact: "本人：服薬遵守" },
          { reply: "効いているのかは、よく分かりません。", fact: "本人：効果実感の乏しさ" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "処方", orderId: "rx-e-20250708-teiki", title: "定期処方" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "服薬の経過" },
        ]},
      ),
      discharge: t(
        "E", "退院",
        "帰りたいという希望の背景にある生活や不安も確認してみましょう。",
        "例えば「退院についてどう思いますか？」と尋ねられます。",
        [{ reply: "家に帰っても、迷惑をかけるだけな気がして。", fact: "本人：退院への自信のなさ" }],
        { relatedResources: [
          { type: "生活歴", title: "退院後の生活" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "退院支援" },
        ]},
      ),
      hobby: t(
        "C", "以前の活動",
        "以前楽しめていたことが、今の生活とどう関わるか尋ねてみましょう。",
        "例えば「以前好きだったことは、今も心に残っていますか？」と尋ねられます。",
        [{ reply: "前は、編み物を……。今は、何かをする気になれなくて。", fact: "本人：以前の趣味への関心低下" }],
        { relatedResources: [
          { type: "生活歴", title: "趣味の記載" },
          { type: "診療録", recordId: "clinical-e-20250708-sleep-01", title: "活動の記録" },
        ]},
      ),
      anxiety: t(
        "E", "不安",
        "これからのことについて、不安がないか尋ねてみましょう。",
        "例えば「これからのことが心配ですか？」と尋ねられます。",
        [{ reply: "……これからのことが、不安で。", fact: "本人：将来不安" }],
      ),
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
      condition: t(
        "A", "活動性",
        "今の気分や活動の様子を確かめてみましょう。",
        "例えば「今日の調子はいかがですか？」と尋ねられます。",
        [
          { reply: "絶好調です！　アイデアが止まらなくて。", fact: "本人：高揚感・観念奔逸傾向" },
          { reply: "じっとしていられないんですよ。", fact: "本人：多動・静止困難" },
        ],
        { sufficientAt: 2 },
      ),
      sleep: t(
        "A", "睡眠",
        "睡眠や休息のとれ方を確かめてみましょう。",
        "例えば「昨日はどのくらい眠れましたか？」と尋ねられます。",
        [
          { reply: "睡眠は短いけど平気です。", fact: "本人：睡眠時間短縮を問題視せず" },
          { reply: "やりたいことがたくさんあって、寝るのがもったいなくて。", fact: "本人：睡眠欲求の低下" },
        ],
        { sufficientAt: 2, relatedResources: [
          { type: "フローシート", date: "2025/07/08", title: "睡眠時間" },
          { type: "看護記録", recordId: "nursing-f-20250708-01", title: "睡眠記録" },
        ]},
      ),
      medication: t(
        "B", "服薬",
        "薬を飲むことについて、患者さんがどのように感じているか尋ねてみましょう。",
        "例えば「お薬を飲んでいて気になることはありますか？」と尋ねられます。",
        [
          { reply: "薬は……正直、もう飲まなくてもいい気がします。", fact: "本人：服薬に消極的" },
          { reply: "眠くなるのが、少し嫌なんですよね。", fact: "本人：副作用（眠気）忌避" },
          { reply: "調子いいのに、飲む意味あります？", fact: "本人：病識・必要感の乏しさ" },
        ],
        { sufficientAt: 3, relatedResources: [
          { type: "処方", orderId: "rx-f-20250707-teiki", title: "定期処方" },
          { type: "診療録", recordId: "clinical-f-20250707-med-01", title: "服薬の経過" },
          { type: "フローシート", date: "2025/07/08", title: "服薬状況" },
        ]},
      ),
      plan: t(
        "E", "今後の計画",
        "退院後の計画や、休息のとり方を尋ねてみましょう。",
        "例えば「退院したら何をしたいですか？」と尋ねられます。",
        [{ reply: "退院したら、すぐアプリ開発です！　休むのはもったいなくて。", fact: "本人：退院後の過活動計画・休息軽視" }],
        { relatedResources: [
          { type: "生活歴", title: "退院後の生活" },
          { type: "診療録", recordId: "clinical-f-20250707-med-01", title: "退院支援" },
        ]},
      ),
      meal: t(
        "A", "食事",
        "食事の様子について尋ねてみましょう。",
        "例えば「食事はとれていますか？」と尋ねられます。",
        [{ reply: "食事はしっかり食べてます！　話しながらでも、どんどんいけますよ。", fact: "本人：食欲良好・多弁" }],
        { relatedResources: [
          { type: "フローシート", date: "2025/07/09", title: "食事摂取" },
        ]},
      ),
      family: t(
        "D", "家族",
        "家族との関係について尋ねてみましょう。",
        "例えば「ご家族とはどんなふうに過ごしていますか？」と尋ねられます。",
        [{ reply: "家族は心配性でね。でも僕はこの通り元気なので。", fact: "本人：家族の心配を軽視" }],
        { relatedResources: [
          { type: "生活歴", title: "家族構成" },
        ]},
      ),
      discharge: t(
        "E", "退院",
        "退院への思いや、その先の生活について尋ねてみましょう。",
        "例えば「退院についてどう思いますか？」と尋ねられます。",
        [{ reply: "早く退院したいです。やりたいことが山ほどあって。", fact: "本人：退院希望・活動意欲過剰" }],
      ),
      hobby: t(
        "C", "趣味",
        "好きなことが現在の生活の中でどのような意味を持つか、もう少し聞いてみましょう。",
        "例えば「得意なことや好きなことはありますか？」と尋ねられます。",
        [{ reply: "新しいアプリを作るのが好きなんです。", fact: "本人：開発への没頭" }],
        { relatedResources: [
          { type: "生活歴", title: "趣味の記載" },
          { type: "診療録", recordId: "clinical-f-20250707-med-01", title: "活動の記録" },
        ]},
      ),
      anxiety: t(
        "E", "不安",
        "不安や心配について尋ねてみましょう。",
        "例えば「何か心配なことはありますか？」と尋ねられます。",
        [{ reply: "不安？　いやー、今はまったくないですね。", fact: "本人：不安の否認" }],
      ),
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
    condition: t(
      "A", "体調",
      "今日の体調や気分を確かめてみましょう。",
      "例えば「今日の調子はいかがですか？」と尋ねられます。",
      [{ reply: "体調は、まあまあです。", fact: "本人：体調はまずまず" }],
    ),
    sleep: t(
      "A", "睡眠",
      "睡眠がとれているか確かめてみましょう。",
      "例えば「昨日はよく眠れましたか？」と尋ねられます。",
      [{ reply: "睡眠は、まずまずとれています。", fact: "本人：睡眠はまずまず" }],
      { relatedResources: [
        { type: "診療録", recordId: "clinical-a-20250705-sleep-01", title: "睡眠状況" },
        { type: "フローシート", date: "2025/07/05", title: "睡眠時間" },
      ]},
    ),
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
  completedTopics: string[]; // 十分に深掘りした話題ID
  resourcesShown: string[]; // 関連情報を提示済みの話題ID
  recentlyCompletedTopic: string | null; // 直前に完了した話題（Coach遷移用）
  domainProgress: Record<Domain, number>; // 領域ごとの完了話題数
  exploredDomains: Domain[]; // 1話題以上完了した領域
  unexploredDomains: Domain[]; // まだ完了話題がない領域
  wholePersonReady: boolean; // 全人的理解の最低条件を満たしたか
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
    completedTopics: [],
    resourcesShown: [],
    recentlyCompletedTopic: null,
    domainProgress: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    exploredDomains: [],
    unexploredDomains: ["A", "B", "C", "D", "E"],
    wholePersonReady: false,
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

function topicLevel(state: FacingConvoState, topicId: string): number {
  return state.topicLevels[topicId] ?? 0;
}

function isTopicSufficient(
  convo: PatientConvo,
  state: FacingConvoState,
  topicId: string,
): boolean {
  const def = convo.topics[topicId];
  if (!def) return false;
  return topicLevel(state, topicId) >= def.meta.sufficientAt;
}

function computeDomainProgress(
  convo: PatientConvo,
  completedTopics: string[],
): Record<Domain, number> {
  const progress: Record<Domain, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const id of completedTopics) {
    const domain = convo.topics[id]?.meta.domain;
    if (domain) progress[domain] += 1;
  }
  return progress;
}

function computeExploredDomains(
  convo: PatientConvo,
  completedTopics: string[],
): Domain[] {
  const domains = new Set<Domain>();
  for (const id of completedTopics) {
    const d = convo.topics[id]?.meta.domain;
    if (d) domains.add(d);
  }
  return [...domains];
}

function computeUnexploredDomains(
  convo: PatientConvo,
  completedTopics: string[],
): Domain[] {
  const explored = new Set(computeExploredDomains(convo, completedTopics));
  const present = new Set<Domain>();
  for (const def of Object.values(convo.topics)) {
    present.add(def.meta.domain);
  }
  return (["A", "B", "C", "D", "E"] as Domain[]).filter(
    (d) => present.has(d) && !explored.has(d),
  );
}

function checkWholePersonReady(
  domainProgress: Record<Domain, number>,
): boolean {
  return (
    domainProgress.A >= 2 &&
    domainProgress.B >= 1 &&
    domainProgress.C >= 1 &&
    (domainProgress.D >= 1 || domainProgress.E >= 1)
  );
}

function getExploredLabels(
  convo: PatientConvo,
  completedTopics: string[],
): string[] {
  return completedTopics
    .map((id) => convo.topics[id]?.meta.label)
    .filter((l): l is string => Boolean(l));
}

function getUnexploredHints(
  convo: PatientConvo,
  unexploredDomains: Domain[],
): string[] {
  return unexploredDomains.map((d) => DOMAIN_AREA_HINTS[d]);
}

function getActiveTopic(
  convo: PatientConvo,
  state: FacingConvoState,
): string | null {
  for (let i = state.askedTopics.length - 1; i >= 0; i--) {
    const id = state.askedTopics[i];
    if (!isTopicSufficient(convo, state, id) && convo.topics[id]) return id;
  }
  return null;
}

function firstTopicInDomain(
  convo: PatientConvo,
  domain: Domain,
): TopicDef | undefined {
  return Object.values(convo.topics).find((def) => def.meta.domain === domain);
}

function syncDomainState(
  convo: PatientConvo,
  completedTopics: string[],
): Pick<
  FacingConvoState,
  "domainProgress" | "exploredDomains" | "unexploredDomains" | "wholePersonReady"
> {
  const domainProgress = computeDomainProgress(convo, completedTopics);
  return {
    domainProgress,
    exploredDomains: computeExploredDomains(convo, completedTopics),
    unexploredDomains: computeUnexploredDomains(convo, completedTopics),
    wholePersonReady: checkWholePersonReady(domainProgress),
  };
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
// 優先: 1) strong一致（具体） 2) 主ルート関連(weak) 3) 進行中(weak) 4) 優先度 5) unknown
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

// 開示処理の作業用アキュムレータ（イミュータブルに状態を組み立てる）
interface Acc {
  topicLevels: Record<string, number>;
  askedTopics: string[];
  disclosedFacts: string[];
  completedMainSteps: string[];
  completedTopics: string[];
  resourcesShown: string[];
  recentlyCompletedTopic: string | null;
  advancedMain: boolean;
  repeated: boolean;
  alreadyTotal: number;
}

// 学生の発話を処理し、次の会話状態を返す（純粋関数）。
// 単一意図・複数意図を区別する。挨拶は種別に合わせて返答し、
// 挨拶だけの入力では体調などを自動開示しない。
export function normalizeFacingState(
  patientId: string,
  state: FacingConvoState,
): FacingConvoState {
  const base = initialFacingState();
  const completedTopics = state.completedTopics ?? base.completedTopics;
  const domainState = syncDomainState(getConvo(patientId), completedTopics);
  return {
    ...base,
    ...state,
    completedTopics,
    resourcesShown: state.resourcesShown ?? base.resourcesShown,
    recentlyCompletedTopic: state.recentlyCompletedTopic ?? null,
    ...domainState,
  };
}

export function advanceConversation(
  patientId: string,
  state: FacingConvoState,
  input: string,
): FacingConvoState {
  state = normalizeFacingState(patientId, state);
  const text = input.trim();
  if (text === "") return state;

  const convo = getConvo(patientId);
  const history: FacingEntry[] = [...state.history, { role: "student", text }];
  const greetingKind = detectGreeting(text);
  const topic = detectTopic(convo, text, state); // 挨拶を除く実質的な話題

  const acc: Acc = {
    topicLevels: { ...state.topicLevels },
    askedTopics: [...state.askedTopics],
    disclosedFacts: [...state.disclosedFacts],
    completedMainSteps: [...state.completedMainSteps],
    completedTopics: [...state.completedTopics],
    resourcesShown: [...state.resourcesShown],
    recentlyCompletedTopic: null, // 新しい発話で前回の完了表示はクリア
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
      // 掘り尽くした話題（同じ話題の繰り返し）
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
    if (!acc.askedTopics.includes(id)) acc.askedTopics.push(id);
    if (disc.fact) acc.disclosedFacts.push(disc.fact);

    const node = convo.mainRoute.find((n) => n.topic === id && n.level === level);
    const key = `${id}@${level}`;
    if (node && !acc.completedMainSteps.includes(key)) {
      acc.completedMainSteps.push(key);
      acc.advancedMain = true;
    }

    // 話題を十分に深掘りしたら完了扱い＋関連情報を提示
    if (
      newLevel >= def.meta.sufficientAt &&
      !acc.completedTopics.includes(id)
    ) {
      acc.completedTopics.push(id);
      acc.recentlyCompletedTopic = id;
      if (
        def.meta.relatedResources &&
        def.meta.relatedResources.length > 0 &&
        !acc.resourcesShown.includes(id)
      ) {
        acc.resourcesShown.push(id);
        history.push({
          role: "coach",
          resources: def.meta.relatedResources,
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
      hintLevel = 0; // 主ルートが進んだらCoachは控えめに戻す
    } else {
      const base = acc.repeated ? (Math.max(state.hintLevel, 1) as 0 | 1 | 2) : state.hintLevel;
      hintLevel = computeHint(base, 0, stalledTurns);
    }
    const domainState = syncDomainState(convo, acc.completedTopics);
    if (acc.recentlyCompletedTopic) {
      hintLevel = Math.max(hintLevel, 1) as 0 | 1 | 2;
    } else if (domainState.wholePersonReady) {
      hintLevel = Math.max(hintLevel, 1) as 0 | 1 | 2;
    }
    return {
      ...state,
      topicLevels: acc.topicLevels,
      askedTopics: acc.askedTopics,
      disclosedFacts: acc.disclosedFacts,
      completedMainSteps: acc.completedMainSteps,
      completedTopics: acc.completedTopics,
      resourcesShown: acc.resourcesShown,
      recentlyCompletedTopic: acc.recentlyCompletedTopic,
      ...domainState,
      mainRouteProgress: acc.completedMainSteps.length,
      alreadyTotal: acc.alreadyTotal,
      unknownStreak: opts.unknown ? state.unknownStreak + 1 : 0,
      unknownTotal: opts.unknown ? state.unknownTotal + 1 : state.unknownTotal,
      stalledTurns,
      hintLevel,
      history,
    };
  };

  // --- 挨拶を含む入力 ---
  if (greetingKind) {
    history.push({ role: "patient", text: convo.greetings[greetingKind] });
    completeGreetingNode();
    // 複数意図（挨拶＋話題）のときのみ、続けて話題を開示する
    if (topic !== "unknown" && convo.topics[topic]) {
      discloseTopic(topic);
    }
    return finalize({ unknown: false });
  }

  // --- 想定外入力 ---
  if (topic === "unknown" || !convo.topics[topic]) {
    const unknownTotal = state.unknownTotal + 1;
    history.push({
      role: "patient",
      text: convo.unknownReplies[(unknownTotal - 1) % convo.unknownReplies.length],
      unknown: true,
    });
    return finalize({ unknown: true });
  }

  // --- 単一意図（通常の開示） ---
  discloseTopic(topic);
  return finalize({ unknown: false });
}

// 自動ヒントレベル算出（手動で上げた分は下げない＝Math.max）。
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

// 学生が手動でヒントを要求（「ヒントを見る」→「もう少しヒント」）。
export function requestHint(state: FacingConvoState): FacingConvoState {
  return { ...state, hintLevel: (state.hintLevel >= 1 ? 2 : 1) as 0 | 1 | 2 };
}

// 現在の Coach ヒント内容（表示可否は hintLevel で FacingPatient 側が判断）。
export interface CoachHintView {
  direction: string;
  example: string;
  showBreadth: boolean;
  exploredLabels: string[];
  unexploredHints: string[];
  wholePersonReady: boolean;
  topicJustCompleted: string | null;
}

export function getCoachHint(
  patientId: string,
  state: FacingConvoState,
): CoachHintView {
  state = normalizeFacingState(patientId, state);
  const convo = getConvo(patientId);
  const exploredLabels = getExploredLabels(convo, state.completedTopics);
  const unexploredHints = getUnexploredHints(convo, state.unexploredDomains);
  const showBreadth = exploredLabels.length > 0 || unexploredHints.length > 0;
  const base = {
    showBreadth,
    exploredLabels,
    unexploredHints,
    wholePersonReady: state.wholePersonReady,
    topicJustCompleted: null as string | null,
  };

  // 話題完了直後：次の領域への遷移を促す（会話は終了しない）
  if (state.recentlyCompletedTopic) {
    const label =
      convo.topics[state.recentlyCompletedTopic]?.meta.label ?? "その話題";
    return {
      ...base,
      direction: `${label}については具体的に聞くことができました。患者さんを生活者として理解するために、ほかに知りたいことはありますか？`,
      example: "",
      topicJustCompleted: label,
    };
  }

  // 全人的理解の最低条件を満たした（会話は続けられる）
  if (state.wholePersonReady) {
    return {
      ...base,
      direction:
        "患者さんについていくつかの側面から話を聞くことができました。まだ確認したいことがあれば、会話を続けられます。",
      example: "",
    };
  }

  // 進行中の話題（主ルート外の深掘りを含む）
  const activeId = getActiveTopic(convo, state);
  if (activeId) {
    const meta = convo.topics[activeId].meta;
    return {
      ...base,
      direction: meta.direction,
      example: meta.example,
    };
  }

  // 主ルートの次のノード
  const node = nextMainNode(convo, state);
  if (node) {
    const topicDef = convo.topics[node.topic];
    return {
      ...base,
      direction: node.direction ?? topicDef?.meta.direction ?? "",
      example: node.example ?? topicDef?.meta.example ?? "",
    };
  }

  // 主ルート完了後：未確認領域へ広げる方向性を示す
  const firstUnexplored = state.unexploredDomains[0];
  const suggestDef = firstUnexplored
    ? firstTopicInDomain(convo, firstUnexplored)
    : undefined;
  return {
    ...base,
    direction:
      "患者さんを生活者として理解するために、ほかに知りたいことはありますか？",
    example: suggestDef?.meta.example ?? "",
  };
}
