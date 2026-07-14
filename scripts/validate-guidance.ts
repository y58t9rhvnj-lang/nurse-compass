import {
  advanceConversation,
  getCoachFocus,
  getDisplayTopicResources,
  getGuidanceState,
  getResourceMessage,
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
  s = sayA(s, "好きなことは、ありますか？"); // 楽しみへ移動
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
  s = sayA(s, "好きなことは、ありますか？"); // 離脱→sleep pending
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
  s = sayA(s, "好きなことは、ありますか？");
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

// ---- Task 6: Coach は根拠（カルテ）へ導き、結論（診断/アセスメント）を言わない ----
{
  // 根拠へ導く語（看護記録・フローシート・診療録・サマリー・生活歴 など）を含む。
  const evidenceWords = ["看護記録", "フローシート", "診療録", "サマリー", "生活歴", "処方"];
  const sleepMsg = getResourceMessage("sleep");
  check(
    "睡眠の関連メッセージが根拠（看護記録/フローシート）へ導く",
    sleepMsg.includes("看護記録") || sleepMsg.includes("フローシート"),
  );
  const dischargeMsg = getResourceMessage("discharge");
  check(
    "退院の関連メッセージが生活歴・現在サマリーへ導く",
    dischargeMsg.includes("生活歴") && dischargeMsg.includes("サマリー"),
  );

  // 禁止：結論的な診断・アセスメント表現（例：睡眠障害ですね／自己効力感が低いですね）。
  const forbidden = ["障害ですね", "自己効力感", "アセスメント", "看護問題", "と診断"];
  const topics = [
    "sleep",
    "hallucination",
    "medication",
    "med_selfmgmt",
    "discharge",
    "hospital",
    "roommate",
    "uncle",
    "weight",
  ];
  let anyForbidden = false;
  for (const t of topics) {
    const msg = getResourceMessage(t);
    if (forbidden.some((f) => msg.includes(f))) anyForbidden = true;
    // 各メッセージは少なくとも一つの根拠語を含む（結論ではなく根拠へ導く）。
    check(`関連メッセージが根拠へ導く（${t}）`, evidenceWords.some((w) => msg.includes(w)));
  }
  check("関連メッセージに結論的な診断/アセスメント表現がない", !anyForbidden);

  // return guidance（一区切り→pending睡眠へ戻す）も根拠へ導く表現である。
  let s = initialFacingState();
  s = sayA(s, "おはようございます");
  s = sayA(s, "昨日はよく眠れましたか？");
  s = sayA(s, "お薬は飲めていますか？");
  s = sayA(s, "お薬で困っていることはありますか？");
  const rf = getCoachFocus("A", s);
  check(
    "睡眠へのreturn guidanceが根拠（看護記録/フローシート）へ導く",
    rf.kind === "return" &&
      (rf.direction.includes("看護記録") || rf.direction.includes("フローシート")),
  );
  check(
    "return guidanceに結論的表現がない",
    !forbidden.some((f) => rf.direction.includes(f)),
  );
}

console.log(`\nConversation guidance validation: ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("All conversation guidance checks passed.");
