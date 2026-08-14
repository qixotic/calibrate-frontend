"use client";

import React, { useState } from "react";
import { SelectCheckbox } from "@/components/ui/SelectCheckbox";
import { DeleteIconButton } from "@/components/ui";
import { useAccessToken } from "@/hooks/useAccessToken";
import type { TraceEvalSummary, TraceSummary } from "@/lib/tracesApi";
import { TraceEvaluationsDialog } from "./TraceEvaluationsDialog";

type CheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
  label: string;
  tooltip?: string;
};

type TracesTableProps = {
  traces: TraceSummary[];
  /** Per-row selection checkbox props, from `useTraceDeletion`. */
  checkboxProps: (trace: TraceSummary) => CheckboxProps;
  allSelected: boolean;
  hasSelectableItems: boolean;
  onToggleSelectAll: () => void;
  /** Open the detail view for a trace. */
  onOpen: (traceUuid: string) => void;
  /** Ask to delete a single trace. */
  onDelete: (trace: TraceSummary) => void;
  /** Filter the list down to one conversation. */
  onFilterConversation: (conversationId: string) => void;
};

export function formatTraceDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The tool names a turn used, as pills. `tool_call_names` is a truncated,
 * de-duplicated preview, so `tool_call_count` is what closes the gap when a
 * turn called more tools than are shown.
 */
