import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/v2/auth/currentUser";
import NurseCompassLogo from "@/components/v2/brand/NurseCompassLogo";
import LogoutButton from "@/components/v2/LogoutButton";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

// 初回パスワード変更「専用」画面（認証必須・初回変更フラグでは弾かない）。
//   ・must_change_password=true : 変更画面を表示
//   ・must_change_password=false: /v2 へリダイレクト（任意の変更はここでは扱わない）
// 将来の任意パスワード変更は、プロフィールメニュー側の別画面・別導線で実装する。
export default async function ChangePasswordPage() {
  const profile = await requireActiveUser();

  // 初回変更が不要なユーザーはこの専用画面を使わせない。
  if (!profile.mustChangePassword) redirect("/v2");

  return (
    <main className="flex min-h-full w-full flex-col items-center justify-center bg-[#F2F4F7] px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="mb-8 flex w-full flex-col items-center text-center">
          <NurseCompassLogo
            variant="vertical"
            size={220}
            priority
            className="h-auto w-full max-w-[300px]"
          />
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            パスワードの設定
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            初回ログインです。安全のため、ご自身の新しいパスワードを設定してください。
          </p>

          <div className="mt-5">
            <ChangePasswordForm />
          </div>
        </div>

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
