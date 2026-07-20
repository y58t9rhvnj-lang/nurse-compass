"use client";

import {
  BookOpen,
  Calendar,
  ClipboardList,
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
import NurseCompassLogo from "@/components/v2/brand/NurseCompassLogo";
import { BRAND } from "@/lib/brand";
import { type FeatureFlagKey, isFeatureEnabled } from "@/lib/featureFlags";

// Version2 で会話・患者トップを電子カルテと並列に扱うためのビュー。
// V1 のビュー（ward/patient/chart/workspace/form2）は従来どおり。追加は加算のみ。
export type AppView =
  | "ward"
  | "patient"
  | "chart"
  | "workspace"
  | "form2"
  | "patient-top"
  | "conversation"
  | "clinical-workspace";

export type NavItem = {
  label: string;
  icon: typeof Home;
  view?: AppView;
  badge?: number;
  flag?: FeatureFlagKey;
};

// サイドバー識別情報（フッター表示）。V1 既定は看護師プロフィール。
export type SideNavIdentity = { name: string; subtitle: string };

const DEFAULT_IDENTITY: SideNavIdentity = {
  name: "田中 花子",
  subtitle: "看護師 · 南3病棟",
};

// V1（`/`）の既定ナビ。挙動・feature flag による出し分けは従来どおり。
const navItems: NavItem[] = [
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

// Version2 学生導線（`/v2/student`）のナビ。V1 の見た目・構成を基盤にする（Lecture Readiness）。
// 学生の学習導線: 病棟ホーム → 患者トップ → 電子カルテ・患者との会話 → Compassメモ（会話画面内）
//   → 思考ワークスペース（Learning Layer）→ Evidence 整理 → 様式2。
// V2 で加えるのは「思考ワークスペース」と「様式2（Supabase 保存）」のみ。
// V1 と同じ補助項目（情報BOX・申し送り 等）も踏襲する（view 未指定は非活性表示）。
// 「患者との会話」はメニューには出さない（会話画面自体は残し、患者トップから入る導線に一本化）。
export const STUDENT_NAV_ITEMS: NavItem[] = [
  { label: "病棟ホーム", icon: Home, view: "ward" },
  { label: "患者トップ", icon: Users, view: "patient-top" },
  { label: "電子カルテ", icon: FileText, view: "chart" },
  { label: "思考ワークスペース", icon: NotebookPen, view: "clinical-workspace" },
  { label: "様式2", icon: ClipboardList, view: "form2" },
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
  items = navItems,
  identity = DEFAULT_IDENTITY,
}: {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  items?: NavItem[];
  identity?: SideNavIdentity;
}) {
  return (
    <nav className="flex h-full w-full flex-col px-3 py-4">
      {/* ブランド（シンボルマーク＋名称）。アイコンは共有素材を参照（描き直さない）。
          隣に「Nurse Compass」テキストがあるためシンボルは装飾（alt=""）とする。 */}
      <div className="mb-4 flex items-center gap-2.5 px-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5EA] bg-white">
          <NurseCompassLogo variant="symbol" size={22} alt="" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-tight text-[#1D1D1F]">
            Nurse Compass
          </p>
          <p className="text-[10px] leading-tight text-[#8E8E93]">
            {BRAND.taglineEn}
          </p>
        </div>
      </div>

      {/* ナビ */}
      <ul className="flex flex-1 flex-col gap-1">
        {items
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
            {identity.name}
          </p>
          <p className="truncate text-[10px] text-[#8E8E93]">
            {identity.subtitle}
          </p>
        </div>
      </div>
    </nav>
  );
}
