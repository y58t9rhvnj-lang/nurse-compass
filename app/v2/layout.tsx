import type { Metadata } from "next";

// Version2 (/v2 配下) の共通レイアウト。
// Version1 (/) とルート／責務を分離するための土台。
// Phase 1 では最小限（メタデータ設定と children の受け渡し）のみ。
export const metadata: Metadata = {
  title: "Compass Version2 β",
};

export default function V2Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
