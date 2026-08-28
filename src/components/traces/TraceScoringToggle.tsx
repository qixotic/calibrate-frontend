"use client";

import { Tooltip } from "@/components/Tooltip";
import { useAgentTraceScoring } from "@/hooks/useAgentTraceScoring";
import { ineligibleReasonCopy } from "@/lib/traceScoring";

type TraceScoringToggleProps = {
  agentUuid: string;
  accessToken: string | null;
  enabled: boolean;
  onEnabledChange?: (enabled: boolean) => void;
};

/**
 * Opt-in control for scoring newly ingested traces. Enabling is hard-blocked
 * when no linked evaluator can score this agent; turning scoring off is always
 * allowed, even if eligibility later drifts.
 */
export function TraceScoringToggle({
  agentUuid,
  accessToken,
  enabled,
  onEnabledChange,
}: TraceScoringToggleProps) {
  const {
    isEnabled,
    eligibility,
    isLoadingEligibility,
    eligibilityError,
    canEnable,
    enableBlocked,
    isSaving,
    saveError,
    setEnabled,
  } = useAgentTraceScoring({
    accessToken,
    agentUuid,
    enabled,
    onEnabledChange,
  });

  const disableEnable =
    !isEnabled &&
    (isSaving || isLoadingEligibility || !canEnable || !!eligibilityError);
  const disableOff = isSaving;
  const switchDisabled = isEnabled ? disableOff : disableEnable;

  const switchTooltip = !isEnabled
    ? isLoadingEligibility
      ? "Checking which evaluators can score new traces"
      : eligibilityError
        ? eligibilityError
        : !canEnable
          ? "Scoring cannot be turned on until an evaluator that can score this agent is linked"
          : "Score each new trace automatically"
    : "Stop scoring new traces";

  const eligible = eligibility?.eligible ?? [];
  const ineligible = eligibility?.ineligible ?? [];

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-3 md:px-4 py-3 md:py-4 flex items-start justify-between gap-3">
        <div className="flex flex-col-reverse md:flex-row items-start md:items-start gap-2 md:gap-4 min-w-0">
          <Tooltip content={switchTooltip} position="top">
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              aria-label="Score new traces automatically"
              disabled={switchDisabled}
              onClick={() => void setEnabled(!isEnabled)}
              className={`relative w-11 md:w-12 h-6 md:h-7 rounded-full transition-colors border-2 flex-shrink-0 ${
                switchDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              } ${
                isEnabled
                  ? "bg-green-500 border-green-500"
                  : "bg-muted border-muted-foreground/30"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 md:w-5 h-4 md:h-5 rounded-full bg-white shadow-md transition-transform ${
                  isEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </Tooltip>
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm md:text-base font-medium text-foreground">
              Score new traces automatically
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              When this is on, each new trace this agent receives is scored with
              the evaluators linked to it. Traces already received are not scored.
            </p>
            {isEnabled && !canEnable && eligibility && (
              <p className="text-xs md:text-sm text-muted-foreground">
                New traces will be skipped until an evaluator that can score this
                agent is linked. You can still turn scoring off.
              </p>
            )}
            {eligibilityError && (
              <p className="text-xs md:text-sm text-red-600 dark:text-red-400">
                {eligibilityError}
              </p>
            )}
            {saveError && (
              <p className="text-xs md:text-sm text-red-600 dark:text-red-400">
                {saveError}
              </p>
            )}
            {eligible.length > 0 && (
              <p className="text-xs md:text-sm text-muted-foreground">
                {eligible.length === 1
                  ? `${eligible[0].name} will score new traces.`
                  : `${eligible.map((item) => item.name).join(", ")} will score new traces.`}
              </p>
            )}
            {enableBlocked && !isLoadingEligibility && (
              <div className="space-y-1">
                <p className="text-xs md:text-sm text-foreground">
                  Scoring cannot be turned on because no linked evaluator can
                  score this agent&apos;s traces.
                </p>
                {ineligible.length > 0 && (
                  <ul className="text-xs md:text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
                    {ineligible.map((item) => (
                      <li key={item.evaluator_uuid || item.name}>
                        {item.name}: {ineligibleReasonCopy(item.reason)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {isEnabled && ineligible.length > 0 && !enableBlocked && (
              <ul className="text-xs md:text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
                {ineligible.map((item) => (
                  <li key={item.evaluator_uuid || item.name}>
                    {item.name}: {ineligibleReasonCopy(item.reason)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
