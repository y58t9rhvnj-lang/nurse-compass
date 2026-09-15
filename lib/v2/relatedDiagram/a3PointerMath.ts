/**
 * Client ↔ A3 logical coordinate math (Slice 2A).
 * Viewport translate/scale are never written into card layout.
 */

import type { A3ViewportTransform } from "./a3ViewportGesture";

export type ClientPoint = { x: number; y: number };
export type LogicalPoint = { x: number; y: number };

export function clientDeltaToLogical(
  deltaClientX: number,
  deltaClientY: number,
  scale: number,
): LogicalPoint {
  const s = scale === 0 ? 1 : scale;
  return {
    x: deltaClientX / s,
    y: deltaClientY / s,
  };
}

export function clientToLogical(
  client: ClientPoint,
  viewportOrigin: ClientPoint,
  transform: A3ViewportTransform,
): LogicalPoint {
  const s = transform.scale === 0 ? 1 : transform.scale;
  return {
    x: (client.x - viewportOrigin.x - transform.x) / s,
    y: (client.y - viewportOrigin.y - transform.y) / s,
  };
}

/** Drag position from pointer-down origin. Does not add viewport translate. */
export function logicalDragPosition(
  origin: LogicalPoint,
  startClient: ClientPoint,
  currentClient: ClientPoint,
  scale: number,
): LogicalPoint {
  const delta = clientDeltaToLogical(
    currentClient.x - startClient.x,
    currentClient.y - startClient.y,
    scale,
  );
  return {
    x: origin.x + delta.x,
    y: origin.y + delta.y,
  };
}
