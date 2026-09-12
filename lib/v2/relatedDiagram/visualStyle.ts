/**
 * Pure Card/Connection → visual style mapping (Slice 1).
 * Semantics are Design Frozen; stroke/border details are UI-mock adjustable.
 */

import type {
  RelatedDiagramCardState,
  RelatedDiagramCardType,
  RelatedDiagramConnectionRelationType,
} from "./types";

export type CardBorderVisual = {
  borderStyle: "solid" | "dashed";
  borderWidthPx: number;
  borderColor: string;
  showByotaiLabel: boolean;
  showNursingProblemLabel: boolean;
  background: string;
};

export type ConnectionStrokeVisual = {
  stroke: string;
  strokeWidthPx: number;
  dasharray: string | null;
  marker: "arrow" | "arrow-thick";
};

export function resolveCardBorderVisual(
  cardType: RelatedDiagramCardType,
  state: RelatedDiagramCardState | null,
): CardBorderVisual {
  if (cardType === "knowledge") {
    return {
      borderStyle: "solid",
      borderWidthPx: 1.5,
      borderColor: "#6E6E73",
      showByotaiLabel: true,
      showNursingProblemLabel: false,
      background: "#F5F5F7",
    };
  }
  if (cardType === "information") {
    return {
      borderStyle: "solid",
      borderWidthPx: 1.5,
      borderColor: "#1D1D1F",
      showByotaiLabel: false,
      showNursingProblemLabel: false,
      background: "#FFFFFF",
    };
  }
  const potential = state === "potential";
  if (cardType === "nursing_problem") {
    return {
      borderStyle: potential ? "dashed" : "solid",
      borderWidthPx: potential ? 2 : 2.5,
      borderColor: "#0A5FCC",
      showByotaiLabel: false,
      showNursingProblemLabel: true,
      background: "#F0F7FF",
    };
  }
  // understanding
  return {
    borderStyle: potential ? "dashed" : "solid",
    borderWidthPx: potential ? 2 : 1.5,
    borderColor: "#1D1D1F",
    showByotaiLabel: false,
    showNursingProblemLabel: false,
    background: "#FFFFFF",
  };
}

const SOLID_ARROW: ConnectionStrokeVisual = {
  stroke: "#1D1D1F",
  strokeWidthPx: 1.5,
  dasharray: null,
  marker: "arrow",
};

export function resolveConnectionStrokeVisual(
  relation: RelatedDiagramConnectionRelationType,
): ConnectionStrokeVisual {
  switch (relation) {
    case "potential":
      return {
        stroke: "#1D1D1F",
        strokeWidthPx: 1.25,
        dasharray: "5 4",
        marker: "arrow",
      };
    case "treatment":
      return {
        stroke: "#1D1D1F",
        strokeWidthPx: 3.25,
        dasharray: null,
        marker: "arrow-thick",
      };
    case "nursing_problem_basis":
    case "nursing_problem_integration":
    case "current":
    default:
      return SOLID_ARROW;
  }
}
