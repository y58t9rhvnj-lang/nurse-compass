"use client";

/**
 * Related Diagram V1 Slice 1 — read-only A3 workspace (student).
 * Knowledge pathology foundation only. No style demo. No fixture fallback.
 */

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { loadRelatedDiagramReadonlySceneAction } from "@/app/v2/actions/relatedDiagramReadonly";
import type { RelatedDiagramReadonlyScene } from "@/lib/v2/relatedDiagram/resolveReadonlyScene";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramPrintPortal, {
  prepareRelatedDiagramPrint,
} from "./RelatedDiagramPrintPortal";
import RelatedDiagramWorkspaceToolbar from "./RelatedDiagramWorkspaceToolbar";
import { useA3Viewport } from "./useA3Viewport";

type WorkspaceLoadState =
  | { status: "loading" }
  | { status: "ready"; scene: RelatedDiagramReadonlyScene }
  | { status: "empty"; message: string }
  | { status: "error"; message: string };

export default function RelatedDiagramReadonlyWorkspace({
  patientId,
  onBack,
}: {
  patientId: string;
  onBack?: () => void;
}) {
  const { viewportRef, transform, fitToView, resetTo100, percent } =
    useA3Viewport();

  const [loadState, setLoadState] = useState<WorkspaceLoadState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    void (async () => {
      const result = await loadRelatedDiagramReadonlySceneAction(patientId);
      if (cancelled) return;
      if (!result.ok) {
        if (result.kind === "unauthorized" || result.kind === "validation") {
          setLoadState({
            status: "error",
            message: "関連図を表示できません。",
          });
          return;
        }
        setLoadState({
          status: "error",
          message:
            "病態関連図の読み込みに失敗しました。時間をおいて再度お試しください。",
        });
        return;
      }
      if (result.status === "empty") {
        setLoadState({ status: "empty", message: result.message });
        return;
      }
      setLoadState({ status: "ready", scene: result.scene });
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    if (loadState.status !== "ready") return;
    const id = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(id);
  }, [fitToView, loadState]);

  const handlePrint = () => {
    prepareRelatedDiagramPrint();
    window.print();
  };

  const scene = loadState.status === "ready" ? loadState.scene : null;
  const subtitle =
    loadState.status === "loading"
      ? "読み込み中…"
      : loadState.status === "empty"
        ? "病態関連図未設定"
        : loadState.status === "error"
          ? "読み込みエラー"
          : `${scene!.knowledgeTitle} · ${scene!.knowledgeVersion} · 編集不可`;

  return (
    <main
      data-rd-workspace="readonly"
      data-rd-load={loadState.status}
      data-rd-source={scene?.source ?? "none"}
      data-patient-id={patientId}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#EDEDF0]"
    >
      <RelatedDiagramWorkspaceToolbar
        percent={percent}
        onReset100={resetTo100}
        onFit={fitToView}
        onPrint={handlePrint}
        title="関連図（閲覧）"
        subtitle={subtitle}
        leading={
          onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[14px] text-[#0A5FCC]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              戻る
            </button>
          ) : null
        }
      />

      {loadState.status === "loading" ? (
        <div className="flex flex-1 items-center justify-center text-[14px] text-[#6E6E73]">
          読み込み中…
        </div>
      ) : null}

      {loadState.status === "empty" ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
          data-rd-empty
        >
          <p className="text-[16px] font-medium text-[#1D1D1F]">
            {loadState.message}
          </p>
          <p className="max-w-md text-[13px] text-[#6E6E73]">
            教員が事例に病態 Knowledge を設定すると、ここに土台が表示されます。
          </p>
        </div>
      ) : null}

      {loadState.status === "error" ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
          data-rd-error
        >
          <p className="text-[16px] font-medium text-[#1D1D1F]">
            {loadState.message}
          </p>
        </div>
      ) : null}

      {loadState.status === "ready" && scene ? (
        <>
          <div
            ref={viewportRef}
            data-rd-viewport
            className="relative z-0 min-h-0 flex-1 touch-none overflow-hidden bg-[#D1D1D6]/55"
            style={{ touchAction: "none" }}
          >
            <div
              data-rd-canvas-transform
              className="origin-top-left will-change-transform"
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              }}
            >
              <RelatedDiagramA3Surface
                graph={scene.graph}
                knowledgeLabel={scene.knowledgeTitle}
                routeTopology={scene.routeTopology}
              />
            </div>
          </div>

          <RelatedDiagramPrintPortal>
            <div className="rd-print-root">
              <RelatedDiagramA3Surface
                graph={scene.graph}
                knowledgeLabel={scene.knowledgeTitle}
                routeTopology={scene.routeTopology}
              />
            </div>
          </RelatedDiagramPrintPortal>
        </>
      ) : null}
    </main>
  );
}
