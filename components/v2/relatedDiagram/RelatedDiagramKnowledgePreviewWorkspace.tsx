"use client";

/**
 * DEV-only display preview of the initial pathophysiology Knowledge scene.
 * Uses resolveDevFixtureReadonlyScene({ includeStyleDemo: false }).
 * No persist load/save. No DB. Not student runtime.
 */

import { useEffect, useMemo } from "react";
import { resolveDevFixtureReadonlyScene } from "@/lib/v2/relatedDiagram/resolveReadonlyScene";
import { seedStableRouteState } from "@/lib/v2/relatedDiagram/incrementalRoutes";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramPrintPortal, {
  prepareRelatedDiagramPrint,
} from "./RelatedDiagramPrintPortal";
import RelatedDiagramWorkspaceToolbar from "./RelatedDiagramWorkspaceToolbar";
import { useA3Viewport } from "./useA3Viewport";

export default function RelatedDiagramKnowledgePreviewWorkspace() {
  const { viewportRef, transform, fitToView, resetTo100, percent } =
    useA3Viewport();
  const scene = useMemo(
    () => resolveDevFixtureReadonlyScene({ includeStyleDemo: false }),
    [],
  );
  const routeState = useMemo(
    () =>
      seedStableRouteState(
        scene.graph.cards,
        scene.graph.connections,
        scene.routeTopology,
      ),
    [scene],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(id);
  }, [fitToView]);

  const handlePrint = () => {
    prepareRelatedDiagramPrint();
    window.print();
  };

  return (
    <main
      data-rd-workspace="knowledge-preview"
      data-rd-source="dev_fixture"
      data-rd-style-demo="false"
      className="fixed inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden overscroll-none bg-[#EDEDF0]"
    >
      <RelatedDiagramWorkspaceToolbar
        percent={percent}
        onReset100={resetTo100}
        onFit={fitToView}
        onPrint={handlePrint}
        title="初期病態関連図"
        subtitle={`${scene.knowledgeTitle} · ${scene.knowledgeVersion} · preview · 編集なし`}
      />

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
            stableRouteState={routeState}
          />
        </div>
      </div>

      <RelatedDiagramPrintPortal>
        <div className="rd-print-root">
          <RelatedDiagramA3Surface
            graph={scene.graph}
            knowledgeLabel={scene.knowledgeTitle}
            routeTopology={scene.routeTopology}
            stableRouteState={routeState}
          />
        </div>
      </RelatedDiagramPrintPortal>
    </main>
  );
}
