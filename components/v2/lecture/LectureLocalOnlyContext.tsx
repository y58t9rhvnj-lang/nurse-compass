"use client";

import { createContext, useContext } from "react";

/** true のとき Form/Evidence/Notes hooks は Server Action を呼ばない（講義デモ）。 */
const LectureLocalOnlyContext = createContext(false);

export function LectureLocalOnlyProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return (
    <LectureLocalOnlyContext.Provider value={value}>
      {children}
    </LectureLocalOnlyContext.Provider>
  );
}

export function useLectureLocalOnly(): boolean {
  return useContext(LectureLocalOnlyContext);
}
