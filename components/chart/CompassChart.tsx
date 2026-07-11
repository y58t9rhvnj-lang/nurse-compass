"use client";

import { useState } from "react";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus, ChartNavRequest } from "@/lib/chartNav";
import type { Patient } from "@/lib/wardData";
import ChartMain from "./ChartMain";
import ChartPatientBar from "./ChartPatientBar";
import ChartTabs from "./ChartTabs";

// Compass Chart（中央）: 精神科電子カルテ。患者バー・タブは固定、本文のみスクロール。
export default function CompassChart({ patient }: { patient: Patient }) {
  const [activeTab, setActiveTab] = useState<ChartTabId>("診療録");
  const [nav, setNav] = useState<ChartNavRequest | null>(null);
  const [prevPatientId, setPrevPatientId] = useState(patient.id);

  // 患者切替時はリンク状態をクリア（レンダー中に前回値と比較して調整）
  if (patient.id !== prevPatientId) {
    setPrevPatientId(patient.id);
    setNav(null);
  }

  const navigate = (tab: ChartTabId, focus: ChartFocus) => {
    setActiveTab(tab);
    setNav({ tab, focus, token: Date.now() });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <ChartPatientBar patient={patient} />
      <ChartTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <ChartMain
        key={patient.id}
        activeTab={activeTab}
        patientId={patient.id}
        nav={nav}
        onNavigate={navigate}
      />
    </div>
  );
}
