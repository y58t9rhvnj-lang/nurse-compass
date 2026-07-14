import { Home } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { EmptyNote, ProfileCard } from "./ProfileCard";

// 退院への思い（本人が向かいたい未来）
export default function DischargeHopeCard({ patient }: { patient: Patient }) {
  const hope = patient.profile?.dischargeHope;
  return (
    <ProfileCard
      icon={<Home className="h-4 w-4 text-[#34C759]" strokeWidth={1.75} />}
      title="退院への思い"
    >
      {hope ? (
        <p className="rounded-xl bg-[#E7F8ED] px-3.5 py-3 text-[14px] font-medium leading-relaxed text-[#1F7A3D]">
          {hope}
        </p>
      ) : (
        <EmptyNote />
      )}
    </ProfileCard>
  );
}
