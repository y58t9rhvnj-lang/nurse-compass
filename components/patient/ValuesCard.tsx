import { Heart } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { EmptyNote, ProfileCard } from "./ProfileCard";

// 大切にしていること・価値観
export default function ValuesCard({ patient }: { patient: Patient }) {
  const values = patient.profile?.values ?? [];
  return (
    <ProfileCard
      icon={<Heart className="h-4 w-4 text-[#FF3B5C]" strokeWidth={1.75} />}
      title="大切にしていること"
    >
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {values.map((v) => (
            <li
              key={v}
              className="rounded-full bg-[#FFF0F3] px-3 py-1.5 text-[12px] font-medium text-[#D63B57]"
            >
              {v}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote />
      )}
    </ProfileCard>
  );
}
