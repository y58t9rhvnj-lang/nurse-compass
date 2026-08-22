import Link from "next/link";
import { requireTeacherGoldStandardList } from "@/lib/gold/access";

export const dynamic = "force-dynamic";

/**
 * 教員向け Gold Standard 一覧。
 * ルート: /v2/teacher/gold-standard
 */
export default async function TeacherGoldStandardListPage() {
  const list = await requireTeacherGoldStandardList();

  if (!list.ok) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-xl font-bold text-slate-900">アクセスできません</h1>
        <p className="mt-2 text-sm text-slate-600">{list.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Patient Understanding First
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Gold Standard（教員用）
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            思考の更新過程を追体験するための読み取り専用教材です。完成答案の提示ではありません。
          </p>
        </div>
        <Link
          href="/v2/teacher"
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
        >
          教員ホーム
        </Link>
      </div>

      <ul className="space-y-3">
        {list.items.map((item) => (
          <li
            key={item.patientId}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {item.patientId}さん
                </p>
                <p className="mt-1 text-sm text-slate-600">{item.title}</p>
                <dl className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-slate-500">caseId</dt>
                    <dd className="font-mono">{item.caseId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">schemaVersion</dt>
                    <dd>{item.schemaVersion}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">CTP件数</dt>
                    <dd>{item.ctpCount}</dd>
                  </div>
                </dl>
              </div>
              <Link
                href={`/v2/teacher/gold-standard/${item.patientId}`}
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                開く
              </Link>
            </div>
          </li>
        ))}
        {list.items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            表示できる Gold Standard がありません。
          </li>
        ) : null}
      </ul>
    </main>
  );
}
