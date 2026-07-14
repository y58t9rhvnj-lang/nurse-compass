// Sprint11.3A: 情報（OrganizedInformation）基盤の自動検証。
// UI を作らず、型・保存・履歴・検証・データ解決が仕様どおり動くことを確認する。

import {
  createInformationCard,
  type InformationCard,
} from "../lib/information/informationCard";
import {
  createOrganizedInformation,
  resolveSourceData,
  validateOrganizedInformation,
  validateSourceDataOwnership,
} from "../lib/organization/organizedInformation";
import {
  addSourceDataId,
  archiveInformation,
  createInformation,
  deserializeStore,
  emptyStoreState,
  getInformationById,
  getInformationByPatient,
  getRevisions,
  normalizeStoreState,
  removeSourceDataId,
  restoreInformation,
  serializeStore,
  updateInformationContent,
} from "../lib/organization/organizedInformationStore";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`[OK]   ${label}`);
  } else {
    console.error(`[FAIL] ${label}`);
    failures += 1;
  }
}

// 参照用のデータ（InformationCard）を id 指定で生成する。
function card(patientId: string, id: string): InformationCard {
  return createInformationCard({
    id,
    patientId,
    content: `${id} の発言内容`,
    sourceType: "patient_conversation",
    sourceLabel: "患者との会話",
    createdBy: "student",
  });
}

// ---- 1: 複数データから情報を作成できる ----
{
  const cards = [card("A", "d1"), card("A", "d2")];
  const { state, information } = createInformation(
    emptyStoreState(),
    {
      patientId: "A",
      title: "睡眠についての整理",
      content: "夜間覚醒が続いており、日中の眠気にもつながっている。",
      sourceDataIds: ["d1", "d2"],
    },
    { cards },
  );
  check("1: 複数データから情報を作成できる", information.sourceDataIds.length === 2);
  check("1: 患者Aに1件保存される", getInformationByPatient(state, "A").length === 1);
  check("1: revision=1 で作成される", information.revision === 1);
  check("1: createdBy=student", information.createdBy === "student");
}

// ---- 2: 1つのデータを複数情報で参照できる ----
{
  const cards = [card("A", "d1"), card("A", "d2")];
  let s = emptyStoreState();
  s = createInformation(
    s,
    { patientId: "A", title: "情報1", content: "内容1", sourceDataIds: ["d1"] },
    { cards },
  ).state;
  s = createInformation(
    s,
    { patientId: "A", title: "情報2", content: "内容2", sourceDataIds: ["d1"] },
    { cards },
  ).state;
  const all = getInformationByPatient(s, "A");
  check("2: 1つのデータを複数情報で参照できる", all.length === 2);
  check(
    "2: 両情報が同じ d1 を参照",
    all.every((i) => i.sourceDataIds.includes("d1")),
  );
}

// ---- 3: 同一情報内の重複 sourceDataId を拒否 ----
{
  let threw = false;
  try {
    createOrganizedInformation({
      patientId: "A",
      title: "t",
      content: "c",
      sourceDataIds: ["d1", "d1"],
    });
  } catch {
    threw = true;
  }
  check("3: create で重複 sourceDataId を拒否", threw);

  const cards = [card("A", "d1")];
  const { state, information } = createInformation(
    emptyStoreState(),
    { patientId: "A", title: "t", content: "c", sourceDataIds: ["d1"] },
    { cards },
  );
  let threw2 = false;
  try {
    addSourceDataId(state, "A", information.id, "d1", { cards });
  } catch {
    threw2 = true;
  }
  check("3: addSourceDataId で重複を拒否", threw2);
}

// ---- 4: 異なる患者データの参照を拒否 ----
{
  const own = validateSourceDataOwnership("A", ["e1"], [card("E", "e1")]);
  check("4: 患者不一致は ownership 検証で ok=false", !own.ok);

  let threw = false;
  try {
    createInformation(
      emptyStoreState(),
      { patientId: "A", title: "t", content: "c", sourceDataIds: ["e1"] },
      { cards: [card("E", "e1")] },
    );
  } catch {
    threw = true;
  }
  check("4: 異なる患者データ参照で create が失敗", threw);
}

// ---- 5: title / content 空を拒否 ----
{
  let t1 = false;
  try {
    createOrganizedInformation({
      patientId: "A",
      title: "   ",
      content: "c",
      sourceDataIds: ["d1"],
    });
  } catch {
    t1 = true;
  }
  check("5: 空 title を拒否", t1);

  let t2 = false;
  try {
    createOrganizedInformation({
      patientId: "A",
      title: "t",
      content: "   ",
      sourceDataIds: ["d1"],
    });
  } catch {
    t2 = true;
  }
  check("5: 空 content を拒否", t2);

  let t3 = false;
  try {
    createOrganizedInformation({
      patientId: "A",
      title: "t",
      content: "c",
      sourceDataIds: [],
    });
  } catch {
    t3 = true;
  }
  check("5: 空 sourceDataIds を拒否", t3);
}

