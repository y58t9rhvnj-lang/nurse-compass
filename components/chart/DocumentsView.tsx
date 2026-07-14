"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  FileText,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import type {
  ChartData,
  ClinicalDocument,
  FormBlock,
  FormDocument,
  FormFieldItem,
} from "@/lib/chartData";
import { EmptyState } from "./ChartUi";

// 帳票の設計上の横幅（A4縦の実寸に近い論理px）。ビューアはこの幅を基準に拡縮する。
const PAGE_WIDTH = 760;

type DocEntry = {
  id: string;
  name: string;
  type: string;
  department: string;
  author: string;
  createdDate: string;
  evaluationDate: string;
  pages: number;
  status: string;
} & (
  | { kind: "form"; form: FormDocument }
  | { kind: "clinical"; clinical: ClinicalDocument }
);

// 作成者名から作成部署を推定（既存 clinicalDocuments 用）。
function deriveDepartment(author: string): string {
  if (author.includes("医師") || author.includes("鈴木")) return "精神科";
  if (author.includes("薬剤")) return "薬剤部";
  if (author.includes("栄養")) return "栄養管理科";
  if (author.includes("作業療法")) return "リハビリテーション科";
  if (author.includes("MSW") || author.includes("PSW")) return "医療福祉相談室";
  if (author.includes("多職種")) return "多職種チーム";
  if (author.includes("田中")) return "看護部";
  return "—";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export default function DocumentsView({ data }: { data: ChartData }) {
  const entries = useMemo<DocEntry[]>(() => {
    const forms: DocEntry[] = data.formDocuments.map((f) => ({
      id: f.id,
      name: f.documentName,
      type: f.documentType,
      department: f.department,
      author: f.author,
      createdDate: f.createdDate,
      evaluationDate: f.evaluationDate,
      pages: f.pageCount,
      status: f.status,
      kind: "form",
      form: f,
    }));
    const clinical: DocEntry[] = data.clinicalDocuments.map((d) => ({
      id: d.id,
      name: d.title,
      type: d.category,
      department: deriveDepartment(d.author),
      author: d.author,
      createdDate: d.date,
      evaluationDate: d.date,
      pages: 1,
      status: "確定",
      kind: "clinical",
      clinical: d,
    }));
    return [...forms, ...clinical].sort((a, b) =>
      b.evaluationDate.localeCompare(a.evaluationDate),
    );
  }, [data.formDocuments, data.clinicalDocuments]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = entries.find((e) => e.id === selectedId) ?? null;

  if (entries.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F7F7F9] p-2.5">
        <EmptyState text="この患者の書類はありません" />
      </div>
    );
  }

  if (selected) {
    return <PdfViewer entry={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <DocumentList entries={entries} onOpen={(id) => setSelectedId(id)} />
  );
}

// ── 文書一覧（文書フォルダ） ─────────────────────────────
function DocumentList({
  entries,
  onOpen,
}: {
  entries: DocEntry[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F7F7F9] p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <FileText size={15} className="text-[#6E6E73]" />
        <h3 className="text-[13px] font-bold text-[#1D1D1F]">文書フォルダ</h3>
        <span className="text-[11px] text-[#8E8E93]">{entries.length}件</span>
      </div>
      <ul className="space-y-1.5">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onOpen(e.id)}
              className="flex min-h-[44px] w-full items-start gap-3 rounded-xl border border-[#E5E5EA] bg-white px-3.5 py-2.5 text-left transition-colors hover:bg-[#FAFAFC]"
            >
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#FCECEC] text-[9px] font-bold text-[#C0392B]">
                PDF
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-bold text-[#1D1D1F]">
                    {e.name}
                  </span>
                  <StatusBadge status={e.status} />
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[#6E6E73]">
                  {e.type}　·　{e.department}　·　{e.author}
                </span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-[#8E8E93]">
                  評価日 {e.evaluationDate}　·　作成日 {e.createdDate}　·　PDF　·　{e.pages}ページ
                </span>
              </span>
              <ChevronLeft
                size={16}
                className="mt-2 shrink-0 rotate-180 text-[#C7C7CC]"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    確定: { bg: "#E7F8ED", text: "#248A3D" },
    評価済: { bg: "#EAF3FF", text: "#0A5FCC" },
    説明済: { bg: "#F4EBFB", text: "#7B3FA0" },
  };
  const c = map[status] ?? { bg: "#F2F2F7", text: "#6E6E73" };
  return (
    <span
      className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

// ── PDFビューア風の閲覧画面 ─────────────────────────────
function PdfViewer({
  entry,
  onBack,
}: {
  entry: DocEntry;
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoomMult, setZoomMult] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);
  const scale = clamp(fitScale * zoomMult, 0.3, 3);

  // 表示領域の幅に合わせて初期倍率（フィット）を算出。iPadでも横幅が収まる。
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const compute = () => {
      const avail = el.clientWidth - 24;
      setFitScale(clamp(avail / PAGE_WIDTH, 0.35, 1));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 帳票の実寸高さを測定し、拡縮後のスペースを確保（重なり・はみ出し防止）。
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const update = () => setPageHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [entry.id]);

  const pct = Math.round(scale * 100);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#525659]">
      {/* ツールバー（常時表示。文書一覧へ戻る操作を含む） */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-black/30 bg-[#3C3F41] px-2.5 py-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md bg-white/10 px-2.5 text-[12px] font-medium text-white hover:bg-white/20"
        >
          <ChevronLeft size={16} />
          一覧へ戻る
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-white">
            {entry.name}
          </p>
          <p className="truncate text-[10.5px] tabular-nums text-white/60">
            {entry.author}　·　評価日 {entry.evaluationDate}　·　{entry.pages}ページ
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ToolBtn
            label="縮小"
            onClick={() => setZoomMult((z) => clamp(z / 1.15, 0.3, 3))}
          >
            <Minus size={15} />
          </ToolBtn>
          <span className="w-11 text-center text-[11px] tabular-nums text-white/80">
            {pct}%
          </span>
          <ToolBtn
            label="拡大"
            onClick={() => setZoomMult((z) => clamp(z * 1.15, 0.3, 3))}
          >
            <Plus size={15} />
          </ToolBtn>
          <ToolBtn label="倍率リセット" onClick={() => setZoomMult(1)}>
            <RotateCcw size={14} />
          </ToolBtn>
        </div>
      </div>

      {/* 文書スクロール領域 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div
          style={{
            width: PAGE_WIDTH * scale,
            height: pageHeight ? pageHeight * scale : undefined,
            margin: "12px auto",
          }}
        >
          <div
            ref={pageRef}
            style={{
              width: PAGE_WIDTH,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
            }}
            className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
          >
            {entry.kind === "form" ? (
              <FormDocPage doc={entry.form} />
            ) : (
              <ClinicalDocPage doc={entry.clinical} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
    >
      {children}
    </button>
  );
}

// ── A4帳票（記載済み文書）本体 ─────────────────────────────
function FormDocPage({ doc }: { doc: FormDocument }) {
  return (
    <div className="px-9 py-8 text-[#111] [font-feature-settings:'palt']">
      {/* ヘッダ */}
      <div className="mb-1 flex items-center justify-between text-[10.5px] text-[#333]">
        <span>{doc.hospitalName}</span>
        <span>文書ID：{doc.id}</span>
      </div>
      <h1 className="border-b-2 border-[#111] pb-2 text-center text-[19px] font-bold tracking-wide">
        {doc.documentName}
      </h1>

      {/* 患者基本情報欄 */}
      <div className="mt-4">
        <FieldTable items={doc.headerFields} columns={2} />
      </div>

      {/* 本文セクション */}
      {doc.sections.map((sec, i) => (
        <section key={i} className="mt-4">
          <h2 className="border-l-4 border-[#111] bg-[#eee] px-2 py-1 text-[13px] font-bold">
            {sec.title}
          </h2>
          <div className="mt-1.5 space-y-2">
            {sec.blocks.map((block, j) => (
              <BlockView key={j} block={block} />
            ))}
          </div>
        </section>
      ))}

      {/* 署名・確認欄 */}
      <section className="mt-5">
        <h2 className="border-l-4 border-[#111] bg-[#eee] px-2 py-1 text-[13px] font-bold">
          署名・確認欄
        </h2>
        <div className="mt-1.5">
          <FieldTable items={doc.signature} columns={1} />
        </div>
      </section>

      <p className="mt-4 text-right text-[10px] text-[#555]">
        {doc.hospitalName}　—　{doc.documentName}
      </p>
    </div>
  );
}

function BlockView({ block }: { block: FormBlock }) {
  if (block.kind === "fields") {
    return <FieldTable items={block.items} columns={block.columns ?? 2} />;
  }
  if (block.kind === "text") {
    return (
      <div className="text-[12px] leading-[1.7]">
        {block.label ? (
          <span className="mr-1 font-bold">{block.label}：</span>
        ) : null}
        <span className="whitespace-pre-wrap break-words">{block.body}</span>
      </div>
    );
  }
  if (block.kind === "list") {
    return (
      <div className="text-[12px] leading-[1.7]">
        {block.label ? (
          <p className="mb-0.5 font-bold">{block.label}：</p>
        ) : null}
        <ul className="list-disc space-y-0.5 pl-5">
          {block.items.map((it, i) => (
            <li key={i} className="break-words">
              {it}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  // table
  const { headers, rows, align, caption } = block.table;
  return (
    <div>
      <table className="w-full table-fixed border-collapse text-[11.5px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`border border-[#333] bg-[#eee] px-1.5 py-1 font-bold ${
                  colWidth(headers.length, i)
                } ${align?.[i] === "center" ? "text-center" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const isTotal = row[0] === "合計点";
            return (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`border border-[#333] px-1.5 py-1 align-top leading-[1.55] break-words ${
                      align?.[ci] === "center" ? "text-center" : "text-left"
                    } ${isTotal ? "bg-[#f5f5f5] font-bold" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {caption ? (
        <p className="mt-1 text-[10px] leading-snug text-[#555]">※ {caption}</p>
      ) : null}
    </div>
  );
}

function colWidth(count: number, index: number): string {
  // 4列（評価領域/所見/該当/点数）や3列（項目/値/評価）の見やすい配分。
  if (count === 4) {
    return ["w-[20%]", "w-[58%]", "w-[10%]", "w-[12%]"][index] ?? "";
  }
  if (count === 3) {
    return ["w-[26%]", "w-[54%]", "w-[20%]"][index] ?? "";
  }
  if (count === 2) {
    return ["w-[34%]", "w-[66%]"][index] ?? "";
  }
  return "";
}

// 患者基本情報欄・記述欄を罫線グリッドで表示（印刷帳票に近い密度）。
function FieldTable({
  items,
  columns,
}: {
  items: FormFieldItem[];
  columns: 1 | 2 | 3;
}) {
  const rows: FormFieldItem[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return (
    <table className="w-full table-fixed border-collapse text-[11.5px]">
      <tbody>
        {rows.map((row, ri) => {
          const cells: React.ReactNode[] = [];
          for (let c = 0; c < columns; c++) {
            const item = row[c];
            if (item) {
              cells.push(
                <th
                  key={`l-${c}`}
                  className="border border-[#333] bg-[#eee] px-1.5 py-1 text-left align-top font-bold"
                  style={{ width: `${18 / columns}%` }}
                >
                  {item.label}
                </th>,
              );
              cells.push(
                <td
                  key={`v-${c}`}
                  className="border border-[#333] px-1.5 py-1 align-top leading-[1.55] break-words"
                  style={{ width: `${(100 - 18) / columns}%` }}
                >
                  {item.value}
                </td>,
              );
            } else {
              cells.push(
                <td
                  key={`e-${c}`}
                  colSpan={2}
                  className="border border-[#333] px-1.5 py-1"
                />,
              );
            }
          }
          return <tr key={ri}>{cells}</tr>;
        })}
      </tbody>
    </table>
  );
}

// ── その他の記録（既存 clinicalDocuments）のA4表示 ─────────────
function ClinicalDocPage({ doc }: { doc: ClinicalDocument }) {
  return (
    <div className="px-9 py-8 text-[#111]">
      <div className="mb-1 flex items-center justify-between text-[10.5px] text-[#333]">
        <span>Aims Medical Center</span>
        <span>{doc.date}</span>
      </div>
      <h1 className="border-b-2 border-[#111] pb-2 text-center text-[18px] font-bold tracking-wide">
        {doc.title}
      </h1>
      <div className="mt-3 flex flex-wrap justify-between gap-x-4 text-[11.5px] text-[#333]">
        <span>種別：{doc.category}</span>
        <span>作成者：{doc.author}</span>
      </div>
      <table className="mt-4 w-full table-fixed border-collapse text-[12px]">
        <tbody>
          {doc.sections.map((sec, i) => (
            <tr key={i}>
              <th className="w-[26%] border border-[#333] bg-[#eee] px-2 py-1.5 text-left align-top font-bold">
                {sec.heading}
              </th>
              <td className="border border-[#333] px-2 py-1.5 align-top leading-[1.7] break-words">
                {sec.body}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-right text-[10px] text-[#555]">
        Aims Medical Center　—　{doc.title}
      </p>
    </div>
  );
}
