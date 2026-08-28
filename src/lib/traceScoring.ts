import type {
  TraceScoringIneligibleReason,
  TraceScoringStatus,
  TraceSummary,
} from "./tracesApi";

/** A run that is still open and should be refetched. */
export function isTraceScoringInProgress(
  status: TraceScoringStatus | null | undefined,
): boolean {
  return status === "pending" || status === "processing";
}

export function pageHasOpenTraceScoring(
  traces: Pick<TraceSummary, "latest_run_status">[],
): boolean {
  return traces.some((trace) =>
    isTraceScoringInProgress(trace.latest_run_status),
  );
}

/** Why a linked evaluator cannot score this agent's traces. */
export function ineligibleReasonCopy(
  reason: TraceScoringIneligibleReason | string,
): string {
  switch (reason) {
    case "wrong_type_for_agent":
      return "Does not match this agent";
    case "no_live_version":
      return "Has no current version to run";
    case "declares_variables":
      return "Needs extra details that are not set for this agent";
    default:
      return "Cannot score traces for this agent";
  }
}

/** Why a scoring run was skipped or failed. */
export function scoringRunErrorCopy(error: string | null | undefined): string {
  switch (error) {
    case "no_usable_evaluators":
      return "No evaluators could score this trace";
    case "trace_deleted":
      return "This trace was deleted before scoring finished";
    case "agent_deleted":
      return "This agent was deleted before scoring finished";
    case "unsupported_interaction_type":
      return "This kind of agent cannot be scored yet";
    case "corrupt_snapshot":
      return "This scoring run could not be completed";
    default:
      return "Scoring did not finish";
  }
}

export function scoringStatusLabel(status: TraceScoringStatus): string {
  switch (status) {
    case "pending":
      return "Waiting";
    case "processing":
      return "Scoring";
    case "completed":
      return "Scored";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
  }
}

/** Compact pass count for a completed run. Never an average. */
export function scoringResultCountCopy(
  nPassed: number | null | undefined,
  nTotal: number | null | undefined,
): string | null {
  if (nPassed == null || nTotal == null || nTotal < 1) return null;
  return `${nPassed} of ${nTotal} passed`;
}

export function scoringPassSummaryCopy(
  passed: boolean | null | undefined,
): string | null {
  if (passed == null) return null;
  return passed ? "Passed" : "Did not pass";
}

export type ParsedAutoScoreIneligible = {
  evaluator_uuid: string;
  name: string;
  reason: string;
};

/**
 * Pull the enable-rejected partition out of a 422 from PUT /agents/{uuid}.
 * Only the structured `{ detail: { ineligible: [...] } }` body counts — a
 * FastAPI validation 422 (`detail` as an array of `{ loc, msg }`) is not this.
 */
export function parseAutoScoreEnableError(error: unknown): {
  message: string;
  ineligible: ParsedAutoScoreIneligible[];
} | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/Request failed:\s*422\s*-\s*(.+)$/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { detail?: unknown };
    const detail = parsed.detail;
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
      return null;
    }
    const ineligibleRaw = (detail as { ineligible?: unknown }).ineligible;
    if (!Array.isArray(ineligibleRaw)) return null;
    const ineligible = ineligibleRaw.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as {
        evaluator_uuid?: unknown;
        name?: unknown;
        reason?: unknown;
      };
      if (typeof row.name !== "string" || typeof row.reason !== "string") {
        return [];
      }
      return [
        {
          evaluator_uuid:
            typeof row.evaluator_uuid === "string" ? row.evaluator_uuid : "",
          name: row.name,
          reason: row.reason,
        },
      ];
    });
    return {
      message: "There are no evaluators that can score this agent's traces",
      ineligible,
    };
  } catch {
    return null;
  }
}
