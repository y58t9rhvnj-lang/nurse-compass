import {
  advanceConversation,
  getDisplayTopicResources,
  initialFacingState,
  requestCoachConsultation,
  type FacingConvoState,
} from "../lib/patientFacingData";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`[OK]   ${label}`);
  } else {
    console.error(`[FAIL] ${label}`);
    failures += 1;
  }
}

function say(state: FacingConvoState, text: string): FacingConvoState {
  return advanceConversation("A", state, text);
}
function displayedTopic(state: FacingConvoState): string | null {
  return getDisplayTopicResources(state)?.topicId ?? null;
}

// ---- Bug1: 成功ターン後に hintLevel === 0 ----
{
  let s = initialFacingState();
  s = say(s, "おはようございます");
  s = requestCoachConsultation(s);
  check("相談後 hintLevel === 1", s.hintLevel === 1);
  s = say(s, "今日の調子はいかがですか？");
  check("成功ターン後 hintLevel === 0", s.hintLevel === 0);
}

// ---- Bug1: unknown では Coach を閉じない ----
{
  let s = initialFacingState();
  s = say(s, "おはようございます");
  s = requestCoachConsultation(s);
  s = say(s, "★意味不明な入力★");
  check("unknown 後も hintLevel >= 1", s.hintLevel >= 1);
}

// ---- Bug2: A 話題別 relatedResources ----
{
  let s = initialFacingState();
  s = say(s, "おはようございます");
  s = say(s, "今日の調子はいかがですか？");

  // 睡眠を深める（sufficientAt 3）
  s = say(s, "昨日はよく眠れましたか？");
  s = say(s, "夜中に目が覚めることはありましたか？");
  s = say(s, "眠れないとき、気になることはありますか？");
  check("睡眠深掘り後に睡眠リソース表示", displayedTopic(s) === "sleep");

  // 服薬へ切替（level0 のみ→まだ未解放、睡眠は消える）
  s = say(s, "お薬は飲めていますか？");
  check("服薬切替直後は睡眠カードが消える", displayedTopic(s) !== "sleep");
  check("服薬 level0 では未解放（表示なし）", displayedTopic(s) === null);

  // 服薬を十分に深める（sufficientAt 2）
  s = say(s, "お薬で困っていることはありますか？");
  check("服薬深掘り後に服薬リソース表示", displayedTopic(s) === "medication");

  // 趣味へ切替・深掘り（sufficientAt 1）
  s = say(s, "詰将棋");
  check("趣味切替後は服薬カードが消える", displayedTopic(s) !== "medication");
  check("趣味深掘り後に趣味リソース表示", displayedTopic(s) === "hobby");

  // 家族を深掘り（sufficientAt 1）
  s = say(s, "お母さんは面会に来ますか？");
  check("家族深掘り後に家族リソース表示", displayedTopic(s) === "family");

  // 再び睡眠へ戻る（解放済み）
  s = say(s, "昨日はよく眠れましたか？");
  check("睡眠へ戻ると解放済み睡眠リソース再表示", displayedTopic(s) === "sleep");
}

// ---- E: 主要話題（self_blame）で解放 ----
{
  let s = initialFacingState();
  s = advanceConversation("E", s, "おはようございます");
  s = advanceConversation("E", s, "今、どんなことがつらいですか？");
  s = advanceConversation("E", s, "ご家族のことも、気にされていますか？");
  check(
    "E: self_blame 深掘り後にリソース表示",
    getDisplayTopicResources(s)?.topicId === "self_blame",
  );
}

// ---- F: 主要話題（medication）で解放 ----
{
  let s = initialFacingState();
  s = advanceConversation("F", s, "おはようございます");
  s = advanceConversation("F", s, "お薬は飲めていますか？");
  s = advanceConversation("F", s, "お薬で困っていることはありますか？");
  check(
    "F: medication 深掘り後にリソース表示",
    getDisplayTopicResources(s)?.topicId === "medication",
  );
}

console.log(`\nCoach behavior validation: ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("All Coach behavior checks passed.");
