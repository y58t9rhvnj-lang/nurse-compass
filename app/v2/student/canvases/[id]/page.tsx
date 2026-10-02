import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import { getFreeCanvasAction } from "@/app/v2/actions/freeCanvas";
import FreeCanvasWorkspace from "@/components/v2/freeCanvas/FreeCanvasWorkspace";

export const dynamic = "force-dynamic";

export default async function StudentFreeCanvasEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("student");
  const { id } = await params;
  const loaded = await getFreeCanvasAction({ id });
  if (!loaded.ok) {
    return (
      <main
        className="mx-auto w-full max-w-3xl px-6 py-10"
        data-free-canvas-missing="1"
      >
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {loaded.message}
        </p>
        <Link
          href="/v2/student/canvases"
          className="mt-4 inline-flex min-h-[44px] items-center text-sm text-slate-600 hover:underline"
        >
          一覧へ戻る
        </Link>
      </main>
    );
  }
  return <FreeCanvasWorkspace canvasId={id} />;
}
