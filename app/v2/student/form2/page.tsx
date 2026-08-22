import { requireRole } from "@/lib/v2/auth/currentUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * C8: 旧スタンドアロン様式2 URL。
 * 学生導線は AppShell 内の様式2 ワークスペースへ一本化するため、/v2/student へリダイレクトする。
 * ページは削除せず、ブックマーク・旧リンク用に残す。
 */
export default async function StudentForm2Page() {
  await requireRole("student");
  redirect("/v2/student");
}
