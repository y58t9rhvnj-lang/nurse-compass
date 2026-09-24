/**
 * DEV ONLY — Route Editing Demo Patient.
 * Daily iPad / Manual Route Editing fixture. Not Patient A.
 * No Junction. No Form3 write-back. No persistence.
 */

import {
  INFORMATION_CARD_HEIGHT,
  INFORMATION_CARD_WIDTH,
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
} from "./form3ToUnderstandingCard";
import { DIRECT_NURSING_PROBLEM_HEIGHT, DIRECT_NURSING_PROBLEM_WIDTH } from "./cardDirectNursingProblem";
import { emptyRelatedDiagramGraph } from "./resolveReadonlyScene";
import {
  emptyRouteTopology,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
import type { Point } from "./orthogonalRouting";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardType,
  RelatedDiagramConnection,
  RelatedDiagramConnectionRelationType,
  RelatedDiagramSemanticGraph,
} from "./types";

export const ROUTE_EDITING_DEMO_KIND =
  "route_editing_demo_patient_dev_only" as const;

export const ROUTE_EDITING_DEMO_TS = "2026-09-22T10:00:00.000Z";

export const ROUTE_EDITING_DEMO_GEOMETRY_CASES = [
  "long_horizontal",
  "long_vertical",
  "want_detour_up",
  "want_detour_down",
  "want_detour_side",
  "card_through",
  "crossing",
  "existing_bend",
  "multi_connection_card",
  "endpoint_repair_host",
] as const;

export type RouteEditingDemoGeometryCase =
  (typeof ROUTE_EDITING_DEMO_GEOMETRY_CASES)[number];

const TS = ROUTE_EDITING_DEMO_TS;

function card(
  id: string,
  cardType: RelatedDiagramCardType,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
): RelatedDiagramCard {
  return {
    id,
    cardType,
    text,
    state: cardType === "information" ? null : "current",
    origin:
      cardType === "information"
        ? "form3_information"
        : cardType === "nursing_problem"
          ? "direct_insight"
          : "form3_assessment",
    layout: { x, y, width, height, zIndex: 1 },
    isLocked: false,
    createdAt: TS,
    updatedAt: TS,
  };
}

function conn(
  id: string,
  sourceCardId: string,
  targetCardId: string,
  relationType: RelatedDiagramConnectionRelationType = "current",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType,
    origin: "student_diagram",
    createdAt: TS,
    updatedAt: TS,
  };
}

const IW = INFORMATION_CARD_WIDTH;
const IH = INFORMATION_CARD_HEIGHT;
const UW = UNDERSTANDING_CARD_WIDTH;
const UH = UNDERSTANDING_CARD_HEIGHT;
const NW = DIRECT_NURSING_PROBLEM_WIDTH;
const NH = DIRECT_NURSING_PROBLEM_HEIGHT;

export const ROUTE_EDITING_DEMO_CONNECTION_IDS = {
  longHorizontal: "red_c_u_pna_u_low_act",
  longVertical: "red_c_u_adl_np",
  wantDetourDown: "red_c_u_pna_u_low_act",
  wantDetourUp: "red_c_u_intake_u_dehyd",
  wantDetourSide: "red_c_u_adl_np",
  cardThrough: "red_c_u_pna_u_low_act",
  crossingA: "red_c_i_cough_u_sleep",
  crossingB: "red_c_u_pna_u_tired",
  existingBend: "red_c_i_med_u_htn_ctrl",
  endpointRepairHost: "red_c_i_fatigue_u_low_act",
} as const;

export const ROUTE_EDITING_DEMO_MULTI_CARD_ID = "u_low_act";

/** Authored jog on the treatment line. Student-owned MANUAL, not a Junction. */
export const ROUTE_EDITING_DEMO_EXISTING_BEND_POINTS: Point[] = [
  { x: 700, y: 896 },
  { x: 700, y: 780 },
  { x: 980, y: 780 },
  { x: 980, y: 896 },
];

export type RouteEditingDemoScene = {
  kind: typeof ROUTE_EDITING_DEMO_KIND;
  title: string;
  caseLabel: string;
  graph: RelatedDiagramSemanticGraph;
  topology: RelatedDiagramRouteTopology;
  geometryCases: readonly RouteEditingDemoGeometryCase[];
};

