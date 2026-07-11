import { BookOpen } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { EmptyNote, ProfileCard } from "./ProfileCard";

// 入院までの経緯・生活歴（その人の物語）
export default function StoryCard({ patient }: { patient: Patient }) {
  const { story, lifeHistory } = patient.profile ?? {};
  const hasContent = Boolean(story || lifeHistory);
  return (
    <ProfileCard
      icon={<BookOpen className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />}
      title="これまでの歩み"
    >
      {hasContent ? (
        <div className="space-y-3">
          {lifeHistory && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-[#8E8E93]">
                生活歴
              </p>
              <p className="text-[13px] leading-relaxed text-[#3A3A3C]">
                {lifeHistory}
              </p>
            </div>
          )}
          {story && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-[#8E8E93]">
                入院までの経緯
              </p>
              <p className="text-[13px] leading-relaxed text-[#3A3A3C]">
                {story}
              </p>
            </div>
          )}
        </div>
      ) : (
        <EmptyNote />
      )}
    </ProfileCard>
  );
}
