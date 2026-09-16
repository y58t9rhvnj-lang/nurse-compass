/**
 * Slice 2B-1 simple placement. Reuses Slice 2A collision / legend / A3 clamp.
 * Not an auto-layout engine.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { resolveCardDropPosition } from "./a3CardBoundary";
import { resolveCardDropCollision } from "./cardCollision";
import {
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
} from "./form3ToUnderstandingCard";
import type { RelatedDiagramCard } from "./types";

export type PlaceForm3UnderstandingCardResult = {
  x: number;
  y: number;
  collided: boolean;
  resolution: ReturnType<typeof resolveCardDropCollision>["resolution"];
};

export function a3CenterPoint(
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): { x: number; y: number } {
  return { x: canvasWidth / 2, y: canvasHeight / 2 };
}

export function topLeftFromCenter(
  center: { x: number; y: number },
  size: { width: number; height: number } = {
    width: UNDERSTANDING_CARD_WIDTH,
    height: UNDERSTANDING_CARD_HEIGHT,
  },
): { x: number; y: number } {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
  };
}

export function placeForm3UnderstandingCard(input: {
  desiredCenter?: { x: number; y: number };
  otherCards: RelatedDiagramCard[];
  canvasWidth?: number;
  canvasHeight?: number;
  size?: { width: number; height: number };
}): PlaceForm3UnderstandingCardResult {
  const canvasWidth = input.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = input.canvasHeight ?? A3_HEIGHT_PX;
  const size = input.size ?? {
    width: UNDERSTANDING_CARD_WIDTH,
    height: UNDERSTANDING_CARD_HEIGHT,
  };
  const center = input.desiredCenter ?? a3CenterPoint(canvasWidth, canvasHeight);
  const desired = topLeftFromCenter(center, size);
  const clamped = resolveCardDropPosition(
    { ...desired, ...size },
    canvasWidth,
    canvasHeight,
  );
  const dropped = resolveCardDropCollision({
    movingCard: {
      id: "__form3_place__",
      x: clamped.x,
      y: clamped.y,
      width: size.width,
      height: size.height,
    },
    desiredPosition: { x: clamped.x, y: clamped.y },
    otherCards: input.otherCards,
    lastLegal: { x: clamped.x, y: clamped.y },
    canvasWidth,
    canvasHeight,
  });
  return {
    x: dropped.position.x,
    y: dropped.position.y,
    collided: dropped.collided,
    resolution: dropped.resolution,
  };
}
