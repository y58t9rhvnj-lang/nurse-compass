"use client";

import { useState } from "react";
import { Wifi } from "lucide-react";
import OutsideWardArea from "@/components/OutsideWardArea";
import SideNav from "@/components/SideNav";
import WardMap from "@/components/WardMap";
import WardRightPanel from "@/components/WardRightPanel";
import WardHomeTopBar from "@/components/ward/WardHomeTopBar";
import { DEFAULT_PATIENT_ID, PATIENTS } from "@/lib/wardData";

const PATIENT_TOP_NOTICE = "患者トップは次のSprintで実装予定です";

function StatusBar() {
  return (
    <div className="flex h-7 shrink-0 items-center justify-between bg-white px-5 text-[12px] font-medium text-[#1D1D1F]">
      <div className="flex items-center gap-2">
        <span className="font-semibold">9:41</span>
        <span className="text-[#8E8E93]">6月1日 (日)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Wifi className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="text-[11px]">100%</span>
        <span className="relative inline-flex h-3 w-6 items-center rounded-[3px] border border-[#1D1D1F]/70 px-[1px]">
          <span className="h-2 w-full rounded-[1px] bg-[#34C759]" />
          <span className="absolute -right-[3px] h-1.5 w-[2px] rounded-r bg-[#1D1D1F]/70" />
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PATIENT_ID);
  const openPatientTop = () => setNotice(PATIENT_TOP_NOTICE);
  const selectedPatient = PATIENTS[selectedId];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#EDEDF0] text-[#1D1D1F]">
      <StatusBar />

      <div className="flex min-h-0 flex-1">
        {/* 左サイドバー */}
        <aside className="w-[204px] shrink-0 border-r border-[#E5E5EA] bg-white">
          <SideNav />
        </aside>

        {/* 中央メイン */}
        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3.5">
          {notice && (
            <div className="flex shrink-0 items-center justify-between rounded-2xl bg-[#EAF3FF] px-4 py-2">
              <p className="text-xs font-medium text-[#0A5FCC]">{notice}</p>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-[11px] text-[#6E6E73] hover:text-[#1D1D1F]"
              >
                閉じる
              </button>
            </div>
          )}

          <WardHomeTopBar />
          <WardMap
            selectedId={selectedId}
            onSelectPatient={setSelectedId}
          />
          <OutsideWardArea />
        </main>

        {/* 右ペイン */}
        <aside className="w-[288px] shrink-0 border-l border-[#E5E5EA] bg-white">
          <WardRightPanel
            patient={selectedPatient}
            onPatientTopRequest={openPatientTop}
          />
        </aside>
      </div>
    </div>
  );
}
