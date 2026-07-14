"use client";

import { getChartData } from "@/lib/chartData";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus, ChartNavRequest } from "@/lib/chartNav";
import ChartTabContent from "./ChartTabContent";

export default function ChartMain({
  activeTab,
  patientId,
  nav,
  onNavigate,
}: {
  activeTab: ChartTabId;
  patientId: string;
  nav: ChartNavRequest | null;
  onNavigate: (tab: ChartTabId, focus: ChartFocus) => void;
}) {
  const data = getChartData(patientId);
  return (
    <ChartTabContent
      tab={activeTab}
      data={data}
      patientId={patientId}
      nav={nav}
      onNavigate={onNavigate}
    />
  );
}
