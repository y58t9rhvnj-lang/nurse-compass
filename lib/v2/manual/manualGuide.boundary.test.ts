/**
 * In-app V2.2 operation manual contract (source scan).
 * Run: ./node_modules/.bin/jiti lib/v2/manual/manualGuide.boundary.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  chaptersForAudience,
  flattenManualText,
  MANUAL_CATALOG,
} from "./catalog";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    throw e;
  }
}

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const nav = src("../../../components/SideNav.tsx");
const studentText = flattenManualText(chaptersForAudience("student"));
const viewer = src("../../../components/v2/manual/ManualViewer.tsx");
const studentLayout = src("../../../app/v2/student/guide/layout.tsx");

test("student left menu places 操作説明 after フィードバック", () => {
  const start = nav.indexOf("export const STUDENT_NAV_ITEMS");
  const items = nav.slice(start, nav.indexOf("export default function SideNav"));
  const feedback = items.indexOf('label: "フィードバック"');
  const guide = items.indexOf('label: "操作説明"');
  const box = items.indexOf('label: "情報BOX"');
  assert.ok(feedback >= 0);
  assert.ok(guide > feedback);
  assert.ok(box > guide);
  assert.ok(items.includes('href: "/v2/student/guide"'));
});

test("student guide has its own scroll root", () => {
  assert.ok(studentLayout.includes("data-manual-scroll-root"));
  assert.ok(studentLayout.includes("overflow-y-auto"));
  assert.ok(studentLayout.includes("h-dvh"));
  assert.equal(src("../../../app/globals.css").includes("data-manual-scroll-root"), false);
});

test("viewer is numbered-shot first and hides engineering copy", () => {
  assert.ok(viewer.includes("この画面でできること"));
  assert.equal(viewer.includes("どこから開くか"), false);
  assert.equal(viewer.includes("release/lecture-2026"), false);
  assert.equal(MANUAL_CATALOG.student[0] && "updatedLabel" in MANUAL_CATALOG, false);
});

test("manual images stay scrollable on touch and do not lock body", () => {
  const image = src("../../../components/v2/manual/ManualImage.tsx");
  assert.ok(image.includes("拡大する"));
  assert.ok(image.includes('touchAction: "pan-y"'));
  assert.ok(image.includes("pointer-events-none"));
  assert.equal(image.includes("document.body.style.overflow"), false);
  assert.equal(image.includes("overflow: hidden"), false);
});

test("student chapters cover required topics and current labels", () => {
  const ids = MANUAL_CATALOG.student.map((chapter) => chapter.id);
  for (const id of [
    "login",
    "ward-home",
    "announcements",
    "patient-top",
    "chart",
    "form2",
    "form3",
    "related-diagram-patient-a",
    "related-diagram-cards",
    "related-diagram-lines",
    "related-diagram-view-save",
    "related-diagram-broken-line",
    "free-canvas",
    "submissions",
    "feedback",
  ]) {
    assert.ok(ids.includes(id), id);
  }
  assert.ok(studentText.includes("情報カード"));
  assert.ok(studentText.includes("看護問題"));
  assert.ok(studentText.includes("確認した"));
  assert.ok(studentText.includes("後で"));
  assert.ok(studentText.includes("未保存の変更あり"));
  assert.ok(studentText.includes("今すぐ保存"));
  assert.ok(studentText.includes("もう一度保存を試す"));
  assert.ok(studentText.includes("新規作成"));
  assert.ok(studentText.includes("改名"));
  assert.equal(studentText.includes("気づき・理解"), false);
});

test("student text does not describe unclickable menus as operable", () => {
  assert.ok(studentText.includes("押せません"));
  assert.equal(studentText.includes("情報BOXを開"), false);
});

test("ward patient selection is map-only and nav mentions scroll", () => {
  assert.ok(studentText.includes("病棟図の中の患者A（308号室）を押します。"));
  assert.ok(studentText.includes("押すのは病棟図の患者だけです。右側の患者情報は押しません。"));
  assert.ok(
    studentText.includes(
      "左メニューは上下にスクロールできます。見えない項目は下へスクロールして探してください。",
    ),
  );
  assert.equal(studentText.includes("病棟図または右の患者A"), false);
  assert.equal(studentText.includes("右の患者Aを選び"), false);
});

test("side nav shows overflow hint when more items are below", () => {
  assert.ok(nav.includes("下にスクロールすると、続きのメニューが表示されます"));
  assert.ok(nav.includes("data-sidenav-more"));
  assert.ok(nav.includes("pointer-events-none"));
});

test("student text does not include AI evaluation internals", () => {
  assert.equal(studentText.includes("AI評価"), false);
  assert.equal(studentText.includes("ルーブリック"), false);
  assert.equal(studentText.includes("プロンプト"), false);
  assert.equal(studentText.includes("取込"), false);
});

test("related-diagram copy matches production buttons and omits unavailable actions", () => {
  assert.ok(studentText.includes("＋カード"));
  assert.ok(studentText.includes("つなぐ"));
  assert.ok(studentText.includes("向きを反転"));
  assert.ok(studentText.includes("一手戻る"));
  assert.ok(studentText.includes("全体表示"));
  assert.ok(studentText.includes("接続先のカードを選択"));
  assert.ok(studentText.includes("この関係は自動的に管理されています"));
  assert.ok(studentText.includes("カードと接続を削除"));
  assert.ok(studentText.includes("線だけ"));
  assert.ok(studentText.includes("自動に戻す"));
  assert.ok(studentText.includes("ルートを描く"));
  assert.ok(studentText.includes("ありません"));
});

test("referenced manual images exist under public/manual/v22", () => {
  const chapters = [
    ...MANUAL_CATALOG.student,
    ...MANUAL_CATALOG.teacher,
    ...MANUAL_CATALOG.admin,
  ];
  for (const chapter of chapters) {
    for (const item of chapter.ops) {
      for (const image of item.shots) {
        const rel = image.src.replace(/^\//, "public/");
        assert.ok(existsSync(new URL(`../../../${rel}`, import.meta.url)), rel);
      }
    }
  }
});

test("staff homes and guide routes exist", () => {
  const teacherHome = src("../../../app/v2/teacher/page.tsx");
  const adminHome = src("../../../app/v2/admin/page.tsx");
  assert.ok(teacherHome.includes('href="/v2/teacher/guide"'));
  assert.ok(adminHome.includes('href="/v2/admin/guide"'));
});

console.log(`\n${passed} passed`);
