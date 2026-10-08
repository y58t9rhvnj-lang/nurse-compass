export type ManualAudience = "student" | "teacher" | "admin";

export type ManualMarker = {
  n: number;
  /** Number badge position, percent of the image. */
  x: number;
  y: number;
  /** Optional target point the number points to. */
  tx?: number;
  ty?: number;
};

export type ManualShot = {
  src: string;
  alt: string;
  caption?: string;
  markers?: ManualMarker[];
};

export type ManualOpStep = {
  n: number;
  text: string;
};

export type ManualOp = {
  title: string;
  shots: ManualShot[];
  steps: ManualOpStep[];
  result?: string;
};

export type ManualChapter = {
  id: string;
  title: string;
  audience: ManualAudience;
  about: string;
  ops: ManualOp[];
};

export type ManualCatalog = {
  versionLabel: string;
  student: ManualChapter[];
  teacher: ManualChapter[];
  admin: ManualChapter[];
};
