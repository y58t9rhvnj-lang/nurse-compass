import "server-only";

/**
 * Safe assessment diagnostics for production investigation.
 * Never log names, login IDs, emails, Form2/3 bodies, snapshots, or evidence text.
 */

export type AssessmentDiagPhase = "start" | "success" | "fail";

export type AssessmentDiagInput = {
  op: string;
  phase: AssessmentDiagPhase;
  organizationId?: string | null;
  role?: string | null;
  cycleId?: string | null;
  milestoneId?: string | null;
  /** Presence only — never log the UUID value (avoid correlating to a person). */
  hasStudentRef?: boolean;
  supabaseCode?: string | null;
  supabaseMessage?: string | null;
  detail?: string | null;
  error?: unknown;
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function safeErrorFields(error: unknown): {
  errorName?: string;
  errorMessage?: string;
  stack?: string;
} {
  if (!error) return {};
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: truncate(error.message, 300),
      stack: error.stack ? truncate(error.stack, 2000) : undefined,
    };
  }
  return { errorMessage: truncate(String(error), 300) };
}

/** Structured console log for assessment server paths. */
export function logAssessmentDiag(input: AssessmentDiagInput): void {
  const payload = {
    tag: "assessment-diag",
    op: input.op,
    phase: input.phase,
    organizationId: input.organizationId ?? null,
    role: input.role ?? null,
    cycleId: input.cycleId ?? null,
    milestoneId: input.milestoneId ?? null,
    hasStudentRef: input.hasStudentRef ?? false,
    supabaseCode: input.supabaseCode ?? null,
    supabaseMessage: input.supabaseMessage
      ? truncate(input.supabaseMessage, 300)
      : null,
    detail: input.detail ? truncate(input.detail, 200) : null,
    ...safeErrorFields(input.error),
    at: new Date().toISOString(),
  };

  if (input.phase === "fail") {
    console.error(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}

export function supabaseErrFields(
  err: { message?: string; code?: string } | null | undefined,
): { supabaseCode: string | null; supabaseMessage: string | null } {
  if (!err) return { supabaseCode: null, supabaseMessage: null };
  return {
    supabaseCode: typeof err.code === "string" ? err.code : null,
    supabaseMessage: typeof err.message === "string" ? err.message : null,
  };
}

/** Throw after logging — surfaces in V2 error.tsx with digest. */
export function throwAssessmentDiagError(
  input: Omit<AssessmentDiagInput, "phase"> & { message: string },
): never {
  const err = new Error(input.message);
  logAssessmentDiag({
    ...input,
    phase: "fail",
    error: err,
  });
  throw err;
}
