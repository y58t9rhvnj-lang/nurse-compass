/**
 * Aさん（SP-001）正規 Information の教材カタログ（安定 ID）。
 *
 * 重要:
 * - 学生 Form3 DB の active カードを複製・上書きしない。
 * - カード UUID は学生ごと・保存ごとに変わりうるため、Gold 根拠参照には使わない。
 * - content は 99999991 受け入れ時点の active 22件と同一文言（指紋）。
 * - acceptanceExampleCardId は照合用メモのみ。
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { GoldCanonicalInformationRef } from "../types";

const PATIENT_ID = "A";
const CASE_ID = "SP-001";

function ref(
  id: string,
  soType: "S" | "O",
  primaryPatternKey: Form3PatternKey,
  content: string,
  acceptanceExampleCardId: string,
): GoldCanonicalInformationRef {
  return {
    id,
    patientId: PATIENT_ID,
    caseId: CASE_ID,
    soType,
    primaryPatternKey,
    content,
    acceptanceExampleCardId,
  };
}

/**
 * Aさん active Information 22件（受け入れバックアップと同一 content）。
 * 順序はパターン順（FORM3_PATTERN_ORDER に沿う）。
 */
export const PATIENT_A_CANONICAL_INFORMATION_CATALOG: readonly GoldCanonicalInformationRef[] =
  [
    ref(
      "a-info-health-s-1",
      "S",
      "health_perception_management",
      "「自分にもできるかな」「うらやましい」（Iさんの服薬自己管理を見て）。服薬の必要性は理解している。",
      "33c6c371-3979-4881-9827-f9fa3b1e8610",
    ),
    ref(
      "a-info-health-o-1",
      "O",
      "health_perception_management",
      "服薬拒否なし・定期薬は全量服用。薬剤記録で段階的な服薬自己管理（まず就寝前薬から）を医師・看護と検討する方針。",
      "4f08cf3b-b7ff-4d85-b1aa-e9b25de2771c",
    ),
    ref(
      "a-info-nutrition-s-1",
      "S",
      "nutritional_metabolic",
      "間食は一つ・非甘味の飲み物を選択できている。",
      "a6ba0f83-86e8-4174-a3f5-381263a6d2fe",
    ),
    ref(
      "a-info-nutrition-o-1",
      "O",
      "nutritional_metabolic",
      "体重約70kg台・腹囲約85cmまで減少。以前の脂質異常は改善。BMIは過体重域が続く（栄養記録）。",
      "f83a37ff-2154-4c33-b521-39a89abf9bca",
    ),
    ref(
      "a-info-elimination-s-1",
      "S",
      "elimination",
      "便秘など体調の変化を自分で訴え、頓服を求められる（強みとして記載）。",
      "8bba1087-a4ee-418c-aaa6-08fbd6f9dcc5",
    ),
    ref(
      "a-info-elimination-o-1",
      "O",
      "elimination",
      "排便間隔に変動あり。便秘時センノシド使用後に排便。腹部症状の訴えなし（看護・フローシート）。",
      "cb6bb07d-7532-4406-aa97-5702a931173b",
    ),
    ref(
      "a-info-activity-s-1",
      "S",
      "activity_exercise",
      "OTは「気が向かない」と辞退することがある。「疲れる」と早めに切り上げる。",
      "e812c196-3a30-4c40-b026-67c95b81d961",
    ),
    ref(
      "a-info-activity-o-1",
      "O",
      "activity_exercise",
      "SST参加は定着。OTは参加・辞退が混在。日中は室内中心の日が多い。促しで入浴・洗濯を実施。",
      "34649fa8-ee6c-49ad-9e04-b2fbdb83e633",
    ),
    ref(
      "a-info-sleep-s-1",
      "S",
      "sleep_rest",
      "「夜になると声が気になります。眠れない日があります。」「だめな人間だ、と聞こえる」。",
      "e018e0de-296a-4968-a58f-57bd75a612b8",
    ),
    ref(
      "a-info-sleep-o-1",
      "O",
      "sleep_rest",
      "夜間幻聴で入眠困難。ラジオで対処し、不眠時ブロチゾラム頓用あり。翌朝の持ち越し倦怠感あり。",
      "8e3d7e06-0b9c-4a20-90f3-3dbc4a516923",
    ),
    ref(
      "a-info-cognitive-s-1",
      "S",
      "cognitive_perceptual",
      "夜間を中心に幻聴を訴える。",
      "f9567c1b-c525-46fd-9f8d-f5b2d7d7453b",
    ),
    ref(
      "a-info-cognitive-o-1",
      "O",
      "cognitive_perceptual",
      "幻聴は残存するが著明な行動化なし。会話は成立。表情は概ね穏やか（医師・看護記録）。",
      "3b615042-b1ce-4c23-af61-53c05c539905",
    ),
    ref(
      "a-info-self-s-1",
      "S",
      "self_perception_self_concept",
      "「だめな人間だ」と聞こえる。叔父に嫌われたのではないか。外で一人でやっていけるか自信がない。",
      "34b9022d-73dc-4816-94f6-e818650ec0ef",
    ),
    ref(
      "a-info-self-o-1",
      "O",
      "self_perception_self_concept",
      "物静かで内向的。心を許した相手（Iさん）とは穏やかに過ごせる。",
      "68a7fe04-33c6-48af-8bdd-e9eb69ddb56c",
    ),
    ref(
      "a-info-role-s-1",
      "S",
      "role_relationship",
      "「Iさんといると落ち着く」。",
      "0b6ce8a6-5acc-4e90-a478-5d6e53324965",
    ),
    ref(
      "a-info-role-o-1",
      "O",
      "role_relationship",
      "同室Iさんと中庭で菓子を分け合い過ごす。高齢の叔父がキーパーソンだが面会は減少。",
      "2baa5087-3fc7-4449-a5a8-620acda5d40a",
    ),
    ref(
      "a-info-sexuality-s-1",
      "S",
      "sexuality_reproductive",
      "（登録情報・会話・カルテ上、本人からの性・生殖に関する訴えは確認できず）情報不足。",
      "e7db33ac-544b-41b5-a1b9-71fc5e4fa2ca",
    ),
    ref(
      "a-info-sexuality-o-1",
      "O",
      "sexuality_reproductive",
      "未婚・同胞なし。性・生殖パターンに関する具体的記載はカルテ上ほぼなし。",
      "641dd19b-d16c-4ea9-97ea-6a64efbe52da",
    ),
    ref(
      "a-info-coping-s-1",
      "S",
      "coping_stress_tolerance",
      "「ここ（病院）にいる方が安心」。幻聴時はラジオで対処し、必要時に頓服を希望できる。",
      "9b556878-52fc-41ae-92b1-77166069f27a",
    ),
    ref(
      "a-info-coping-o-1",
      "O",
      "coping_stress_tolerance",
      "SST参加の定着。夜間の自己対処（ラジオ）後に頓用睡眠薬使用あり。",
      "93841ad6-3340-496c-be21-709ccf302eff",
    ),
    ref(
      "a-info-value-s-1",
      "S",
      "value_belief",
      "静かに自分のペースで過ごしたい。Iさんのように自分も少しずつできるようになりたい。",
      "f92ea97a-ae17-4c89-860b-fa9f87c12781",
    ),
    ref(
      "a-info-value-o-1",
      "O",
      "value_belief",
      "退院を急がず、まずは安心して過ごしたいという思いが生活歴・プロファイルに記載。",
      "c409e35a-244f-4185-b1ca-5138fe64f0c4",
    ),
  ] as const;

/** active 22件の content 指紋（正規データ変更検知用） */
export const PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS: readonly string[] =
  PATIENT_A_CANONICAL_INFORMATION_CATALOG.map((c) => c.content);

export function getPatientACanonicalInformationById(
  id: string,
): GoldCanonicalInformationRef | undefined {
  return PATIENT_A_CANONICAL_INFORMATION_CATALOG.find((c) => c.id === id);
}
