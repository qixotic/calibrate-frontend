"use client";

import { EvaluatorVerdictCard } from "@/components/EvaluatorVerdictCard";
import { PassFailCountPills, StatusBadge } from "@/components/ui";
import {
  scoringResultCounts,
  scoringRunErrorCopy,
  scoringStatusLabel,
} from "@/lib/traceScoring";
import { formatTraceDate } from "./TracesTable";
import type { TraceScoreResult, TraceScoringRun } from "@/lib/tracesApi";

type TraceScoreHistoryProps = {
  runs: TraceScoringRun[];
  isLoading?: boolean;
  error?: string | null;
};

function versionLabel(versionId: string): string {
  const compact = versionId.replace(/-/g, "").slice(0, 8);
  return compact || versionId;
}

/** The verdict card keeps binary and rating displays apart, so the stored
 *  numeric `value` is split back into the field its output type reads. */
function verdictFields(result: TraceScoreResult): {
  match?: boolean;
  score?: number;
} {
  if (result.output_type === "rating") {
    return { score: result.value };
  }
  return { match: result.value === 1 };
}

function RunHeader({ run, isLatest }: { run: TraceScoringRun; isLatest: boolean }) {
  const counts =
    run.status === "completed"
      ? scoringResultCounts(
          run.results.filter((result) => result.passed).length,
          run.results.length,
        )
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="text-sm font-semibold text-foreground">
        {isLatest ? "Latest scores" : "Earlier scores"}
      </h4>
      <StatusBadge
        status={run.status}
        showSpinner={run.status === "pending" || run.status === "processing"}
      />
      {counts && (
        <PassFailCountPills passed={counts.passed} failed={counts.failed} />
      )}
    </div>
  );
}

function RunBody({ run }: { run: TraceScoringRun }) {
  if (run.status === "pending" || run.status === "processing") {
    return (
      <p className="text-sm text-muted-foreground">
        {run.status === "pending"
          ? "Waiting to be scored."
          : "Scoring this trace now."}
      </p>
    );
  }

  if (run.status === "failed" || run.status === "skipped") {
    return (
      <p className="text-sm text-muted-foreground">
        {scoringRunErrorCopy(run.error)}
      </p>
    );
  }

  if (run.results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No evaluator results were stored for this run.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {run.results.map((result) => (
        <EvaluatorVerdictCard
          key={`${run.run_uuid}-${result.evaluator_uuid}`}
          mode="read"
          name={result.name}
          outputType={result.output_type}
          {...verdictFields(result)}
          reasoning={result.reasoning}
          scaleMin={result.scale_min ?? undefined}
          scaleMax={result.scale_max ?? undefined}
          evaluatorUuid={result.evaluator_uuid}
          enableLink
          versionLabel={versionLabel(result.evaluator_version_id)}
        />
      ))}
    </div>
  );
}

/**
 * Full scoring history for one trace, newest first. Reuses the shared
 * evaluator verdict card so binary and rating results keep their own display.
 */
export function TraceScoreHistory({
  runs,
  isLoading = false,
  error = null,
}: TraceScoreHistoryProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading scores...</p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
    );
  }
  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This trace has not been scored.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {runs.map((run, index) => (
        <section key={run.run_uuid} className="space-y-3">
          <RunHeader run={run} isLatest={index === 0} />
          <p className="text-xs text-muted-foreground">
            {scoringStatusLabel(run.status)} · {formatTraceDate(run.created_at)}
            {run.completed_at
              ? ` · finished ${formatTraceDate(run.completed_at)}`
              : ""}
          </p>
          <RunBody run={run} />
        </section>
      ))}
    </div>
  );
}