// ---- 6: createdBy が student 以外なら失敗 ----
{
  const base = createOrganizedInformation({
    patientId: "A",
    title: "t",
    content: "c",
    sourceDataIds: ["d1"],
  });
  check(
    "6: createdBy=system は validation 失敗",
    !validateOrganizedInformation({ ...base, createdBy: "system" }).ok,
  );
  check(
    "6: createdBy=ai は validation 失敗",
    !validateOrganizedInformation({ ...base, createdBy: "ai" }).ok,
  );
  check(
    "6: revision<1 は validation 失敗",
    !validateOrganizedInformation({ ...base, revision: 0 }).ok,
  );
  check(
    "6: 空 patientId は validation 失敗",
    !validateOrganizedInformation({ ...base, patientId: "" }).ok,
  );
}

// ---- 7: 更新時に revision が増える ----
{
  const cards = [card("A", "d1")];
  const created = createInformation(
    emptyStoreState(),
    { patientId: "A", title: "t", content: "初期内容", sourceDataIds: ["d1"] },
    { cards },
  );
  const id = created.information.id;
  const s = updateInformationContent(created.state, "A", id, "更新後の内容");
  const cur = getInformationById(s, "A", id);
  check("7: 更新後 revision=2", cur?.revision === 2);
  check("7: content が反映される", cur?.content === "更新後の内容");
  check("7: updatedAt が文字列で保持", typeof cur?.updatedAt === "string");
}

// ---- 8: 更新前 revision が履歴へ残る ----
{
  const cards = [card("A", "d1")];
  const created = createInformation(
    emptyStoreState(),
    { patientId: "A", title: "t", content: "元の内容", sourceDataIds: ["d1"] },
    { cards },
  );
  const id = created.information.id;
  const s = updateInformationContent(created.state, "A", id, "新しい内容");
  const revs = getRevisions(s, id);
  check("8: 履歴が2件（rev1, rev2）", revs.length === 2);
  check("8: rev1 の内容は元のまま保持", revs[0].content === "元の内容");
  check("8: rev2 の内容は新しい内容", revs[1].content === "新しい内容");
  check(
    "8: rev2.previousRevisionId が rev1.id を指す",
    revs[1].previousRevisionId === revs[0].id,
  );
  check(
    "8: current.previousRevisionId が rev1.id を指す",
    getInformationById(s, "A", id)?.previousRevisionId === revs[0].id,
  );
}

// ---- 9: sourceDataId 追加・削除で履歴が残る ----
{
  const cards = [card("A", "d1"), card("A", "d2")];
  const created = createInformation(
    emptyStoreState(),
    { patientId: "A", title: "t", content: "c", sourceDataIds: ["d1"] },
    { cards },
  );
  const id = created.information.id;
  let s = addSourceDataId(created.state, "A", id, "d2", { cards });
  check("9: 追加で revision=2", getInformationById(s, "A", id)?.revision === 2);
  check(
    "9: sourceDataIds が [d1, d2]",
    JSON.stringify(getInformationById(s, "A", id)?.sourceDataIds) ===
      JSON.stringify(["d1", "d2"]),
  );
  s = removeSourceDataId(s, "A", id, "d1");
  check("9: 削除で revision=3", getInformationById(s, "A", id)?.revision === 3);
  check(
    "9: sourceDataIds が [d2]",
    JSON.stringify(getInformationById(s, "A", id)?.sourceDataIds) ===
      JSON.stringify(["d2"]),
  );
  const revs = getRevisions(s, id);
  check("9: 履歴が3件残る", revs.length === 3);
  check("9: rev1 は d1 のみ（過去が保存される）",
    JSON.stringify(revs[0].sourceDataIds) === JSON.stringify(["d1"]));
  check("9: rev2 は d1,d2", JSON.stringify(revs[1].sourceDataIds) === JSON.stringify(["d1", "d2"]));

  // 最後の1件を削除して 0 件になる更新は拒否される
  let threw = false;
  try {
    removeSourceDataId(s, "A", id, "d2");
  } catch {
    threw = true;
  }
  check("9: 参照0件になる削除は拒否", threw);
}

// ---- 10: archive / restore が動作する ----
{
  const cards = [card("A", "d1")];
  const created = createInformation(
    emptyStoreState(),
    { patientId: "A", title: "t", content: "c", sourceDataIds: ["d1"] },
    { cards },
  );
  const id = created.information.id;
  let s = archiveInformation(created.state, "A", id);
  check("10: archive で status=archived", getInformationById(s, "A", id)?.status === "archived");
  s = restoreInformation(s, "A", id);
  check("10: restore で status!=archived", getInformationById(s, "A", id)?.status !== "archived");
  check("10: archive/restore は revision を変えない", getInformationById(s, "A", id)?.revision === 1);
}

