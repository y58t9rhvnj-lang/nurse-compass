"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

// 学籍番号・氏名の検索。条件は URL クエリ(q)へ保持し、サーバー側で検索する。
// 送信時は page を初期化する（1ページ目から表示）。
export default function StudentSearchForm({
  defaultQuery,
}: {
  defaultQuery: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    const query = params.toString();
    router.push(query ? `/v2/admin/students?${query}` : "/v2/admin/students");
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={50}
          placeholder="学籍番号または氏名で検索"
          aria-label="学籍番号または氏名で検索"
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
      >
        検索
      </button>
    </form>
  );
}
