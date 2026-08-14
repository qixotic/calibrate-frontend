"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTraces, TraceSummary } from "@/lib/tracesApi";
import { reportError } from "@/lib/reportError";

export const TRACES_PAGE_SIZE = 50;

type UseTracesArgs = {
  /** Backend JWT; the hook is idle until it's available. */
  accessToken: string | null;
  /** The agent whose traces to read. Every list is agent-scoped. */
  agentUuid: string;
  /** Server-side search query. Pass the debounced value, not each keystroke. */
  q: string;
  /** Restrict the list to one conversation, or null for all. */
  conversationId: string | null;
  pageSize?: number;
};

/**
 * Server-paginated trace list. Every other list page fetches everything and
 * filters client-side; traces are machine-written and can be far larger than
 * the client should download, so paging, search, and the conversation filter
 * all round-trip to `GET /traces` and this hook only ever holds one page.
 */
export function useTraces({
  accessToken,
  agentUuid,
  q,
  conversationId,
  pageSize = TRACES_PAGE_SIZE,
}: UseTracesArgs) {
  const [items, setItems] = useState<TraceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Monotonic id so a slow, superseded response can never clobber the state
  // written by a newer request (filters change mid-flight, rapid paging).
  const requestIdRef = useRef(0);

  useEffect(() => {
    setOffset(0);
  }, [q, conversationId, agentUuid]);

  const load = useCallback(
    async (targetOffset: number) => {
      if (!accessToken) return;
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const page = await fetchTraces(accessToken, {
          limit: pageSize,
          offset: targetOffset,
          q: q || undefined,
          conversationId: conversationId || undefined,
          agentUuid,
        });
        if (requestId !== requestIdRef.current) return;
        setItems(page.items ?? []);
        setTotal(page.total ?? 0);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        reportError("Error fetching traces:", err);
        setError("Failed to load traces. Please try again.");
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [accessToken, pageSize, q, conversationId, agentUuid],
  );

  useEffect(() => {
    load(offset);
  }, [load, offset]);

  const refetch = useCallback(() => load(offset), [load, offset]);

  /** Re-sync after `count` rows were deleted, clamping the page back into
   *  range when the current offset would land past the new end. */
  const handleDeleted = useCallback(
    (count: number) => {
      const newTotal = Math.max(0, total - count);
      const lastPageOffset =
        Math.max(0, Math.ceil(newTotal / pageSize) - 1) * pageSize;
      if (offset > lastPageOffset) {
        setOffset(lastPageOffset);
      } else {
        load(offset);
      }
    },
    [total, pageSize, offset, load],
  );

  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < total;

  const prevPage = useCallback(() => {
    setOffset((current) => Math.max(0, current - pageSize));
  }, [pageSize]);

  const nextPage = useCallback(() => {
    setOffset((current) =>
      current + pageSize < total ? current + pageSize : current,
    );
  }, [pageSize, total]);

  return {
    items,
    total,
    offset,
    pageSize,
    isLoading,
    error,
    refetch,
    handleDeleted,
    hasPrev,
    hasNext,
    prevPage,
    nextPage,
  };
}

/**
 * Live trace count for one agent, independent of the list's active filters (a
 * `limit=1` fetch reads just the envelope `total`). Note the workspace cap
 * this is shown against counts every agent's traces, so a single agent can sit
 * well under the cap while the workspace is at it. Bump `refreshKey` after
 * deletes or ingests to re-read.
 */
/**
 * Live trace count across the whole workspace, which is what the storage limit
 * applies to. The per-agent count cannot stand in for it: an agent well under
 * the limit still stops accepting traces once its siblings fill the workspace.
 */
export function useWorkspaceTraceCount(
  accessToken: string | null,
  refreshKey = 0,
) {
  return useTraceCount(accessToken, undefined, refreshKey);
}

export function useTraceCount(
  accessToken: string | null,
  agentUuid: string | undefined,
  refreshKey = 0,
) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetchTraces(accessToken, { limit: 1, offset: 0, agentUuid })
      .then((page) => {
        if (!cancelled) setCount(page.total ?? 0);
      })
      .catch((err) => {
        reportError("Error fetching trace count:", err);
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, agentUuid, refreshKey]);

  return count;
}