function ToolCallNames({
  names = [],
  count,
}: {
  names?: string[];
  count: number;
}) {
  if (count === 0) {
    return <span className="text-[13px] text-muted-foreground">0</span>;
  }
  const hidden = count - names.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {names.map((name) => (
        <span
          key={name}
          className="font-mono text-xs px-2 py-0.5 rounded-full border border-border bg-muted/50 text-foreground"
        >
          {name}
        </span>
      ))}
      {hidden > 0 && (
        <span
          className="text-xs text-muted-foreground"
          title={`${count} tool calls in total`}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}

export type EvalSummaryState =
  | "not-evaluated"
  | "all-passed"
  | "some-passed"
  | "none-passed";

/**
 * Which of the four states a trace is in. A missing summary means nothing has
 * scored the trace yet, which must never be shown as "nothing passed" — an
 * empty set of evaluators is treated the same way rather than as 0 out of 0.
 */
export function evalSummaryState(
  summary: TraceEvalSummary | null | undefined,
): EvalSummaryState {
  if (!summary || summary.total <= 0) return "not-evaluated";
  if (summary.passed >= summary.total) return "all-passed";
  if (summary.passed <= 0) return "none-passed";
  return "some-passed";
}

const EVAL_PILL_CLASS: Record<EvalSummaryState, string> = {
  "not-evaluated":
    "border-dashed border-border bg-transparent text-muted-foreground",
  "all-passed":
    "border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-400",
  "some-passed":
    "border-yellow-200 bg-yellow-100 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/20 dark:text-yellow-400",
  "none-passed":
    "border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-400",
};

/** Shape, not only colour, separates the three scored states. */
function EvalStateIcon({ state }: { state: EvalSummaryState }) {
  const common = "w-3 h-3 flex-shrink-0";
  if (state === "all-passed") {
    return (
      <svg
        className={common}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6.5 5 9.5 10 3" />
      </svg>
    );
  }
  if (state === "none-passed") {
    return (
      <svg
        className={common}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" d="M3 3l6 6M9 3l-6 6" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 12 12" aria-hidden="true">
      <circle
        cx="6"
        cy="6"
        r="4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path d="M6 1.5A4.5 4.5 0 0 1 6 10.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * How the evaluators scored one trace. Not-yet-scored is a dashed outline with
 * no count, so it never reads as a score of zero.
 */
function EvaluationsBadge({
  summary,
  onOpen,
}: {
  summary: TraceEvalSummary | null | undefined;
  onOpen: () => void;
}) {
  const state = evalSummaryState(summary);
  const pill = `inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-full border text-xs font-medium ${EVAL_PILL_CLASS[state]}`;

  if (state === "not-evaluated" || !summary) {
    return <span className={pill}>Not evaluated yet</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title="See what the evaluators found"
      className={`${pill} hover:opacity-80 transition-opacity cursor-pointer`}
    >
      <EvalStateIcon state={state} />
      <span className="truncate">
        {summary.passed} of {summary.total} passed
      </span>
    </button>
  );
}

function ConversationButton({
  conversationId,
  onClick,
}: {
  conversationId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Show this conversation"
      className="max-w-full truncate font-mono text-xs px-2 py-0.5 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors cursor-pointer"
    >
      {conversationId}
    </button>
  );
}

/**
 * The traces list: a table on desktop, cards on mobile. Rows open the detail
 * view; the conversation pill narrows the list to that conversation.
 */
export function TracesTable({
  traces,
  checkboxProps,
  allSelected,
  hasSelectableItems,
  onToggleSelectAll,
  onOpen,
  onDelete,
  onFilterConversation,
}: TracesTableProps) {
  const accessToken = useAccessToken();
  const [evaluationsFor, setEvaluationsFor] = useState<TraceSummary | null>(
    null,
  );

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block border border-border rounded-xl overflow-hidden">
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="w-12 px-4 py-3">
                <SelectCheckbox
                  checked={allSelected}
                  onToggle={onToggleSelectAll}
                  disabled={!hasSelectableItems}
                  label="Select all traces"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-[26%]">
                Message
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Response
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-[16%]">
                Conversation
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground w-16">
                Turns
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-[12%]">
                Tools
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-40">
                Evaluations
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-40">
                Created
              </th>
              <th className="w-14 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {traces.map((trace) => (
              <tr
                key={trace.uuid}
                onClick={() => onOpen(trace.uuid)}
                className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <SelectCheckbox {...checkboxProps(trace)} />
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-foreground truncate">
                    {trace.message_id}
                  </div>
                  {trace.input_preview && (
                    <div className="text-[13px] text-muted-foreground truncate mt-0.5">
                      {trace.input_preview}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {trace.response_preview ? (
                    <div className="text-[13px] text-foreground truncate">
                      {trace.response_preview}
                    </div>
                  ) : (
                    <div className="text-[13px] text-muted-foreground italic">
                      Tool calls only
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ConversationButton
                    conversationId={trace.conversation_id}
                    onClick={() => onFilterConversation(trace.conversation_id)}
                  />
                </td>
                <td className="px-4 py-3 text-right text-[13px] text-muted-foreground">
                  {trace.turn_count}
                </td>
                <td className="px-4 py-3">
                  <ToolCallNames
                    names={trace.tool_call_names}
                    count={trace.tool_call_count}
                  />
                </td>
                <td className="px-4 py-3">
                  <EvaluationsBadge
                    summary={trace.eval_summary}
                    onOpen={() => setEvaluationsFor(trace)}
                  />
                </td>
                <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">
                  {formatTraceDate(trace.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteIconButton
                    onClick={() => onDelete(trace)}
                    title="Delete trace"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {traces.map((trace) => (
          <div
            key={trace.uuid}
            className="border border-border rounded-lg overflow-hidden bg-background"
          >
            <div
              className="p-4 cursor-pointer"
              onClick={() => onOpen(trace.uuid)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-mono text-xs text-foreground truncate">
                  {trace.message_id}
                </div>
                <SelectCheckbox {...checkboxProps(trace)} />
              </div>
              {trace.input_preview && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {trace.input_preview}
                </p>
              )}
              {trace.response_preview ? (
                <p className="text-sm text-foreground mt-1 line-clamp-2">
                  {trace.response_preview}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic mt-1">
                  Tool calls only
                </p>
              )}
            </div>
            {trace.tool_call_count > 0 && (
              <div className="px-4 pb-2">
                <ToolCallNames
                  names={trace.tool_call_names}
                  count={trace.tool_call_count}
                />
              </div>
            )}
            <div className="px-4 pb-2">
              <EvaluationsBadge
                summary={trace.eval_summary}
                onOpen={() => setEvaluationsFor(trace)}
              />
            </div>
            <div className="flex items-center gap-2 px-4 pb-3 pt-0">
              <ConversationButton
                conversationId={trace.conversation_id}
                onClick={() => onFilterConversation(trace.conversation_id)}
              />
              <span className="text-xs text-muted-foreground">
                {trace.turn_count} turns
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTraceDate(trace.created_at)}
              </span>
              <div className="ml-auto">
                <DeleteIconButton
                  onClick={() => onDelete(trace)}
                  title="Delete trace"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <TraceEvaluationsDialog
        isOpen={evaluationsFor != null}
        onClose={() => setEvaluationsFor(null)}
        accessToken={accessToken}
        traceUuid={evaluationsFor?.uuid ?? null}
        messageId={evaluationsFor?.message_id}
      />
    </>
  );
}
