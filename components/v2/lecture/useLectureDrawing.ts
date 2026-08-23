"use client";

import { useCallback, useRef, useState } from "react";
import {
  LECTURE_PEN_COLORS,
  LECTURE_PEN_WIDTHS,
  type LecturePoint,
  type LectureStroke,
  type LectureToolMode,
} from "./lectureDrawingTypes";

const ERASE_SESSION_ID = "__erase__";

function newStrokeId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dist2(a: LecturePoint, b: LecturePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** 消しゴム: 近傍のペンストロークを除去 */
function eraseNearPoint(
  strokes: LectureStroke[],
  point: LecturePoint,
  radius: number,
): LectureStroke[] {
  const r2 = radius * radius;
  return strokes.filter(
    (s) => !s.points.some((p) => dist2(p, point) <= r2),
  );
}

/**
 * 講義用描画状態（ホワイトボード専用・メモリのみ）。
 * sessionStorage は使わない。講義終了で破棄。
 */
export function useLectureDrawing() {
  const [mode, setMode] = useState<LectureToolMode>("off");
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [strokes, setStrokes] = useState<LectureStroke[]>([]);
  const [undoStack, setUndoStack] = useState<LectureStroke[][]>([]);
  const [penColor, setPenColor] = useState<string>(LECTURE_PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(LECTURE_PEN_WIDTHS[1]);
  const drawingRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  const pushUndo = useCallback((prev: LectureStroke[]) => {
    setUndoStack((stack) => [...stack.slice(-39), prev]);
  }, []);

  const beginStroke = useCallback(
    (point: LecturePoint, tool: "pen" | "eraser") => {
      if (!whiteboardOpen) return;

      if (tool === "eraser") {
        activeIdRef.current = ERASE_SESSION_ID;
        drawingRef.current = true;
        const radius = Math.max(penWidth * 3, 20);
        setStrokes((prev) => {
          pushUndo(prev);
          return eraseNearPoint(prev, point, radius);
        });
        return;
      }

      const id = newStrokeId();
      activeIdRef.current = id;
      drawingRef.current = true;
      setStrokes((prev) => {
        pushUndo(prev);
        return [
          ...prev,
          {
            id,
            tool: "pen",
            color: penColor,
            width: penWidth,
            points: [point],
          },
        ];
      });
    },
    [whiteboardOpen, penColor, penWidth, pushUndo],
  );

  const extendStroke = useCallback(
    (point: LecturePoint) => {
      const id = activeIdRef.current;
      if (!id || !drawingRef.current || !whiteboardOpen) return;

      if (id === ERASE_SESSION_ID) {
        setStrokes((prev) => {
          const radius = Math.max(penWidth * 3, 20);
          return eraseNearPoint(prev, point, radius);
        });
        return;
      }

      setStrokes((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, points: [...s.points, point] } : s,
        ),
      );
    },
    [whiteboardOpen, penWidth],
  );

  const endStroke = useCallback(() => {
    drawingRef.current = false;
    activeIdRef.current = null;
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack.slice(0, -1);
      const restore = stack[stack.length - 1] ?? [];
      setStrokes(restore);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      pushUndo(prev);
      return [];
    });
  }, [pushUndo]);

  const openWhiteboard = useCallback(() => {
    setWhiteboardOpen(true);
    setMode("pen");
  }, []);

  const closeWhiteboard = useCallback(() => {
    drawingRef.current = false;
    activeIdRef.current = null;
    setWhiteboardOpen(false);
    setMode("off");
  }, []);

  const selectMode = useCallback(
    (next: LectureToolMode) => {
      if (next === "off") {
        setMode("off");
        return;
      }
      // pen / eraser はホワイトボード内のみ
      if (!whiteboardOpen) {
        setWhiteboardOpen(true);
      }
      setMode(next);
    },
    [whiteboardOpen],
  );

  const endLecture = useCallback(() => {
    drawingRef.current = false;
    activeIdRef.current = null;
    setMode("off");
    setWhiteboardOpen(false);
    setStrokes([]);
    setUndoStack([]);
  }, []);

  return {
    mode,
    whiteboardOpen,
    strokes,
    penColor,
    penWidth,
    setPenColor,
    setPenWidth,
    selectMode,
    openWhiteboard,
    closeWhiteboard,
    beginStroke,
    extendStroke,
    endStroke,
    undo,
    clearAll,
    endLecture,
    canUndo: undoStack.length > 0,
  };
}

export type LectureDrawingApi = ReturnType<typeof useLectureDrawing>;
