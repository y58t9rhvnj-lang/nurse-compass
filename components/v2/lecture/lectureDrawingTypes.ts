export type LectureToolMode = "off" | "pen" | "eraser";

export type LecturePoint = { x: number; y: number };

export type LectureStroke = {
  id: string;
  tool: "pen";
  color: string;
  width: number;
  points: LecturePoint[];
};

export const LECTURE_PEN_COLORS = [
  "#E11D48",
  "#2563EB",
  "#16A34A",
  "#CA8A04",
  "#0F172A",
] as const;

export const LECTURE_PEN_WIDTHS = [3, 5, 8, 12] as const;
