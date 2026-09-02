"use client";

import { useId } from "react";
import { EvaluatorPillList } from "@/components/EvaluatorPillList";
import { WarningTriangleIcon } from "@/components/icons";
import { useAgentTraceScoring } from "@/hooks/useAgentTraceScoring";
import { ineligibleReasonCopy } from "@/lib/traceScoring";
import type {
  TraceScoringEligibleEvaluator,
  TraceScoringIneligibleEvaluator,
} from "@/lib/tracesApi";

type TraceScoringToggleProps = {
  agentUuid: string;
  accessToken: string | null;
  enabled: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** The traces tab is on screen; eligibility refetches when this becomes true. */
  isActive?: boolean;
};

function pillUuid(uuid: string) {
  return uuid || undefined;
}

function eligiblePills(eligible: TraceScoringEligibleEvaluator[]) {
  return eligible.map((item) => ({
    uuid: pillUuid(item.evaluator_uuid),
    name: item.name,
  }));
}

function ineligiblePills(ineligible: TraceScoringIneligibleEvaluator[]) {
  return ineligible.map((item) => ({
    uuid: pillUuid(item.evaluator_uuid),
    name: item.name,
    detail: ineligibleReasonCopy(item.reason),
  }));
}

/** Amber, not red: an ineligible evaluator is a setup gap to fix, not a
 *  judgement that anything the agent did was wrong. */
function IneligibleEvaluatorsBanner({
  lead,
  ineligible,
}: {
  lead: string;
  ineligible: TraceScoringIneligibleEvaluator[];
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs md:text-sm text-foreground flex items-start gap-2">
      <WarningTriangleIcon className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
      <div className="min-w-0 space-y-2">
        <p>{lead}</p>
        <EvaluatorPillList layout="flow" evaluators={ineligiblePills(ineligible)} />
      </div>
    </div>
  );
}

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
  isActive = true,
}: TraceScoringToggleProps) {
  const descriptionId = useId();
  const statusId = useId();
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
    isActive,
  });

  const eligibilityUnknown = eligibility === null && !eligibilityError;
  const disableEnable =
    !isEnabled &&
    (isSaving ||
      isLoadingEligibility ||
      eligibilityUnknown ||
      !!eligibilityError ||
      enableBlocked);
  const disableOff = isSaving;
  const switchDisabled = isEnabled ? disableOff : disableEnable;
  const showLoadingCopy = isLoadingEligibility && eligibility === null;

  const eligible = eligibility?.eligible ?? [];
  const ineligible = eligibility?.ineligible ?? [];
  const describedBy = [descriptionId, statusId].join(" ");
  const ineligibleLead = enableBlocked
    ? "Scoring cannot be turned on because no linked evaluator can score this agent's traces."
    : isEnabled && !canEnable
      ? "New traces will be skipped until an evaluator that can score this agent is linked. You can still turn scoring off."
      : "Some linked evaluators cannot be used on traces.";

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-3 md:px-4 py-3 md:py-4 space-y-2">
        <div className="flex flex-col-reverse md:flex-row items-start md:items-center gap-2 md:gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label="Score new traces automatically"
            aria-describedby={describedBy}
            disabled={switchDisabled}
            onClick={() => void setEnabled(!isEnabled)}
            className={`relative w-11 md:w-12 h-6 md:h-7 rounded-full transition-colors border-2 flex-shrink-0 ${
              switchDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
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
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm md:text-base font-medium text-foreground">
              Score new traces automatically
            </h3>
            <p
              id={descriptionId}
              className="text-xs md:text-sm text-muted-foreground"
            >
              When enabled, this agent&apos;s new traces are scored with its linked Evaluators. Past traces are not
              scored.
            </p>
          </div>
        </div>
        <div id={statusId} className="space-y-2">
          {showLoadingCopy && (
            <p className="text-xs md:text-sm text-muted-foreground">
              Checking which evaluators can score new traces.
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
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                Evaluators used
              </h4>
              <EvaluatorPillList
                layout="flow"
                evaluators={eligiblePills(eligible)}
              />
            </div>
          )}
          {eligibility !== null &&
            (ineligible.length > 0 || (isEnabled && !canEnable)) && (
              <IneligibleEvaluatorsBanner
                lead={ineligibleLead}
                ineligible={ineligible}
              />
            )}
        </div>
      </div>
    </div>
  );
}
