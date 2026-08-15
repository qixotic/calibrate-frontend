"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { TracesTable } from "@/components/traces/TracesTable";
import { TraceDetailDialog } from "@/components/traces/TraceDetailDialog";
import { TraceEvaluationsDialog } from "@/components/traces/TraceEvaluationsDialog";
import { TracesEmptyState } from "@/components/traces/TracesEmptyState";
import { LoadingState, SearchInput } from "@/components/ui";
import {
  useAccessToken,
  useDialogUrlParam,
  useMaxTraces,
  useTraceCount,
  useWorkspaceTraceCount,
  useTraceDeletion,
  useTraces,
} from "@/hooks";
import { bulkDeleteMatchingTraces, type TraceSummary } from "@/lib/tracesApi";
import { reportError } from "@/lib/reportError";

const SEARCH_DEBOUNCE_MS = 300;

type TracesTabContentProps = {
  agentUuid: string;
};

/**
 * The agent's Traces tab: what this agent actually did in production, one row
 * per turn. Every read and delete is scoped to `agentUuid` — the workspace can
 * hold traces from other agents, and none of them belong on this tab.
 */
export function TracesTabContent({ agentUuid }: TracesTabContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = useAccessToken();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(searchQuery),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // The conversation filter deep-links (?conversation_id=...) so a row's
  // conversation pill yields a shareable, reload-safe view.
  const conversationId = searchParams.get("conversation_id");
  const setConversationFilter = useCallback(
    (value: string | null) => {
      const params = new URLSearchParams(window.location.search);
      if (value) params.set("conversation_id", value);
      else params.delete("conversation_id");
      params.set("tab", "traces");
      router.replace(`/agents/${agentUuid}?${params.toString()}`);
    },
    [router, agentUuid],
  );

  const {
    items,
    total,
    offset,
    isLoading,
    error,
    handleDeleted,
    hasPrev,
    hasNext,
    prevPage,
    nextPage,
  } = useTraces({
    accessToken,
    agentUuid,
    q: debouncedQuery,
    conversationId,
  });

  const [usageRefreshKey, setUsageRefreshKey] = useState(0);
  const traceCount = useTraceCount(accessToken, agentUuid, usageRefreshKey);
  const workspaceTraceCount = useWorkspaceTraceCount(
    accessToken,
    usageRefreshKey,
  );
  const maxTraces = useMaxTraces();
  // The limit is workspace-wide, so this agent can be far under it and still
  // be refused new traces because other agents filled the workspace.
  const atCapacity =
    workspaceTraceCount != null && workspaceTraceCount >= maxTraces;

  const deletion = useTraceDeletion({
    traces: items,
    agentUuid,
    onDeleted: (uuids) => {
      handleDeleted(uuids.length);
      setUsageRefreshKey((key) => key + 1);
    },
    accessToken,
  });

  // "Delete everything matching this filter" — the select_all path covers
  // rows beyond the loaded page, which checkbox selection can't reach.
  const filtersActive = Boolean(debouncedQuery.trim() || conversationId);
  const [deleteMatchingOpen, setDeleteMatchingOpen] = useState(false);
  const [isDeletingMatching, setIsDeletingMatching] = useState(false);
  const deleteMatching = async () => {
    if (!accessToken) return;
    setIsDeletingMatching(true);
    try {
      const result = await bulkDeleteMatchingTraces(accessToken, {
        q: debouncedQuery,
        conversationId: conversationId ?? undefined,
        agentUuid,
      });
      setDeleteMatchingOpen(false);
      handleDeleted(result.deleted);
      setUsageRefreshKey((key) => key + 1);
    } catch (err) {
      reportError("Error deleting matching traces:", err);
    } finally {
      setIsDeletingMatching(false);
    }
  };

  const [openTraceUuid, setOpenTraceUuid] = useState<string | null>(null);
  const { setParam: setTraceParam } = useDialogUrlParam({
    param: "traceId",
    onOpen: (value) => setOpenTraceUuid(value),
    onClose: () => setOpenTraceUuid(null),
  });
  const openTrace = (uuid: string) => {
    setOpenTraceUuid(uuid);
    setTraceParam(uuid);
  };
  const closeTrace = () => {
    setOpenTraceUuid(null);
    setTraceParam(null);
  };

  const [evaluationsFor, setEvaluationsFor] = useState<TraceSummary | null>(
    null,
  );

  const showEmptyState = !isLoading && !error && total === 0 && !filtersActive;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + items.length, total);

  return (
    <div className="space-y-4 md:space-y-6 py-4 md:py-6">
      <div>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          Conversations this agent had in production, one trace per turn.
        </p>
        {traceCount != null && (
          <p className="text-xs text-muted-foreground mt-1">
            {traceCount.toLocaleString()} stored for this agent. Your workspace
            can hold {maxTraces.toLocaleString()} in total.
          </p>
        )}
      </div>

      {atCapacity && (
        <div
          role="status"
          className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200 flex items-start gap-2"
        >
          <svg
            className="w-4 h-4 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0 3.75h.01M10.34 3.94l-8.1 14.02A1.5 1.5 0 003.54 20.2h16.92a1.5 1.5 0 001.3-2.24l-8.1-14.02a1.5 1.5 0 00-2.6 0z"
            />
          </svg>
          <span>
            Your workspace is storing all {maxTraces.toLocaleString()} traces it
            can hold, so new ones are not being saved. Delete traces you no
            longer need, or contact support to ask for a higher limit.
          </span>
        </div>
      )}

      {!showEmptyState && (
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search traces"
            className="w-full md:max-w-md"
          />
          {conversationId && (
            <button
              type="button"
              onClick={() => setConversationFilter(null)}
              title="Clear conversation filter"
              className="flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors cursor-pointer max-w-full"
            >
              <span className="truncate">{conversationId}</span>
              <span aria-hidden>×</span>
            </button>
          )}
          <div className="flex items-center gap-2 md:ml-auto">
            {deletion.selectedUuids.size > 0 && (
              <button
                type="button"
                onClick={deletion.openBulkDeleteDialog}
                className="h-9 md:h-10 px-4 rounded-md text-xs md:text-sm font-medium border border-border bg-background hover:bg-muted/50 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
              >
                Delete selected ({deletion.selectedUuids.size})
              </button>
            )}
            {filtersActive && total > 0 && (
              <button
                type="button"
                onClick={() => setDeleteMatchingOpen(true)}
                className="h-9 md:h-10 px-4 rounded-md text-xs md:text-sm font-medium border border-border bg-background hover:bg-muted/50 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
              >
                Delete all {total.toLocaleString()} matching
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : showEmptyState ? (
        <TracesEmptyState agentUuid={agentUuid} />
      ) : items.length === 0 ? (
        <div className="border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No traces match your filters.
        </div>
      ) : (
        <>
          <TracesTable
            traces={items}
            checkboxProps={deletion.checkboxProps}
            allSelected={deletion.allSelected}
            hasSelectableItems={deletion.hasSelectableItems}
            onToggleSelectAll={deletion.toggleSelectAll}
            onOpen={openTrace}
            onOpenEvaluations={setEvaluationsFor}
            onDelete={deletion.openDeleteDialog}
            onFilterConversation={(value) => setConversationFilter(value)}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}{" "}
              of {total.toLocaleString()}
            </p>
            {(hasPrev || hasNext) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevPage}
                  disabled={!hasPrev}
                  className="h-9 px-4 rounded-md text-xs md:text-sm font-medium border border-border bg-background hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={nextPage}
                  disabled={!hasNext}
                  className="h-9 px-4 rounded-md text-xs md:text-sm font-medium border border-border bg-background hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <TraceDetailDialog
        isOpen={openTraceUuid != null}
        onClose={closeTrace}
        accessToken={accessToken}
        traceUuid={openTraceUuid}
      />

      <TraceEvaluationsDialog
        isOpen={evaluationsFor != null}
        onClose={() => setEvaluationsFor(null)}
        accessToken={accessToken}
        traceUuid={evaluationsFor?.uuid ?? null}
        messageId={evaluationsFor?.message_id}
      />

      <DeleteConfirmationDialog
        isOpen={deletion.deleteDialogOpen}
        onClose={deletion.closeDeleteDialog}
        onConfirm={deletion.deleteItems}
        title={
          deletion.itemsToDeleteBulk.length > 0
            ? `Delete ${deletion.itemsToDeleteBulk.length} trace${deletion.itemsToDeleteBulk.length === 1 ? "" : "s"}?`
            : "Delete this trace?"
        }
        message={
          deletion.deleteError ??
          "Deleting frees workspace capacity and lets the same message be sent again."
        }
        confirmText="Delete"
        isDeleting={deletion.isDeleting}
      />

      <DeleteConfirmationDialog
        isOpen={deleteMatchingOpen}
        onClose={() => {
          if (!isDeletingMatching) setDeleteMatchingOpen(false);
        }}
        onConfirm={deleteMatching}
        title={`Delete all ${total.toLocaleString()} matching traces?`}
        message="Every trace of this agent matching the current search and conversation filter will be deleted, including ones not shown on this page."
        confirmText="Delete all"
        isDeleting={isDeletingMatching}
      />
    </div>
  );
}
