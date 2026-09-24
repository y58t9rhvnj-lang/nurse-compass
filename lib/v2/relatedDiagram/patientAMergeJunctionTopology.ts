/**
 * DEV ONLY — Patient A explicit target-merge Junction prototype.
 * Does not change the semantic graph. Does not infer Junctions from geometry.
 * Does not invert target merges into source-fan routeGroups / isFanChild.
 *
 * Authored topology only: branchPoints + trunks + routes.
 */

import { getA3LegendBounds } from "./a3Legend";
import { arrangeRelatedDiagramScene } from "./applyRelatedDiagramLayout";
import { applyPatientACardSizeScale } from "./patientACardSizeExperiment";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import { seedStableRouteState, type StableRouteState } from "./incrementalRoutes";
import {
  edgeMidpoint,
  type EdgeSide,
  type Point,
} from "./orthogonalRouting";
import {
  MIN_BRANCH_CLEARANCE,
  cardObstacle,
  defaultRouteCanvas,
  routeCardToBranch,
  routeFromBranchToChild,
} from "./routeHardening";
import { ROUTE_TOPOLOGY_SCHEMA, type RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramConnectionRelationType,
  RelatedDiagramSemanticGraph,
} from "./types";

export const PATIENT_A_DEV_MERGE_JUNCTION_KIND =
  "patient_a_explicit_merge_junction_dev_only" as const;

export const PATIENT_A_MERGE_JUNCTION_IDS = [
  "j_exec_in",
  "j_sleep_tx_in",
  "j_food_s_in",
  "j_role_s_in",
] as const;

export type PatientAMergeJunctionId =
  (typeof PATIENT_A_MERGE_JUNCTION_IDS)[number];

type MergeSpec = {
  id: PatientAMergeJunctionId;
  sourceKeys: [string, string];
  targetKey: string;
  relationType: RelatedDiagramConnectionRelationType;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
};

export const PATIENT_A_MERGE_JUNCTION_SPECS: MergeSpec[] = [
  {
    id: "j_exec_in",
    sourceKeys: ["advance", "laundry"],
    targetKey: "u_exec",
    relationType: "current",
    sourceEdge: "right",
    targetEdge: "left",
  },
  {
    id: "j_sleep_tx_in",
    sourceKeys: ["quetiapine", "zopiclone"],
    targetKey: "u_sleep_core",
    relationType: "treatment",
    sourceEdge: "bottom",
    targetEdge: "top",
  },
  {
    id: "j_food_s_in",
    sourceKeys: ["snack", "lighter"],
    targetKey: "u_food_adjust",
    relationType: "current",
    sourceEdge: "bottom",
    targetEdge: "top",
  },
  {
    id: "j_role_s_in",
    sourceKeys: ["no_home", "unemployed"],
    targetKey: "u_role_weak",
    relationType: "current",
    sourceEdge: "bottom",
    targetEdge: "top",
  },
];

function connectionId(from: string, to: string): string {
  return `pa_rs_c_${from}_${to}`;
}

function requireCard(
  cards: Map<string, RelatedDiagramCard>,
  id: string,
  label: string,
): RelatedDiagramCard {
  const card = cards.get(id);
  if (!card) throw new Error(`Missing card for ${label}: ${id}`);
  return card;
}

function requireConnection(
  connections: RelatedDiagramConnection[],
  id: string,
): RelatedDiagramConnection {
  const conn = connections.find((row) => row.id === id);
  if (!conn) throw new Error(`Missing connection ${id}`);
  return conn;
}

function pointHitsCard(point: Point, card: RelatedDiagramCard, pad: number): boolean {
  return (
    point.x >= card.layout.x - pad &&
    point.x <= card.layout.x + card.layout.width + pad &&
    point.y >= card.layout.y - pad &&
    point.y <= card.layout.y + card.layout.height + pad
  );
}

