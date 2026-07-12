import {
  advanceConversation,
  getCoachFocus,
  getDisplayTopicResources,
  getGuidanceState,
  initialFacingState,
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

function sayA(state: FacingConvoState, text: string): FacingConvoState {
  return advanceConversation("A", state, text);
}
function pending(state: FacingConvoState): string[] {
  return getGuidanceState(state).pendingImportantTopics;
}
function focusTopic(state: FacingConvoState): string | null {
  return getGuidanceState(state).currentFocus;
}
function displayedTopic(state: FacingConvoState): string | null {
  return getDisplayTopicResources(state)?.topicId ?? null;
}

// ---- 重要テーマを途中で離れると pending へ入る ----
{
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "昨日はよく眠れましたか？"); // sleep level1 (< sufficientAt 3)
  check("睡眠を1段階だけ聞いた直後は現在focus（pendingでない）", !pending(s).includes("sleep"));
  s = sayA(s, "詰将棋"); // 趣味へ移動
  check("睡眠を途中で離れると pending に入る", pending(s).includes("sleep"));
}

// ---- 十分に深めたテーマは pending へ入らない ----
{
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "昨日はよく眠れましたか？");
  s = sayA(s, "夜中に目が覚めることはありましたか？");
  s = sayA(s, "眠れないとき、気になることはありますか？"); // sleep 3段階＝sufficient
  s = sayA(s, "お薬は飲めていますか？"); // 服薬へ移動
  check("十分に深めた睡眠は pending に入らない", !pending(s).includes("sleep"));
}

// ---- pending が重複しない ----
{
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "昨日はよく眠れましたか？");
  s = sayA(s, "詰将棋"); // 離脱→sleep pending
  s = sayA(s, "夜中に目が覚めることはありましたか？"); // sleepへ戻り再び1段階
  s = sayA(s, "作業療法には出ていますか？"); // 再離脱
  check(
    "pending に睡眠が重複登録されない",
    pending(s).filter((t) => t === "sleep").length === 1,
  );
}

// ---- 十分に深めると pending から消える ----
{
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "昨日はよく眠れましたか？");
  s = sayA(s, "詰将棋");
  check("離脱後 pending に睡眠あり", pending(s).includes("sleep"));
  s = sayA(s, "夜中に目が覚めることはありましたか？");
  s = sayA(s, "眠れないとき、気になることはありますか？"); // sleep sufficient
  check("十分に深めると pending から睡眠が消える", !pending(s).includes("sleep"));
}

// ---- currentFocus 進行中は return guidance を出さない ----
{
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "昨日はよく眠れましたか？"); // sleep 部分
  s = sayA(s, "お薬は飲めていますか？"); // 服薬 level1（sufficientAt 2 未満＝進行中）, sleep pending
  check("進行中の服薬では focus は medication", focusTopic(s) === "medication");
  check("服薬進行中は return guidance を出さない", getCoachFocus("A", s).kind !== "return");
}

// ---- currentFocus が一区切りつくと pending guidance 候補が得られる ----
{
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "昨日はよく眠れましたか？"); // sleep pending 候補
  s = sayA(s, "お薬は飲めていますか？");
  s = sayA(s, "お薬で困っていることはありますか？"); // 服薬 sufficient（一区切り）
  const focus = getCoachFocus("A", s);
  check("服薬が一区切り＋pendingで return guidance", focus.kind === "return");
  check("return 文面が睡眠へ自然に戻す", focus.direction.includes("睡眠"));
}

// ---- unknown 入力で currentFocus が変わらない ----
{
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "お薬は飲めていますか？"); // focus = medication
  s = sayA(s, "★意味不明★");
  check("unknown で currentFocus が変わらない", focusTopic(s) === "medication");
}

// ---- relatedResources が pending topic へ勝手に切り替わらない ----
{
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "昨日はよく眠れましたか？");
  s = sayA(s, "夜中に目が覚めることはありましたか？");
  s = sayA(s, "眠れないとき、気になることはありますか？"); // sleep 解放
  check("睡眠深掘り後は睡眠リソース表示", displayedTopic(s) === "sleep");
  s = sayA(s, "お薬は飲めていますか？"); // 服薬へ移動（sleep は解放済みだが現在focusではない）
  check("relatedResources は解放済み睡眠へ勝手に切り替わらない（現在focus基準）", displayedTopic(s) !== "sleep");
}

// ---- E: coreTheme（自責感）が離脱で pending に入る ----
{
  let s = initialFacingState();
  s = advanceConversation("E", s, "おはようございます");
  s = advanceConversation("E", s, "今、どんなことがつらいですか？"); // self_blame level1 (<2)
  s = advanceConversation("E", s, "夜はよく眠れていますか？"); // 睡眠へ移動
  check("E: 自責感が pending に入る", getGuidanceState(s).pendingImportantTopics.includes("self_blame"));
}

// ---- F: coreTheme（服薬）が離脱で pending に入る ----
{
  let s = initialFacingState();
  s = advanceConversation("F", s, "おはようございます");
  s = advanceConversation("F", s, "お薬は飲めていますか？"); // medication level1 (<2)
  s = advanceConversation("F", s, "昨日はどのくらい眠れましたか？"); // 睡眠へ移動
  check("F: 服薬が pending に入る", getGuidanceState(s).pendingImportantTopics.includes("medication"));
}

console.log(`\nConversation guidance validation: ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("All conversation guidance checks passed.");
