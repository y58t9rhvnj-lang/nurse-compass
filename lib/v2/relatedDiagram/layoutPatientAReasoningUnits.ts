/**
 * DEV ONLY — Patient A Reasoning Unit semantic initial layout.
 * Not an Arrange / D0–D3 algorithm. Positions only; existing routing
 * is applied once by the caller via seedStableRouteState.
 *
 * patternKey is never used as layout ownership.
 * Shared Information is never duplicated.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import type { PatientADevSkeletonScene } from "./buildPatientAForm3Skeleton";
import { patientADevInformationCardId } from "./buildPatientAForm3Skeleton";
import {
  CARD_MIN_GAP,
  findNearestLegalPlacement,
  type CardCollisionBody,
} from "./cardCollision";
import {
  derivePatientAReasoningUnits,
  type PatientAReasoningUnitDerivation,
} from "./derivePatientAReasoningUnits";
import {
  PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
  type PatientAForm3SkeletonSnapshot,
} from "./fixtures/patientAForm3SkeletonSnapshot";
import {
  INFORMATION_CARD_HEIGHT,
  INFORMATION_CARD_WIDTH,
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
} from "./form3ToUnderstandingCard";
import type { RelatedDiagramSemanticGraph } from "./types";

export const PATIENT_A_DEV_UNINTEGRATED_POOL_LABEL = "未統合情報";

const MARGIN = 48;
const INDEPENDENT_STRIP = 230;
const ISOLATED_ROWS = 2;
const ISOLATED_COLS = 4;
const INNER_GAP = CARD_MIN_GAP + 20;
const UNDERSTANDING_FAN: Array<{ dx: number; dy: number }> = [
  { dx: 0, dy: 100 },
  { dx: 208, dy: 0 },
  { dx: 0, dy: -100 },
  { dx: -208, dy: 0 },
  { dx: 208, dy: 100 },
  { dx: -208, dy: 100 },
  { dx: 208, dy: -100 },
  { dx: -208, dy: -100 },
];
const EXCLUSIVE_OFFSETS: Array<{ dx: number; dy: number }> = [
  { dx: -(INFORMATION_CARD_WIDTH + CARD_MIN_GAP + 8), dy: 0 },
  { dx: 0, dy: -(INFORMATION_CARD_HEIGHT + CARD_MIN_GAP + 8) },
  {
    dx: -(INFORMATION_CARD_WIDTH + CARD_MIN_GAP + 8),
    dy: -(INFORMATION_CARD_HEIGHT + CARD_MIN_GAP + 8),
  },
  {
    dx: -(INFORMATION_CARD_WIDTH + CARD_MIN_GAP + 8),
    dy: INFORMATION_CARD_HEIGHT + CARD_MIN_GAP + 8,
  },
];

export type PatientAIsolatedPoolBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PatientAReasoningUnitLayoutResult = {
  graph: RelatedDiagramSemanticGraph;
  derivation: PatientAReasoningUnitDerivation;
  isolatedPool: PatientAIsolatedPoolBounds;
};

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isolatedBandTop(): number {
  return (
    A3_HEIGHT_PX -
    MARGIN -
    ISOLATED_ROWS * (INFORMATION_CARD_HEIGHT + CARD_MIN_GAP) +
    CARD_MIN_GAP -
    28
  );
}

function isolatedPoolBounds(): PatientAIsolatedPoolBounds {
  const width =
    ISOLATED_COLS * INFORMATION_CARD_WIDTH +
    (ISOLATED_COLS - 1) * CARD_MIN_GAP;
  const height =
    ISOLATED_ROWS * INFORMATION_CARD_HEIGHT +
    (ISOLATED_ROWS - 1) * CARD_MIN_GAP;
  return {
    x: MARGIN,
    y: isolatedBandTop() + 10,
    width,
    height,
  };
}

function isolatedReserveBody(): CardCollisionBody {
  const pool = isolatedPoolBounds();
  return {
    id: "__dev_isolated_reserve__",
    x: pool.x - 8,
    y: pool.y - 22,
    width: pool.width + 16,
    height: A3_HEIGHT_PX - (pool.y - 22) - 8,
  };
}

function pocketGrid(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  const cols = Math.min(3, count);
  return { cols, rows: Math.ceil(count / cols) };
}

function clusterCols(count: number): number {
  if (count <= 1) return 1;
  if (count <= 3) return count;
  return 2;
}

function placeLegal(
  id: string,
  desired: { x: number; y: number },
  width: number,
  height: number,
  occupied: CardCollisionBody[],
): { x: number; y: number } {
  const origin = { x: desired.x, y: desired.y, width, height };
  const found = findNearestLegalPlacement(origin, occupied);
  const pos = found ?? origin;
  occupied.push({
    id,
    x: pos.x,
    y: pos.y,
    width,
    height,
  });
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

function cardCenter(
  pos: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  return { x: pos.x + width / 2, y: pos.y + height / 2 };
}

function meanPoint(points: Array<{ x: number; y: number }>): {
  x: number;
  y: number;
} {
  let sx = 0;
  let sy = 0;
  for (const point of points) {
    sx += point.x;
    sy += point.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

function primaryPocketId(
  sharedInformationIds: string[],
  pockets: PatientAReasoningUnitDerivation["pockets"],
): string | null {
  if (sharedInformationIds.length === 0 || pockets.length === 0) return null;
  let bestId: string | null = null;
  let bestCount = -1;
  for (const pocket of pockets) {
    let count = 0;
    for (const id of sharedInformationIds) {
      if (pocket.informationIds.includes(id)) count += 1;
    }
    if (
      count > bestCount ||
      (count === bestCount &&
        bestId != null &&
        compareId(pocket.id, bestId) < 0)
    ) {
      bestCount = count;
      bestId = pocket.id;
    }
  }
  return bestCount > 0 ? bestId : null;
}

function pocketSpanCount(
  sharedInformationIds: string[],
  pockets: PatientAReasoningUnitDerivation["pockets"],
): number {
  let n = 0;
  for (const pocket of pockets) {
    if (sharedInformationIds.some((id) => pocket.informationIds.includes(id))) {
      n += 1;
    }
  }
  return n;
}

export function layoutPatientAReasoningUnitPositions(
  derivation: PatientAReasoningUnitDerivation,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const occupied: CardCollisionBody[] = [isolatedReserveBody()];
  const legend = getA3LegendBounds();
  const isolatedTop = isolatedBandTop();
  const anchorRegion = {
    x: MARGIN,
    y: MARGIN,
    width: Math.max(
      240,
      A3_WIDTH_PX - MARGIN - INDEPENDENT_STRIP - 16,
    ),
    height: Math.max(220, isolatedTop - MARGIN - 16),
  };

  const pockets = derivation.pockets;
  const grid = pocketGrid(Math.max(1, pockets.length));
  const cellW = anchorRegion.width / grid.cols;
  const cellH = anchorRegion.height / grid.rows;
  const pocketCenters = new Map<string, { x: number; y: number }>();

  pockets.forEach((pocket, index) => {
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    const cx = anchorRegion.x + col * cellW + cellW / 2;
    const cy = anchorRegion.y + row * cellH + cellH / 2;
    pocketCenters.set(pocket.id, { x: cx, y: cy });

    const ids = [...pocket.informationIds].sort(compareId);
    const cols = clusterCols(ids.length);
    const rows = Math.ceil(ids.length / cols);
    const clusterW =
      cols * INFORMATION_CARD_WIDTH + (cols - 1) * INNER_GAP;
    const clusterH =
      rows * INFORMATION_CARD_HEIGHT + (rows - 1) * INNER_GAP;
    const originX = cx - clusterW / 2;
    const originY = cy - clusterH / 2;

    ids.forEach((informationId, memberIndex) => {
      const mCol = memberIndex % cols;
      const mRow = Math.floor(memberIndex / cols);
      const cardId = patientADevInformationCardId(informationId);
      positions[cardId] = placeLegal(
        cardId,
        {
          x: originX + mCol * (INFORMATION_CARD_WIDTH + INNER_GAP),
          y: originY + mRow * (INFORMATION_CARD_HEIGHT + INNER_GAP),
        },
        INFORMATION_CARD_WIDTH,
        INFORMATION_CARD_HEIGHT,
        occupied,
      );
    });
  });

  const units = [...derivation.units].sort((a, b) =>
    compareId(a.assessmentId, b.assessmentId),
  );
  const independentUnits = units.filter(
    (unit) => unit.sharedInformationIds.length === 0,
  );
  const nextFan = new Map<string, number>();

  for (const unit of units) {
    const cardId = unit.understandingCardId;
    let desired: { x: number; y: number };
    if (unit.sharedInformationIds.length === 0) {
      const index = independentUnits.findIndex(
        (row) => row.assessmentId === unit.assessmentId,
      );
      desired = {
        x: A3_WIDTH_PX - MARGIN - UNDERSTANDING_CARD_WIDTH,
        y: MARGIN + index * (UNDERSTANDING_CARD_HEIGHT + CARD_MIN_GAP + 56),
      };
      if (desired.x + UNDERSTANDING_CARD_WIDTH > legend.x - 16) {
        desired.x = legend.x - UNDERSTANDING_CARD_WIDTH - 16;
      }
    } else {
      const centers = unit.sharedInformationIds.map((informationId) => {
        const pos = positions[patientADevInformationCardId(informationId)];
        return cardCenter(
          pos ?? { x: MARGIN, y: MARGIN },
          INFORMATION_CARD_WIDTH,
          INFORMATION_CARD_HEIGHT,
        );
      });
      const centroid = meanPoint(centers);
      desired = {
        x: centroid.x - UNDERSTANDING_CARD_WIDTH / 2,
        y: centroid.y - UNDERSTANDING_CARD_HEIGHT / 2,
      };
      const span = pocketSpanCount(unit.sharedInformationIds, pockets);
      const pocketId = primaryPocketId(unit.sharedInformationIds, pockets);
      if (span <= 1 && pocketId) {
        const slot = nextFan.get(pocketId) ?? 0;
        nextFan.set(pocketId, slot + 1);
        const fan = UNDERSTANDING_FAN[slot % UNDERSTANDING_FAN.length]!;
        desired = { x: desired.x + fan.dx, y: desired.y + fan.dy };
      }
    }
    if (desired.y + UNDERSTANDING_CARD_HEIGHT > isolatedTop - 8) {
      desired.y = isolatedTop - UNDERSTANDING_CARD_HEIGHT - 8;
    }
    positions[cardId] = placeLegal(
      cardId,
      desired,
      UNDERSTANDING_CARD_WIDTH,
      UNDERSTANDING_CARD_HEIGHT,
      occupied,
    );
  }

  const exclusiveIds = [...derivation.exclusiveInformationIds].sort(compareId);
  for (const informationId of exclusiveIds) {
    const unit = units.find((row) =>
      row.exclusiveInformationIds.includes(informationId),
    );
    const understanding = unit
      ? positions[unit.understandingCardId]
      : undefined;
    const localIndex = unit
      ? unit.exclusiveInformationIds.indexOf(informationId)
      : 0;
    const offset =
      EXCLUSIVE_OFFSETS[Math.max(0, localIndex) % EXCLUSIVE_OFFSETS.length]!;
    const desired = understanding
      ? { x: understanding.x + offset.dx, y: understanding.y + offset.dy }
      : { x: MARGIN, y: MARGIN };
    const cardId = patientADevInformationCardId(informationId);
    positions[cardId] = placeLegal(
      cardId,
      desired,
      INFORMATION_CARD_WIDTH,
      INFORMATION_CARD_HEIGHT,
      occupied,
    );
  }

  const pool = isolatedPoolBounds();
  const isolatedOccupied = occupied.filter(
    (body) => body.id !== "__dev_isolated_reserve__",
  );
  [...derivation.isolatedInformationIds].sort(compareId).forEach((informationId, index) => {
    const col = index % ISOLATED_COLS;
    const row = Math.floor(index / ISOLATED_COLS);
    const cardId = patientADevInformationCardId(informationId);
    positions[cardId] = placeLegal(
      cardId,
      {
        x: pool.x + col * (INFORMATION_CARD_WIDTH + CARD_MIN_GAP),
        y: pool.y + row * (INFORMATION_CARD_HEIGHT + CARD_MIN_GAP),
      },
      INFORMATION_CARD_WIDTH,
      INFORMATION_CARD_HEIGHT,
      isolatedOccupied,
    );
  });

  return positions;
}

export function applyPatientAReasoningUnitLayout(
  scene: PatientADevSkeletonScene,
  snapshot: PatientAForm3SkeletonSnapshot = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
): PatientAReasoningUnitLayoutResult {
  const derivation = derivePatientAReasoningUnits(snapshot);
  const positions = layoutPatientAReasoningUnitPositions(derivation);
  const graph: RelatedDiagramSemanticGraph = {
    ...scene.graph,
    cards: scene.graph.cards.map((card) => {
      const next = positions[card.id];
      if (!next) return card;
      if (card.layout.x === next.x && card.layout.y === next.y) return card;
      return {
        ...card,
        layout: {
          ...card.layout,
          x: next.x,
          y: next.y,
        },
      };
    }),
    connections: scene.graph.connections.map((conn) => ({ ...conn })),
    cardSources: scene.graph.cardSources.map((source) => ({ ...source })),
  };
  return {
    graph,
    derivation,
    isolatedPool: isolatedPoolBounds(),
  };
}
