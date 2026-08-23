"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import LectureBar from "@/components/v2/lecture/LectureBar";
import LectureWhiteboard from "@/components/v2/lecture/LectureWhiteboard";
import { useLectureDrawing } from "@/components/v2/lecture/useLectureDrawing";
import {
  LECTURE_DEMO_IDENTITY,
  LECTURE_DEMO_PATIENT_ID,
  LECTURE_DEMO_USER_ID,
} from "@/lib/v2/lecture/lectureDemo";

/**
 * Version 2.2 Sprint 1 — 講義用デモシェル（正式・凍結構成）。
 *
 * LecturePage
 * ├─ AppShell（固定デモ学生・localOnly）
 * ├─ LectureBar
 * └─ LectureWhiteboard
 *
 * 学生画面への直接描画・独自ズーム・独自ポインターは対象外。
 */
export default function LectureDemoShell() {
  const router = useRouter();
  const drawing = useLectureDrawing();

  const requestExit = useCallback(() => {
    const ok = window.confirm(
      "講義を終了しますか？\nホワイトボードの内容と講義中の編集は破棄されます。",
    );
    if (!ok) return;
    drawing.endLecture();
    router.push("/v2/teacher");
  }, [drawing.endLecture, router]);

  return (
    <div data-lecture-page-root className="relative h-dvh w-full">
      <AppShell
        mode="v2"
        lectureMode
        userId={LECTURE_DEMO_USER_ID}
        identity={LECTURE_DEMO_IDENTITY}
        fixedPatientId={LECTURE_DEMO_PATIENT_ID}
        inspectorEnabled
        initialForm2={null}
        initialForm3={null}
        initialPatientOverviewText=""
        initialEvidence={[]}
        initialNotes={[]}
      />

      <LectureBar api={drawing} onRequestExit={requestExit} />
      {drawing.whiteboardOpen ? (
        <LectureWhiteboard api={drawing} onRequestExit={requestExit} />
      ) : null}
    </div>
  );
}
