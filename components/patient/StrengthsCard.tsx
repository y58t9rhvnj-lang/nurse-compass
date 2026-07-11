import { Sparkles } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { EmptyNote, ProfileCard } from "./ProfileCard";

// その人の強み・できていること（ストレングス視点）
export default function StrengthsCard({ patient }: { patient: Patient }) {
  const strengths = patient.profile?.strengths ?? [];
  return (
    <ProfileCard
      icon={<Sparkles className="h-4 w-4 text-[#34C759]" strokeWidth={1.75} />}
      title="強み・できていること"
    >
      {strengths.length > 0 ? (
        <ul className="space-y-2">
          {strengths.map((s) => (
            <li
              key={s}
              className="flex items-start gap-2 rounded-xl bg-[#E7F8ED] px-3 py-2 text-[13px] leading-relaxed text-[#1F7A3D]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#34C759]" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote />
      )}
    </ProfileCard>
  );
}
