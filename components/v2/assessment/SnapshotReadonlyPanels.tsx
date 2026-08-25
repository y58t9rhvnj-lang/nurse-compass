"use client";

import { useMemo, type ReactNode } from "react";
import Form2SheetView from "@/components/form2/Form2SheetView";
import Form3SheetView from "@/components/v2/form3/Form3SheetView";
import {
  buildForm3PrintLayout,
  buildForm3PrintLayoutFallback,
} from "@/lib/form3/form3PrintLayout";
import type { Form2Data } from "@/lib/form2/form2Types";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";
import type { SnapshotReadModelOk } from "@/lib/v2/assessment/snapshotReadModel";
import {
  evaluationTypeLabel,
  formatForm3PatternScopeJa,
  formatSubmissionScopeJa,
} from "@/lib/v2/assessment/submissionScope";
import type {
  AssessmentMilestoneType,
  AssessmentSubmissionScope,
} from "@/lib/v2/assessment/types";
import type { Form3PrintMeta } from "@/lib/form3/form3PrintLayout";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function SnapshotUnsupportedMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-950">
      {message}
    </div>
  );
}

export function SnapshotOverviewPanel({
  model,
  submissionNumber,
  candidateSubmissionNumber,
  timingDisplayText,
  evaluationType,
  milestoneType,
  submissionScope,
}: {
  model: SnapshotReadModelOk;
  submissionNumber: number | null;
  candidateSubmissionNumber: number | null;
  /** 提出時判定・現在期限との関係・提出時期限（改行可） */
  timingDisplayText: string;
  evaluationType: "formative" | "summative" | null;
  milestoneType: AssessmentMilestoneType | null;
  /** ヘッダと同じ正本（課題の submission_scope）。snapshot 欠落時も揃える */
  submissionScope: AssessmentSubmissionScope | null;
}) {
  const scopeForDisplay = submissionScope ?? model.submissionScope;
  const scopeLabel =
    scopeForDisplay && milestoneType
      ? formatSubmissionScopeJa(milestoneType, scopeForDisplay)
      : "—";
  const patternLabel = formatForm3PatternScopeJa(scopeForDisplay);

  const rows: Array<{ label: string; value: string; preLine?: boolean }> = [
    {
      label: "提出回数（この課題）",
      value: submissionNumber != null ? String(submissionNumber) : "—",
    },
    {
      label: "評価対象の提出番号",
      value:
        candidateSubmissionNumber != null
          ? String(candidateSubmissionNumber)
          : "評価対象なし",
    },
    {
      label: "この提出の日時",
      value: model.submittedAt
        ? formatAssessmentDateTimeJa(model.submittedAt)
        : "—",
    },
    {
      label: "提出時判定 / 現在期限との関係",
      value: timingDisplayText,
      preLine: true,
    },
    {
      label: "含まれる成果物",
      value:
        model.includedArtifacts.length > 0
          ? model.includedArtifacts.join("・")
          : "なし",
    },
    {
      label: "様式2 の版",
      value:
        model.sourceVersions.form2 != null
          ? String(model.sourceVersions.form2)
          : "—",
    },
    {
      label: "様式3 の版",
      value:
        model.sourceVersions.form3 != null
          ? String(model.sourceVersions.form3)
          : "—",
    },
    {
      label: "患者理解の更新時刻",
      value: model.sourceVersions.patientUnderstanding
        ? formatAssessmentDateTimeJa(model.sourceVersions.patientUnderstanding)
        : model.patientUnderstanding?.updatedAt
          ? formatAssessmentDateTimeJa(model.patientUnderstanding.updatedAt)
          : "—",
    },
    { label: "提出範囲", value: scopeLabel },
    { label: "対象の様式3パターン", value: patternLabel },
    {
      label: "形成評価／総括評価",
      value: evaluationType ? evaluationTypeLabel(evaluationType) : "—",
    },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <dt className="text-xs font-medium text-slate-500">{r.label}</dt>
          <dd
            className={`mt-1 text-sm text-slate-900 ${
              r.preLine ? "whitespace-pre-line" : ""
            }`}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SnapshotForm2Readonly({ data }: { data: Form2Data | null }) {
  if (!data) {
    return (
      <p className="text-sm text-slate-500">この提出に様式2は含まれていません。</p>
    );
  }
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-2">
      <Form2SheetView data={data} maxScreenScale={1.6} />
    </div>
  );
}

export function SnapshotForm3Readonly({
  data,
  meta,
}: {
  data: Form3DataV2 | null;
  /** snapshot 外の教員向け表示用（学籍番号・氏名）。snapshot / head は変更しない */
  meta?: Form3PrintMeta | null;
}) {
  const layout = useMemo(() => {
    if (!data) return null;
    return (
      buildForm3PrintLayout(data) ?? buildForm3PrintLayoutFallback(data)
    );
  }, [data]);

  if (!data || !layout) {
    return (
      <p className="text-sm text-slate-500">この提出に様式3は含まれていません。</p>
    );
  }
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-2">
      <Form3SheetView layout={layout} meta={meta ?? undefined} />
    </div>
  );
}