/** Fixed offset just before the target. Does not scan the whole A3. */
function terminalJunction(
  target: RelatedDiagramCard,
  targetEdge: EdgeSide,
  cards: RelatedDiagramCard[],
): Point {
  const pin = edgeMidpoint(target.layout, targetEdge);
  const gap = MIN_BRANCH_CLEARANCE + 12;
  let point =
    targetEdge === "left"
      ? { x: target.layout.x - gap, y: pin.y }
      : targetEdge === "right"
        ? { x: target.layout.x + target.layout.width + gap, y: pin.y }
        : targetEdge === "top"
          ? { x: pin.x, y: target.layout.y - gap }
          : { x: pin.x, y: target.layout.y + target.layout.height + gap };
  for (let i = 0; i < 12; i += 1) {
    const hit = cards.find((card) => pointHitsCard(point, card, 12));
    if (!hit) break;
    if (targetEdge === "left") point = { x: hit.layout.x - 16, y: point.y };
    else if (targetEdge === "right") {
      point = { x: hit.layout.x + hit.layout.width + 16, y: point.y };
    } else if (targetEdge === "top") point = { x: point.x, y: hit.layout.y - 16 };
    else {
      point = { x: point.x, y: hit.layout.y + hit.layout.height + 16 };
    }
  }
  return {
    x: Math.max(16, Math.min(1571, point.x)),
    y: Math.max(16, Math.min(1107, point.y)),
  };
}

function sharedSuffix(a: Point[], b: Point[]): Point[] {
  const out: Point[] = [];
  let i = a.length - 1;
  let j = b.length - 1;
  while (i >= 0 && j >= 0) {
    const left = a[i]!;
    const right = b[j]!;
    if (Math.abs(left.x - right.x) > 0.2 || Math.abs(left.y - right.y) > 0.2) {
      break;
    }
    out.push(left);
    i -= 1;
    j -= 1;
  }
  return out.reverse();
}

export function sharedTerminalPoints(a: Point[], b: Point[]): Point[] {
  return sharedSuffix(a, b);
}

export function buildPatientAMergeJunctionTopology(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  cardKeys: Record<string, string>;
}): RelatedDiagramRouteTopology {
  const cards = new Map(input.cards.map((card) => [card.id, card]));
  const obstacles = [
    ...input.cards.map(cardObstacle),
    { id: "__legend__", ...getA3LegendBounds() },
  ];
  const canvas = defaultRouteCanvas();
    const topology: RelatedDiagramRouteTopology = {
    schema: ROUTE_TOPOLOGY_SCHEMA,
    trunks: [],
    branchPoints: [],
    routeGroups: [],
    routes: [],
  };

  for (const spec of PATIENT_A_MERGE_JUNCTION_SPECS) {
    const sourceAId = input.cardKeys[spec.sourceKeys[0]];
    const sourceBId = input.cardKeys[spec.sourceKeys[1]];
    const targetId = input.cardKeys[spec.targetKey];
    if (!sourceAId || !sourceBId || !targetId) {
      throw new Error(`Missing cardKeys for ${spec.id}`);
    }
    const sourceA = requireCard(cards, sourceAId, spec.sourceKeys[0]);
    const sourceB = requireCard(cards, sourceBId, spec.sourceKeys[1]);
    const target = requireCard(cards, targetId, spec.targetKey);
    const connA = requireConnection(
      input.connections,
      connectionId(spec.sourceKeys[0], spec.targetKey),
    );
    const connB = requireConnection(
      input.connections,
      connectionId(spec.sourceKeys[1], spec.targetKey),
    );
    if (
      connA.relationType !== spec.relationType ||
      connB.relationType !== spec.relationType
    ) {
      throw new Error(`Relation mismatch for ${spec.id}`);
    }

    const targetPin = edgeMidpoint(target.layout, spec.targetEdge);
    const branch = terminalJunction(target, spec.targetEdge, input.cards);

    const trunkPoints = routeFromBranchToChild({
      branch,
      sourceEdge: spec.targetEdge,
      child: target,
      targetEdge: spec.targetEdge,
      obstacles,
      canvas,
    });
    const legA = routeCardToBranch({
      source: sourceA,
      sourceEdge: spec.sourceEdge,
      branch,
      obstacles,
      canvas,
    });
    const legB = routeCardToBranch({
      source: sourceB,
      sourceEdge: spec.sourceEdge,
      branch,
      obstacles,
      canvas,
    });

    const pointsA = [...legA.slice(0, -1), ...trunkPoints];
    const pointsB = [...legB.slice(0, -1), ...trunkPoints];

    topology.branchPoints.push({
      id: spec.id,
      x: branch.x,
      y: branch.y,
      connectionIds: [connA.id, connB.id],
    });
    topology.trunks.push({
      id: `tr_${spec.id}`,
      branchPointId: spec.id,
      connectionIds: [connA.id, connB.id],
      points: trunkPoints.map((point) => ({ ...point })),
    });
    topology.routes.push(
      {
        connectionId: connA.id,
        sourceEdge: spec.sourceEdge,
        targetEdge: spec.targetEdge,
        points: pointsA,
      },
      {
        connectionId: connB.id,
        sourceEdge: spec.sourceEdge,
        targetEdge: spec.targetEdge,
        points: pointsB,
      },
    );
  }

  return topology;
}

