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
} from "../lib/information/informationCardAdapters";
import { sampleInformationCards } from "../lib/information/informationCardSamples";

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

console.log(`\nInformation Card validation: ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("All Information Card checks passed.");