// ---- 11: serialize / deserialize 後も current と history が保持される ----
{
  const cards = [card("A", "d1"), card("A", "d2")];
  const created = createInformation(
    emptyStoreState(),
    { patientId: "A", title: "t", content: "c", sourceDataIds: ["d1"] },
    { cards },
  );
  const id = created.information.id;
  let s = updateInformationContent(created.state, "A", id, "second");
  s = addSourceDataId(s, "A", id, "d2", { cards });
  const restored = deserializeStore(serializeStore(s));
  check("11: 復元後 current の revision=3", getInformationById(restored, "A", id)?.revision === 3);
  check("11: 復元後 history 3件保持", getRevisions(restored, id).length === 3);
  check("11: 復元後 version=1", restored.version === 1);
}

// ---- 12: 不正 localStorage データでクラッシュしない ----
{
  check("12: null → 空", Object.keys(deserializeStore(null).currentByPatient).length === 0);
  check("12: 壊れた JSON → 空", Object.keys(deserializeStore("{oops").currentByPatient).length === 0);
  check(
    "12: version 不一致 → 空",
    Object.keys(
      normalizeStoreState({ version: 99, currentByPatient: { A: [] }, revisionsByInformationId: {} })
        .currentByPatient,
    ).length === 0,
  );
  const validInfo = createOrganizedInformation({
    patientId: "A",
    title: "t",
    content: "c",
    sourceDataIds: ["d1"],
  });
  const mixed = {
    version: 1,
    currentByPatient: {
      A: [validInfo, { junk: true }],
      E: [validInfo], // patientId 不一致（A の情報が E キーに混入）
    },
    revisionsByInformationId: {},
  };
  const norm = normalizeStoreState(mixed);
  check("12: 不正 info を除外", getInformationByPatient(norm, "A").length === 1);
  check("12: 患者ID不一致の混入を除外", getInformationByPatient(norm, "E").length === 0);
}

// ---- 13: resolveSourceData が順序を維持する ----
{
  const cards = [card("A", "x1"), card("A", "x2"), card("A", "x3")];
  const info = createOrganizedInformation({
    patientId: "A",
    title: "t",
    content: "c",
    sourceDataIds: ["x3", "x1", "x2"],
  });
  const res = resolveSourceData(info, cards);
  check(
    "13: resolve が sourceDataIds 順を維持",
    res.resolved.map((c) => c.id).join(",") === "x3,x1,x2",
  );
  check("13: 元カードを変更しない", cards[0].id === "x1" && cards[0].patientId === "A");
}

// ---- 14: 欠損 ID を安全に扱う ----
{
  const cards = [card("A", "x1"), card("A", "x2")];
  const info = createOrganizedInformation({
    patientId: "A",
    title: "t",
    content: "c",
    sourceDataIds: ["x1", "missing", "x2"],
  });
  const res = resolveSourceData(info, cards);
  check("14: 欠損IDをスキップ（2件解決）", res.resolved.length === 2);
  check("14: missingIds に報告", res.missingIds.includes("missing"));

  const infoAllMissing = createOrganizedInformation({
    patientId: "A",
    title: "t",
    content: "c",
    sourceDataIds: ["nope"],
  });
  check("14: 参照0件で hasNoSource=true", resolveSourceData(infoAllMissing, cards).hasNoSource);

  // 患者不一致は resolved から除外し mismatchedIds に報告
  const infoMismatch = createOrganizedInformation({
    patientId: "A",
    title: "t",
    content: "c",
    sourceDataIds: ["x1"],
  });
  const resMismatch = resolveSourceData(infoMismatch, [card("E", "x1")]);
  check(
    "14: 患者不一致を除外し mismatchedIds に報告",
    resMismatch.resolved.length === 0 && resMismatch.mismatchedIds.includes("x1"),
  );
}

// ---- 15: 患者Aの情報が患者Eへ混ざらない ----
{
  let s = emptyStoreState();
  s = createInformation(
    s,
    { patientId: "A", title: "A情報", content: "cA", sourceDataIds: ["d1"] },
    { cards: [card("A", "d1")] },
  ).state;
  s = createInformation(
    s,
    { patientId: "E", title: "E情報", content: "cE", sourceDataIds: ["e1"] },
    { cards: [card("E", "e1")] },
  ).state;
  check("15: 患者A 1件", getInformationByPatient(s, "A").length === 1);
  check("15: 患者E 1件", getInformationByPatient(s, "E").length === 1);
  check("15: Aの情報は patientId=A のみ", getInformationByPatient(s, "A").every((i) => i.patientId === "A"));
  check("15: Eの情報は patientId=E のみ", getInformationByPatient(s, "E").every((i) => i.patientId === "E"));
}

console.log(`\nOrganized Information validation: ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("All Organized Information checks passed.");
