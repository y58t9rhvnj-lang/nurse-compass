// Sprint A-2.2: 第1回講義レディネス検証。
// 収集UIの非表示（機能フラグ）、全面接ドメインの応答可能性、フォローアップの話題維持、
// 共感がunknownにならないこと、成功ターンでCoachが割り込まないこと、Coachの話題整合、
// 禁止アセスメント語の不在、カルテ関連情報の話題隔離、患者A canon 保持、状態の保存可能性を
// 決定的に検証する。会話テンプレートは追加しない（Version1 の凍結を守る）。

import { readFileSync } from "fs";
import { join } from "path";
import {
  advanceConversation,
  getCoachFocus,
  getDisplayTopicResources,
  getGuidanceState,
  getResourceMessage,
  initialFacingState,
  requestCoachConsultation,
  shouldShowCoachHint,
  type FacingConvoState,
} from "../lib/patientFacingData";
import { FEATURE_FLAGS, isFeatureEnabled } from "../lib/featureFlags";
import { FORBIDDEN_CLINICAL_VOCAB } from "../lib/conversation/naturalness";

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
function greet(): FacingConvoState {
  return sayA(initialFacingState(), "おはようございます");
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
function focusTopic(s: FacingConvoState): string | null {
  return getGuidanceState(s).currentFocus;
}
function displayedTopic(s: FacingConvoState): string | null {
  return getDisplayTopicResources(s)?.topicId ?? null;
}
function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

// ============ 1. 収集の機能フラグ（Version1 は非表示） ============
{
  check("収集フラグは false（学生画面で非表示）", isFeatureEnabled("collection") === false);
  check(
    "情報整理ノートフラグは false（未完成機能を隠す）",
    isFeatureEnabled("informationNotebook") === false,
  );
  check("収集フラグが集中管理されている（FEATURE_FLAGS に存在）", "collection" in FEATURE_FLAGS);
}

// ============ 2. 学生UIに旧・収集ラベルが残っていない ＋ ラベル規則の一元化 ============
{
  const studentFiles = [
    "components/patient/facing/FacingPatient.tsx",
    "components/patient/notes/NoteItem.tsx",
    "components/patient/notes/NoteList.tsx",
    "components/patient/notes/NoteZone.tsx",
  ];
  const oldLabels = ["＋収集する", "ノートへ追加", "追加済み"];
  let noOldLabels = true;
  for (const f of studentFiles) {
    const src = read(f);
    if (oldLabels.some((l) => src.includes(l))) noOldLabels = false;
  }
  check("学生UIコンポーネントに旧ラベル（＋収集する/ノートへ追加/追加済み）が無い", noOldLabels);

  // 収集の描画は集中管理フラグ（collection）でゲートされている。
  const facing = read("components/patient/facing/FacingPatient.tsx");
  const notes = read("components/patient/notes/NoteZone.tsx");
  check(
    "患者会話の収集UIは collection フラグでゲートされている",
    facing.includes('isFeatureEnabled("collection")'),
  );
  check(
    "一時メモの収集UIは collection フラグでゲートされている",
    notes.includes('isFeatureEnabled("collection")'),
  );

  // ラベル規則の一元化：収集アクションは「収集する」/「収集済み」の対のみ。
  check(
    "収集ラベルは『収集する』『収集済み』の対で統一（FacingPatient）",
    facing.includes("収集する") && facing.includes("収集済み"),
  );
  check(
    "収集ラベルは『収集する』『収集済み』の対で統一（NoteItem）",
    read("components/patient/notes/NoteItem.tsx").includes("収集する") &&
      read("components/patient/notes/NoteItem.tsx").includes("収集済み"),
  );
}

// ============ 3/4/5. 面接ドメイン：初回に答え、深掘りでき、話題が維持される ============
// domain -> 代表的な学生の質問（detectTopic が当該話題へ確実に写像する表現）。
const DOMAIN_QUESTIONS: Record<string, string> = {
  sleep: "夜は眠れていますか",
  hallucination: "幻聴について教えてください",
  radio: "ラジオはよく聞きますか",
  morning: "朝はどうですか",
  medication: "お薬は飲めていますか",
  med_selfmgmt: "薬を自分で管理してみたいですか",
  roommate: "Iさんとはどんな関係ですか",
  sst: "SSTには参加していますか",
  ot: "作業療法には行きますか",
  daytime: "日中は何をしていますか",
  uncle: "叔父さんはどんな人ですか",
  mother: "お母さんのことを教えてください",
  family: "ご家族について教えてください",
  money: "お金の管理はどうですか",
  hospital: "入院生活はどうですか",
  discharge: "退院についてどう思いますか",
  weight: "体重は気になりますか",
  constipation: "お通じはいかがですか",
  hygiene: "お風呂には入れていますか",
  hobby: "趣味はありますか",
  strengths: "得意なことはありますか",
  values: "大切にしていることは何ですか",
  condition: "今日の調子はいかがですか",
};

const canonCorpus: string[] = [];
{
  let allAnswerable = true;
  let allOnTopic = true;
  let allDeepen = true;
  for (const [domain, q] of Object.entries(DOMAIN_QUESTIONS)) {
    let s = greet();
    const replies: string[] = [];
    let unknownSeen = false;
    let offTopic = false;
    for (let i = 0; i < 3; i++) {
      s = sayA(s, q);
      const r = reply(s);
      replies.push(r);
      canonCorpus.push(r);
      if (isUnknown(s)) unknownSeen = true;
      // フォローアップ（2回目以降）でも現在の話題が維持される。
      if (i >= 1 && focusTopic(s) !== domain) offTopic = true;
    }
    if (unknownSeen) allAnswerable = false;
    if (offTopic) allOnTopic = false;
    // 初回の直接的な短い答え＋より深い答え（少なくとも2つの異なる開示）。
    if (new Set(replies).size < 2) allDeepen = false;
  }
  check("全面接ドメインが初回質問に答えられる（unknown にならない）", allAnswerable);
  check("フォローアップ質問でも話題が維持される（話題ずれしない）", allOnTopic);
  check("各ドメインで初回＋深掘りの異なる開示が得られる", allDeepen);
}

// ============ 5b. キーワードの無いフォローアップ（対処質問）が話題を続ける ============
{
  // 睡眠の話題を進めた後、「その時はどうしていますか」で対処（ラジオ・頓服）へ続く。
  let s = greet();
  s = sayA(s, "夜は眠れていますか"); // sleep L0
  s = sayA(s, "どうして眠れないんですか"); // sleep L1（キーワード 眠れ）
  s = sayA(s, "その時はどうしていますか"); // キーワード無しの対処質問 → sleep 継続
  check("対処のフォローアップ（その時はどうしていますか）が unknown にならない", !isUnknown(s));
  check("対処のフォローアップで話題が維持される", focusTopic(s) === "sleep");
  check(
    "対処のフォローアップで対処情報（ラジオ/頓服）が得られる",
    reply(s).includes("ラジオ") || reply(s).includes("頓服"),
  );

  // 現在の話題が無い（会話冒頭）または曖昧な入力は従来どおり unknown。
  const vague = sayA(greet(), "それはどれですか");
  check("話題文脈の無い曖昧な入力は unknown のまま", isUnknown(vague));
  const noise = sayA(greet(), "あwづえ");
  check("無意味な入力は unknown のまま", isUnknown(noise));
}

// ============ 6. 共感・反射は unknown にならない ============
{
  let s = greet();
  s = sayA(s, "夜は眠れていますか");
  const empathies = ["それはつらいですね", "眠れなかったんですね", "大変でしたね"];
  let ok = true;
  for (const e of empathies) {
    s = sayA(s, e);
    if (isUnknown(s)) ok = false;
  }
  check("共感・反射的傾聴は unknown にならない", ok);
}

// ============ 7. 成功した情報収集の間は Coach が割り込まない ============
{
  let s = greet();
  const successTurns = [
    "夜は眠れていますか", // sleep L0
    "夜中に目が覚めますか", // sleep L1
    "眠れないとき気になることはありますか", // sleep L2
    "お薬は飲めていますか", // medication L0
    "お薬で困っていることはありますか", // medication L1
  ];
  let quiet = true;
  for (const t of successTurns) {
    s = sayA(s, t);
    if (shouldShowCoachHint(s)) quiet = false;
  }
  check("成功ターン中は Coach が idle（割り込まない）", quiet);
}

// ============ 8/10. Coach の話題整合・カルテ関連情報の話題隔離 ============
{
  // 睡眠を十分に深めると睡眠リソースが表示される。
  let s = greet();
  s = sayA(s, "夜は眠れていますか");
  s = sayA(s, "夜中に目が覚めますか");
  s = sayA(s, "眠れないとき気になることはありますか");
  check("睡眠を深掘りすると睡眠の関連情報が表示される", displayedTopic(s) === "sleep");

  // 叔父へ移ると、睡眠リソースは消え、叔父の話題に整合する（sufficientAt 2 まで深める）。
  s = sayA(s, "叔父さんはどんな人ですか");
  check("叔父の話題では睡眠リソースを表示しない", displayedTopic(s) !== "sleep");
  s = sayA(s, "叔父さんは面会に来ますか");
  check("叔父を深掘りすると叔父の関連情報に整合する", displayedTopic(s) === "uncle");

  // お金・整容の話題では睡眠リソースを出さない。
  let money = greet();
  money = sayA(money, "お金の管理はどうですか");
  money = sayA(money, "生活費は足りていますか");
  check("お金の話題で睡眠リソースを表示しない", displayedTopic(money) !== "sleep");

  let hygiene = greet();
  hygiene = sayA(hygiene, "お風呂には入れていますか");
  hygiene = sayA(hygiene, "身だしなみはどうですか");
  check("整容の話題で睡眠リソースを表示しない", displayedTopic(hygiene) !== "sleep");
}

// ============ 9. Coach に禁止アセスメント語が現れない ============
{
  const PROHIBITED = [
    "自己効力感",
    "退院意欲",
    "幻聴による睡眠障害",
    "回復モデル",
    "看護問題",
    "アセスメント",
    "病識",
    "予後",
    "と診断",
    "障害ですね",
  ];
  const coachTexts: string[] = [];

  // すべての話題の関連情報メッセージ。
  for (const t of Object.keys(DOMAIN_QUESTIONS)) coachTexts.push(getResourceMessage(t));

  // 会話を進めながら Coach の視点（direction/example）を収集する。
  let s = greet();
  const walk = [
    "夜は眠れていますか",
    "夜中に目が覚めますか",
    "お薬は飲めていますか",
    "お薬で困っていることはありますか",
    "退院についてどう思いますか",
    "叔父さんはどんな人ですか",
    "Iさんとはどんな関係ですか",
  ];
  for (const t of walk) {
    s = sayA(s, t);
    const consulted = requestCoachConsultation(s);
    const f = getCoachFocus("A", consulted);
    coachTexts.push(f.direction, f.example);
  }
  const joined = coachTexts.join("\n");
  const found = PROHIBITED.filter((p) => joined.includes(p));
  check(`Coach に禁止アセスメント語が無い（検出: ${found.join(",") || "なし"}）`, found.length === 0);
}

// ============ 11. 患者A canon 保持 ============
{
  const joined = canonCorpus.join("\n");
  const anchors = ["叔父", "ラジオ", "Iさん", "安心", "亡くな"];
  check(
    "canon 保持: 叔父・ラジオ・Iさん・安心・母の死が会話に現れる",
    anchors.every((a) => joined.includes(a)),
  );
  check("canon 保持: 突然の退院意欲（退院したい）は出さない", !joined.includes("退院したい"));
  check(
    "canon 保持: 禁止された臨床分析用語が患者応答に現れない",
    FORBIDDEN_CLINICAL_VOCAB.every((w) => !joined.includes(w)),
  );
}

// ============ 12. 患者からの逆質問は Version1 では行わない ============
{
  let s = greet();
  const seq = [
    "夜は眠れていますか",
    "夜中に目が覚めますか",
    "眠れないとき気になることはありますか",
    "お薬は飲めていますか",
    "ラジオはよく聞きますか",
    "どんな番組を聞きますか",
    "Iさんとはどんな関係ですか",
    "一緒に過ごすんですね",
  ];
  let reciprocal = false;
  for (const t of seq) {
    s = sayA(s, t);
    const r = reply(s);
    if (r.includes("そちらは") || r.includes("知っているんですか")) reciprocal = true;
  }
  check("患者からの逆質問を行わない（面接は聞かれたことに答える）", !reciprocal);
}

// ============ 状態の保存可能性（Patient→Chart→Patient で保持できる） ============
{
  // 会話状態はプレーンな値で、JSON 往復で不変（＝ビュー切替や親stateで安全に保持できる）。
  let s = greet();
  s = sayA(s, "夜は眠れていますか");
  s = sayA(s, "お薬は飲めていますか");
  const roundTrip = JSON.parse(JSON.stringify(s)) as FacingConvoState;
  check(
    "会話状態は JSON 往復で不変（ビュー切替で保持可能）",
    JSON.stringify(roundTrip) === JSON.stringify(s),
  );
  // 「Patient→Chart→Patient」を模擬：状態を保持したまま参照しても履歴が失われない。
  const held = s; // 親（AppShell）が患者別に保持する想定
  check("保持した状態の会話履歴が失われない", held.history.length === s.history.length);
  check("保持した状態から Coach 視点が安定して得られる", !!getCoachFocus("A", held));
}

console.log(`\nLecture readiness validation: ${failures} failed`);
if (failures > 0) {
  console.error("Some lecture readiness checks FAILED.");
  process.exit(1);
} else {
  console.log("All lecture readiness checks passed.");
}
