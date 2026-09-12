"use client";

/**
 * DEV-only Slice 1 A3 workspace for iPad / LAN touch verification.
 * Uses the same viewport + surface + connection renderers as student runtime,
 * but loads resolveDevFixtureReadonlyScene (never used by student production path).
 */

import { useEffect } from "react";
import { resolveDevFixtureReadonlyScene } from "@/lib/v2/relatedDiagram/resolveReadonlyScene";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramPrintPortal, {
  prepareRelatedDiagramPrint,
} from "./RelatedDiagramPrintPortal";
import RelatedDiagramWorkspaceToolbar from "./RelatedDiagramWorkspaceToolbar";
import { useA3Viewport } from "./useA3Viewport";

export default function RelatedDiagramDevFixtureWorkspace() {
  const { viewportRef, transform, fitToView, resetTo100, percent } =
    useA3Viewport();

  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });

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
      data-rd-workspace="dev-fixture"
      data-rd-source="dev_fixture"
      className="relative flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden bg-[#EDEDF0]"
    >
      <RelatedDiagramWorkspaceToolbar
        percent={percent}
        onReset100={resetTo100}
        onFit={fitToView}
        onPrint={handlePrint}
        title="Related Diagram Slice 1 · DEV fixture"
        subtitle={`${scene.knowledgeTitle} · ${scene.knowledgeVersion} · not student runtime`}
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
    </main>
  );
}