export function buildRouteEditingDemoPatient(): RouteEditingDemoScene {
  const cards: RelatedDiagramCard[] = [
    card("i_demo", "information", "78歳男性", 48, 40, IW, IH),
    card("i_fever", "information", "発熱 38.5℃", 48, 140, IW, IH),
    card("i_fatigue", "information", "倦怠感", 48, 250, IW, IH),
    card("i_cough", "information", "咳・痰", 48, 420, IW, IH),
    card("i_night", "information", "夜間咳嗽で中途覚醒", 48, 540, IW, IH),
    card("i_appetite", "information", "食欲低下", 48, 700, IW, IH),
    card("i_htn", "information", "高血圧の既往", 48, 860, IW, IH),
    card("i_walk", "information", "安静度：病棟内歩行", 620, 128, IW, IH),
    card("i_med", "information", "降圧薬内服", 520, 860, IW, IH),
    card("u_pna", "understanding", "肺炎による炎症", 320, 140, UW, UH),
    card("u_low_act", "understanding", "活動量低下", 980, 140, UW, UH),
    card("u_adl", "understanding", "ADL低下", 1280, 80, UW, UH),
    card("u_sleep", "understanding", "睡眠中断", 980, 420, UW, UH),
    card("u_tired", "understanding", "疲労の蓄積", 320, 540, UW, UH),
    card("u_intake", "understanding", "摂取量低下", 320, 700, UW, UH),
    card("u_dehyd", "understanding", "脱水リスク", 980, 700, UW, UH),
    card("u_htn_ctrl", "understanding", "降圧薬による血圧管理", 980, 860, UW, UH),
    card("np_activity", "nursing_problem", "活動耐容能の低下", 1280, 780, NW, NH),
  ];

  const connections: RelatedDiagramConnection[] = [
    conn("red_c_i_demo_u_pna", "i_demo", "u_pna"),
    conn("red_c_i_fever_u_pna", "i_fever", "u_pna"),
    conn("red_c_u_pna_u_low_act", "u_pna", "u_low_act"),
    conn("red_c_i_fatigue_u_low_act", "i_fatigue", "u_low_act"),
    conn("red_c_u_low_act_u_adl", "u_low_act", "u_adl"),
    conn("red_c_u_adl_np", "u_adl", "np_activity", "nursing_problem_basis"),
    conn("red_c_u_low_act_np", "u_low_act", "np_activity", "nursing_problem_basis"),
    conn("red_c_i_cough_u_sleep", "i_cough", "u_sleep"),
    conn("red_c_i_night_u_sleep", "i_night", "u_sleep"),
    conn("red_c_u_sleep_u_tired", "u_sleep", "u_tired"),
    conn("red_c_u_pna_u_tired", "u_pna", "u_tired"),
    conn("red_c_i_appetite_u_intake", "i_appetite", "u_intake"),
    conn("red_c_u_intake_u_dehyd", "u_intake", "u_dehyd"),
    conn("red_c_i_htn_u_htn_ctrl", "i_htn", "u_htn_ctrl"),
    conn("red_c_i_med_u_htn_ctrl", "i_med", "u_htn_ctrl", "treatment"),
  ];

  const graph: RelatedDiagramSemanticGraph = {
    ...emptyRelatedDiagramGraph(),
    cards,
    connections,
    nursingProblems: [
      {
        cardId: "np_activity",
        status: "active",
        priority: 1,
        createdAt: TS,
        updatedAt: TS,
      },
    ],
    nursingProblemSupports: [
      {
        nursingProblemCardId: "np_activity",
        supportingCardId: "u_low_act",
        createdAt: TS,
      },
      {
        nursingProblemCardId: "np_activity",
        supportingCardId: "u_adl",
        createdAt: TS,
      },
    ],
  };

  const topology: RelatedDiagramRouteTopology = {
    ...emptyRouteTopology(),
    routes: [
      {
        connectionId: ROUTE_EDITING_DEMO_CONNECTION_IDS.existingBend,
        sourceEdge: "right",
        targetEdge: "left",
        points: ROUTE_EDITING_DEMO_EXISTING_BEND_POINTS.map((point) => ({
          ...point,
        })),
      },
    ],
  };

  return {
    kind: ROUTE_EDITING_DEMO_KIND,
    title: "Route Editing Demo",
    caseLabel: "78歳 肺炎入院 · Route Editing 確認用",
    graph,
    topology,
    geometryCases: ROUTE_EDITING_DEMO_GEOMETRY_CASES,
  };
}
