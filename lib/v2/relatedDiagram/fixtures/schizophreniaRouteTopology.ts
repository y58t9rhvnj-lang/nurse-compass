/**
 * Explicit route topology for the schizophrenia Knowledge fixture + DEV fans.
 * Layout metadata only. Semantic connections stay in the semantic graph.
 */

import {
  edgeMidpoint,
  outwardPoint,
  type EdgeSide,
  type Point,
} from "../orthogonalRouting";
import {
  mergeRouteTopologies,
  type ExplicitConnectionRoute,
  type RelatedDiagramRouteTopology,
} from "../routeTopology";
import {
  SCHIZOPHRENIA_KNOWLEDGE_CARDS,
  buildSlice1StyleDemoGraph,
} from "./schizophreniaPathophysiologyFixture";

const STUB = 14;

function card(id: string) {
  const c = SCHIZOPHRENIA_KNOWLEDGE_CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`missing knowledge card ${id}`);
  return c;
}

function pin(id: string, side: EdgeSide): Point {
  return edgeMidpoint(card(id).layout, side);
}

function stub(id: string, side: EdgeSide, len = STUB): Point {
  return outwardPoint(pin(id, side), side, len);
}

function colinearBetween(a: Point, b: Point, c: Point): boolean {
  const h = Math.abs(a.y - b.y) <= 0.2 && Math.abs(b.y - c.y) <= 0.2;
  const v = Math.abs(a.x - b.x) <= 0.2 && Math.abs(b.x - c.x) <= 0.2;
  if (h) {
    const lo = Math.min(a.x, c.x);
    const hi = Math.max(a.x, c.x);
    return b.x > lo + 0.2 && b.x < hi - 0.2;
  }
  if (v) {
    const lo = Math.min(a.y, c.y);
    const hi = Math.max(a.y, c.y);
    return b.y > lo + 0.2 && b.y < hi - 0.2;
  }
  return false;
}

