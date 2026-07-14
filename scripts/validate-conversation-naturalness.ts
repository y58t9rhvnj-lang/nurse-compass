// Sprint A-2.1: 会話の自然さ検証。
// 反射・共感・要約・雑談・逆質問・繰り返し・unknown を、患者A らしく・決定的に扱えているか。
import {
  advanceConversation,
  extractQuotedExample,
  getCoachFocus,
  initialFacingState,
  shouldShowCoachHint,
  type FacingConvoState,
} from "../lib/patientFacingData";
import {
  FORBIDDEN_CLINICAL_VOCAB,
  PATIENT_A_PERSONA,
} from "../lib/conversation/naturalness";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`[OK]   ${label}`);
  } else {
    console.error(`[FAIL] ${label}`);
    failures += 1;
  }
}

function sayA(state: FacingConvoState, text: string): FacingConvoState {
  return advanceConversation("A", state, text);
}
function lastPatient(s: FacingConvoState) {
  for (let i = s.history.length - 1; i >= 0; i--) {
    if (s.history[i].role === "patient") return s.history[i];
  }
  return null;
}
function reply(s: FacingConvoState): string {
  const e = lastPatient(s);
  return e && "text" in e ? e.text : "";
}
function isUnknown(s: FacingConvoState): boolean {
  const e = lastPatient(s);
  return !!(e && "unknown" in e && e.unknown === true);
}
function greet(): FacingConvoState {
  return sayA(initialFacingState(), "おはようございます");
}
function ellipsisRuns(text: string): number {
  return (text.match(/…+/g) ?? []).length;
}

// ============ Scenario A — 反射的傾聴 ============
{
  let s = greet();
  s = sayA(s, "夜は眠れていますか"); // sleep 開示
  const steps = [
    "眠れない日があるんですね",
    "それはつらいですね",
    "声が気になるんですね",
    "その時はラジオを聞くんですね",
  ];
  let allNotUnknown = true;
  let coachStayedQuiet = true;
  for (const step of steps) {
    s = sayA(s, step);
    if (isUnknown(s)) allNotUnknown = false;
    if (shouldShowCoachHint(s)) coachStayedQuiet = false;
  }
  check("A: 反射・共感は unknown にならない", allNotUnknown);
  check("A: 反射的傾聴中は Coach が割り込まない", coachStayedQuiet);
}

// ============ Scenario B — 要約のやんわり訂正 ============
{
  let s = greet();
  s = sayA(s, "毎晩、幻聴で全く眠れないんですね");
  check("B: 過度な一般化は unknown にならない", !isUnknown(s));
  check("B: 『毎日ではない』とやんわり訂正する", reply(s).includes("毎日ではない"));
  check("B: 訂正は Coach を割り込ませない", !shouldShowCoachHint(s));
}

// ============ 正確な要約は確認する ============
{
  let s = greet();
  s = sayA(s, "夜に声が聞こえて眠れず、ラジオを聞いているんですね");
  check("要約: 正確な要約は unknown にならない", !isUnknown(s));
  check(
    "要約: 正確な要約は『だいたい』と確認する",
    PATIENT_A_PERSONA.summaryConfirm.includes(reply(s)),
  );
}

// ============ Scenario C — Iさんとの関係 ============
{
  let s = greet();
  const steps = [
    "Iさんとは一緒に過ごすんですね",
    "安心できる人なんですね",
    "Iさんみたいになりたいんですね",
  ];
  let ok = true;
  for (const step of steps) {
    s = sayA(s, step);
    if (isUnknown(s)) ok = false;
  }
  check("C: Iさんへの反射はすべて unknown にならない", ok);
  check("C: 応答が長すぎない（<=130字）", reply(s).length <= 130);
}

// ============ Scenario D — 退院・地域生活 ============
{
  let s = greet();
  const steps = [
    "病院にいる方が安心なんですね",
    "外で暮らすのは不安なんですね",
    "薬やお金の管理に自信がないんですね",
  ];
  let ok = true;
  let noMotivation = true;
  for (const step of steps) {
    s = sayA(s, step);
    if (isUnknown(s)) ok = false;
    if (reply(s).includes("退院したい")) noMotivation = false;
  }
  check("D: 退院の反射はすべて unknown にならない", ok);
  check("D: 突然の退院意欲は出さない", noMotivation);
}

