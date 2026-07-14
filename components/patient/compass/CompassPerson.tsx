import type { ReactNode } from "react";
import {
  BookOpen,
  Heart,
  Smile,
  Soup,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { CompassExtra } from "@/lib/compassPatientData";

// ② Person: 趣味・好物・家族・生活歴・性格・価値観からその人となりを描く。
export default function CompassPerson({
  patient,
  extra,
}: {
  patient: Patient;
  extra: CompassExtra;
}) {
  const p = patient.profile ?? {};
  return (
    <section className="rounded-3xl border border-[#EBEBF0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0A84FF]/10">
          <User className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
        </span>
        <h2 className="text-[16px] font-bold text-[#1D1D1F]">この人となり</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          icon={<Heart className="h-4 w-4 text-[#FF3B5C]" strokeWidth={1.75} />}
          label="趣味"
        >
          <Chips items={p.hobbies} color="#FFF0F3" text="#D63B57" />
        </Tile>

        <Tile
          icon={<Soup className="h-4 w-4 text-[#FF9500]" strokeWidth={1.75} />}
          label="好きな食べ物"
        >
          <Text value={extra.favoriteFood} />
        </Tile>

        <Tile
          icon={<Smile className="h-4 w-4 text-[#34C759]" strokeWidth={1.75} />}
          label="好きなこと"
        >
          <Text value={extra.likes} />
        </Tile>

        <Tile
          icon={<Users className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />}
          label="家族構成"
        >
          <Text value={p.family} />
        </Tile>

        <div className="col-span-2">
          <Tile
            icon={
              <BookOpen className="h-4 w-4 text-[#8E8E93]" strokeWidth={1.75} />
            }
            label="生活歴"
          >
            <Text value={p.lifeHistory} />
          </Tile>
        </div>

        <div className="col-span-2">
          <Tile
            icon={
              <Smile className="h-4 w-4 text-[#AF52DE]" strokeWidth={1.75} />
            }
            label="性格"
          >
            <Text value={p.personality} />
          </Tile>
        </div>

        <div className="col-span-2">
          <Tile
            icon={
              <Sparkles className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
            }
            label="価値観"
          >
            <Chips items={p.values} color="#E9F2FF" text="#0A6CD6" />
          </Tile>
        </div>
      </div>
    </section>
  );
}

function Tile({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[#FAFAFC] p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-semibold text-[#8E8E93]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Text({ value }: { value?: string }) {
  if (!value) return <span className="text-[12px] text-[#C7C7CC]">未入力</span>;
  return (
    <p className="text-[13px] leading-relaxed text-[#3A3A3C]">{value}</p>
  );
}

function Chips({
  items,
  color,
  text,
}: {
  items?: string[];
  color: string;
  text: string;
}) {
  if (!items || items.length === 0)
    return <span className="text-[12px] text-[#C7C7CC]">未入力</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li
          key={i}
          className="rounded-full px-2.5 py-1 text-[12px] font-medium"
          style={{ background: color, color: text }}
        >
          {i}
        </li>
      ))}
    </ul>
  );
}
