"use client";

import {
  BookOpen,
  Calendar,
  ClipboardList,
  Compass,
  FileText,
  Home,
  MessageCircle,
  Network,
  NotebookPen,
  Settings,
  StickyNote,
  User,
  Users,
} from "lucide-react";
import { type FeatureFlagKey, isFeatureEnabled } from "@/lib/featureFlags";

export type AppView = "ward" | "patient" | "chart" | "workspace" | "form2";

const navItems: {
  label: string;
  icon: typeof Home;
  view?: AppView;
  badge?: number;
  flag?: FeatureFlagKey;
}[] = [
  { label: "病棟ホーム", icon: Home, view: "ward" },
  { label: "患者トップ", icon: Users, view: "patient" },
  { label: "電子カルテ", icon: FileText, view: "chart" },
  {
    label: "情報整理ノート",
    icon: NotebookPen,
    view: "workspace",
    flag: "informationNotebook",
  },
  {
    label: "精神様式2",
    icon: ClipboardList,
    view: "form2",
    flag: "form2Workspace",
  },
  { label: "情報BOX", icon: MessageCircle, badge: 2 },
  { label: "申し送り", icon: MessageCircle },
  { label: "スケジュール", icon: Calendar },
  { label: "業務メモ", icon: StickyNote },
  { label: "ラーニング", icon: BookOpen },
  { label: "関連図", icon: Network },
  { label: "設定", icon: Settings },
];

export default function SideNav({
  activeView,
  onNavigate,
}: {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <nav className="flex h-full w-full flex-col px-3 py-4">
      {/* ロゴ */}
      <div className="mb-4 flex items-center gap-2.5 px-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5EA] bg-white">
          <Compass className="h-5 w-5 text-[#0A84FF]" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-tight text-[#1D1D1F]">
            Nurse Compass
          </p>
          <p className="truncate text-[10px] text-[#8E8E93]">
            Aims Medical Center
          </p>
        </div>
      </div>

      {/* ナビ */}
      <ul className="flex flex-1 flex-col gap-1">
        {navItems
          .filter((item) => !item.flag || isFeatureEnabled(item.flag))
          .map(({ label, icon: Icon, view, badge }) => {
          const active = view !== undefined && view === activeView;
          const clickable = view !== undefined;
          return (
          <li key={label}>
            <button
              type="button"
              onClick={clickable ? () => onNavigate(view) : undefined}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] transition-colors",
                active
                  ? "bg-[#0A84FF] font-semibold text-white shadow-[0_2px_8px_rgba(10,132,255,0.3)]"
                  : "font-medium text-[#3A3A3C] hover:bg-[#F2F2F5]",
              ].join(" ")}
            >
              <Icon
                className="h-[18px] w-[18px] shrink-0"
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className="flex-1 truncate">{label}</span>
              {badge !== undefined && (
                <span
                  className={[
                    "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                    active
                      ? "bg-white text-[#0A84FF]"
                      : "bg-[#FF3B30] text-white",
                  ].join(" ")}
                >
                  {badge}
                </span>
              )}
            </button>
          </li>
          );
        })}
      </ul>

      {/* 看護師プロフィール */}
      <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#EBEBF0] bg-[#FAFAFC] p-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7FB2F0] to-[#0A84FF]">
          <User className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-[#1D1D1F]">
            田中 花子
          </p>
          <p className="truncate text-[10px] text-[#8E8E93]">看護師 · 南3病棟</p>
        </div>
      </div>
    </nav>
  );
}