// ============ Scenario E — 雑談 ============
{
  let s = greet();
  s = sayA(s, "今日は暑いですね");
  check("E: 天気の雑談は unknown にならない", !isUnknown(s));
  check(
    "E: 天気の応答が canon 一貫（暑い/中庭）",
    reply(s).includes("暑い") || reply(s).includes("中庭"),
  );
  s = sayA(s, "中庭には行きますか");
  check("E: 中庭（同室話題）は unknown にならない", !isUnknown(s));
}

// ============ Scenario F — unknown / 不明瞭 ============
{
  const vagues = ["あwづえ", "力学のラプラス方程式について教えて", "それはどれですか"];
  let allUnknown = true;
  let naturalLang = true;
  for (const v of vagues) {
    const s = sayA(greet(), v);
    if (!isUnknown(s)) allUnknown = false;
    if (!PATIENT_A_PERSONA.acks.concat([
      "うーん……ちょっと、分からないですね。",
      "もう少し、詳しく聞いてもらえますか。",
      "それは、どういう意味ですか？",
      "あまり、考えたことがなくて……。",
    ]).some((u) => reply(s).includes(u.slice(0, 4)))) {
      // unknown 応答は自然な患者A言葉（丁寧・ためらい）であること
      naturalLang = naturalLang && /(ですか|ないです|ません|ですね)/.test(reply(s));
    }
  }
  check("F: 曖昧・無関係・文脈なしはすべて unknown", allUnknown);
  check("F: unknown 応答は自然な患者A言葉", naturalLang);
}

// ============ Scenario G — 繰り返し ============
{
  let s = greet();
  const replies: string[] = [];
  for (let i = 0; i < 5; i++) {
    s = sayA(s, "昨日はよく眠れましたか？");
    replies.push(reply(s));
  }
  const consecutiveDistinct = replies.every(
    (r, i) => i === 0 || r !== replies[i - 1],
  );
  check("G: 同じ質問の連続でも直前と同一文字列にならない", consecutiveDistinct);
  const boundary = replies.some(
    (r) => r.includes("さっき") || r.includes("同じ") || r.includes("変わり"),
  );
  check("G: 出し尽くすと自然な境界表現になる", boundary);
}

// ============ Scenario H — 逆質問（まれ） ============
{
  // 十分に長い自然な会話（radio/roommate を 6ターン目以降に含む）。
  let s = greet();
  const seq = [
    "昨日はよく眠れましたか？", // 2
    "夜中に目が覚めますか？", // 3
    "眠れないとき気になることは？", // 4
    "お薬は飲めていますか？", // 5
    "ラジオはよく聞きますか？", // 6 radio
    "どんな番組を聞きますか？", // 7 radio
    "同室の方とは話しますか？", // 8 roommate
  ];
  let reciprocalCount = 0;
  for (const q of seq) {
    s = sayA(s, q);
    if (reply(s).includes("聞きますか") || reply(s).includes("知っているんですか")) {
      // 患者側からの逆質問（radio/roommate の逆質問マーカー）。
      if (
        reply(s).includes("そちらは") ||
        reply(s).includes("知っているんですか")
      ) {
        reciprocalCount += 1;
      }
    }
  }
  check("H: 逆質問は会話全体で最大1回", reciprocalCount <= 1);

  // 短い会話（6ターン未満）では逆質問しない。
  let short = greet();
  short = sayA(short, "ラジオはよく聞きますか？");
  short = sayA(short, "どんな番組を聞きますか？");
  const early = short.history.some(
    (e) => e.role === "patient" && "text" in e && e.text.includes("そちらは"),
  );
  check("H: 会話序盤（6ターン未満）では逆質問しない", !early);
}

