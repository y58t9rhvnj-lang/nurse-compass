/**
 * Form3 Phase B — 学生向け教育コピー（文言のみ）。
 * DB / schema / AI / autosave / print 構造は変更しない。
 */

/** 様式3を開いた直後の中心メッセージ（転記・引継ぎ表現は使わない） */
export const FORM3_PHASE_B_OPENING_GUIDE =
  "様式2で感じた患者さんの姿や気になったことも手がかりにしながら、患者さんを理解するために必要な情報を、11の視点で整理してみましょう。";

/** 考えるときの道しるべ（wizard / 必須順ではない） */
export const FORM3_PHASE_B_THINKING_STEPS = [
  "① 情報を整理する",
  "② 情報のつながりから患者さんを考える",
  "③ 必要な看護を考える",
] as const;

export const FORM3_PHASE_B_THINKING_STEPS_NOTE =
  "考えるときの道しるべです。どの視点から始めても構いません。";

/** 11パターンの意味（「書かなくてよい」ではない） */
export const FORM3_PHASE_B_PATTERNS_NOTE =
  "11のパターンは、患者さんをいろいろな視点から見るためのものです。すべてを同じ量で埋める必要はありません。患者さんを理解するために必要な情報を、自分で判断して整理してください。";

/** Information section */
export const FORM3_PHASE_B_INFORMATION_HELPER =
  "患者さんを理解するために必要な情報を整理します。会話や観察、カルテなどから得た情報のうち、患者さんを理解するために必要だと思うことを整理してみましょう。";

/** Assessment section（一覧ヘッダ下）— 提出本文に思考を残す。未確定事項は Compassメモへ */
export const FORM3_PHASE_B_ASSESSMENT_HELPER =
  "選んだ情報のつながりから、患者さんに何が起きているのかを考え、その理解からこの患者さんに必要な看護を考えてみましょう。看護問題名や援助計画の完成ではありません。まだ分からないことや確認したいことは、Compassメモに残しておきましょう。";

/** Assessment dialog helper（専門語を抑え、境界は維持） */
export const FORM3_PHASE_B_ASSESSMENT_DIALOG_HELPER =
  "ここでは解釈を書きます。看護問題名や援助計画ではありません。根拠にした情報の本文はコピーしません。まだ分からないことや確認したいことは、Compassメモに残しておきましょう。";

/** Assessment textarea の手前の短い問い */
export const FORM3_PHASE_B_ASSESSMENT_PROMPTS = [
  "選んだ情報には、どのようなつながりがありますか？",
  "そこから、患者さんに何が起きていると考えますか？（必要なら、これから起こり得ることにも触れてよい）",
  "その理解から、この患者さんにはどのような看護が必要だと考えますか？",
] as const;

export const FORM3_PHASE_B_ASSESSMENT_PLACEHOLDER =
  "選んだ情報のつながり、患者さんに起きていること、必要な看護について、自分の言葉で書いてみましょう。";

/** 提出確認（非block維持。collectForm3Missing は変更しない） */
export const FORM3_PHASE_B_SUBMIT_CONFIRM_BODY =
  "未入力のパターンがあります。すべてのパターンを同じ量で記入する必要はありません。患者さんを理解するために必要な内容が整理できているか確認してください。患者さんの状態によっては情報がない場合もあります。内容を確認したうえで、このまま提出できます。";
