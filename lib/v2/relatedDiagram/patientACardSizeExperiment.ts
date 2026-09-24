/**
 * DEV ONLY — Patient A card-size corridor experiment.
 * Does not change production card constants, Arrange, routing, or Junctions.
 *
 * Scales logical layout.width / layout.height so collision and routing
 * see the smaller boxes. Do not visually shrink cards with CSS scale.
 */

import { A3_BODY_PT, A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { CARD_MIN_GAP } from "./cardCollision";
import { DIRECT_NURSING_PROBLEM_HEIGHT, DIRECT_NURSING_PROBLEM_WIDTH } from "./cardDirectNursingProblem";
import { KNOWLEDGE_CARD_HEIGHT_SHORT, KNOWLEDGE_CARD_WIDTH } from "./fixtures/schizophreniaPathophysiologyFixture";
import {
  INFORMATION_CARD_HEIGHT,
  INFORMATION_CARD_WIDTH,
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
} from "./form3ToUnderstandingCard";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardType,
  RelatedDiagramSemanticGraph,
} from "./types";

export const PATIENT_A_CARD_SIZE_SCALES = [100, 90, 85] as const;
export type PatientACardSizeScale = (typeof PATIENT_A_CARD_SIZE_SCALES)[number];

export const PATIENT_A_DEFAULT_CARD_SIZE_SCALE: PatientACardSizeScale = 100;

export type PatientADevCardChrome = {
  padding: string;
  knowledgePadding: string;
  fontSizePt: number;
  lineHeight: number;
};

export type PatientACardBox = {
  width: number;
  height: number;
};

const PRODUCTION_BOX: Record<RelatedDiagramCardType, PatientACardBox> = {
  information: {
    width: INFORMATION_CARD_WIDTH,
    height: INFORMATION_CARD_HEIGHT,
  },
  understanding: {
    width: UNDERSTANDING_CARD_WIDTH,
    height: UNDERSTANDING_CARD_HEIGHT,
  },
  knowledge: {
    width: KNOWLEDGE_CARD_WIDTH,
    height: KNOWLEDGE_CARD_HEIGHT_SHORT,
  },
  nursing_problem: {
    width: DIRECT_NURSING_PROBLEM_WIDTH,
    height: DIRECT_NURSING_PROBLEM_HEIGHT,
  },
};

/** Knowledge long card used on the canvas is 146×72 in several fixtures. */
export const PRODUCTION_KNOWLEDGE_CARD_HEIGHT = 72;

function scalePx(value: number, scale: PatientACardSizeScale): number {
  return Math.round((value * scale) / 100);
}

export function patientACardBoxForType(
  cardType: RelatedDiagramCardType,
  scale: PatientACardSizeScale,
  currentHeight?: number,
): PatientACardBox {
  const base = PRODUCTION_BOX[cardType];
  const height =
    cardType === "knowledge" && currentHeight && currentHeight >= 70
      ? scalePx(PRODUCTION_KNOWLEDGE_CARD_HEIGHT, scale)
      : scalePx(base.height, scale);
  return {
    width: scalePx(base.width, scale),
    height,
  };
}

/**
 * Padding is reduced first so 10.5pt body text can stay.
 * 85% only slightly tightens line-height.
 */
export function patientADevCardChrome(
  scale: PatientACardSizeScale,
): PatientADevCardChrome {
  if (scale === 90) {
    return {
      padding: "4px 6px",
      knowledgePadding: "4px 5px",
      fontSizePt: A3_BODY_PT,
      lineHeight: 1.35,
    };
  }
  if (scale === 85) {
    return {
      padding: "4px 5px",
      knowledgePadding: "3px 5px",
      fontSizePt: A3_BODY_PT,
      lineHeight: 1.3,
    };
  }
  return {
    padding: "6px 8px",
    knowledgePadding: "5px 7px",
    fontSizePt: A3_BODY_PT,
    lineHeight: 1.35,
  };
}

export function applyPatientACardSizeScale(
  graph: RelatedDiagramSemanticGraph,
  scale: PatientACardSizeScale,
): RelatedDiagramSemanticGraph {
  return {
    ...graph,
    cards: graph.cards.map((card) => {
      const box = patientACardBoxForType(
        card.cardType,
        scale,
        card.layout.height,
      );
      if (
        card.layout.width === box.width &&
        card.layout.height === box.height
      ) {
        return card;
      }
      return {
        ...card,
        layout: {
          ...card.layout,
          width: box.width,
          height: box.height,
        },
      };
    }),
  };
}

