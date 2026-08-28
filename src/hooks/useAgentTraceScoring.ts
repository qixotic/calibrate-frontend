"use client";

import { useCallback, useEffect, useState } from "react";
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
};

/**
 * Eligibility + opt-in for automatic trace scoring. Enabling is blocked when
 * no linked evaluator can score this agent; disabling is always allowed.
 */
export function useAgentTraceScoring({
  accessToken,
  agentUuid,
  enabled,
  onEnabledChange,
}: UseAgentTraceScoringArgs) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [eligibility, setEligibility] = useState<TraceScoringEligibility | null>(
    null,
  );
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setIsEnabled(enabled);
  }, [enabled]);

  const loadEligibility = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingEligibility(true);
    setEligibilityError(null);
    try {
      const next = await fetchTraceScoringEligibility(accessToken, agentUuid);
      setEligibility(next);
    } catch (err) {
      reportError("Error fetching trace scoring eligibility:", err);
      setEligibility(null);
      setEligibilityError(
        "Could not check which evaluators can score this agent's traces.",
      );
    } finally {
      setIsLoadingEligibility(false);
    }
  }, [accessToken, agentUuid]);

  useEffect(() => {
    void loadEligibility();
  }, [loadEligibility]);

  const canEnable = (eligibility?.eligible.length ?? 0) > 0;
  const enableBlocked = !isEnabled && !canEnable;

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
          if (enableError.ineligible.length) {
            setEligibility((current) => ({
              eligible: current?.eligible ?? [],
              ineligible: enableError.ineligible.map((item) => ({
                evaluator_uuid: "",
                name: item.name,
                reason: item.reason as TraceScoringEligibility["ineligible"][number]["reason"],
              })),
            }));
          }
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
