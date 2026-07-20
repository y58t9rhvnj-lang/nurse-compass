import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

// Version2 (/v2 配下) の共通レイアウト。
// Version1 (/) とルート／責務を分離するための土台。
// ブランド統一（Sprint C）: タイトルはブランド名を absolute 指定（親 template を上書きし二重表記を避ける）。
export const metadata: Metadata = {
  title: { absolute: BRAND.name },
  description: BRAND.taglineEn,
};

export default function V2Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
