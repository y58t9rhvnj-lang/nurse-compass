/**
 * Slice 2B-2F — Direct Card Create shared flow.
 * Understanding (2F-1) and Nursing Problem (2F-2).
 */

import {
  buildDirectInsightCard,
  canCommitDirectInsightCompose,
  type DirectInsightComposeDraft,
} from "./cardDirectInsight";
import {
  DIRECT_NURSING_PROBLEM_HEIGHT,
  DIRECT_NURSING_PROBLEM_WIDTH,
  buildDirectNursingProblemCard,
} from "./cardDirectNursingProblem";
import {
  insertCardEntity,
  nextCardZIndex,
  type CardEntitySnapshot,
} from "./form3ToUnderstandingCard";
import {
  placeDirectCard,
  type DirectCardPlacementResult,
} from "./placeDirectCard";
import type { RelatedDiagramSemanticGraph } from "./types";
import type { ScreenRect } from "./actionPopoverPlacement";

export const DIRECT_CARD_CREATE_TYPES = [
  "understanding",
  "nursing_problem",
] as const;

export type DirectCardCreateType = (typeof DIRECT_CARD_CREATE_TYPES)[number];

export const DIRECT_CARD_CREATE_TYPE_LABELS: Record<
  DirectCardCreateType,
  string
> = {
  understanding: "気づき・理解",
  nursing_problem: "看護問題",
};

export const DIRECT_CARD_NO_SPACE_MESSAGE =
  "カードを置くスペースがありません。配置を整理してから追加してください。";

export type DirectCardPlacementNotice = {
  kind: "no_space";
  message: typeof DIRECT_CARD_NO_SPACE_MESSAGE;
  tidyDiagramAvailable: false;
};

export function directCardNoSpaceNotice(): DirectCardPlacementNotice {
  return {
    kind: "no_space",
    message: DIRECT_CARD_NO_SPACE_MESSAGE,
    tidyDiagramAvailable: false,
  };
}

export function canOpenDirectCardTypeChooser(input: {
  connecting: boolean;
}): boolean {
  return !input.connecting;
}

export function isDirectCardCreateImplemented(
  type: DirectCardCreateType,
): boolean {
  return type === "understanding" || type === "nursing_problem";
}

export type DirectCardCreateSelectionUi = {
  selectedCardId: string;
  revealCardActions: false;
};

export function directCardCreateSelectionUi(
  cardId: string,
): DirectCardCreateSelectionUi {
  return {
    selectedCardId: cardId,
    revealCardActions: false,
  };
}

export function resolveAddCardAnchorRect(
  documentLike?: Pick<Document, "querySelectorAll" | "querySelector">,
): ScreenRect {
  const doc = documentLike ?? (typeof document === "undefined" ? null : document);
  if (doc) {
    const nodes = doc.querySelectorAll("[data-rd-add-card]");
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        return {
          x: box.left,
          y: box.top,
          width: box.width,
          height: box.height,
        };
      }
    }
    const overflow = doc.querySelector("[data-rd-toolbar-overflow]");
    if (overflow) {
      const box = overflow.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        return {
          x: box.left,
          y: box.top,
          width: box.width,
          height: box.height,
        };
      }
    }
  }
  return { x: 12, y: 4, width: 88, height: 44 };
}

export type CommitDirectCardResult =
  | {
      ok: true;
      graph: RelatedDiagramSemanticGraph;
      entity: CardEntitySnapshot;
      placement: Extract<DirectCardPlacementResult, { ok: true }>;
    }
  | {
      ok: false;
      reason: "invalid_draft" | "no_space";
      notice?: DirectCardPlacementNotice;
    };

export type CommitDirectUnderstandingResult = CommitDirectCardResult;

export function commitDirectUnderstandingCreate(input: {
  draft: DirectInsightComposeDraft;
  graph: RelatedDiagramSemanticGraph;
  desiredCenter?: { x: number; y: number };
  cardId?: string;
  now?: string;
}): CommitDirectCardResult {
  if (!canCommitDirectInsightCompose(input.draft)) {
    return { ok: false, reason: "invalid_draft" };
  }
  if (input.draft.state !== "current" && input.draft.state !== "potential") {
    return { ok: false, reason: "invalid_draft" };
  }
  const placement = placeDirectCard({
    desiredCenter: input.desiredCenter,
    otherCards: input.graph.cards,
  });
  if (!placement.ok) {
    return {
      ok: false,
      reason: "no_space",
      notice: directCardNoSpaceNotice(),
    };
  }
  const entity = buildDirectInsightCard({
    text: input.draft.text,
    state: input.draft.state,
    cardId: input.cardId,
    now: input.now,
    layout: {
      x: placement.x,
      y: placement.y,
      zIndex: nextCardZIndex(input.graph),
    },
  });
  return {
    ok: true,
    graph: insertCardEntity(input.graph, entity),
    entity,
    placement,
  };
}

export function commitDirectNursingProblemCreate(input: {
  draft: DirectInsightComposeDraft;
  graph: RelatedDiagramSemanticGraph;
  desiredCenter?: { x: number; y: number };
  cardId?: string;
  now?: string;
}): CommitDirectCardResult {
  if (!canCommitDirectInsightCompose(input.draft)) {
    return { ok: false, reason: "invalid_draft" };
  }
  if (input.draft.state !== "current" && input.draft.state !== "potential") {
    return { ok: false, reason: "invalid_draft" };
  }
  const placement = placeDirectCard({
    desiredCenter: input.desiredCenter,
    otherCards: input.graph.cards,
    size: {
      width: DIRECT_NURSING_PROBLEM_WIDTH,
      height: DIRECT_NURSING_PROBLEM_HEIGHT,
    },
  });
  if (!placement.ok) {
    return {
      ok: false,
      reason: "no_space",
      notice: directCardNoSpaceNotice(),
    };
  }
  const entity = buildDirectNursingProblemCard({
    text: input.draft.text,
    state: input.draft.state,
    cardId: input.cardId,
    now: input.now,
    layout: {
      x: placement.x,
      y: placement.y,
      zIndex: nextCardZIndex(input.graph),
    },
  });
  const graph = insertCardEntity(input.graph, entity);
  return {
    ok: true,
    graph,
    entity,
    placement,
  };
}

export function commitDirectCardCreate(input: {
  type: DirectCardCreateType;
  draft: DirectInsightComposeDraft;
  graph: RelatedDiagramSemanticGraph;
  desiredCenter?: { x: number; y: number };
  cardId?: string;
  now?: string;
}): CommitDirectCardResult {
  if (input.type === "nursing_problem") {
    return commitDirectNursingProblemCreate(input);
  }
  return commitDirectUnderstandingCreate(input);
}