export type PatientACorridorSample = {
  cardArea: number;
  canvasArea: number;
  occupancy: number;
  overlapPairs: number;
  tightPairs: number;
  usableVerticalCorridors: number;
  usableHorizontalCorridors: number;
  meanMinGap: number;
};

function edgeGap(a: RelatedDiagramCard, b: RelatedDiagramCard): {
  overlap: boolean;
  verticalCorridor: number | null;
  horizontalCorridor: number | null;
  gap: number;
} {
  const ax2 = a.layout.x + a.layout.width;
  const ay2 = a.layout.y + a.layout.height;
  const bx2 = b.layout.x + b.layout.width;
  const by2 = b.layout.y + b.layout.height;
  const xOverlap = a.layout.x < bx2 && ax2 > b.layout.x;
  const yOverlap = a.layout.y < by2 && ay2 > b.layout.y;
  const dx = Math.max(0, Math.max(a.layout.x - bx2, b.layout.x - ax2));
  const dy = Math.max(0, Math.max(a.layout.y - by2, b.layout.y - ay2));
  if (xOverlap && yOverlap) {
    return { overlap: true, verticalCorridor: null, horizontalCorridor: null, gap: 0 };
  }
  if (xOverlap) {
    return {
      overlap: false,
      verticalCorridor: dy,
      horizontalCorridor: null,
      gap: dy,
    };
  }
  if (yOverlap) {
    return {
      overlap: false,
      verticalCorridor: null,
      horizontalCorridor: dx,
      gap: dx,
    };
  }
  return {
    overlap: false,
    verticalCorridor: null,
    horizontalCorridor: null,
    gap: Math.hypot(dx, dy),
  };
}

const USABLE_MIN = CARD_MIN_GAP;
const USABLE_MAX = 96;

export function measurePatientACorridors(
  cards: RelatedDiagramCard[],
): PatientACorridorSample {
  const cardArea = cards.reduce(
    (sum, card) => sum + card.layout.width * card.layout.height,
    0,
  );
  const canvasArea = A3_WIDTH_PX * A3_HEIGHT_PX;
  let overlapPairs = 0;
  let tightPairs = 0;
  let usableVerticalCorridors = 0;
  let usableHorizontalCorridors = 0;
  const minGaps: number[] = [];

  for (let i = 0; i < cards.length; i += 1) {
    let nearest = Number.POSITIVE_INFINITY;
    for (let j = 0; j < cards.length; j += 1) {
      if (i === j) continue;
      const sample = edgeGap(cards[i]!, cards[j]!);
      if (sample.gap < nearest) nearest = sample.gap;
      if (j <= i) continue;
      if (sample.overlap) overlapPairs += 1;
      if (!sample.overlap && sample.gap > 0 && sample.gap < CARD_MIN_GAP) {
        tightPairs += 1;
      }
      if (
        sample.verticalCorridor != null &&
        sample.verticalCorridor >= USABLE_MIN &&
        sample.verticalCorridor <= USABLE_MAX
      ) {
        usableVerticalCorridors += 1;
      }
      if (
        sample.horizontalCorridor != null &&
        sample.horizontalCorridor >= USABLE_MIN &&
        sample.horizontalCorridor <= USABLE_MAX
      ) {
        usableHorizontalCorridors += 1;
      }
    }
    if (Number.isFinite(nearest)) minGaps.push(nearest);
  }

  return {
    cardArea,
    canvasArea,
    occupancy: cardArea / canvasArea,
    overlapPairs,
    tightPairs,
    usableVerticalCorridors,
    usableHorizontalCorridors,
    meanMinGap:
      minGaps.length === 0
        ? 0
        : minGaps.reduce((sum, gap) => sum + gap, 0) / minGaps.length,
  };
}

export const PATIENT_A_PRODUCTION_CARD_CONTRACT = {
  information: { width: 180, height: 72 },
  understanding: { width: 180, height: 72 },
  knowledgeShort: { width: 146, height: 62 },
  knowledge: { width: 146, height: 72 },
  nursingProblem: { width: 200, height: 78 },
  fontSizePt: 10.5,
  lineHeight: 1.35,
  padding: "6px 8px",
  knowledgePadding: "5px 7px",
  overflow: "hidden",
} as const;