// ============ Coach: 反射のみが続くとやんわり促す ============
{
  let s = greet();
  s = sayA(s, "夜は眠れていますか"); // sleep 開示
  s = sayA(s, "つらかったですね"); // empathy 1
  check("Coach: 共感1回では割り込まない", !shouldShowCoachHint(s));
  s = sayA(s, "大変でしたね"); // empathy 2
  check("Coach: 共感2回でも割り込まない", !shouldShowCoachHint(s));
  s = sayA(s, "頑張っているんですね"); // empathy 3
  check("Coach: 共感3回でやんわり促す", shouldShowCoachHint(s));
  const focus = getCoachFocus("A", s);
  check("Coach: 促しは受け止めを認める文面", focus.direction.includes("受け止め"));
}

// ============ Coach が勧める質問は必ず答えられる ============
{
  const states: FacingConvoState[] = [];
  let s = greet();
  states.push(s);
  s = sayA(s, "昨日はよく眠れましたか？");
  states.push(s);
  s = sayA(s, "お薬は飲めていますか？");
  states.push(s);
  let allAnswerable = true;
  for (const st of states) {
    const focus = getCoachFocus("A", st);
    const q = extractQuotedExample(focus.example);
    if (q) {
      const next = sayA(st, q);
      if (isUnknown(next)) allAnswerable = false;
    }
  }
  check("Coach が勧める質問例はすべて有効な応答を得る", allAnswerable);
}

// ============ 決定的な出力（再現性） ============
{
  const run = (): string => {
    let s = greet();
    for (const t of [
      "夜は眠れていますか",
      "眠れない日があるんですね",
      "それはつらいですね",
      "声が気になるんですね",
      "その時はラジオを聞くんですね",
    ]) {
      s = sayA(s, t);
    }
    return s.history.map((e) => ("text" in e ? e.text : "")).join("|");
  };
  check("決定的: 同一系列は同一出力になる", run() === run());
}

// ============ 大域スキャン（禁止語・長さ・ためらい・canon 保持） ============
{
  const PROBES: string[] = [
    "調子はどうですか",
    "睡眠はどうですか",
    "幻聴について教えてください",
    "ラジオについて教えてください",
    "起床はどうですか",
    "日中はどうですか",
    "食事はどうですか",
    "薬はどうですか",
    "薬の自己管理について",
    "同室の方について",
    "SSTについて",
    "作業療法について",
    "叔父さんについて",
    "お母さんについて",
    "ご家族について",
    "お金について",
    "退院について",
    "入院生活について",
    "体重について",
    "便秘について",
    "入浴について",
    "得意なことは",
    "趣味について",
    "大切にしていることは",
    "不安なことは",
  ];
  const corpus: string[] = [];
  let s = greet();
  corpus.push(reply(s));
  for (const p of PROBES) {
    for (let i = 0; i < 4; i++) {
      s = sayA(s, p);
      corpus.push(reply(s));
    }
  }
  const joined = corpus.join("\n");

  const noForbidden = FORBIDDEN_CLINICAL_VOCAB.every((w) => !joined.includes(w));
  check("禁止された臨床分析用語が応答に現れない", noForbidden);

  const withinLength = corpus.every((r) => r.length <= 130);
  check("応答の長さが妥当な範囲（<=130字）", withinLength);

  const hesitationOk = corpus.every((r) => ellipsisRuns(r) <= 2);
  check("ためらい記号（……）が過剰でない（<=2/応答）", hesitationOk);

  const anchors = ["ラジオ", "Iさん", "叔父", "安心"];
  const voices = joined.includes("声") || joined.includes("幻聴");
  check("canon 保持: 幻聴/声が現れる", voices);
  check(
    "canon 保持: ラジオ・Iさん・叔父・安心が現れる",
    anchors.every((a) => joined.includes(a)),
  );
}

console.log(`\nConversation naturalness validation: ${failures} failed`);
if (failures > 0) {
  console.error("Some conversation naturalness checks FAILED.");
  process.exit(1);
} else {
  console.log("All conversation naturalness checks passed.");
}
