-- =====================================================================
-- Compass Version 2.2 — Related Diagram Persistence P2
-- 0031_related_diagram_route_scene.sql
-- Adds nullable route_scene to related_diagram_records.
-- Does not backfill, rewrite semantic_graph, or generate routes.
-- RLS stays row-level from 0030; this column inherits the same policies.
-- =====================================================================

alter table public.related_diagram_records
  add column if not exists route_scene jsonb null;

comment on column public.related_diagram_records.route_scene is
  'Persisted rd.routeScene.v1 JSON (resolved geometry + authored topology). null = no saved geometry. Not part of semantic_graph. Parser/restore lives in application code.';
