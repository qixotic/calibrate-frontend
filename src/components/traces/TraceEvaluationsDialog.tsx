"use client";

import React, { useState } from "react";
import { useHideFloatingButton } from "@/components/AppLayout";
import { LoadingState } from "@/components/ui";
import { useTraceEvaluations } from "@/hooks/useTraceEvaluations";
import { formatVerdict, TraceEvaluationResult } from "@/lib/traceEvalApi";

type TraceEvaluationsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string | null;
  traceUuid: string | null;
  /** Shown under the heading so the reader knows which turn they are reading. */
  messageId?: string | null;
};

/** Reasoning longer than this is collapsed so the verdicts stay scannable. */
const REASONING_CLAMP = 260;

function verdictPillClass(result: TraceEvaluationResult): string {
  const base =
    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap";
  if (result.output_type === "rating") {
    return `${base} border-border bg-muted/50 text-foreground`;
  }
  if (result.passed === true) {
    return `${base} border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-400`;
  }
  if (result.passed === false) {
    return `${base} border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-400`;
  }
  return `${base} border-border bg-muted/50 text-muted-foreground`;
}

function Reasoning({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > REASONING_CLAMP;

  return (
    <div className="mt-2">
      <p className="text-[13px] text-muted-foreground whitespace-pre-wrap break-words">
        {isLong && !expanded ? `${text.slice(0, REASONING_CLAMP)}…` : text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 text-xs font-medium text-foreground underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function EvaluationRow({ result }: { result: TraceEvaluationResult }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-background">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground break-words">
          {result.evaluator_name}
        </h3>
        <span className={verdictPillClass(result)}>{formatVerdict(result)}</span>
      </div>
      {result.reasoning ? (
        <Reasoning text={result.reasoning} />
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground italic">
          This evaluator gave no reason.
        </p>
      )}
    </div>
  );
}

/**
 * Every evaluator verdict on one trace, one row each. Fetches its own data so
 * the list only ever carries the pass count, not the reasons behind it.
 */
export function TraceEvaluationsDialog({
  isOpen,
  onClose,
  accessToken,
  traceUuid,
  messageId,
}: TraceEvaluationsDialogProps) {
  useHideFloatingButton(isOpen);

  const { results, isLoading, error } = useTraceEvaluations({
    accessToken,
    traceUuid,
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-5 md:p-6 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-semibold text-foreground">
              What the evaluators found
            </h2>
            {messageId && (
              <p className="font-mono text-xs text-muted-foreground truncate mt-1">
                {messageId}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-3">
          {isLoading && <LoadingState />}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {results && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No evaluator has scored this trace yet. Run this agent&apos;s
              evaluators on its traces and their scores appear here.
            </p>
          )}

          {results?.map((result) => (
            <EvaluationRow
              key={`${result.run_uuid}-${result.evaluator_uuid}`}
              result={result}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
