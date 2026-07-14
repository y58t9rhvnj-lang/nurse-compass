import { ClipboardList } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { ProfileCard } from "./ProfileCard";

// 補助的な基本情報（診断名は主役にせず、事務情報としてまとめる）
export default function PatientInfoCard({ patient }: { patient: Patient }) {
  const rows: { label: string; value: string }[] = [
    { label: "診断名", value: patient.diagnosis },
    { label: "年齢・性別", value: `${patient.age}歳・${patient.sex}` },
    { label: "病室", value: `${patient.room}号室` },
    { label: "入院日", value: patient.admit },
    { label: "主治医", value: patient.doctor },
  ];
  return (
    <ProfileCard
      icon={
        <ClipboardList className="h-4 w-4 text-[#8E8E93]" strokeWidth={1.75} />
      }
      title="基本情報"
    >
      <dl className="divide-y divide-[#F2F2F5]">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between py-2 text-[12px]">
            <dt className="text-[#8E8E93]">{r.label}</dt>
            <dd className="font-medium text-[#3A3A3C]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </ProfileCard>
  );
}
