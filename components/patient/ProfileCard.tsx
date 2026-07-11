import type { ReactNode } from "react";

// 患者トップ共通カード（Design System: 白・角丸16px・控えめな影）
export function ProfileCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#EBEBF0] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
        <h3 className="text-[13px] font-semibold text-[#1D1D1F]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

// 未入力プレースホルダ
export function EmptyNote() {
  return (
    <p className="rounded-xl bg-[#F7F7F9] px-3 py-2.5 text-[12px] text-[#AEAEB5]">
      未入力
    </p>
  );
}
