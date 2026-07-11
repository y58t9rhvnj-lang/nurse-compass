import { MessageCircle } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { EmptyNote, ProfileCard } from "./ProfileCard";

// 本人が語る困りごと（主観）
export default function WorriesCard({ patient }: { patient: Patient }) {
  const worries = patient.profile?.worries ?? [];
  return (
    <ProfileCard
      icon={
        <MessageCircle className="h-4 w-4 text-[#FF9500]" strokeWidth={1.75} />
      }
      title="本人の困りごと"
    >
      {worries.length > 0 ? (
        <ul className="space-y-2">
          {worries.map((w) => (
            <li
              key={w}
              className="flex items-start gap-2 text-[13px] leading-relaxed text-[#3A3A3C]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9500]" />
              <span>「{w}」</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote />
      )}
    </ProfileCard>
  );
}
