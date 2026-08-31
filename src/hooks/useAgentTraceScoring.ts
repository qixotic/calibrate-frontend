"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchTraceScoringEligibility,
  setAgentAutoScoreTraces,
  type TraceScoringEligibility,
} from "@/lib/tracesApi";
import { parseAutoScoreEnableError } from "@/lib/traceScoring";
import { parseBackendErrorMessage } from "@/lib/parseBackendError";
import { reportError } from "@/lib/reportError";

type UseAgentTraceScoringArgs = {
  accessToken: string | null;
  agentUuid: string;
  /** Current flag from the agent record. The hook keeps a live copy after a toggle. */
  enabled: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /**
   * The traces tab is on screen. Eligibility is fetched when this becomes
   * true so linking an evaluator on another tab unblocks the switch without
   * a full reload. While false, no eligibility request is started.
   */
  isActive?: boolean;
};

/**
 * Eligibility + opt-in for automatic trace scoring. Enabling is blocked when
 * no linked evaluator can score this agent; disabling is always allowed.
 * Eligibility stays unknown until a GET succeeds — a missing or failed check
 * is not treated as "no eligible evaluators".
 */
export function useAgentTraceScoring({
  accessToken,
  agentUuid,
  enabled,
  onEnabledChange,
  isActive = true,
}: UseAgentTraceScoringArgs) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [eligibility, setEligibility] = useState<TraceScoringEligibility | null>(
    null,
  );
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(
    () => Boolean(accessToken) && isActive,
  );
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setIsEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    requestIdRef.current += 1;
    setEligibility(null);
    setEligibilityError(null);
    setSaveError(null);
    setIsLoadingEligibility(Boolean(accessToken) && isActive);
    // Tab visibility must not wipe a successful GET; only identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isActive is read from this render
  }, [agentUuid, accessToken]);

  const loadEligibility = useCallback(async () => {
    if (!accessToken) return;
    const requestId = ++requestIdRef.current;
    setIsLoadingEligibility(true);
    setEligibilityError(null);
    try {
      const next = await fetchTraceScoringEligibility(accessToken, agentUuid);
      if (requestId !== requestIdRef.current) return;
      setEligibility(next);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      reportError("Error fetching trace scoring eligibility:", err);
      setEligibility(null);
      setEligibilityError(
        "Could not check which evaluators can score this agent's traces.",
      );
    } finally {
      if (requestId === requestIdRef.current) setIsLoadingEligibility(false);
    }
  }, [accessToken, agentUuid]);

  useEffect(() => {
    if (!isActive) return;
    void loadEligibility();
  }, [isActive, loadEligibility]);

  const hasEligibility = eligibility !== null;
  const canEnable = (eligibility?.eligible.length ?? 0) > 0;
  const enableBlocked = !isEnabled && hasEligibility && !canEnable;

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (!accessToken) return;
      if (next === isEnabled) return;
      if (next && !canEnable) return;
      setIsSaving(true);
      setSaveError(null);
      try {
        const updated = await setAgentAutoScoreTraces(
          accessToken,
          agentUuid,
          next,
        );
        const live = !!updated.auto_score_traces;
        setIsEnabled(live);
        onEnabledChange?.(live);
        if (next) void loadEligibility();
      } catch (err) {
        reportError("Error updating automatic trace scoring:", err);
        const enableError = parseAutoScoreEnableError(err);
        if (enableError) {
          setSaveError(enableError.message);
          setEligibility({
            eligible: [],
            ineligible: enableError.ineligible.map((item) => ({
              evaluator_uuid: item.evaluator_uuid,
              name: item.name,
              reason: item.reason as TraceScoringEligibility["ineligible"][number]["reason"],
            })),
          });
        } else {
          setSaveError(
            parseBackendErrorMessage(
              err,
              "Could not update automatic scoring. Please try again.",
            ),
          );
        }
      } finally {
        setIsSaving(false);
      }
    },
    [
      accessToken,
      agentUuid,
      canEnable,
      isEnabled,
      loadEligibility,
      onEnabledChange,
    ],
  );

  return {
    isEnabled,
    eligibility,
    isLoadingEligibility,
    eligibilityError,
    canEnable,
    enableBlocked,
    isSaving,
    saveError,
    setEnabled,
    reloadEligibility: loadEligibility,
  };
}
