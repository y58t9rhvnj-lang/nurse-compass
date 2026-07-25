import Link from "next/link";

// Admin 学生管理の共通ナビゲーション。
//
// ・各学生管理画面の上部（ページタイトル付近）に配置する共通リンク群。
// ・リンクを各ページへ重複実装しないための単一コンポーネント。
// ・サーバーコンポーネント（Admin Guard 配下でのみ描画されるため、管理者以外には出ない）。
// ・iPad Safari でも押しやすいサイズ・横幅が狭い場合は折り返し（flex-wrap）。

export type StudentNavKey = "list" | "new" | "import";

const ITEMS: { key: StudentNavKey; label: string; href: string }[] = [
  { key: "list", label: "学生一覧", href: "/v2/admin/students" },
  { key: "new", label: "学生を1名登録", href: "/v2/admin/students/new" },
  { key: "import", label: "CSV一括登録", href: "/v2/admin/students/import" },
];

export default function StudentManagementNav({
  current,
}: {
  // 現在表示中の画面。詳細ページ等、いずれにも一致しない場合は指定しない。
  current?: StudentNavKey;
}) {
  return (
    <nav
      aria-label="学生管理ナビゲーション"
      className="mb-6 flex flex-wrap gap-2"
    >
      {ITEMS.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-sky-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
