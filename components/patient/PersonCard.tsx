import { Smile } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { EmptyNote, ProfileCard } from "./ProfileCard";

// 人物像（性格・家族・趣味・生活リズム）をひとまとめにしたカード
export default function PersonCard({ patient }: { patient: Patient }) {
  const { personality, family, hobbies, dailyRhythm } = patient.profile ?? {};
  const hasContent = Boolean(
    personality || family || (hobbies && hobbies.length) || dailyRhythm,
  );
  return (
    <ProfileCard
      icon={<Smile className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />}
      title="人物像"
    >
      {hasContent ? (
        <div className="space-y-3">
          {personality && <Field label="性格・人柄" text={personality} />}
          {family && <Field label="家族・キーパーソン" text={family} />}
          {hobbies && hobbies.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-[#8E8E93]">
                趣味・好きなこと
              </p>
              <ul className="flex flex-wrap gap-2">
                {hobbies.map((h) => (
                  <li
                    key={h}
                    className="rounded-full bg-[#E9F2FF] px-3 py-1.5 text-[12px] font-medium text-[#0A6CD6]"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dailyRhythm && <Field label="入院前の生活リズム" text={dailyRhythm} />}
        </div>
      ) : (
        <EmptyNote />
      )}
    </ProfileCard>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-[#8E8E93]">{label}</p>
      <p className="text-[13px] leading-relaxed text-[#3A3A3C]">{text}</p>
    </div>
  );
}
