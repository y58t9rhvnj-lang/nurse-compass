import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile } from "@/lib/v2/auth/currentUser";

// /v2 は「振り分け」専用。認証状態と role に応じて着地点へ送る。
export const dynamic = "force-dynamic";

export default async function V2IndexPage() {
  if (!isSupabaseConfigured()) redirect("/v2/login");

  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive) redirect("/v2/login");

  // admin は今回 teacher 相当（admin 専用画面は未実装）。
  if (profile.role === "teacher" || profile.role === "admin") {
    redirect("/v2/teacher");
  }
  redirect("/v2/student");
}
