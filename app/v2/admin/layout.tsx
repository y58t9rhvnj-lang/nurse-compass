import { requireRole } from "@/lib/v2/auth/currentUser";

export const dynamic = "force-dynamic";

// /v2/admin 配下すべてに適用される Admin ガード。
//
// requireRole("admin") が以下を一括で担保する（サーバー側で必ず制御）:
//   ・未認証            → /v2/login（proxy + requireActiveUser）
//   ・is_active=false   → /v2/login
//   ・must_change_password=true → /v2/change-password（role 判定より先）
//   ・role=student/teacher → /v2 へ戻し、自分の role 画面へ振り分け
//   ・role=admin        → 通過（子ページを表示）
//
// 各 Admin ページで role 判定を重複実装しないこと（ここに集約する）。
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");
  // globals.css は html/body に overflow:hidden; height:100dvh を課しており
  // （iPad バウンス防止のアプリシェル設計）、各画面が内部スクロール領域を持つ前提。
  // Admin ページは通常のドキュメントフローなので、ここで /v2/admin/* 専用の
  // 縦スクロール領域を用意する（集計 → 登録ボタン → 一覧 まで到達できるようにする）。
  return (
    <div className="h-dvh overflow-y-auto overscroll-contain">{children}</div>
  );
}
