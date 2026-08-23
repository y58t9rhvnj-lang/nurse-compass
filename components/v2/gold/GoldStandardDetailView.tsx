import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import type { ResolvedGoldCtp } from "@/lib/gold/resolveEvidence";
import type { GoldStandardDocument } from "@/lib/gold/types";
import type { ResolvedTeacherInsight } from "@/lib/teacherInsights/resolveEvidence";
import { TeacherInsightsPanel } from "./TeacherInsightsPanel";

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-1 break-words pl-5 text-sm leading-relaxed text-slate-800">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * 教員向け Gold Standard 詳細（Server Component）。
 * 「模範解答」「正解」という語は使わない。
 * Teacher Insight は CTP 展開末尾に補助パネルとして表示（正解提示ではない）。
 */
export function GoldStandardDetailView({
  document,
  resolvedPoints,
  insightsByCtpId,
}: {
  document: GoldStandardDocument;
  resolvedPoints: readonly ResolvedGoldCtp[];
  /** CTP id → 解決済み Teacher Insights（データ側 relatedCtpIds 由来） */
  insightsByCtpId?: ReadonlyMap<string, readonly ResolvedTeacherInsight[]>;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Patient Understanding First
        </p>
        <h1 className="text-2xl font-bold text-slate-900">
          {document.title ?? "Aさん — 現時点で最も妥当な患者理解"}
        </h1>
        <p className="text-sm text-slate-600">
          {document.purpose ??
            "完成答案を提示するのではなく、事実・意味・不足情報・患者理解の更新を追体験するための教材です。"}
        </p>
        <p className="text-xs text-slate-500">
          patientId {document.patientId} · caseId {document.caseId} ·
          schemaVersion {document.schemaVersion}
        </p>
      </header>

      <Section title="学生が抱きやすい初期仮説（初期の患者理解）">
        <p className="text-sm leading-relaxed break-words text-slate-800 whitespace-pre-wrap">
          {document.initialUnderstanding}
        </p>
      </Section>

      <Section title="思考の更新過程（Critical Thinking Points）">
        <p className="mb-4 text-sm text-slate-600">
          閉じたカードは仮説とレンズの概要、開くと事実・意味・不足・更新・次の問いと根拠情報を確認できます。末尾の
          Teacher Insight
          は教員向けの視点と問いであり、患者理解の正解ではありません。
        </p>
        <div className="space-y-3">
          {resolvedPoints.map(({ ctp, evidence }, index) => (
            <details
              key={ctp.id}
              className="group rounded-lg border border-slate-200 bg-slate-50 open:bg-white"
            >
              <summary className="cursor-pointer list-none px-4 py-3 marker:content-none">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {ctp.id}
                      {ctp.title ? ` · ${ctp.title}` : ` · 観点 ${index + 1}`}
                    </p>
                    <p className="text-sm break-words text-slate-700">
                      <span className="font-medium text-slate-500">
                        学生が抱きやすい初期仮説：
                      </span>
                      {ctp.studentAssumption}
                    </p>
                    <p className="text-xs text-slate-600">
                      Gordon Lens：
                      {ctp.gordonLenses
                        .map((key) => getForm3PatternDefinition(key).labelJa)
                        .join(" / ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      根拠情報 {evidence.length} 件
                      {insightsByCtpId?.get(ctp.id)?.length
                        ? ` · Teacher Insight ${insightsByCtpId.get(ctp.id)!.length} 件`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500 group-open:hidden">
                    開く
                  </span>
                  <span className="hidden shrink-0 text-xs font-medium text-slate-500 group-open:inline">
                    閉じる
                  </span>
                </div>
              </summary>

              <div className="space-y-4 border-t border-slate-200 px-4 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Facts</h3>
                  <div className="mt-2">
                    <BulletList items={ctp.facts} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Meaning
                  </h3>
                  <div className="mt-2">
                    <BulletList items={ctp.meaning} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Missing（まだ分からないこと）
                  </h3>
                  <div className="mt-2">
                    <BulletList items={ctp.missing} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    患者理解の更新（Update）
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed break-words text-slate-800 whitespace-pre-wrap">
                    {ctp.update}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    次に知りたいこと（Next Question）
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed break-words text-slate-800 whitespace-pre-wrap">
                    {ctp.nextQuestion}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Evidence Information
                  </h3>
                  <ul className="mt-2 space-y-3">
                    {evidence.map((item) => (
                      <li
                        key={`${ctp.id}-${item.id}`}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
                      >
                        <p className="font-medium text-slate-900">
                          {item.soType} · {item.patternLabelJa}
                        </p>
                        <p className="mt-1 leading-relaxed break-words text-slate-800 whitespace-pre-wrap">
                          {item.content}
                        </p>
                        <p className="mt-2 font-mono text-xs text-slate-500">
                          {item.id}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <TeacherInsightsPanel
                  insights={insightsByCtpId?.get(ctp.id) ?? []}
                />
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section title="現時点で最も妥当な患者理解（統合）">
        <p className="text-sm leading-relaxed break-words text-slate-800 whitespace-pre-wrap">
          {document.integratedUnderstanding}
        </p>
      </Section>

      <Section title="まだ分からないこと（Remaining Unknowns）">
        <BulletList items={document.remainingUnknowns} />
      </Section>

      <Section title="評価基準（Assessment Criteria）">
        <BulletList items={document.assessmentCriteria} />
      </Section>
    </div>
  );
}