function poly(...pts: Point[]): Point[] {
  const raw: Point[] = [];
  for (const p of pts) {
    const last = raw[raw.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.2 || Math.abs(last.y - p.y) > 0.2) {
      raw.push(p);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < raw.length; i++) {
    const prev = out[out.length - 1];
    const cur = raw[i]!;
    const next = raw[i + 1];
    if (prev && next && colinearBetween(prev, cur, next)) continue;
    out.push(cur);
  }
  return out;
}

function route(
  connectionId: string,
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
  points: Point[],
): ExplicitConnectionRoute {
  return { connectionId, sourceEdge, targetEdge, points };
}

function downFan(sourceId: string, branch: Point, targetId: string): Point[] {
  return poly(
    pin(sourceId, "bottom"),
    stub(sourceId, "bottom"),
    branch,
    { x: pin(targetId, "top").x, y: branch.y },
    stub(targetId, "top"),
    pin(targetId, "top"),
  );
}

export function buildSchizophreniaKnowledgeTopology(): RelatedDiagramRouteTopology {
  return {
    schema: "rd.routeTopology.v1",
    routeGroups: [],
    trunks: [],
    branchPoints: [],
    routes: [
      route("skc14", "bottom", "top", [
        { x: 1048.762975, y: 469.869621 },
        { x: 1048.762975, y: 489.869621 },
        { x: 1055.670157, y: 489.869621 },
        { x: 1055.670157, y: 558.342976 },
      ]),
      route("skc15", "right", "left", [
        { x: 1121.762975, y: 438.869621 },
        { x: 1141.762975, y: 438.869621 },
        { x: 1141.670157, y: 592.094835 },
        { x: 1151.023478, y: 592.094835 },
      ]),
      route("skc8", "right", "top", [
        { x: 976.548965, y: 359.869621 },
        { x: 1048.762975, y: 359.869621 },
        { x: 1048.762975, y: 407.869621 },
      ]),
      route("skc2", "bottom", "top", [
        { x: 706.758128, y: 343.45347 },
        { x: 706.758128, y: 363.45347 },
        { x: 722.237814, y: 363.45347 },
        { x: 722.237814, y: 349.381652 },
        { x: 722.237814, y: 373.381652 },
      ]),
      route("skc1", "right", "left", [
        { x: 585.741606, y: 310.199786 },
        { x: 609.758128, y: 310.199786 },
        { x: 609.758128, y: 307.45347 },
        { x: 633.758128, y: 307.45347 },
      ]),
      route("skc5", "right", "left", [
        { x: 795.237814, y: 409.381652 },
        { x: 815.237814, y: 409.381652 },
        { x: 806.548965, y: 409.381652 },
        { x: 806.548965, y: 359.869621 },
        { x: 830.548965, y: 359.869621 },
      ]),
      route("skc4", "left", "right", [
        { x: 649.237814, y: 409.381652 },
        { x: 628.003801, y: 409.381652 },
        { x: 628.003801, y: 485.693955 },
        { x: 604.003801, y: 485.693955 },
      ]),
      route("skc6", "bottom", "right", [
        { x: 531.003801, y: 521.693955 },
        { x: 531.003801, y: 541.693955 },
        { x: 547.816493, y: 541.693955 },
        { x: 547.816493, y: 564.521771 },
        { x: 523.816493, y: 564.521771 },
      ]),
      route("skc9", "left", "top", [
        { x: 377.816493, y: 576.521771 },
        { x: 305.840538, y: 576.521771 },
        { x: 305.840538, y: 679.462918 },
      ]),
      route("skc10", "right", "top", [
        { x: 523.816493, y: 588.521771 },
        { x: 543.816493, y: 588.521771 },
        { x: 543.816493, y: 658.436303 },
        { x: 478.606655, y: 658.436303 },
        { x: 478.606655, y: 682.436303 },
      ]),
      route("skc11", "right", "left", [
        { x: 523.816493, y: 576.521771 },
        { x: 560.437071, y: 576.521771 },
        { x: 560.437071, y: 712.054623 },
        { x: 584.437071, y: 712.054623 },
      ]),
      route("skc7", "bottom", "right", [
        { x: 903.548965, y: 395.869621 },
        { x: 903.548965, y: 496.809882 },
        { x: 809.581863, y: 496.809882 },
      ]),
      route("skc12", "bottom", "top", [
        { x: 724.581863, y: 527.809882 },
        { x: 724.581863, y: 547.809882 },
        { x: 668.292592, y: 547.809882 },
        { x: 668.292592, y: 583.661087 },
      ]),
      route("skc13", "bottom", "left", [
        { x: 748.581863, y: 527.809882 },
        { x: 748.581863, y: 547.809882 },
        { x: 767.664412, y: 547.809882 },
        { x: 767.664412, y: 605.890385 },
        { x: 791.664412, y: 605.890385 },
      ]),
      route("skc21", "right", "top", [
        { x: 809.581863, y: 508.809882 },
        { x: 964.064072, y: 508.809882 },
        { x: 964.064072, y: 661.501064 },
      ]),
    ],
  };
}

export function buildSlice1DemoTopology(): RelatedDiagramRouteTopology {
  const demo = buildSlice1StyleDemoGraph();
  const byId = new Map(demo.cards.map((c) => [c.id, c]));
  const pinDemo = (id: string, side: EdgeSide) =>
    edgeMidpoint(byId.get(id)!.layout, side);
  const stubDemo = (id: string, side: EdgeSide) =>
    outwardPoint(pinDemo(id, side), side, STUB);
  const branch = { x: 266, y: 842 };
  return {
    schema: "rd.routeTopology.v1",
    routeGroups: [
      {
        id: "rg_demo_junc",
        sourceCardId: "demo_junc_a",
        trunkId: "tr_demo_junc",
        connectionIds: ["demo_c_junc_b", "demo_c_junc_c", "demo_c_junc_d"],
      },
    ],
    trunks: [
      {
        id: "tr_demo_junc",
        branchPointId: "bp_demo_junc",
        connectionIds: ["demo_c_junc_b", "demo_c_junc_c", "demo_c_junc_d"],
        points: poly(pinDemo("demo_junc_a", "right"), stubDemo("demo_junc_a", "right"), branch),
      },
    ],
    branchPoints: [
      {
        id: "bp_demo_junc",
        ...branch,
        connectionIds: ["demo_c_junc_b", "demo_c_junc_c", "demo_c_junc_d"],
      },
    ],
    routes: [
      route("demo_c_junc_b", "right", "left", poly(pinDemo("demo_junc_a", "right"), stubDemo("demo_junc_a", "right"), branch, { x: 266, y: 742 }, stubDemo("demo_junc_b", "left"), pinDemo("demo_junc_b", "left"))),
      route("demo_c_junc_c", "right", "left", poly(pinDemo("demo_junc_a", "right"), stubDemo("demo_junc_a", "right"), branch, stubDemo("demo_junc_c", "left"), pinDemo("demo_junc_c", "left"))),
      route("demo_c_junc_d", "right", "left", poly(pinDemo("demo_junc_a", "right"), stubDemo("demo_junc_a", "right"), branch, { x: 266, y: 942 }, stubDemo("demo_junc_d", "left"), pinDemo("demo_junc_d", "left"))),
    ],
  };
}

export function buildSlice1DevRouteTopology(): RelatedDiagramRouteTopology {
  return mergeRouteTopologies(
    buildSchizophreniaKnowledgeTopology(),
    buildSlice1DemoTopology(),
  );
}
