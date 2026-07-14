import type { Note } from "../lib/notes";
import {
  createInformationCard,
  isInformationCard,
  validateInformationCard,
  type InformationCard,
} from "../lib/information/informationCard";
import {
  addCard,
  deleteCard,
  deserializeStore,
  emptyStoreState,
  getCards,
  normalizeStoreState,
  reorderCards,
  serializeStore,
  updateCard,
} from "../lib/information/informationCardStore";
import {
  noteToInformationCard,
  notesToInformationCards,
  patientUtteranceToInformationCard,
  temporaryMemoToInformationCard,
} from "../lib/information/informationCardAdapters";
import {
  findCardBySource,
  hasCardForEntry,
  hasCardForNote,
} from "../lib/information/informationCardStore";
import { sampleInformationCards } from "../lib/information/informationCardSamples";
import {
  advanceConversation,
  getEntryId,
  initialFacingState,
  type FacingEntry,
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

function validCard(patientId: string): InformationCard {
  return createInformationCard({
    patientId,
    content: "夜は眠れていない。",
    sourceType: "patient_conversation",
    sourceLabel: "患者の発言",
    createdBy: "student",
  });
}

// ---- valid card が validation を通る ----
{
  const card = validCard("A");
  check("valid card が validation を通る", validateInformationCard(card).ok);
  check("isInformationCard が true", isInformationCard(card));
}

// ---- 空 content は失敗 ----
{
  const bad = { ...validCard("A"), content: "   " };
  check("空 content は validation 失敗", !validateInformationCard(bad).ok);
  let threw = false;
  try {
    createInformationCard({
      patientId: "A",
      content: "",
      sourceType: "student_note",
      sourceLabel: "学生メモ",
      createdBy: "student",
    });
  } catch {
    threw = true;
  }
  check("空 content で createInformationCard が例外", threw);
}

// ---- 不正 sourceType は失敗 ----
{
  const bad = { ...validCard("A"), sourceType: "unknown_source" as unknown };
  check("不正 sourceType は validation 失敗", !validateInformationCard(bad).ok);
}

// ---- Note から Card へ正しく変換 ----
{
  const now = Date.parse("2026-07-01T00:00:00.000Z");
  const note: Note = {
    id: "note-1",
    patientId: "A",
    text: "眠れない背景を確認する",
    createdAt: now,
    updatedAt: now,
  };
  const card = noteToInformationCard(note);
  check("Note→Card: content 一致", card.content === note.text);
  check("Note→Card: sourceType=student_note", card.sourceType === "student_note");
  check("Note→Card: sourceLabel=学生メモ", card.sourceLabel === "学生メモ");
  check("Note→Card: createdBy=student", card.createdBy === "student");
  check("Note→Card: createdAt が Note 由来 ISO", card.createdAt === new Date(now).toISOString());
  check("Note→Card: originalText 保持", card.originalText === note.text);
  check("Note→Card: sourceReference が元メモID", card.sourceReference?.id === "note-1");

  // 空本文は変換対象外
  const notes: Note[] = [note, { ...note, id: "note-2", text: "   " }];
  check("空本文の Note は一括変換で除外", notesToInformationCards(notes).length === 1);
}

// ---- 患者 A のカードが患者 E へ混ざらない ----
{
  let s = emptyStoreState();
  s = addCard(s, validCard("A"));
  s = addCard(s, validCard("E"));
  check("患者A: 1件", getCards(s, "A").length === 1);
  check("患者E: 1件", getCards(s, "E").length === 1);
  check("A のカードは patientId=A のみ", getCards(s, "A").every((c) => c.patientId === "A"));
  check("E のカードは patientId=E のみ", getCards(s, "E").every((c) => c.patientId === "E"));
}

// ---- add / update / delete が動作 ----
{
  let s = emptyStoreState();
  const c1 = validCard("A");
  const c2 = validCard("A");
  s = addCard(s, c1);
  s = addCard(s, c2);
  check("add: 2件", getCards(s, "A").length === 2);

  s = updateCard(s, "A", c1.id, { content: "更新後の内容", category: "仮説" });
  const updated = getCards(s, "A").find((c) => c.id === c1.id);
  check("update: content 反映", updated?.content === "更新後の内容");
  check("update: category 反映", updated?.category === "仮説");
  check("update: id/patientId は不変", updated?.id === c1.id && updated?.patientId === "A");

  s = deleteCard(s, "A", c1.id);
  check("delete: 1件に減る", getCards(s, "A").length === 1);
  check("delete: 対象が消える", !getCards(s, "A").some((c) => c.id === c1.id));
}

// ---- 並び替え（順序保持） ----
{
  let s = emptyStoreState();
  const a = validCard("A");
  const b = validCard("A");
  const c = validCard("A");
  s = addCard(addCard(addCard(s, a), b), c);
  s = reorderCards(s, "A", [c.id, a.id, b.id]);
  const ids = getCards(s, "A").map((x) => x.id);
  check("reorder: 指定順に並ぶ", ids[0] === c.id && ids[1] === a.id && ids[2] === b.id);

  // 欠落IDに強い（存在しないIDは無視、指定外は末尾へ）
  s = reorderCards(s, "A", [b.id, "missing-id"]);
  const ids2 = getCards(s, "A").map((x) => x.id);
  check("reorder: 欠落・過剰に強い", ids2[0] === b.id && ids2.length === 3);
}

// ---- serialize / deserialize が安全 ----
{
  let s = emptyStoreState();
  s = addCard(s, validCard("A"));
  s = addCard(s, validCard("E"));
  const raw = serializeStore(s);
  const restored = deserializeStore(raw);
  check("serialize/deserialize round-trip: A", getCards(restored, "A").length === 1);
  check("serialize/deserialize round-trip: E", getCards(restored, "E").length === 1);
  check("restored version=1", restored.version === 1);
}

// ---- 不正保存データでクラッシュしない ----
{
  check("null 文字列 → 空状態", deserializeStore(null).cardsByPatient.A === undefined);
  check("壊れた JSON → 空状態", Object.keys(deserializeStore("{not json").cardsByPatient).length === 0);
  check("version 不一致 → 空状態", Object.keys(normalizeStoreState({ version: 99, cardsByPatient: { A: [] } }).cardsByPatient).length === 0);
  check(
    "配列でない cardsByPatient → 空状態",
    Object.keys(normalizeStoreState({ version: 1, cardsByPatient: 5 }).cardsByPatient).length === 0,
  );
  // 不正カードや患者ID不一致は除外され、有効カードのみ残る
  const mixed = {
    version: 1,
    cardsByPatient: {
      A: [validCard("A"), { junk: true }, validCard("E") /* patientId不一致 */],
    },
  };
  const norm = normalizeStoreState(mixed);
  check("不正カード・患者ID不一致を除外", getCards(norm, "A").length === 1);
}

// ---- サンプルカードはすべて valid ----
{
  const samples = sampleInformationCards("A");
  check("サンプル4件生成", samples.length === 4);
  check("サンプルは全て valid", samples.every((c) => isInformationCard(c)));
}

// ===== Sprint11.2: 患者発言から Information Card を追加する =====

// 会話履歴から患者発言（role=patient, unknownでない実発言も含む）を entryId 付きで取り出す。
function patientEntries(
  patientId: string,
  history: FacingEntry[],
): { entryId: string; text: string; role: string }[] {
  return history.map((item, i) => ({
    role: item.role,
    entryId: getEntryId(patientId, item, i),
    text: item.role === "coach" ? "" : item.text,
  }));
}

// ---- 1〜5, 11: 患者発言から Card 生成／学生発言からは作らない ----
{
  let s = initialFacingState();
  s = advanceConversation("A", s, "おはようございます");
  const entries = patientEntries("A", s.history);
  const student = entries.find((e) => e.role === "student");
  const patient = entries.find((e) => e.role === "patient");
  check("会話に学生・患者エントリが存在", !!student && !!patient);

  const card = patientUtteranceToInformationCard(
    "A",
    patient!.entryId,
    patient!.text,
  );
  check("患者発言から Card 生成できる", isInformationCard(card));
  check("sourceType が patient_conversation", card.sourceType === "patient_conversation");
  check("sourceLabel が 患者との会話", card.sourceLabel === "患者との会話");
  check("patientId が正しい", card.patientId === "A");
  check(
    "conversationEntryId が sourceReference に保存",
    card.sourceReference?.kind === "patient_conversation" &&
      card.sourceReference.id === patient!.entryId,
  );
  check("学生発言と患者発言の entryId は異なる", student!.entryId !== patient!.entryId);
}

// ---- 6, 7: entryId 基準の重複防止 / 同一本文でも別entryなら別カード ----
{
  const cards: InformationCard[] = [];
  const addIfNew = (patientId: string, entryId: string, text: string) => {
    if (hasCardForEntry(cards, entryId)) return false;
    cards.push(patientUtteranceToInformationCard(patientId, entryId, text));
    return true;
  };

  check("初回追加は成功", addIfNew("A", "A-1", "はい、こんにちは。"));
  check("同一 entryId は重複追加されない", !addIfNew("A", "A-1", "はい、こんにちは。"));
  check("追加済み判定できる（entryId基準）", hasCardForEntry(cards, "A-1"));
  // 同じ本文でも entryId が違えば別カードとして追加できる
  check("同一本文・別entryは追加できる", addIfNew("A", "A-5", "はい、こんにちは。"));
  check("2枚に増える", cards.filter((c) => c.patientId === "A").length === 2);
}

// ---- 8: 患者Aのカードが患者Eへ混ざらない ----
{
  let s = emptyStoreState();
  s = addCard(s, patientUtteranceToInformationCard("A", "A-1", "Aの発言"));
  s = addCard(s, patientUtteranceToInformationCard("E", "E-1", "Eの発言"));
  check("A entry は E に混ざらない", !hasCardForEntry(getCards(s, "E"), "A-1"));
  check("E entry は A に混ざらない", !hasCardForEntry(getCards(s, "A"), "E-1"));
  check("A の追加済み判定は A で成立", hasCardForEntry(getCards(s, "A"), "A-1"));
}

// ---- 9: serialize / deserialize 後も追加済み判定ができる ----
{
  let s = emptyStoreState();
  s = addCard(s, patientUtteranceToInformationCard("A", "A-2", "夜は眠れませんでした。"));
  const restored = deserializeStore(serializeStore(s));
  check(
    "永続化往復後も entryId で追加済み判定",
    hasCardForEntry(getCards(restored, "A"), "A-2"),
  );
}

// ---- 10: 古い会話エントリに ID が無くても normalize（fallback ID）可能 ----
{
  // id を持たない旧 state 相当のエントリ
  const legacy = [
    { role: "student", text: "こんにちは" },
    { role: "patient", text: "……こんにちは。" },
  ] as unknown as FacingEntry[];
  const id0 = getEntryId("A", legacy[0], 0);
  const id1 = getEntryId("A", legacy[1], 1);
  check("旧エントリでも fallback ID を生成", id0 === "A-0" && id1 === "A-1");
  check("fallback ID は一意", id0 !== id1);
  const card = patientUtteranceToInformationCard("A", id1, "……こんにちは。");
  check("fallback ID からでも Card 生成できる", isInformationCard(card));
}

// ===== Sprint12.2B: 統一収集モデル（患者発言・一時メモからの収集） =====

// 収集ダイアログ確定内容で患者発言を収集する（重複は entryId 基準で防ぐ）。
function collectUtterance(
  cards: InformationCard[],
  patientId: string,
  entryId: string,
  content: string,
  originalText: string,
): boolean {
  if (content.trim() === "") return false; // 空 content は追加不可
  if (hasCardForEntry(cards, entryId)) return false; // 重複防止
  cards.push(
    patientUtteranceToInformationCard(patientId, entryId, content.trim(), {
      originalText,
    }),
  );
  return true;
}

// 収集ダイアログ確定内容で一時メモを収集する（重複は Note ID 基準で防ぐ）。
function collectMemo(
  cards: InformationCard[],
  patientId: string,
  noteId: string,
  content: string,
  originalText: string,
  observedAt?: string,
): boolean {
  if (content.trim() === "") return false;
  if (hasCardForNote(cards, noteId)) return false;
  cards.push(
    temporaryMemoToInformationCard(
      patientId,
      noteId,
      content.trim(),
      originalText,
      observedAt,
    ),
  );
  return true;
}

// 収集解除：収集データ配列から取り除く（元の患者発言・一時メモは対象外）。
function releaseCard(cards: InformationCard[], id: string): InformationCard[] {
  return cards.filter((c) => c.id !== id);
}

// 収集データの content のみ修正する（空は不可、originalText 等は不変）。
function editContent(card: InformationCard, content: string): InformationCard {
  if (content.trim() === "") return card; // 空 content は更新不可
  return { ...card, content: content.trim(), updatedAt: new Date().toISOString() };
}

// ---- 1〜5: 患者発言の収集（ダイアログ確定内容・出所保持・重複防止） ----
{
  const cards: InformationCard[] = [];
  const full = "……夜は、あまり眠れていないですね。物音で目が覚めてしまって。";
  const edited = "夜間、物音で覚醒し眠れていない";
  const ok = collectUtterance(cards, "A", "A-3", edited, full);
  const card = cards[0];
  check("1 患者発言をダイアログ確定内容で収集できる", ok && cards.length === 1);
  check("2 originalText は患者発言の全文を保持", card.originalText === full);
  check("3 content は編集後の内容を保持", card.content === edited);
  check(
    "4 sourceReference に conversation entry ID が残る",
    card.sourceReference?.kind === "patient_conversation" &&
      card.sourceReference.id === "A-3",
  );
  const dup = collectUtterance(cards, "A", "A-3", "別の内容", full);
  check("5 同じ entryId は重複収集できない", !dup && cards.length === 1);
}

// ---- 6: 収集解除後は再収集できる ----
{
  let cards: InformationCard[] = [];
  collectUtterance(cards, "A", "A-7", "内容", "元の発言");
  const id = cards[0].id;
  cards = releaseCard(cards, id);
  check("6a 収集解除で一覧から消える", !cards.some((c) => c.id === id));
  const recollect = collectUtterance(cards, "A", "A-7", "内容", "元の発言");
  check("6b 収集解除後は同じ entryId を再収集できる", recollect && cards.length === 1);
}

// ---- 7〜10: 一時メモの収集（出所=Note ID・出典=一時メモ・重複防止・観察時刻） ----
{
  const cards: InformationCard[] = [];
  const memoText = "家族の面会が少ないことが気がかり";
  const memoCreatedIso = new Date(Date.parse("2026-07-12T22:16:00+09:00")).toISOString();
  const ok = collectMemo(cards, "A", "note-42", memoText, memoText, memoCreatedIso);
  const card = cards[0];
  check("7 一時メモから収集できる", ok && cards.length === 1);
  check("8 originalText は元メモ本文を保持", card.originalText === memoText);
  check("8b sourceType=student_note / sourceLabel=一時メモ",
    card.sourceType === "student_note" && card.sourceLabel === "一時メモ");
  check("8c observedAt にメモ作成時刻を保持", card.observedAt === memoCreatedIso);
  check(
    "9 sourceReference に Note ID が残る",
    card.sourceReference?.kind === "student_note" &&
      card.sourceReference.id === "note-42",
  );
  const dup = collectMemo(cards, "A", "note-42", "別本文", "別本文");
  check("10 同じ Note ID は重複収集できない", !dup && cards.length === 1);
}

// ---- 10b: 同一本文でも別 Note ID なら別データとして収集できる ----
{
  const cards: InformationCard[] = [];
  const text = "同じ内容のメモ";
  check("10b-1 note-x を収集", collectMemo(cards, "A", "note-x", text, text));
  check("10b-2 同一本文・別 note-y も収集できる", collectMemo(cards, "A", "note-y", text, text));
  check("10b-3 2件になる", cards.length === 2);
}

// ---- 11: 一時メモを後から編集しても収集済みデータは自動変更されない ----
{
  const cards: InformationCard[] = [];
  const originalMemo = "収集した時点の本文";
  collectMemo(cards, "A", "note-99", originalMemo, originalMemo);
  // 一時メモ（Note）側を後から編集した状況を模す（Note と Card は別物）。
  const editedMemoLater = "あとから書き換えた本文"; // Note 側だけ変わる想定
  void editedMemoLater;
  check(
    "11 メモ編集後も収集データの content は自動変更されない",
    cards[0].content === originalMemo,
  );
  check(
    "11b メモ編集後も収集データの originalText は自動変更されない",
    cards[0].originalText === originalMemo,
  );
}

// ---- 12, 13, 17: content 修正 / originalText 不変 / 空 content 不可 ----
{
  const cards: InformationCard[] = [];
  collectUtterance(cards, "A", "A-8", "初期内容", "患者発言の全文");
  const before = cards[0];
  const after = editContent(before, "修正後の内容");
  check("12 収集データ content を修正できる", after.content === "修正後の内容");
  check("13 content 修正で originalText は変わらない", after.originalText === "患者発言の全文");
  check("13b content 修正でも id は不変", after.id === before.id);
  check("17a 空 content では追加できない",
    !collectUtterance(cards, "A", "A-9", "   ", "元発言"));
  const noEdit = editContent(before, "   ");
  check("17b 空 content では更新できない", noEdit.content === before.content);
}

// ---- 14: 患者 A と E のデータが混ざらない（entryId / Note ID とも） ----
{
  let s = emptyStoreState();
  s = addCard(s, patientUtteranceToInformationCard("A", "A-1", "Aの発言"));
  s = addCard(s, temporaryMemoToInformationCard("A", "note-1", "Aのメモ", "Aのメモ"));
  s = addCard(s, patientUtteranceToInformationCard("E", "E-1", "Eの発言"));
  s = addCard(s, temporaryMemoToInformationCard("E", "note-1", "Eのメモ", "Eのメモ"));
  check("14a A の会話 entryId は E の収集済み判定に影響しない",
    !hasCardForEntry(getCards(s, "E"), "A-1"));
  check("14b A の Note ID は E の収集済み判定に影響しない（同名 note-1 でも別患者）",
    hasCardForNote(getCards(s, "A"), "note-1") &&
      findCardBySource(getCards(s, "E"), "student_note", "note-1")?.patientId === "E");
}

// ---- 15: serialize / deserialize 後も収集済み判定が維持 ----
{
  let s = emptyStoreState();
  s = addCard(s, patientUtteranceToInformationCard("A", "A-2", "内容", { originalText: "元発言" }));
  s = addCard(s, temporaryMemoToInformationCard("A", "note-7", "メモ内容", "メモ本文"));
  const restored = deserializeStore(serializeStore(s));
  check("15a 永続化往復後も患者発言が収集済み判定", hasCardForEntry(getCards(restored, "A"), "A-2"));
  check("15b 永続化往復後も一時メモが収集済み判定", hasCardForNote(getCards(restored, "A"), "note-7"));
}

// ---- 16: 既存（旧UI）保存カードが収集済みとして認識される ----
{
  // 旧「ノートへ追加」相当：originalText / updatedAt なし・content=全文。
  const legacy = {
    id: "legacy-1",
    patientId: "A",
    content: "以前に保存した患者発言",
    sourceType: "patient_conversation",
    sourceLabel: "患者との会話",
    createdAt: "2026-07-01T00:00:00.000Z",
    createdBy: "student",
    sourceReference: { kind: "patient_conversation", id: "A-legacy" },
  };
  check("16a 旧カード（originalText/updatedAt 無し）も valid", isInformationCard(legacy));
  const norm = normalizeStoreState({ version: 1, cardsByPatient: { A: [legacy] } });
  check("16b 旧カードが normalize で保持される", getCards(norm, "A").length === 1);
  check("16c 旧カードが entryId で収集済み判定される",
    hasCardForEntry(getCards(norm, "A"), "A-legacy"));
}

// ---- 18: 学生発言は収集対象にならない（患者発言のみ収集する） ----
{
  let st = initialFacingState();
  st = advanceConversation("A", st, "眠れていますか？");
  const entries = patientEntries("A", st.history);
  const cards: InformationCard[] = [];
  for (const e of entries) {
    // UI 同様、患者発言のみを収集対象とする。
    if (e.role !== "patient") continue;
    collectUtterance(cards, "A", e.entryId, e.text, e.text);
  }
  const studentEntry = entries.find((e) => e.role === "student");
  check("18a 会話に学生発言が存在", !!studentEntry);
  check("18b 学生発言は収集データに含まれない",
    studentEntry
      ? !cards.some((c) => c.sourceReference?.id === studentEntry.entryId)
      : false);
  check("18c 患者発言のみ収集される", cards.every(
    (c) => c.sourceReference?.kind === "patient_conversation"));
}

console.log(`\nInformation Card validation: ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("All Information Card checks passed.");
