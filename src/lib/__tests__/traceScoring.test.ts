import {
  ineligibleReasonCopy,
  isTraceScoringInProgress,
  pageHasOpenTraceScoring,
  parseAutoScoreEnableError,
  scoringResultCounts,
  scoringRunErrorCopy,
  scoringStatusLabel,
} from "../traceScoring";

describe("isTraceScoringInProgress", () => {
  it("treats waiting and in-flight runs as open", () => {
    expect(isTraceScoringInProgress("pending")).toBe(true);
    expect(isTraceScoringInProgress("processing")).toBe(true);
    expect(isTraceScoringInProgress("completed")).toBe(false);
    expect(isTraceScoringInProgress(null)).toBe(false);
  });
});

describe("pageHasOpenTraceScoring", () => {
  it("is true when any visible row is still being scored", () => {
    expect(
      pageHasOpenTraceScoring([
        { latest_run_status: "completed" },
        { latest_run_status: "pending" },
      ]),
    ).toBe(true);
    expect(pageHasOpenTraceScoring([{ latest_run_status: "failed" }])).toBe(
      false,
    );
  });
});

describe("copy", () => {
  it("explains ineligible evaluators in ordinary words", () => {
    expect(ineligibleReasonCopy("wrong_type_for_agent")).toBe(
      "Does not match this agent",
    );
    expect(ineligibleReasonCopy("no_live_version")).toBe(
      "Has no current version to run",
    );
    expect(ineligibleReasonCopy("declares_variables")).toBe(
      "Needs extra details that are not set for this agent",
    );
    expect(ineligibleReasonCopy("other")).toBe(
      "Cannot score traces for this agent",
    );
  });

  it("explains skip and failure reasons without averaging", () => {
    expect(scoringRunErrorCopy("no_usable_evaluators")).toBe(
      "No evaluators could score this trace",
    );
    expect(scoringRunErrorCopy("trace_deleted")).toMatch(/deleted/);
    expect(scoringRunErrorCopy("agent_deleted")).toMatch(/agent was deleted/);
    expect(scoringRunErrorCopy("unsupported_interaction_type")).toMatch(
      /cannot be scored yet/,
    );
    expect(scoringRunErrorCopy("corrupt_snapshot")).toMatch(
      /could not be completed/,
    );
    expect(scoringRunErrorCopy("")).toBe("Scoring did not finish");
    expect(scoringRunErrorCopy(null)).toBe("Scoring did not finish");
    expect(scoringRunErrorCopy("unknown-code")).toBe("Scoring did not finish");
  });

  it("labels statuses and pass counts without mixing evaluator types", () => {
    expect(scoringStatusLabel("pending")).toBe("Waiting");
    expect(scoringStatusLabel("processing")).toBe("Scoring");
    expect(scoringResultCounts(2, 4)).toEqual({ passed: 2, failed: 2 });
    expect(scoringResultCounts(2, 2)).toEqual({ passed: 2, failed: 0 });
    expect(scoringResultCounts(0, 3)).toEqual({ passed: 0, failed: 3 });
    expect(scoringResultCounts(0, 0)).toBeNull();
    expect(scoringResultCounts(null, 4)).toBeNull();
    expect(scoringResultCounts(2, undefined)).toBeNull();
    expect(scoringResultCounts(-1, 3)).toEqual({ passed: 0, failed: 3 });
    expect(scoringResultCounts(5, 3)).toEqual({ passed: 5, failed: 0 });
  });
});

describe("parseAutoScoreEnableError", () => {
  it("reads the 422 partition when enabling is refused", () => {
    const err = new Error(
      `Request failed: 422 - ${JSON.stringify({
        detail: {
          error: "There are no eligible evaluators configured for this agent",
          ineligible: [
            {
              evaluator_uuid: "ev-1",
              name: "Correctness",
              reason: "declares_variables",
            },
          ],
        },
      })}`,
    );
    expect(parseAutoScoreEnableError(err)).toEqual({
      message: "There are no evaluators that can score this agent's traces",
      ineligible: [
        {
          evaluator_uuid: "ev-1",
          name: "Correctness",
          reason: "declares_variables",
        },
      ],
    });
  });

  it("returns null for other failures", () => {
    expect(parseAutoScoreEnableError("not-an-error")).toBeNull();
    expect(parseAutoScoreEnableError(new Error("network"))).toBeNull();
    expect(
      parseAutoScoreEnableError(
        new Error("Request failed: 422 - {not-json"),
      ),
    ).toBeNull();
    expect(
      parseAutoScoreEnableError(
        new Error(`Request failed: 422 - ${JSON.stringify({ detail: "nope" })}`),
      ),
    ).toBeNull();
    expect(
      parseAutoScoreEnableError(
        new Error(
          `Request failed: 422 - ${JSON.stringify({
            detail: [{ loc: ["body"], msg: "Field required", type: "missing" }],
          })}`,
        ),
      ),
    ).toBeNull();
    expect(
      parseAutoScoreEnableError(
        new Error(
          `Request failed: 422 - ${JSON.stringify({
            detail: { error: "There are no eligible evaluators configured for this agent" },
          })}`,
        ),
      ),
    ).toBeNull();
    expect(
      parseAutoScoreEnableError(
        new Error(
          `Request failed: 422 - ${JSON.stringify({
            detail: { ineligible: [null, { name: 1 }, { name: "X", reason: "declares_variables" }] },
          })}`,
        ),
      ),
    ).toEqual({
      message: "There are no evaluators that can score this agent's traces",
      ineligible: [{ evaluator_uuid: "", name: "X", reason: "declares_variables" }],
    });
  });
});
