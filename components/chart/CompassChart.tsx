"use client";

import { useState } from "react";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus, ChartNavRequest } from "@/lib/chartNav";
import type { Patient } from "@/lib/wardData";
import ChartMain from "./ChartMain";
import ChartPatientBar from "./ChartPatientBar";
import ChartTabs from "./ChartTabs";

// Compass Chart（中央）: 精神科電子カルテ。患者バー・タブは固定、本文のみスクロール。
// initialTab: 患者画面の Compass Coach 導線から開いたときの初期タブ（未指定なら診療録）。
// initialFocus: 開いた直後に特定の記録へ移動・強調するためのフォーカス（例: 診療録の recordId）。
export default function CompassChart({
  patient,
  initialTab,
  initialFocus,
  embedded,
}: {
  patient: Patient;
  initialTab?: ChartTabId;
  initialFocus?: ChartFocus;
  // embedded: 思考ワークスペース内の簡略表示。水色の患者基本情報バーを出さず、タブを compact 化し、
  //   診療録本文の閲覧領域を最大化する（Sprint D-1 追加修正2 ⑤⑥）。Core の通常カルテは非 embedded。
  embedded?: boolean;
}) {
  const startTab = initialTab ?? "診療録";
  const [activeTab, setActiveTab] = useState<ChartTabId>(startTab);
  const [nav, setNav] = useState<ChartNavRequest | null>(
    initialFocus ? { tab: startTab, focus: initialFocus, token: 1 } : null,
  );
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {!embedded && <ChartPatientBar patient={patient} />}
      <ChartTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        compact={embedded}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ChartMain
          key={patient.id}
          activeTab={activeTab}
          patientId={patient.id}
          nav={nav}
          onNavigate={navigate}
          compact={embedded}
        />
      </div>
    </div>
  );
}
