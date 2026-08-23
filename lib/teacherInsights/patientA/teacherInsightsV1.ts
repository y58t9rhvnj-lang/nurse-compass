/**
 * Patient A Teacher Insight Library v1。
 *
 * - 教員アセスメント比較検証から導いた教育知識（問い・仮説・見落とし）
 * - 原文転記なし / 診断名の正解化なし / Gold Standard 本文とは別系統
 * - Evidence は正規 Information 22件カタログの安定 ID のみ
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";
import { PATIENT_A_CANONICAL_INFORMATION_CATALOG } from "@/lib/gold/patientA/canonicalInformationCatalog";
import { parseTeacherInsightLibrary } from "../load";
import type { TeacherInsightDocument } from "../types";
import { TEACHER_INSIGHT_SCHEMA_VERSION } from "../types";
import {
  PATIENT_A_KNOWN_CTP_IDS,
  PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP,
} from "./insightEvidenceMap";

const SOURCE = {
  sourceType: "teacher_assessment_review" as const,
  derivedFrom:
    "教員アセスメント（様式3）と比較検証した思考過程の再構成。原文は収録しない。",
  containsOriginalAssessmentText: false as const,
};

function evidenceFor(id: keyof typeof PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP) {
  return PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP[id];
}

function basePatientA(partial: {
  id: keyof typeof PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP;
  title: string;
  topic: string;
  applicablePatternKeys: readonly Form3PatternKey[];
  relatedCtpIds: readonly string[];
  overlookedPoints: readonly string[];
  teacherConsiderations: readonly string[];
  hypotheses: TeacherInsightDocument["hypotheses"];
  missingInformation: readonly string[];
  coachingQuestions: TeacherInsightDocument["coachingQuestions"];
  commonMisconceptions: readonly string[];
  goldKind: TeacherInsightDocument["goldStandardRelationship"]["kind"];
  goldNote: string;
  caution: readonly string[];
  tags: readonly string[];
}): TeacherInsightDocument {
  return {
    schemaVersion: TEACHER_INSIGHT_SCHEMA_VERSION,
    id: partial.id,
    title: partial.title,
    topic: partial.topic,
    scope: "patient_specific",
    applicablePatternKeys: partial.applicablePatternKeys,
    patientSpecific: true,
    patientId: "A",
    caseId: "SP-001",
    relatedCtpIds: partial.relatedCtpIds,
    evidenceInformationIds: evidenceFor(partial.id),
    overlookedPoints: partial.overlookedPoints,
    teacherConsiderations: partial.teacherConsiderations,
    hypotheses: partial.hypotheses,
    missingInformation: partial.missingInformation,
    coachingQuestions: partial.coachingQuestions,
    commonMisconceptions: partial.commonMisconceptions,
    goldStandardRelationship: {
      kind: partial.goldKind,
      relatedCtpIds: partial.relatedCtpIds,
      note: partial.goldNote,
    },
    caution: partial.caution,
    tags: partial.tags,
    sourceMetadata: SOURCE,
  };
}

const PATIENT_A_TEACHER_INSIGHTS_RAW: readonly TeacherInsightDocument[] = [
  basePatientA({
    id: "TI-A-01",
    title: "活動参加の選択性",
    topic: "activity_participation_selectivity",
    applicablePatternKeys: [
      "activity_exercise",
      "sleep_rest",
      "cognitive_perceptual",
    ],
    relatedCtpIds: ["CTP-01"],
    overlookedPoints: [
      "SSTには参加できる一方、OT等には参加しないことがある",
      "一律の意欲低下としてまとめてしまうと、条件差が見えなくなる",
    ],
    teacherConsiderations: [
      "活動内容・時間帯・前夜の睡眠・疲労・関わる人・安心感・本人の選択を分けて見る",
      "同じ「参加しない」でも、疲労の持ち越しと内容への合わなさが混在しうる",
    ],
    hypotheses: [
      {
        id: "TI-A-01-H1",
        text: "活動量には波があり、安心できる条件や内容によって参加できる力がある可能性がある",
        evidenceState: "partially_supported",
        supportingEvidenceIds: [
          "a-info-activity-s-1",
          "a-info-activity-o-1",
        ],
        contradictingOrMissingEvidence: [
          "参加できた日と辞退した日の前夜睡眠の対応表はカタログに無い",
        ],
      },
      {
        id: "TI-A-01-H2",
        text: "日中の活動低下には夜間幻聴と睡眠不足が影響している可能性がある",
        evidenceState: "partially_supported",
        supportingEvidenceIds: [
          "a-info-sleep-s-1",
          "a-info-sleep-o-1",
          "a-info-activity-s-1",
        ],
        contradictingOrMissingEvidence: [
          "因果の強さ・頻度は未確認",
        ],
        caution: "睡眠不足を唯一原因として固定しない",
      },
    ],
    missingInformation: [
      "OTを辞退する日の前夜の睡眠状況",
      "参加できた活動と辞退した活動の違い（内容・人・時間帯）",
      "本人が感じる疲労の内容と程度",
      "促し方や関わる人による反応の違い",
    ],
    coachingQuestions: [
      {
        id: "TI-A-01-Q1",
        question:
          "参加できた活動と辞退した活動では、Aさんにとって何が違うのでしょうか",
        purpose: "一律意欲低下仮説を揺らし、条件差に目を向ける",
        stage: "meaning",
        relatedPatternKeys: ["activity_exercise"],
      },
      {
        id: "TI-A-01-Q2",
        question:
          "活動しないことを症状だけで説明する前に、何を確認しますか",
        purpose: "病名単一説明の前に確認項目を挙げさせる",
        stage: "missing",
        relatedPatternKeys: ["activity_exercise", "sleep_rest"],
        avoidWhen: ["すでに複数条件を列挙できているとき"],
      },
      {
        id: "TI-A-01-Q3",
        question:
          "促しがあれば入浴・洗濯ができることと、OTを辞退することは、どう両立し得ますか",
        purpose: "Factsの対比から患者理解を更新させる",
        stage: "update",
        relatedPatternKeys: ["activity_exercise"],
      },
    ],
    commonMisconceptions: [
      "統合失調症だから意欲が低く、どの活動もできない",
      "室内中心＝すべて拒否",
    ],
    goldKind: "reinforces",
    goldNote: "CTP-01（活動性を病気だけで説明しない）を問い返し教材として補強する",
    caution: [
      "カタログ外の清潔・洗面詳細をEvidenceとして追加しない",
      "陰性症状を主因として保存しない",
    ],
    tags: ["activity", "selectivity", "ctp-01"],
  }),

  basePatientA({
    id: "TI-A-02",
    title: "幻聴を症状名だけで捉えない",
    topic: "hallucination_as_experience",
    applicablePatternKeys: [
      "cognitive_perceptual",
      "sleep_rest",
      "coping_stress_tolerance",
      "self_perception_self_concept",
    ],
    relatedCtpIds: ["CTP-02"],
    overlookedPoints: [
      "幻聴の有無以外に、内容・時間帯・生活への影響・対処・援助希求がある",
      "残存と急性増悪を同一視しやすい",
    ],
    teacherConsiderations: [
      "内容・時間帯・頻度・強度・生活影響・本人の意味づけ・ラジオ・頓服・援助希求を分けて聞く",
      "「だめな人間だ」という内容と自己評価の関連は可能性に留める",
    ],
    hypotheses: [
      {
        id: "TI-A-02-H1",
        text: "幻聴は残存するが、存在だけで急性増悪とは判断できない",
        evidenceState: "supported_by_catalog",
        supportingEvidenceIds: [
          "a-info-cognitive-o-1",
          "a-info-cognitive-s-1",
        ],
        contradictingOrMissingEvidence: [
          "頻度・強度・持続の定量は未確認",
        ],
      },
      {
        id: "TI-A-02-H2",
        text: "ラジオや必要時の頓服希望など、自分なりの対処と援助希求がある",
        evidenceState: "supported_by_catalog",
        supportingEvidenceIds: [
          "a-info-coping-s-1",
          "a-info-sleep-o-1",
          "a-info-coping-o-1",
        ],
        contradictingOrMissingEvidence: [
          "ラジオが有効なときと無効なときの差は未確認",
        ],
      },
      {
        id: "TI-A-02-H3",
        text: "幻聴内容が自己評価の低さと関連している可能性がある",
        evidenceState: "open_alternative",
        supportingEvidenceIds: ["a-info-self-s-1", "a-info-sleep-s-1"],
        contradictingOrMissingEvidence: [
          "本人の意味づけは未確認",
          "因果の断定材料はカタログに無い",
        ],
        caution: "関連を断定せず Missing に残す",
      },
    ],
    missingInformation: [
      "幻聴の頻度、強さ、持続時間",
      "ラジオが有効なときと有効でないときの違い",
      "幻聴を本人がどのように意味づけているか",
      "頓服使用後の効果と翌朝への影響",
    ],
    coachingQuestions: [
      {
        id: "TI-A-02-Q1",
        question:
          "幻聴が残っていることと、Aさんが対処できていることは両立しますか",
        purpose: "症状残存＝悪化の二分法を崩す",
        stage: "meaning",
        relatedPatternKeys: [
          "cognitive_perceptual",
          "coping_stress_tolerance",
        ],
      },
      {
        id: "TI-A-02-Q2",
        question:
          "幻聴の有無以外に、何を知ればAさんの体験を理解できますか",
        purpose: "体験理解に必要な情報項目を列挙させる",
        stage: "missing",
        relatedPatternKeys: ["cognitive_perceptual", "sleep_rest"],
      },
      {
        id: "TI-A-02-Q3",
        question:
          "幻聴内容と自己評価の関係について、今の段階でどこまで言えますか。何が足りませんか",
        purpose: "可能性と断定を区別させる",
        stage: "reflection",
        relatedPatternKeys: ["self_perception_self_concept"],
        avoidWhen: ["学生が既に断定を避け Missing を書けているとき"],
      },
    ],
    commonMisconceptions: [
      "幻聴が残っているので症状が安定していない",
      "幻聴内容＝本人の自己評価そのもの（断定）",
    ],
    goldKind: "reinforces",
    goldNote: "CTP-02 を問い返しで補強。内容と自己評価の断定を防ぐ",
    caution: [
      "急性増悪と断定しない",
      "幻聴内容と自己評価の関連は可能性に留める",
      "カタログに無い幻聴文言（例: 別表現）をEvidenceに足さない",
    ],
    tags: ["hallucination", "coping", "ctp-02"],
  }),

  basePatientA({
    id: "TI-A-03",
    title: "自己管理への自信の履歴",
    topic: "self_management_confidence_history",
    applicablePatternKeys: [
      "health_perception_management",
      "value_belief",
      "self_perception_self_concept",
    ],
    relatedCtpIds: ["CTP-03", "CTP-05"],
    overlookedPoints: [
      "現在の「自分にもできるかな」だけを見て、自信の履歴を想像し忘れる",
      "成功・中断・失敗の受け止め方が、今の関心の意味を変えうる",
    ],
    teacherConsiderations: [
      "現在の関心・全量服用・段階的方針はカタログで支えられる",
      "過去の自己管理経験の詳細は現行22件では不足しており、Missing として扱う",
    ],
    hypotheses: [
      {
        id: "TI-A-03-H1",
        text: "服薬自己管理への関心は、地域生活に向けた小さな準備性を示している可能性がある",
        evidenceState: "partially_supported",
        supportingEvidenceIds: [
          "a-info-health-s-1",
          "a-info-health-o-1",
          "a-info-value-s-1",
        ],
        contradictingOrMissingEvidence: [
          "過去の成功・中断・失敗の受け止めはカタログに無い",
        ],
      },
      {
        id: "TI-A-03-H2",
        text: "『できるかな』は期待と不安の両方を含みうる",
        evidenceState: "open_alternative",
        supportingEvidenceIds: ["a-info-health-s-1", "a-info-self-s-1"],
        contradictingOrMissingEvidence: [
          "発言の情緒的ニュアンスの確認記録がカタログに無い",
        ],
        caution: "前向き一色にも、不安一色にも固定しない",
      },
    ],
    missingInformation: [
      "過去に自分で管理しようとした経験とその受け止め",
      "成功体験をどのように意味づけているか",
      "支援があれば自分でできることと、全面支援が必要なことの本人認識",
      "（カタログ外）自己管理が続かなかった経験の有無——Fact化せず確認課題に留める",
    ],
    coachingQuestions: [
      {
        id: "TI-A-03-Q1",
        question:
          "Aさんは過去に、自分で管理しようとした経験をどう受け止めていますか",
        purpose: "履歴を Missing / Next として開く（Fact追加しない）",
        stage: "missing",
        relatedPatternKeys: ["health_perception_management"],
        prerequisites: ["現在の関心や全量服用のFactsを確認済み"],
      },
      {
        id: "TI-A-03-Q2",
        question:
          "現在の『できるかな』は、期待でしょうか、不安でしょうか。それとも両方でしょうか",
        purpose: "単一感情への決めつけを避ける",
        stage: "meaning",
        relatedPatternKeys: [
          "health_perception_management",
          "self_perception_self_concept",
        ],
      },
      {
        id: "TI-A-03-Q3",
        question:
          "少しずつできるようになりたいという願いと、自己管理への関心は、どうつながり得ますか",
        purpose: "価値観と健康管理関心を統合する更新を促す",
        stage: "update",
        relatedPatternKeys: ["value_belief", "health_perception_management"],
      },
    ],
    commonMisconceptions: [
      "関心がある＝すぐに自己管理できる",
      "過去の失敗を根拠なくFactsへ書いてよい",
    ],
    goldKind: "extends",
    goldNote:
      "CTP-03/05 の『関心の芽』を、自信の履歴という Missing 軸で拡張する（原文の失敗談は Fact 化しない）",
    caution: [
      "過去の失敗をFactsとして追加しない",
      "病識低下や自信喪失を診断名として保存しない",
    ],
    tags: ["self-management", "confidence", "missing-first"],
  }),

  basePatientA({
    id: "TI-A-04",
    title: "入院環境への安心と地域生活への不安",
    topic: "hospital_safety_and_community_anxiety",
    applicablePatternKeys: [
      "coping_stress_tolerance",
      "self_perception_self_concept",
      "role_relationship",
      "value_belief",
      "health_perception_management",
    ],
    relatedCtpIds: ["CTP-03"],
    overlookedPoints: [
      "病院への安心を依存と決めつけやすい",
      "地域生活の具体像・家族支援・住居・対処・ペース・安全感が不足している可能性",
    ],
    teacherConsiderations: [
      "『ここ（病院）にいる方が安心』と『外で一人でやっていけるか自信がない』をセットで読む",
      "退院を急がない思いと、服薬自己管理への関心の併存に注目する",
    ],
    hypotheses: [
      {
        id: "TI-A-04-H1",
        text: "病院への安心は、退院意欲の欠如だけでなく、地域生活を支える人や方法が見えない不安の表れと考えられる",
        evidenceState: "partially_supported",
        supportingEvidenceIds: [
          "a-info-coping-s-1",
          "a-info-self-s-1",
          "a-info-role-o-1",
          "a-info-value-o-1",
        ],
        contradictingOrMissingEvidence: [
          "住居・支援体制の具体像はカタログに無い",
          "本人が最も不安な場面の特定が無い",
        ],
        caution: "退院拒否・依存と断定しない。本人の安心を否定しない",
      },
      {
        id: "TI-A-04-H2",
        text: "自分のペースと安全感を守りながら段階的に進みたい価値観がある",
        evidenceState: "supported_by_catalog",
        supportingEvidenceIds: [
          "a-info-value-s-1",
          "a-info-value-o-1",
          "a-info-health-s-1",
        ],
        contradictingOrMissingEvidence: [],
      },
    ],
    missingInformation: [
      "退院後の住居と支援体制",
      "叔父が担える支援の範囲",
      "地域生活で最も不安に感じる具体的場面",
      "これまでの地域生活でうまくいった／いかなかった経験",
    ],
    coachingQuestions: [
      {
        id: "TI-A-04-Q1",
        question:
          "病院にいたいという思いを、依存だけで説明できますか",
        purpose: "依存ラベルを揺らし、安心と不安の構造を見る",
        stage: "meaning",
        relatedPatternKeys: ["coping_stress_tolerance", "value_belief"],
        avoidWhen: ["学生がすでに依存断定を避けているとき"],
      },
      {
        id: "TI-A-04-Q2",
        question:
          "Aさんが外で暮らせそうだと思うために、何が具体化される必要がありますか",
        purpose: "抽象的な退院意欲論から具体条件へ移す",
        stage: "missing",
        relatedPatternKeys: ["role_relationship", "health_perception_management"],
      },
      {
        id: "TI-A-04-Q3",
        question:
          "安心を保ちながら『最初の一歩』を探すとしたら、何が候補になりますか",
        purpose: "価値観（ペース）を壊さない更新へ導く",
        stage: "update",
        relatedPatternKeys: ["value_belief"],
      },
    ],
    commonMisconceptions: [
      "病院にいたい＝依存的で退院意欲が低い",
      "安心を否定して退院を急がせるのが正しい",
    ],
    goldKind: "reinforces",
    goldNote: "CTP-03 を強化。依存断定を防ぐ問いを構造化",
    caution: [
      "退院拒否・依存と断定しない",
      "本人の安心を否定しない",
      "カタログに無い『ずっと入院したい』等の強い表現を事実化しない",
    ],
    tags: ["discharge", "safety", "recovery", "ctp-03"],
  }),

  basePatientA({
    id: "TI-A-05",
    title: "Iさんとの関係性と相互性",
    topic: "peer_relationship_and_mutuality",
    applicablePatternKeys: [
      "role_relationship",
      "self_perception_self_concept",
      "health_perception_management",
      "value_belief",
    ],
    relatedCtpIds: ["CTP-04", "CTP-03"],
    overlookedPoints: [
      "内向的＝関係を築けない、と一括しやすい",
      "Iさん関係を一方的依存か相互関係か、どちらかに決めつけやすい",
      "Iさん側の認識は未確認",
    ],
    teacherConsiderations: [
      "安心・モデル・動機づけ・役割・相互性の可能性を分けて見る",
      "相互性は仮説。確認前に断定しない",
    ],
    hypotheses: [
      {
        id: "TI-A-05-H1",
        text: "安心できる相手とは穏やかな関係を維持でき、回復資源になりうる",
        evidenceState: "supported_by_catalog",
        supportingEvidenceIds: [
          "a-info-role-s-1",
          "a-info-role-o-1",
          "a-info-self-o-1",
        ],
        contradictingOrMissingEvidence: [
          "Iさんのどのような関わりが安心かを本人が言語化した記録は薄い",
        ],
      },
      {
        id: "TI-A-05-H2",
        text: "Iさんとの関係は、服薬自己管理への動機づけにもなっている可能性がある",
        evidenceState: "partially_supported",
        supportingEvidenceIds: [
          "a-info-health-s-1",
          "a-info-value-s-1",
          "a-info-role-s-1",
        ],
        contradictingOrMissingEvidence: [],
      },
      {
        id: "TI-A-05-H3",
        text: "関係は相互的である可能性もある（一方的依存とは限らない）",
        evidenceState: "insufficient_evidence",
        supportingEvidenceIds: ["a-info-role-o-1", "a-info-role-s-1"],
        contradictingOrMissingEvidence: [
          "Iさん側の認識・体験はカタログに無い",
        ],
        caution: "相互性も一方的依存も断定しない",
      },
    ],
    missingInformation: [
      "Iさんのどのような関わりを安心と感じているか",
      "Iさん側がこの関係をどう体験しているか（未確認）",
      "集団場面と一対一場面での違い",
      "Iさんとの関係が変化した場合の代替資源",
    ],
    coachingQuestions: [
      {
        id: "TI-A-05-Q1",
        question: "Iさんとの関係で、Aさんは何を受け取っていますか",
        purpose: "関係の機能（安心・モデル等）を言語化させる",
        stage: "meaning",
        relatedPatternKeys: ["role_relationship"],
      },
      {
        id: "TI-A-05-Q2",
        question: "AさんもIさんに何かを与えている可能性はありますか",
        purpose: "一方的依存仮説の代替を開く",
        stage: "meaning",
        relatedPatternKeys: ["role_relationship"],
        avoidWhen: ["相互性を既に断定しているとき——その場合は確認へ誘導"],
      },
      {
        id: "TI-A-05-Q3",
        question:
          "相互的な関係だと判断するには、何を確認する必要がありますか",
        purpose: "仮説を Missing に落とす",
        stage: "missing",
        relatedPatternKeys: ["role_relationship"],
      },
    ],
    commonMisconceptions: [
      "内向的で人付き合いが苦手なため関係を築けない",
      "年上の同室者への依存で説明が足りる",
      "相互性を観察なしに断定してよい",
    ],
    goldKind: "extends",
    goldNote:
      "CTP-04 の資源化を補強しつつ、相互性は仮説＋Missing として拡張（劣等感断定はしない）",
    caution: [
      "相互性は仮説",
      "一方的依存とも相互関係とも断定しない",
      "『劣等感』など Facts に無い概念語で埋めない",
    ],
    tags: ["peer", "mutuality", "ctp-04"],
  }),

  basePatientA({
    id: "TI-A-06",
    title: "病識・心理教育を単純化しない",
    topic: "insight_and_psychoeducation_nuance",
    applicablePatternKeys: [
      "health_perception_management",
      "value_belief",
    ],
    relatedCtpIds: ["CTP-03", "CTP-05"],
    overlookedPoints: [
      "服薬必要性の一定理解・服薬継続・自己管理関心と、『病識が低い』ラベルを混同しやすい",
      "参加しないプログラムを病識の低さと直結しやすい",
    ],
    teacherConsiderations: [
      "薬を飲む必要性の理解と、病気全体の理解は同一とは限らない",
      "心理教育参加の有無は現行22件に不足——Missing / caution に留め Evidence 化しない",
    ],
    hypotheses: [
      {
        id: "TI-A-06-H1",
        text: "服薬の必要性理解と全量服用は、健康管理への一定の向き合いを示す",
        evidenceState: "supported_by_catalog",
        supportingEvidenceIds: [
          "a-info-health-s-1",
          "a-info-health-o-1",
        ],
        contradictingOrMissingEvidence: [
          "病識の深さの評価はカタログに無い",
        ],
      },
      {
        id: "TI-A-06-H2",
        text: "プログラム参加の選り好みや関心の芽は、『病識が低い』一語では説明しきれない可能性がある",
        evidenceState: "open_alternative",
        supportingEvidenceIds: [
          "a-info-health-s-1",
          "a-info-value-s-1",
        ],
        contradictingOrMissingEvidence: [
          "心理教育参加／非参加の記録はカタログに無い",
        ],
        caution: "病識低下→再燃と直結させない。心理教育拒否をFactsに追加しない",
      },
    ],
    missingInformation: [
      "本人が病気をどのように理解しているか（深さ・言葉）",
      "勧めたプログラムに参加しない理由（内容・安心・疲労・タイミング等）",
      "（カタログ外）心理教育セッションの参加状況——確認課題であり Fact 化しない",
    ],
    coachingQuestions: [
      {
        id: "TI-A-06-Q1",
        question:
          "薬を飲む必要性の理解と、病気全体の理解は同じでしょうか",
        purpose: "病識の単純化を防ぐ",
        stage: "meaning",
        relatedPatternKeys: ["health_perception_management"],
      },
      {
        id: "TI-A-06-Q2",
        question:
          "参加しないことを病識の低さと決める前に、どんな理由を確認しますか",
        purpose: "ラベル前の Missing を開く",
        stage: "missing",
        relatedPatternKeys: ["health_perception_management", "value_belief"],
      },
      {
        id: "TI-A-06-Q3",
        question:
          "服薬継続と『できるかな』という関心があるとき、病識についてどこまで言えますか",
        purpose: "言える範囲と言えない範囲を区別する",
        stage: "reflection",
        relatedPatternKeys: ["health_perception_management"],
      },
    ],
    commonMisconceptions: [
      "心理教育に出ない＝病識が低い＝再燃する",
      "薬を飲むと言うだけで病識は十分／不十分と決められる",
    ],
    goldKind: "contrasts_risk",
    goldNote:
      "教員アセスメントに現れやすい病識→再燃の直結を、Gold の患者理解更新と対比して防ぐ",
    caution: [
      "病識低下→再燃と直結させない",
      "心理教育拒否をFactsとして追加しない",
      "診断名や『病識低下』を正解として保存しない",
    ],
    tags: ["insight", "nuance", "anti-label"],
  }),

  basePatientA({
    id: "TI-A-07",
    title: "不足情報を障害ラベルで埋めない",
    topic: "do_not_fill_gaps_with_disability_labels",
    applicablePatternKeys: [
      "activity_exercise",
      "self_perception_self_concept",
      "cognitive_perceptual",
      "role_relationship",
    ],
    relatedCtpIds: ["CTP-01", "CTP-02", "CTP-04"],
    overlookedPoints: [
      "活動低下・対人・認知の不足を、陰性症状・認知機能障害・社会的認知障害などの主因ラベルで埋めやすい",
      "清潔・金銭などカタログ外領域でも、観察不足を障害名で補完しがち",
    ],
    teacherConsiderations: [
      "障害名は仮説候補・鑑別視点に限定し、主因として保存しない",
      "本人の体験・環境条件・関係の代替仮説を先に三つ挙げる習慣をつける",
    ],
    hypotheses: [
      {
        id: "TI-A-07-H1",
        text: "活動や関係の現れは、条件・体験・安心できる相手によって変わりうる（機能障害の一語では足りない）",
        evidenceState: "partially_supported",
        supportingEvidenceIds: [
          "a-info-activity-s-1",
          "a-info-activity-o-1",
          "a-info-role-s-1",
          "a-info-self-o-1",
        ],
        contradictingOrMissingEvidence: [
          "清潔・金銭などカタログ外の領域は Evidence 化できない",
        ],
      },
      {
        id: "TI-A-07-H2",
        text: "叔父への解釈や幻聴体験は、社会的認知障害と断定する前に、情報不足と本人の意味づけを確認する必要がある",
        evidenceState: "open_alternative",
        supportingEvidenceIds: [
          "a-info-self-s-1",
          "a-info-role-o-1",
          "a-info-cognitive-s-1",
          "a-info-cognitive-o-1",
        ],
        contradictingOrMissingEvidence: [
          "叔父側の事情の確認状況は薄い",
        ],
        caution: "社会的認知障害を主因として保存しない",
      },
    ],
    missingInformation: [
      "当該行動が起きる条件（人・場所・疲労・前夜）",
      "本人の体験の言語化",
      "障害名以外の代替仮説の検討結果",
      "（カタログ外）清潔・金銭の詳細——確認課題であり、障害ラベルで埋めない",
    ],
    coachingQuestions: [
      {
        id: "TI-A-07-Q1",
        question:
          "この行動を障害名で説明すると、何が見えなくなりますか",
        purpose: "ラベルの見えなくなるコストを自覚させる",
        stage: "reflection",
        relatedPatternKeys: ["cognitive_perceptual", "activity_exercise"],
      },
      {
        id: "TI-A-07-Q2",
        question:
          "本人の体験や環境条件を確認せずに、機能障害と判断していませんか",
        purpose: "Missing スキップを指摘する",
        stage: "missing",
        relatedPatternKeys: [
          "self_perception_self_concept",
          "role_relationship",
        ],
      },
      {
        id: "TI-A-07-Q3",
        question: "診断名以外の仮説を三つ挙げられますか",
        purpose: "代替仮説を強制的に開く",
        stage: "meaning",
        relatedPatternKeys: [
          "activity_exercise",
          "cognitive_perceptual",
          "role_relationship",
        ],
      },
    ],
    commonMisconceptions: [
      "不足情報は障害ラベルで埋めてよい",
      "陰性症状・認知機能障害・社会的認知障害が主因だと決めてよい",
    ],
    goldKind: "contrasts_risk",
    goldNote:
      "教員アセスメントの診断手がかり型推論に対するガードレール。Gold の条件・体験・関係仮説を守る",
    caution: [
      "陰性症状、認知機能障害、社会的認知障害を主因として保存しない",
      "これらは仮説候補または鑑別視点に限定する",
      "カタログ外（清潔・金銭等）を Evidence に入れない",
    ],
    tags: ["anti-label", "differential", "philosophy"],
  }),
];

function buildLibrary(): readonly TeacherInsightDocument[] {
  const parsed = parseTeacherInsightLibrary(
    PATIENT_A_TEACHER_INSIGHTS_RAW,
    PATIENT_A_CANONICAL_INFORMATION_CATALOG,
    PATIENT_A_KNOWN_CTP_IDS,
  );
  if (!parsed.ok) {
    const detail = parsed.issues
      .map((i) => `${i.path}:${i.code}:${i.message}`)
      .join("; ");
    throw new Error(`Patient A Teacher Insights v1 validate failed: ${detail}`);
  }
  return parsed.documents;
}

let cached: readonly TeacherInsightDocument[] | null | undefined;

/** 検証済み Aさん Teacher Insight 一覧。失敗時 throw。 */
export function getPatientATeacherInsightsV1(): readonly TeacherInsightDocument[] {
  if (cached === undefined) {
    cached = buildLibrary();
  }
  if (cached === null) {
    throw new Error("Patient A Teacher Insights v1 unavailable");
  }
  return cached;
}

export function getPatientATeacherInsightsV1OrNull():
  | readonly TeacherInsightDocument[]
  | null {
  try {
    return getPatientATeacherInsightsV1();
  } catch {
    return null;
  }
}

export function getPatientATeacherInsightByIdV1(
  id: string,
): TeacherInsightDocument | null {
  return (
    getPatientATeacherInsightsV1OrNull()?.find((doc) => doc.id === id) ?? null
  );
}
