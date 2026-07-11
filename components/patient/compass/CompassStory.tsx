import type { ReactNode } from "react";
import { BookOpen, Home, MessageCircle, Sparkles } from "lucide-react";
import type { Patient } from "@/lib/wardData";

// Story: 患者理解を深めるための4項目（これまでの歩み・強み・困りごと・退院への思い）。
export default function CompassStory({ patient }: { patient: Patient }) {
  const p = patient.profile ?? {};
  return (
    <section className="rounded-3xl border border-[#EBEBF0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5E5CE6]/12">
          <BookOpen className="h-4 w-4 text-[#5E5CE6]" strokeWidth={1.75} />
        </span>
        <h2 className="text-[16px] font-bold text-[#1D1D1F]">Story</h2>
        <span className="text-[11px] text-[#AEAEB5]">その人の歩みと願い</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card
          icon={
            <BookOpen className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
          }
          title="これまでの歩み"
        >
          <Paragraph value={p.story} />
        </Card>

        <Card
          icon={
            <Sparkles className="h-4 w-4 text-[#34C759]" strokeWidth={1.75} />
          }
          title="強み"
        >
          <BulletList items={p.strengths} dot="#34C759" />
        </Card>

        <Card
          icon={
            <MessageCircle
              className="h-4 w-4 text-[#FF9500]"
              strokeWidth={1.75}
            />
          }
          title="困りごと"
        >
          <BulletList items={p.worries} dot="#FF9500" quote />
        </Card>

        <Card
          icon={<Home className="h-4 w-4 text-[#34C759]" strokeWidth={1.75} />}
          title="退院への思い"
        >
          {p.dischargeHope ? (
            <p className="rounded-xl bg-[#E7F8ED] px-3 py-2.5 text-[13px] font-medium leading-relaxed text-[#1F7A3D]">
              {p.dischargeHope}
            </p>
          ) : (
            <Empty />
          )}
        </Card>
      </div>
    </section>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#EFEFF2] bg-[#FAFAFC] p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <span className="text-[12px] font-semibold text-[#1D1D1F]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Paragraph({ value }: { value?: string }) {
  if (!value) return <Empty />;
  return (
    <p className="text-[13px] leading-relaxed text-[#3A3A3C]">{value}</p>
  );
}

function BulletList({
  items,
  dot,
  quote,
}: {
  items?: string[];
  dot: string;
  quote?: boolean;
}) {
  if (!items || items.length === 0) return <Empty />;
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li
          key={i}
          className="flex items-start gap-2 text-[13px] leading-relaxed text-[#3A3A3C]"
        >
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: dot }}
          />
          <span>{quote ? `「${i}」` : i}</span>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <span className="text-[12px] text-[#C7C7CC]">未入力</span>;
}
