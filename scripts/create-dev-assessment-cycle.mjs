#!/usr/bin/env node
/**
 * Sprint 2 — 開発用 assessment_cycle 作成手順（本番へ勝手に seed しない）。
 *
 * 使い方（Admin / service role の SQL エディタで実行）:
 *
 * 1. 組織 UUID と作成者（admin）UUID を確認する
 * 2. 下記 INSERT のプレースホルダを置換する
 * 3. case_id はサーバ解決値（現状患者 A → SP-001）
 *
 * open cycle は organization_id + case_id あたり 1 件のみにしてください。
 * 複数あると提出 RPC が ambiguous_cycle で中止します。
 */

const EXAMPLE_SQL = `
-- === 開発用: 提出期間を 1 件 open にする例 ===
-- :org_id    = organizations.id
-- :admin_id  = profiles.id (role=admin)
-- deadline は Asia/Tokyo 17:00 を timestamptz で指定

insert into public.assessment_cycles (
  organization_id,
  case_id,
  title,
  opens_at,
  deadline_at,
  closes_at,
  status,
  created_by
) values (
  ':org_id'::uuid,
  'SP-001',
  '患者A 課題提出（開発用）',
  now() - interval '7 days',
  timestamptz '2026-12-12 17:00:00+09',
  null,
  'open',
  ':admin_id'::uuid
);
`;

console.log(EXAMPLE_SQL.trim());
console.log("\n# 確認:");
console.log(
  "select id, title, status, deadline_at from assessment_cycles where case_id = 'SP-001' and status = 'open';",
);