export function SnapshotSimpleList({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: Array<Record<string, unknown>>;
  render: (item: Record<string, unknown>, index: number) => ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {render(item, i)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SnapshotInformationCardsReadonly({
  items,
}: {
  items: Array<Record<string, unknown>>;
}) {
  return (
    <SnapshotSimpleList
      title="情報カード"
      empty="情報カードはありません。"
      items={items}
      render={(item) => (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">
            {str(item.sourceLabel) || str(item.sourceType) || "情報"}
          </p>
          <p className="whitespace-pre-wrap text-slate-900">
            {str(item.content) ||
              str(item.body) ||
              str(item.text) ||
              str(item.title) ||
              "—"}
          </p>
        </div>
      )}
    />
  );
}

export function SnapshotEvidenceLinksReadonly({
  items,
}: {
  items: Array<Record<string, unknown>>;
}) {
  return (
    <SnapshotSimpleList
      title="Evidenceリンク"
      empty="Evidenceリンクはありません。"
      items={items}
      render={(item) => (
        <div className="space-y-1">
          <p className="font-medium">
            {str(item.form2_field_key) ||
              str(item.fieldKey) ||
              str(item.form2FieldId) ||
              "フィールド"}
          </p>
          <p className="text-slate-700">
            カード：
            {str(item.information_card_id) ||
              str(item.informationCardId) ||
              str(item.cardTitle) ||
              "—"}
          </p>
        </div>
      )}
    />
  );
}

export function SnapshotFieldReflectionsReadonly({
  items,
}: {
  items: Array<Record<string, unknown>>;
}) {
  return (
    <SnapshotSimpleList
      title="フィールド振り返り"
      empty="フィールド振り返りはありません。"
      items={items}
      render={(item) => (
        <div className="space-y-1">
          <p className="font-medium">
            {str(item.form2_field_key) ||
              str(item.fieldKey) ||
              str(item.form2FieldKey) ||
              str(item.form2FieldId) ||
              "フィールド"}
          </p>
          <p className="whitespace-pre-wrap text-slate-700">
            {str(item.reflection_text) ||
              str(item.reflectionText) ||
              str(item.text) ||
              str(item.body) ||
              "—"}
          </p>
        </div>
      )}
    />
  );
}

export function SnapshotPatientUnderstandingReadonly({
  value,
}: {
  value: SnapshotReadModelOk["patientUnderstanding"];
}) {
  if (!value || !value.overviewText.trim()) {
    return (
      <p className="text-sm text-slate-500">患者理解の記録はありません。</p>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm">
      <p className="text-xs text-slate-500">
        更新：
        {value.updatedAt
          ? formatAssessmentDateTimeJa(value.updatedAt)
          : "—"}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-slate-900">
        {value.overviewText}
      </p>
    </div>
  );
}
