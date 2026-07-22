import Link from "next/link";
import { requireAdminProfile } from "@/lib/v2/auth/currentUser";
import { listStudents, STUDENTS_PAGE_SIZE } from "@/lib/v2/admin/studentRepository";
import type { AdminStudentListItem } from "@/lib/v2/admin/studentTypes";
import StudentSearchForm from "./StudentSearchForm";

export const dynamic = "force-dynamic";

// role 判定は app/v2/admin/layout.tsx に集約済み。ここでは表示用に profile を取得。
function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return 1;
  return n;
}

function firstString(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" ? v : "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "有効" : "無効"}
    </span>
  );
}

function InitialSetupBadge({ pending }: { pending: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        pending ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"
      }`}
    >
      {pending ? "初回設定未完了" : "初回設定完了"}
    </span>
  );
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  // service role クエリ前に、サーバー側で Admin 本人を確定する（認可境界）。
  const profile = await requireAdminProfile();

  const q = firstString(sp.q).trim();
  const requestedPage = parsePage(sp.page);

  const result = await listStudents({
    organizationId: profile.organizationId,
    q,
    page: requestedPage,
  });

  const totalPages =
    result.total === 0 ? 1 : Math.ceil(result.total / STUDENTS_PAGE_SIZE);
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);

  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/v2/admin/students?${query}` : "/v2/admin/students";
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-2">
        <Link href="/v2/admin" className="text-sm text-sky-700 hover:underline">
          ← 管理者ホーム
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">学生一覧</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/v2/admin/students/import"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            CSV一括登録
          </Link>
          <Link
            href="/v2/admin/students/new"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            学生を登録
          </Link>
        </div>
      </header>

      <div className="mb-4">
        <StudentSearchForm defaultQuery={q} />
      </div>

      <p className="mb-3 text-sm text-slate-500">
        {result.total} 件{q ? `（「${q}」で検索）` : ""}
      </p>

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {q
            ? "条件に一致する学生が見つかりませんでした。"
            : "登録されている学生がいません。"}
        </div>
      ) : (
        <>
          {/* 広い画面: テーブル */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">学籍番号</th>
                  <th className="px-4 py-3 font-semibold">氏名</th>
                  <th className="px-4 py-3 font-semibold">状態</th>
                  <th className="px-4 py-3 font-semibold">初回設定</th>
                  <th className="px-4 py-3 font-semibold">作成日</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {result.items.map((s: AdminStudentListItem) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {s.studentNumber ?? s.loginId}
                    </td>
                    <td className="px-4 py-3 text-slate-900">{s.displayName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={s.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <InitialSetupBadge pending={s.mustChangePassword} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/v2/admin/students/${s.id}`}
                        className="text-sky-700 hover:underline"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 狭い画面(iPad縦/スマホ): カード */}
          <ul className="space-y-3 sm:hidden">
            {result.items.map((s: AdminStudentListItem) => (
              <li
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-slate-500">
                      {s.studentNumber ?? s.loginId}
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {s.displayName}
                    </p>
                  </div>
                  <Link
                    href={`/v2/admin/students/${s.id}`}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-sky-700"
                  >
                    詳細
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge active={s.isActive} />
                  <InitialSetupBadge pending={s.mustChangePassword} />
                  <span className="text-xs text-slate-500">
                    {formatDate(s.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ページング */}
      {result.total > 0 ? (
        <nav className="mt-6 flex items-center justify-between gap-3 text-sm">
          {currentPage > 1 ? (
            <Link
              href={buildHref(currentPage - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              ← 前へ
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-300">
              ← 前へ
            </span>
          )}

          <span className="text-slate-500">
            {currentPage} / {totalPages} ページ
          </span>

          {currentPage < totalPages ? (
            <Link
              href={buildHref(currentPage + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              次へ →
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-300">
              次へ →
            </span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
