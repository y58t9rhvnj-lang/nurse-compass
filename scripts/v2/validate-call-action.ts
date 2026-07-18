// Compass Version2 Sprint2-1 — callAction のロジック検証。
//
// 確認内容:
//   ・Action が正常な Result（ok:true）を返した場合、そのまま返す
//   ・Action が error Result（ok:false, kind）を返した場合、そのまま返す
//   ・Action の Promise が reject（TypeError＝通信断）した場合、network へ正規化
//   ・Action の Promise が reject（一般 Error）した場合、unexpected へ正規化
//   ・callAction 自体は決して reject しない（呼び出し側が saving/working を解除できる）
//   ・生の Error / stack / DB メッセージを画面向け message に載せない（固定文のみ）
//
// 実行: npx tsx scripts/v2/validate-call-action.ts
import {
  callAction,
  CALL_ACTION_MESSAGES,
  type ClientCallError,
} from "../../lib/v2/callAction";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`[OK]   ${label}`);
  else {
    console.error(`[FAIL] ${label}${detail ? ` (${detail})` : ""}`);
    failures += 1;
  }
}

type OkResult = { ok: true; data: string };
type ErrResult = { ok: false; kind: "validation" | "conflict"; message: string };

async function main() {
  // --- 1. 正常な Result はそのまま返る ---
  const ok = await callAction<OkResult>(async () => ({ ok: true, data: "x" }));
  check("正常 Result: ok=true をそのまま返す", ok.ok === true);
  check(
    "正常 Result: data を保持",
    ok.ok === true && (ok as OkResult).data === "x",
  );

  // --- 2. error Result はそのまま返る（正規化しない） ---
  const err = await callAction<OkResult | ErrResult>(async () => ({
    ok: false,
    kind: "validation",
    message: "server-side validation",
  }));
  check("error Result: ok=false をそのまま返す", err.ok === false);
  check(
    "error Result: サーバの kind を保持（network へ書き換えない）",
    err.ok === false && err.kind === "validation",
  );

  // --- 3. reject（TypeError = 通信断）は network へ正規化 ---
  const netTypeError = (await callAction<OkResult>(async () => {
    throw new TypeError("Failed to fetch");
  })) as ClientCallError;
  check("reject(TypeError): ok=false", netTypeError.ok === false);
  check("reject(TypeError): kind=network", netTypeError.kind === "network");
  check(
    "reject(TypeError): 固定の通信メッセージ",
    netTypeError.message === CALL_ACTION_MESSAGES.network,
  );

  // --- 3b. reject（network を示すメッセージ）も network へ ---
  const netByMessage = (await callAction<OkResult>(async () => {
    throw new Error("NetworkError when attempting to fetch resource");
  })) as ClientCallError;
  check("reject(network message): kind=network", netByMessage.kind === "network");

  // --- 4. reject（一般 Error）は unexpected へ ---
  const unexpected = (await callAction<OkResult>(async () => {
    throw new Error("boom: internal db pool exhausted stack...");
  })) as ClientCallError;
  check("reject(一般 Error): ok=false", unexpected.ok === false);
  check("reject(一般 Error): kind=unexpected", unexpected.kind === "unexpected");
  check(
    "reject(一般 Error): 固定メッセージ（生Errorを露出しない）",
    unexpected.message === CALL_ACTION_MESSAGES.unexpected &&
      !unexpected.message.includes("boom") &&
      !unexpected.message.includes("db"),
  );

  // --- 5. callAction 自体は reject しない（= 呼び出し側が working を解除できる） ---
  let threw = false;
  let settled: { ok: boolean } | null = null;
  try {
    settled = await callAction<OkResult>(async () => {
      throw new Error("unexpected throw");
    });
  } catch {
    threw = true;
  }
  check("callAction は reject しない（await が値で解決）", threw === false);
  check("解決値は Result 形（ok プロパティを持つ）", settled?.ok === false);

  // --- 6. 非 Error（文字列 throw / null throw）でも安全に処理 ---
  const stringThrow = (await callAction<OkResult>(async () => {
    throw "just a string";
  })) as ClientCallError;
  check("reject(string): 落ちずに正規化", stringThrow.ok === false);
  const nullThrow = (await callAction<OkResult>(async () => {
    throw null;
  })) as ClientCallError;
  check("reject(null): 落ちずに unexpected", nullThrow.kind === "unexpected");

  console.log("");
  if (failures === 0) {
    console.log("callAction 検証: すべてOK");
    process.exit(0);
  } else {
    console.error(`callAction 検証: ${failures} 件の失敗`);
    process.exit(1);
  }
}

void main();
