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
  compact,
}: {
  activeTab: ChartTabId;
  patientId: string;
  nav: ChartNavRequest | null;
  onNavigate: (tab: ChartTabId, focus: ChartFocus) => void;
  // compact: 思考ワークスペース内の embedded 表示。診療録ヘッダー（サブタブ・日付指定）を
  //   コンパクト化し記録本文の閲覧領域を広げる（Sprint D-1 追加修正 ⑤〜⑨）。Core カルテは非 compact。
  compact?: boolean;
}) {
  const data = getChartData(patientId);
  return (
    <ChartTabContent
      tab={activeTab}
      data={data}
      patientId={patientId}
      nav={nav}
      onNavigate={onNavigate}
      compact={compact}
    />
  );
}
