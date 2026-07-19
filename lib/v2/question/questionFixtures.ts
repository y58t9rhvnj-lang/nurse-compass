// Compass Version2 — 初期 Question セット（静的・決定論）。
//
// 精神看護の患者理解に汎用的に使える問い。特定患者へ強く依存させない。
// すべて問いの形で、診断・正解・様式2 転記文を含めない（設計書 12 §4.5 / Principles §2）。
// 文言は教員監修前提の暫定。createdBy は "system"（AI 由来ではない）。

import type { Question } from "./questionTypes";

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: "q-confirm-record-gap",
    category: "confirm",
    prompt:
      "患者さんの言葉と、記録に書かれている情報のあいだに、違いはありますか。",
    purpose: "事実と記録を照らし合わせ、思い込みに気づくため。",
    priority: 1,
    createdBy: "system",
  },
  {
    id: "q-confirm-missing",
    category: "confirm",
    prompt: "生活への影響について、まだ確認できていないことはありませんか。",
    purpose: "情報の偏りや抜けに気づくため。",
    priority: 2,
    createdBy: "system",
  },
  {
    id: "q-observe-signs",
    category: "observe",
    prompt:
      "会話中の表情や声のトーン、視線の変化に、気づいたことはありますか。",
    purpose: "言葉にならないサインに目を向けるため。",
    priority: 3,
    createdBy: "system",
  },
  {
    id: "q-think-perception",
    category: "think",
    prompt:
      "患者さんご自身は、いまの状況をどのように受け止めているでしょうか。",
    purpose: "患者さんの主観的な体験に近づくため。",
    priority: 4,
    createdBy: "system",
  },
  {
    id: "q-think-connections",
    category: "think",
    prompt: "集めた情報どうしには、どのようなつながりがありそうですか。",
    purpose: "別々の事実を関連づけて理解するため。",
    priority: 5,
    createdBy: "system",
  },
];

// 現状は全ケース共通の汎用セット。将来、ケース別の問いを差し込むときは
// caseId を引数に加えて出し分ける（設計書 12 §10 の getCaseQuestions に相当）。
export function getQuestionsForCase(): Question[] {
  return DEFAULT_QUESTIONS;
}
