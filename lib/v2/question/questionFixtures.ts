// Compass Version2 — 初期 Question セット（静的・決定論）。
//
// 患者理解（Sprint D-3A）の役割変更に合わせ、Coach は「答え」を出さず、
// 各事実の意味づけ（考察）を深める問いだけを提示する。
// すべて問いの形で、診断・正解・回答例・推測文・様式2 転記文を含めない
// （Direct Diagnosis 禁止 / 設計書 12 §4.5 / Principles §2）。
// 文言は教員監修前提の暫定。createdBy は "system"（AI 由来ではない）。

import type { Question } from "./questionTypes";

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: "q-think-inference",
    category: "think",
    prompt: "この情報から、どのようなことが考えられますか。",
    purpose: "事実から一歩進んで、自分の解釈を言葉にするため。",
    priority: 1,
    createdBy: "system",
  },
  {
    id: "q-confirm-grounds",
    category: "confirm",
    prompt: "そのように考えた根拠は、どの情報ですか。",
    purpose: "考察を、様式2で整理した事実と結びつけて確かめるため。",
    priority: 2,
    createdBy: "system",
  },
  {
    id: "q-think-life",
    category: "think",
    prompt: "患者さんは、どのような思いで生活しているでしょうか。",
    purpose: "患者さんの体験や思いに近づくため。",
    priority: 3,
    createdBy: "system",
  },
  {
    id: "q-observe-signs",
    category: "observe",
    prompt: "この患者さんらしさは、どんなところに表れているでしょうか。",
    purpose: "その人らしさに目を向けるため。",
    priority: 4,
    createdBy: "system",
  },
  {
    id: "q-think-connections",
    category: "think",
    prompt: "身体・心理・社会の面は、どのようにつながっていそうですか。",
    purpose: "各側面を関連づけて患者さんの全体像を捉えるため。",
    priority: 5,
    createdBy: "system",
  },
];

// 現状は全ケース共通の汎用セット。将来、ケース別の問いを差し込むときは
// caseId を引数に加えて出し分ける（設計書 12 §10 の getCaseQuestions に相当）。
export function getQuestionsForCase(): Question[] {
  return DEFAULT_QUESTIONS;
}
