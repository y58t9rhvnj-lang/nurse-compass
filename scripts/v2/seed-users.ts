/**
 * Compass Version2 β — アカウント初期投入スクリプト（管理者用）
 *
 * 学生本人による新規登録は行わない。教員・学生・admin のアカウントは
 * このスクリプトで作成する。service role key を使うためサーバー（ローカル端末）
 * でのみ実行し、ブラウザへは絶対に露出させない。
 *
 * 使い方:
 *   1) .env.local に以下を設定
 *      NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, V2_AUTH_EMAIL_DOMAIN
 *   2) 入力ファイル（JSON または CSV）を用意（例: scripts/v2/seed-users.example.json）
 *      実データ（実名・パスワード）は *.local.json 等に置き、Git へコミットしない。
 *   3) 実行
 *      npx tsx --env-file=.env.local scripts/v2/seed-users.ts scripts/v2/seed-users.local.json
 *
 * 入力レコード:
 *   { loginId, password, displayName, role, studentNumber?, className? }
 *   role は student / teacher / admin。academic_year は 2026 固定、
 *   organization は slug 'default' に紐づける。
 *
 * 注意:
 *   - login_id は英数字とハイフンのみ（正規化後に一意）
 *   - 仮想メール（login_id@ドメイン）は内部専用。出力しない
 *   - パスワードはログ出力しない
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  loginIdToAuthEmail,
  normalizeLoginId,
} from "../../lib/v2/auth/loginId";

type SeedRole = "student" | "teacher" | "admin";

type SeedRecord = {
  loginId: string;
  password: string;
  displayName: string;
  role: SeedRole;
  studentNumber?: string;
  className?: string;
};

const ACADEMIC_YEAR = 2026;
const ORG_SLUG = "default";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) fail(`環境変数 ${name} が未設定です（.env.local を確認）。`);
  return v;
}

function parseInput(path: string): SeedRecord[] {
  const raw = readFileSync(path, "utf8");
  if (path.endsWith(".json")) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) fail("JSON はレコードの配列である必要があります。");
    return data as SeedRecord[];
  }
  // 簡易 CSV（ヘッダ: loginId,password,displayName,role,studentNumber,className）。
  // 値にカンマを含めないこと（含める場合は JSON を使用）。
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines.shift();
  if (!header) fail("CSV が空です。");
  const cols = header.split(",").map((c) => c.trim());
  return lines.map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const rec: Record<string, string> = {};
    cols.forEach((c, i) => (rec[c] = values[i] ?? ""));
    return {
      loginId: rec.loginId,
      password: rec.password,
      displayName: rec.displayName,
      role: rec.role as SeedRole,
      studentNumber: rec.studentNumber || undefined,
      className: rec.className || undefined,
    };
  });
}

async function main() {
  const inputPath = process.argv[2] ?? "scripts/v2/seed-users.local.json";
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const domain = readEnv("V2_AUTH_EMAIL_DOMAIN");

  const records = parseInput(inputPath);
  if (records.length === 0) fail("入力レコードが 0 件です。");

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 既定組織の id を取得。
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();
  if (orgError || !org) {
    fail(
      `organizations(slug=${ORG_SLUG}) が見つかりません。先に migrations を適用してください。`,
    );
  }
  const organizationId = org.id as string;

  let created = 0;
  let skipped = 0;

  for (const rec of records) {
    let loginId: string;
    try {
      loginId = normalizeLoginId(rec.loginId);
    } catch {
      console.warn(`- skip: login_id が不正です（${rec.loginId}）`);
      skipped++;
      continue;
    }
    if (!["student", "teacher", "admin"].includes(rec.role)) {
      console.warn(`- skip: role が不正です（${loginId}）`);
      skipped++;
      continue;
    }
    if (!rec.password || !rec.displayName) {
      console.warn(`- skip: password / displayName が未設定（${loginId}）`);
      skipped++;
      continue;
    }

    const email = loginIdToAuthEmail(loginId, domain);

    const { data: userRes, error: userError } = await admin.auth.admin.createUser({
      email,
      password: rec.password,
      email_confirm: true,
      user_metadata: { login_id: loginId },
    });

    if (userError || !userRes?.user) {
      // 既に存在する等。詳細（メール）は出さず login_id のみ表示。
      console.warn(`- skip: Authユーザー作成に失敗（${loginId}）`);
      skipped++;
      continue;
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userRes.user.id,
        login_id: loginId,
        display_name: rec.displayName,
        student_number: rec.studentNumber ?? null,
        class_name: rec.className ?? null,
        role: rec.role,
        organization_id: organizationId,
        academic_year: ACADEMIC_YEAR,
        is_active: true,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      console.warn(`- warn: profile 保存に失敗（${loginId}）: ${profileError.message}`);
      skipped++;
      continue;
    }

    created++;
    console.log(`+ ok: ${loginId} (${rec.role})`);
  }

  console.log(`\n完了: 作成 ${created} 件 / スキップ ${skipped} 件`);
}

main().catch((e) => fail(String(e)));
