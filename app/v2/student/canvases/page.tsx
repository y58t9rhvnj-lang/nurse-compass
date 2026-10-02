import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import FreeCanvasListClient from "@/components/v2/freeCanvas/FreeCanvasListClient";

export const dynamic = "force-dynamic";

export default async function StudentFreeCanvasListPage() {
  await requireRole("student");
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <Link href="/v2/student" className="text-sm text-slate-500 hover:underline">
          ← 病棟ホーム
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">自由キャンバス</h1>
      </header>
      <FreeCanvasListClient />
    </main>
  );
}
