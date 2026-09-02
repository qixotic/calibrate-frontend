"use client";

import { PassFailCountPills, StatusBadge } from "@/components/ui";
import { scoringResultCounts } from "@/lib/traceScoring";
import type { TraceSummary } from "@/lib/tracesApi";

type TraceScoringSummaryProps = {
  trace: Pick<
    TraceSummary,
    "latest_run_status" | "n_passed" | "n_total"
  >;
};

/**
 * Compact latest-run cell: status, or the same Success / Fail count pills
 * completed evaluations use. Never averages binary and rating results.
 */
export function TraceScoringSummary({ trace }: TraceScoringSummaryProps) {
  const status = trace.latest_run_status;
  if (!status) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  if (status === "completed") {
    const counts = scoringResultCounts(trace.n_passed, trace.n_total);
    if (!counts) {
      return <span className="text-sm text-muted-foreground">—</span>;
    }
    return (
      <PassFailCountPills passed={counts.passed} failed={counts.failed} />
    );
  }

  return (
    <StatusBadge
      status={status}
      showSpinner={status === "pending" || status === "processing"}
    />
  );
}
