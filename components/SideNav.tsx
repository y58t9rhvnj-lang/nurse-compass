"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ClipboardList,
  FileText,
  Home,
  LayoutList,
  LogOut,
  MessageCircle,
  MessageSquareText,
  Network,
  NotebookPen,
  Settings,
  StickyNote,
  User,
  Users,
  Send,
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
  | "form3"
  | "submissions"
  | "feedback"
  | "patient-top"
  | "conversation"
  | "clinical-workspace"
  // Evidence 整理専用の内部ビュー（Sprint D-2B 画面構成修正）。サイドバー項目にはせず、
  // 思考ワークスペースの様式2 ヘッダーにある「根拠を整理する」からのみ到達する。
  | "evidence-review"
  // Related Diagram V1 Slice 1（read-only A3）。学生サイドナビから到達。
  | "related-diagram";

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
//   → 様式2（Learning Layer）→ Evidence 整理 → 様式3。
// V2 で加えるのは「様式2（作成）」と「様式3」のみ。旧「様式2確認」ナビは C8 で外す。
// 「患者との会話」はメニューには出さない（会話画面自体は残し、患者トップから入る導線に一本化）。
export const STUDENT_NAV_ITEMS: NavItem[] = [
  { label: "病棟ホーム", icon: Home, view: "ward" },
  { label: "患者トップ", icon: Users, view: "patient-top" },
  { label: "電子カルテ", icon: FileText, view: "chart" },
  { label: "様式2", icon: ClipboardList, view: "clinical-workspace" },
  { label: "様式3", icon: LayoutList, view: "form3" },
  { label: "提出", icon: Send, view: "submissions" },
  { label: "フィードバック", icon: MessageSquareText, view: "feedback" },
  { label: "情報BOX", icon: MessageCircle, badge: 2 },
  { label: "申し送り", icon: MessageCircle },
  { label: "スケジュール", icon: Calendar },
  { label: "業務メモ", icon: StickyNote },
  { label: "ラーニング", icon: BookOpen },
  { label: "関連図", icon: Network, view: "related-diagram" },
  { label: "設定", icon: Settings },
];

export default function SideNav({
  activeView,
  onNavigate,
  items = navItems,
  identity = DEFAULT_IDENTITY,
  onLogout,
  selectedPatientName,
}: {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  items?: NavItem[];
  identity?: SideNavIdentity;
  // 指定時（V2 学生シェル）は最下部の識別情報を「ユーザーメニュー」にし、ログアウトを提供する。
  // 未指定時（V1）は従来どおり静的なプロフィール表示のまま（挙動不変）。
  onLogout?: () => void;
  // 選択中（受け持ち）の患者名。指定時はブランド直下に控えめに表示する（Sprint D-2D ②）。
  // 病棟ホームで患者タイルを選ぶと自動遷移せず、この表示で選択状態が分かる。
  selectedPatientName?: string;
}) {
  return (
    // サイドバーは画面高に収める縦 flex（ページスクロールを起こさない）。
    // ブランド／患者カード／学生メニューは固定（shrink-0）、中央のナビ一覧のみが内部スクロールする。
    // 最下部は home indicator / Safari UI と重ならないよう safe-area 分の余白を足す。
    <nav className="flex h-full min-h-0 w-full flex-col overflow-hidden px-3 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {/* ブランド（シンボルマーク＋名称）。アイコンは共有素材を参照（描き直さない）。
          隣に「Nurse Compass」テキストがあるためシンボルは装飾（alt=""）とする。 */}
      <div className="mb-4 flex shrink-0 items-center gap-2.5 px-1">
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

      {/* 受け持ち患者（選択状態）の表示（Sprint D-2D ②）。V2 学生シェルのみ（selectedPatientName 指定時）。 */}
      {selectedPatientName && (
        <div className="mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-[#D6E6FA] bg-[#F2F7FF] px-2.5 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white">
            <Users className="h-4 w-4 text-[#0A6CD6]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-medium leading-tight text-[#6E86A8]">
              受け持ち患者
            </span>
            <span className="block truncate text-[13px] font-semibold leading-tight text-[#0A5FCC]">
              {selectedPatientName}
            </span>
          </span>
        </div>
      )}

      {/* ナビ一覧（唯一のスクロール領域）。min-h-0 で親 flex 内で縮み、収まらないときだけ縦スクロール。
          pr-1 でスクロールバーが文字・アイコンに被らない余白を確保。iPad Safari 慣性スクロール対応。 */}
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
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
              {badge !== undefined && badge > 0 && (
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

      {/* 識別情報（最下部・固定）。onLogout 指定時はユーザーメニュー、未指定時は静的表示。
          shrink-0 でスクロール領域に含めず、常に画面内に表示する。 */}
      {onLogout ? (
        <UserMenu identity={identity} onLogout={onLogout} />
      ) : (
        <div className="mt-3 flex shrink-0 items-center gap-2.5 rounded-2xl border border-[#EBEBF0] bg-[#FAFAFC] p-2.5">
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
      )}
    </nav>
  );
}

// Student Menu（Sprint D-1 ①）: 学生氏名・学籍番号・ログアウトのみ。
// 設定 / プロフィール編集は今回対象外（追加しない）。クリックで上方向にポップアップ。
function UserMenu({
  identity,
  onLogout,
}: {
  identity: SideNavIdentity;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    // 最下部固定（スクロール領域に含めない）。ポップアップは上方向（bottom-full）に開くため画面外に出ない。
    <div className="relative mt-3 shrink-0">
      {open && (
        <>
          {/* 外側クリックで閉じる透明バックドロップ。 */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            aria-label="ユーザーメニュー"
            className="absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-2xl border border-[#E5E5EA] bg-white p-2 shadow-[0_8px_28px_rgba(0,0,0,0.14)]"
          >
            <div className="px-2 py-1.5">
              <p className="truncate text-[13px] font-semibold text-[#1D1D1F]">
                {identity.name}
              </p>
              <p className="truncate text-[11px] text-[#8E8E93]">
                {identity.subtitle}
              </p>
            </div>
            <div className="my-1 border-t border-[#F0F0F3]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-medium text-[#FF3B30] transition-colors hover:bg-[#FFF1F0]"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              ログアウト
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-[#EBEBF0] bg-[#FAFAFC] p-2.5 text-left transition-colors hover:bg-[#F2F2F5]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7FB2F0] to-[#0A84FF]">
          <User className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-[#1D1D1F]">
            {identity.name}
          </p>
          <p className="truncate text-[10px] text-[#8E8E93]">
            {identity.subtitle}
          </p>
        </div>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-[#8E8E93] transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          strokeWidth={2}
        />
      </button>
    </div>
  );
}