export function attachPatientAMergeJunctions(input: {
  graph: RelatedDiagramSemanticGraph;
  cardKeys: Record<string, string>;
}): {
  kind: typeof PATIENT_A_DEV_MERGE_JUNCTION_KIND;
  graph: RelatedDiagramSemanticGraph;
  topology: RelatedDiagramRouteTopology;
  routeState: StableRouteState;
} {
  const topology = buildPatientAMergeJunctionTopology({
    cards: input.graph.cards,
    connections: input.graph.connections,
    cardKeys: input.cardKeys,
  });
  return {
    kind: PATIENT_A_DEV_MERGE_JUNCTION_KIND,
    graph: input.graph,
    topology,
    routeState: seedStableRouteState(
      input.graph.cards,
      input.graph.connections,
      topology,
    ),
  };
}

export function buildPatientAJunctionReconstruction(scale: 90 | 100 | 85 = 90) {
  const scene = buildPatientAStudentReconstruction();
  const graph = applyPatientACardSizeScale(scene.graph, scale);
  return {
    ...attachPatientAMergeJunctions({
      graph,
      cardKeys: scene.cardKeys,
    }),
    cardKeys: scene.cardKeys,
    plainGraph: graph,
  };
}

export function patientAMergeConnectionIds(
  cardKeys: Record<string, string>,
): string[] {
  return PATIENT_A_MERGE_JUNCTION_SPECS.flatMap((spec) => [
    connectionId(spec.sourceKeys[0], spec.targetKey),
    connectionId(spec.sourceKeys[1], spec.targetKey),
  ]).filter((id, index, all) => all.indexOf(id) === index);
}

/**
 * DEV only. Arrange sees the same plain reconstruction routes as 90% 通常.
 * Target-merge topology is re-authored after Arrange. Arrange itself is unchanged.
 */
export function arrangeThenReattachPatientAMergeJunctions(input: {
  graph: RelatedDiagramSemanticGraph;
  cardKeys: Record<string, string>;
  previousPlainRouteState?: StableRouteState;
}) {
  const plainRouteState =
    input.previousPlainRouteState ??
    seedStableRouteState(input.graph.cards, input.graph.connections);
  const arranged = arrangeRelatedDiagramScene({
    graph: input.graph,
    routeState: plainRouteState,
  });
  const nextGraph = arranged.kind === "applied" ? arranged.graph : input.graph;
  return {
    arranged,
    attached: attachPatientAMergeJunctions({
      graph: nextGraph,
      cardKeys: input.cardKeys,
    }),
    plainRouteState:
      arranged.kind === "applied" ? arranged.routeState : plainRouteState,
  };
}
