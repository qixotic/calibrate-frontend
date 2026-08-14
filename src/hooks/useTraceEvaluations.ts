"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchTraceEvaluations,
  TraceEvaluationResult,
} from "@/lib/traceEvalApi";
import { reportError } from "@/lib/reportError";

type UseTraceEvaluationsArgs = {
  /** Backend JWT; the hook stays idle until it's available. */
  accessToken: string | null;
  /** The trace to read verdicts for, or null when nothing is open. */
  traceUuid: string | null;
  /** False keeps the hook idle, so a closed dialog never fetches. */
  enabled: boolean;
};

/** What one completed read produced, tagged with the read it answered. */
type LoadedEvaluations = {
  key: string;
  results: TraceEvaluationResult[] | null;
  error: string | null;
};

/**
 * The evaluator verdicts recorded against one trace. Kept out of the dialog so
 * the fetch, the stale-response guard, and the failure path can be tested
 * without rendering, and so a second surface can reuse them later.
 *
 * Everything the caller reads is derived from the key of the read in flight,
 * so switching trace (or closing) never leaves the previous trace's verdicts
 * on screen for a frame.
 */
export function useTraceEvaluations({
  accessToken,
  traceUuid,
  enabled,
}: UseTraceEvaluationsArgs) {
  const [loaded, setLoaded] = useState<LoadedEvaluations | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const refetch = useCallback(() => setReloadCount((count) => count + 1), []);

  const key =
    enabled && traceUuid && accessToken ? `${reloadCount}:${traceUuid}` : null;

  useEffect(() => {
    if (!key || !traceUuid || !accessToken) return;
    let cancelled = false;
    fetchTraceEvaluations(accessToken, traceUuid)
      .then((data) => {
        if (!cancelled) {
          setLoaded({ key, results: data.results ?? [], error: null });
        }
      })
      .catch((err) => {
        reportError("Error fetching trace evaluations:", err);
        if (!cancelled) {
          setLoaded({
            key,
            results: null,
            error: "Failed to load these results. Please try again.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, traceUuid, accessToken]);

  const current = loaded && loaded.key === key ? loaded : null;

  return {
    results: current?.results ?? null,
    error: current?.error ?? null,
    isLoading: key != null && current == null,
    refetch,
  };
}
