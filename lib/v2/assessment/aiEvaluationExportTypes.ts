/**
 * AI Export の Preview / Download 結果型（"use server" 外）
 */

export type AiExportPreviewItem = {
  submissionId: string;
  submissionNumber: number;
  timingStatus: string;
  includedArtifacts: string[];
  parseOk: boolean;
};

export type AiExportPreviewResult =
  | {
      ok: true;
      milestoneId: string;
      milestoneTitle: string;
      cycleTitle: string;
      exportCycleTitle: string;
      exportMilestoneTitle: string;
      freeTextWarning: string;
      recordCount: number;
      includedArtifacts: string[];
      items: AiExportPreviewItem[];
      schemaVersion: number;
      packageSchemaVersion: number;
    }
  | { ok: false; kind: string; message: string };

export type AiExportDownloadResult =
  | {
      ok: true;
      format: "json" | "jsonl";
      filename: string;
      contentType: string;
      body: string;
      recordCount: number;
      includedArtifacts: string[];
      auditLogged: boolean;
    }
  | { ok: false; kind: string; message: string };
