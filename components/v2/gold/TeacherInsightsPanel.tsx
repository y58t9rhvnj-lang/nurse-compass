import {
  COACHING_STAGE_LABEL_JA,
  GOLD_RELATIONSHIP_KIND_LABEL_JA,
  HYPOTHESIS_EVIDENCE_STATE_LABEL_JA,
  uniqueStageLabelsJa,
} from "@/lib/teacherInsights/labels";
import type {
  ResolvedTeacherEvidence,
  ResolvedTeacherInsight,
} from "@/lib/teacherInsights/resolveEvidence";

function BulletList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 break-words pl-5 text-sm leading-relaxed text-slate-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold tracking-wide text-slate-500">
      {children}
    </h4>
  );
}

function EvidenceList({
  items,
  keyPrefix,
}: {
  items: readonly ResolvedTeacherEvidence[];
  keyPrefix: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li
          key={`${keyPrefix}-${item.id}`}
          className="rounded-md border border-slate-200/80 bg-white/70 p-2.5 text-sm"
        >
          <p className="font-medium text-slate-800">
            {item.soType} · {item.patternLabelJa}
          </p>
          <p className="mt-1 break-words leading-relaxed text-slate-700 whitespace-pre-wrap">
            {item.content}
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-slate-500">
            {item.id}
          </p>
        </li>
      ))}
    </ul>
  );
}

function InsightBody({ insight }: { insight: ResolvedTeacherInsight }) {
  const { document, evidence, hypotheses } = insight;

  return (
    <div className="space-y-4 border-t border-slate-200/80 px-3 py-3 sm:px-4">
      <div>
        <Subheading>学生が見落としやすいこと</Subheading>
        <div className="mt-2">
          <BulletList items={document.overlookedPoints} />
        </div>
      </div>

      <div>
        <Subheading>教員が考えている視点</Subheading>
        <div className="mt-2">
          <BulletList items={document.teacherConsiderations} />
        </div>
      </div>

      <div>
        <Subheading>仮説</Subheading>
        <ul className="mt-2 space-y-3">
          {hypotheses.map(({ hypothesis, supportingEvidence }) => (
            <li
              key={hypothesis.id}
              className="rounded-md border border-dashed border-slate-300 bg-white/50 p-3"
            >
              <p className="text-sm leading-relaxed break-words text-slate-800 whitespace-pre-wrap">
                {hypothesis.text}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-medium text-slate-500">根拠状態：</span>
                {HYPOTHESIS_EVIDENCE_STATE_LABEL_JA[hypothesis.evidenceState]}
              </p>
              {supportingEvidence.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500">
                    この仮説を支える根拠情報
                  </p>
                  <EvidenceList
                    items={supportingEvidence}
                    keyPrefix={`${hypothesis.id}-sup`}
                  />
                </div>
              ) : null}
              {hypothesis.contradictingOrMissingEvidence.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500">
                    抑え・不足している点
                  </p>
                  <div className="mt-1">
                    <BulletList
                      items={hypothesis.contradictingOrMissingEvidence}
                    />
                  </div>
                </div>
              ) : null}
              {hypothesis.caution ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-900/90 whitespace-pre-wrap break-words">
                  注意：{hypothesis.caution}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Subheading>まだ確認が必要なこと</Subheading>
        <div className="mt-2">
          <BulletList items={document.missingInformation} />
        </div>
      </div>

      <div>
        <Subheading>学生へ返す問い</Subheading>
        <ul className="mt-2 space-y-3">
          {document.coachingQuestions.map((q) => (
            <li
              key={q.id}
              className="rounded-md border border-slate-200/80 bg-white/60 p-3"
            >
              <p className="text-sm font-medium leading-relaxed break-words text-slate-900 whitespace-pre-wrap">
                {q.question}
              </p>
              <dl className="mt-2 space-y-1 text-xs text-slate-600">
                <div>
                  <dt className="inline font-medium text-slate-500">
                    思考段階：
                  </dt>
                  <dd className="inline">{COACHING_STAGE_LABEL_JA[q.stage]}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-slate-500">目的：</dt>
                  <dd className="inline break-words">{q.purpose}</dd>
                </div>
                {q.prerequisites && q.prerequisites.length > 0 ? (
                  <div>
                    <dt className="font-medium text-slate-500">前提：</dt>
                    <dd className="mt-0.5">
                      <BulletList items={q.prerequisites} />
                    </dd>
                  </div>
                ) : null}
                {q.avoidWhen && q.avoidWhen.length > 0 ? (
                  <div>
                    <dt className="font-medium text-slate-500">
                      使わない方がよいとき：
                    </dt>
                    <dd className="mt-0.5">
                      <BulletList items={q.avoidWhen} />
                    </dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Subheading>よくある誤解</Subheading>
        <div className="mt-2">
          <BulletList items={document.commonMisconceptions} />
        </div>
      </div>

      <div>
        <Subheading>Gold Standardとの関係</Subheading>
        <p className="mt-2 text-sm leading-relaxed break-words text-slate-700">
          <span className="font-medium text-slate-500">関係：</span>
          {GOLD_RELATIONSHIP_KIND_LABEL_JA[document.goldStandardRelationship.kind]}
        </p>
        <p className="mt-1 text-sm leading-relaxed break-words text-slate-700 whitespace-pre-wrap">
          {document.goldStandardRelationship.note}
        </p>
        {document.goldStandardRelationship.relatedCtpIds.length > 0 ? (
          <p className="mt-1 font-mono text-xs text-slate-500">
            {document.goldStandardRelationship.relatedCtpIds.join(", ")}
          </p>
        ) : null}
      </div>

      <div>
        <Subheading>注意事項</Subheading>
        <div className="mt-2">
          <BulletList items={document.caution} />
        </div>
      </div>

      <div>
        <Subheading>Evidence Information（この問いの根拠）</Subheading>
        <EvidenceList items={evidence} keyPrefix={`${document.id}-ev`} />
      </div>
    </div>
  );
}

/**
 * CTP 展開末尾の Teacher Insight パネル（Server Component）。
 * 階層は CTP details → Insight details の最大2段。
 * 「正解」「診断」や最終断定を見出しにしない。
 */
export function TeacherInsightsPanel({
  insights,
}: {
  insights: readonly ResolvedTeacherInsight[];
}) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-200/90 bg-slate-100/70 p-3 sm:p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-700">
          Teacher Insight｜教員の視点と問い
        </h3>
        <p className="text-xs leading-relaxed text-slate-600">
          学生の思考を深めるために教員が持つ視点と問いです。患者理解の正解を示すものではありません。
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {insights.map((insight) => {
          const { document, evidence } = insight;
          const stages = uniqueStageLabelsJa(
            document.coachingQuestions.map((q) => q.stage),
          );
          return (
            <details
              key={document.id}
              className="group/insight rounded-md border border-slate-200 bg-slate-50/90 open:bg-white"
            >
              <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none sm:px-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {document.id} · {document.title}
                    </p>
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-500">
                        関連する思考段階：
                      </span>
                      {stages || "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Evidence {evidence.length} 件 · Coaching Question{" "}
                      {document.coachingQuestions.length} 件
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-slate-500 group-open/insight:hidden">
                    開く
                  </span>
                  <span className="hidden shrink-0 text-[11px] font-medium text-slate-500 group-open/insight:inline">
                    閉じる
                  </span>
                </div>
              </summary>
              <InsightBody insight={insight} />
            </details>
          );
        })}
      </div>
    </div>
  );
}
