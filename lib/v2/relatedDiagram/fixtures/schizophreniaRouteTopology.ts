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

export function buildSchizophreniaKnowledgeTopology(): RelatedDiagramRouteTopology {
  const pathoBottom = pin("sk_patho_core", "bottom");
  const ntBottom = pin("sk_nt_imbalance", "bottom");
  const posBottom = pin("sk_positive", "bottom");
  const cogBottom = pin("sk_cognitive", "bottom");
  const avolTop = pin("sk_avolition", "top");
  const affectTop = pin("sk_affect", "top");

  const pathoBranch = { x: pathoBottom.x, y: pathoBottom.y + 28 };
  const ntBranch = { x: ntBottom.x, y: ntBottom.y + 36 };
  const posBranch = { x: posBottom.x, y: posBottom.y + 48 };
  const cogBranch = { x: cogBottom.x, y: cogBottom.y + 48 };
  const negBranch = {
    x: Math.round((avolTop.x + affectTop.x) / 2),
    y: avolTop.y - 24,
  };
  /** Independent Crossing with the positive trunk, interior to that V (not a vertex). */
  const negDetourY = posBottom.y + 28;
  const negDetourX = pin("sk_negative", "bottom").x;

  return {
    schema: "rd.routeTopology.v1",
    routeGroups: [
      {
        id: "rg_patho_core",
        sourceCardId: "sk_patho_core",
        trunkId: "tr_patho_core",
        connectionIds: ["skc2", "skc3"],
      },
      {
        id: "rg_nt_imbalance",
        sourceCardId: "sk_nt_imbalance",
        trunkId: "tr_nt_imbalance",
        connectionIds: ["skc6", "skc7", "skc8"],
      },
      {
        id: "rg_positive",
        sourceCardId: "sk_positive",
        trunkId: "tr_positive",
        connectionIds: ["skc9", "skc10", "skc11"],
      },
      {
        id: "rg_cognitive",
        sourceCardId: "sk_cognitive",
        trunkId: "tr_cognitive",
        connectionIds: ["skc14", "skc15"],
      },
      {
        id: "rg_negative",
        sourceCardId: "sk_negative",
        trunkId: "tr_negative",
        connectionIds: ["skc12", "skc13"],
      },
    ],
    trunks: [
      {
        id: "tr_patho_core",
        branchPointId: "bp_patho_core",
        connectionIds: ["skc2", "skc3"],
        points: poly(pin("sk_patho_core", "bottom"), stub("sk_patho_core", "bottom"), pathoBranch),
      },
      {
        id: "tr_nt_imbalance",
        branchPointId: "bp_nt_imbalance",
        connectionIds: ["skc6", "skc7", "skc8"],
        points: poly(pin("sk_nt_imbalance", "bottom"), stub("sk_nt_imbalance", "bottom"), ntBranch),
      },
      {
        id: "tr_positive",
        branchPointId: "bp_positive",
        connectionIds: ["skc9", "skc10", "skc11"],
        points: poly(pin("sk_positive", "bottom"), stub("sk_positive", "bottom"), posBranch),
      },
      {
        id: "tr_cognitive",
        branchPointId: "bp_cognitive",
        connectionIds: ["skc14", "skc15"],
        points: poly(pin("sk_cognitive", "bottom"), stub("sk_cognitive", "bottom"), cogBranch),
      },
      {
        id: "tr_negative",
        branchPointId: "bp_negative",
        connectionIds: ["skc12", "skc13"],
        points: poly(
          pin("sk_negative", "bottom"),
          stub("sk_negative", "bottom"),
          { x: negDetourX, y: negDetourY },
          { x: 12, y: negDetourY },
          { x: 12, y: negBranch.y },
          negBranch,
        ),
      },
    ],
    branchPoints: [
      { id: "bp_patho_core", ...pathoBranch, connectionIds: ["skc2", "skc3"] },
      { id: "bp_nt_imbalance", ...ntBranch, connectionIds: ["skc6", "skc7", "skc8"] },
      { id: "bp_positive", ...posBranch, connectionIds: ["skc9", "skc10", "skc11"] },
      { id: "bp_cognitive", ...cogBranch, connectionIds: ["skc14", "skc15"] },
      { id: "bp_negative", ...negBranch, connectionIds: ["skc12", "skc13"] },
    ],
    routes: [
      route("skc1", "right", "left", poly(pin("sk_disease", "right"), stub("sk_disease", "right"), stub("sk_patho_core", "left"), pin("sk_patho_core", "left"))),
      route("skc2", "bottom", "top", poly(pin("sk_patho_core", "bottom"), stub("sk_patho_core", "bottom"), pathoBranch, { x: pin("sk_da", "top").x, y: pathoBranch.y }, stub("sk_da", "top"), pin("sk_da", "top"))),
      route("skc3", "bottom", "top", poly(pin("sk_patho_core", "bottom"), stub("sk_patho_core", "bottom"), pathoBranch, { x: pin("sk_glu", "top").x, y: pathoBranch.y }, stub("sk_glu", "top"), pin("sk_glu", "top"))),
      route("skc4", "right", "left", poly(pin("sk_da", "right"), stub("sk_da", "right"), stub("sk_nt_imbalance", "left"), pin("sk_nt_imbalance", "left"))),
      route("skc5", "right", "left", poly(pin("sk_glu", "right"), stub("sk_glu", "right"), stub("sk_nt_imbalance", "left"), pin("sk_nt_imbalance", "left"))),
      route("skc6", "bottom", "top", poly(pin("sk_nt_imbalance", "bottom"), stub("sk_nt_imbalance", "bottom"), ntBranch, { x: pin("sk_positive", "top").x, y: ntBranch.y }, stub("sk_positive", "top"), pin("sk_positive", "top"))),
      route("skc7", "bottom", "top", poly(pin("sk_nt_imbalance", "bottom"), stub("sk_nt_imbalance", "bottom"), ntBranch, { x: pin("sk_negative", "top").x, y: ntBranch.y }, stub("sk_negative", "top"), pin("sk_negative", "top"))),
      route("skc8", "bottom", "top", poly(pin("sk_nt_imbalance", "bottom"), stub("sk_nt_imbalance", "bottom"), ntBranch, { x: pin("sk_cognitive", "top").x, y: ntBranch.y }, stub("sk_cognitive", "top"), pin("sk_cognitive", "top"))),
      route("skc9", "bottom", "top", poly(pin("sk_positive", "bottom"), stub("sk_positive", "bottom"), posBranch, { x: pin("sk_hallucination", "top").x, y: posBranch.y }, stub("sk_hallucination", "top"), pin("sk_hallucination", "top"))),
      route("skc10", "bottom", "top", poly(pin("sk_positive", "bottom"), stub("sk_positive", "bottom"), posBranch, { x: pin("sk_delusion", "top").x, y: posBranch.y }, stub("sk_delusion", "top"), pin("sk_delusion", "top"))),
      route("skc11", "bottom", "top", poly(pin("sk_positive", "bottom"), stub("sk_positive", "bottom"), posBranch, { x: pin("sk_thought", "top").x, y: posBranch.y }, stub("sk_thought", "top"), pin("sk_thought", "top"))),
      route("skc12", "bottom", "top", poly(pin("sk_negative", "bottom"), stub("sk_negative", "bottom"), { x: negDetourX, y: negDetourY }, { x: 12, y: negDetourY }, { x: 12, y: negBranch.y }, negBranch, { x: avolTop.x, y: negBranch.y }, stub("sk_avolition", "top"), pin("sk_avolition", "top"))),
      route("skc13", "bottom", "top", poly(pin("sk_negative", "bottom"), stub("sk_negative", "bottom"), { x: negDetourX, y: negDetourY }, { x: 12, y: negDetourY }, { x: 12, y: negBranch.y }, negBranch, { x: affectTop.x, y: negBranch.y }, stub("sk_affect", "top"), pin("sk_affect", "top"))),
      route("skc14", "bottom", "top", poly(pin("sk_cognitive", "bottom"), stub("sk_cognitive", "bottom"), cogBranch, { x: pin("sk_attention", "top").x, y: cogBranch.y }, stub("sk_attention", "top"), pin("sk_attention", "top"))),
      route("skc15", "bottom", "top", poly(pin("sk_cognitive", "bottom"), stub("sk_cognitive", "bottom"), cogBranch, { x: pin("sk_working_memory", "top").x, y: cogBranch.y }, stub("sk_working_memory", "top"), pin("sk_working_memory", "top"))),
      route("skc16", "bottom", "top", poly(pin("sk_da", "bottom"), stub("sk_da", "bottom"), stub("sk_positive", "top"), pin("sk_positive", "top"))),
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
