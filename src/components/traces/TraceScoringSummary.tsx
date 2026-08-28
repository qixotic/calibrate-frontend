"use client";

import { StatusBadge } from "@/components/ui";
import {
  scoringPassSummaryCopy,
  scoringResultCountCopy,
} from "@/lib/traceScoring";
import type { TraceSummary } from "@/lib/tracesApi";

type TraceScoringSummaryProps = {
  trace: Pick<
    TraceSummary,
    "latest_run_status" | "passed" | "n_passed" | "n_total"
  >;
};

/**
 * Compact latest-run cell: status, pass/fail, and a count. Never averages
 * binary and rating results together.
 */
export function TraceScoringSummary({ trace }: TraceScoringSummaryProps) {
  const status = trace.latest_run_status;
  if (!status) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  if (status === "completed") {
    const passLabel = scoringPassSummaryCopy(trace.passed);
    const countLabel = scoringResultCountCopy(trace.n_passed, trace.n_total);
    const passed = trace.passed === true;
    return (
      <div className="min-w-0 space-y-0.5">
        {passLabel && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
              passed
                ? "bg-green-500/15 text-green-600 dark:text-green-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400"
            }`}
          >
            {passLabel}
          </span>
        )}
        {countLabel && (
          <div className="text-xs text-muted-foreground truncate">
            {countLabel}
          </div>
        )}
      </div>
    );
  }

  const badge = (
    <StatusBadge
      status={status}
      showSpinner={status === "pending" || status === "processing"}
    />
  );

  if (status === "failed" || status === "skipped") {
    return badge;
  }

  return badge;
}
