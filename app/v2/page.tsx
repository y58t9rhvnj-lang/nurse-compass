import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile } from "@/lib/v2/auth/currentUser";

// /v2 は「振り分け」専用。認証状態と role に応じて着地点へ送る。
export const dynamic = "force-dynamic";

export default async function V2IndexPage() {
  if (!isSupabaseConfigured()) redirect("/v2/login");

  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive) redirect("/v2/login");

  // 初回パスワード未変更のユーザーは、role 別画面より先に変更画面へ誘導する。
  if (profile.mustChangePassword) redirect("/v2/change-password");

  // role 別ルーティング（student / teacher / admin）。
  if (profile.role === "admin") redirect("/v2/admin");
  if (profile.role === "teacher") redirect("/v2/teacher");
  redirect("/v2/student");
}
