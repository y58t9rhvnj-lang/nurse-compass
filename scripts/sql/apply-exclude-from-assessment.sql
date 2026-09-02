-- Apply after 0029 migration file is reviewed.
-- Safe to re-run (idempotent updates).
-- Marks lecture verification students for exclude_from_assessment.

\i ../migrations/0029_profiles_exclude_from_assessment.sql
