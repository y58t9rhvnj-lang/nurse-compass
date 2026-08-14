// Compass Version2.1 — Learning Workspace 種別（React 非依存）。
// WorkspaceHost / validate スクリプトから共有する。

export type LearningWorkspaceView = "clinical-workspace" | "form3";

export function isLearningWorkspaceView(
  view: string,
): view is LearningWorkspaceView {
  return view === "clinical-workspace" || view === "form3";
}
