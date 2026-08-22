import Link from "next/link";
import { notFound } from "next/navigation";
import { GoldStandardDetailView } from "@/components/v2/gold/GoldStandardDetailView";
import { requireTeacherGoldStandardDetail } from "@/lib/gold/access";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ patientId: string }>;
};

/**
 * 教員向け Gold Standard 詳細。
 * ルート: /v2/teacher/gold-standard/[patientId]
 */
export default async function TeacherGoldStandardDetailPage({
  params,
}: PageProps) {
  const { patientId } = await params;
  if (!patientId || patientId.trim().length === 0) {
    notFound();
  }

  const detail = await requireTeacherGoldStandardDetail(patientId.trim());

  if (!detail.ok && detail.kind === "not_found") {
    notFound();
  }

  if (!detail.ok && detail.kind === "unauthorized") {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-xl font-bold text-slate-900">アクセスできません</h1>
        <p className="mt-2 text-sm text-slate-600">{detail.message}</p>
      </main>
    );
  }

  if (!detail.ok) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-xl font-bold text-red-800">表示できません</h1>
        <p className="mt-2 text-sm text-slate-700">{detail.message}</p>
        {detail.unresolvedIds && detail.unresolvedIds.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 font-mono text-sm text-slate-700">
            {detail.unresolvedIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4">
          <Link
            href="/v2/teacher/gold-standard"
            className="text-sm font-medium text-slate-700 underline"
          >
            一覧へ戻る
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/v2/teacher/gold-standard"
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
        >
          ← Gold Standard 一覧
        </Link>
        <Link
          href="/v2/teacher"
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
        >
          教員ホーム
        </Link>
      </div>
      <GoldStandardDetailView
        document={detail.document}
        resolvedPoints={detail.resolvedPoints}
      />
    </main>
  );
}
