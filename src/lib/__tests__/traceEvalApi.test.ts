import {
  fetchTraceEvaluations,
  formatVerdict,
  TraceEvaluationResult,
} from "../traceEvalApi";
import { apiGet } from "../api";

jest.mock("../api", () => ({
  __esModule: true,
  apiGet: jest.fn(),
}));

const mockApiGet = apiGet as jest.Mock;

function result(
  overrides: Partial<TraceEvaluationResult> = {},
): TraceEvaluationResult {
  return {
    run_uuid: "run-1",
    evaluator_uuid: "ev-1",
    evaluator_name: "Answered the caller's question",
    output_type: "binary",
    passed: true,
    score: null,
    scale_min: null,
    scale_max: null,
    reasoning: "The agent gave the schedule the caller asked for.",
    created_at: "2026-07-20T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockApiGet.mockReset();
});

describe("fetchTraceEvaluations", () => {
  it("reads the evaluations for one trace", async () => {
    const response = { trace_uuid: "t1", results: [result()] };
    mockApiGet.mockResolvedValue(response);

    const data = await fetchTraceEvaluations("tok", "t1");

    expect(mockApiGet).toHaveBeenCalledWith("/traces/t1/evaluations", "tok");
    expect(data).toBe(response);
  });

  it("passes the trace through to the path it was given", async () => {
    mockApiGet.mockResolvedValue({ trace_uuid: "t2", results: [] });

    await fetchTraceEvaluations("other-token", "t2");

    expect(mockApiGet).toHaveBeenCalledWith(
      "/traces/t2/evaluations",
      "other-token",
    );
  });

  it("surfaces a failed request to the caller", async () => {
    mockApiGet.mockRejectedValue(new Error("boom"));

    await expect(fetchTraceEvaluations("tok", "t1")).rejects.toThrow("boom");
  });
});

describe("formatVerdict", () => {
  it("reads a passing binary evaluator as Pass", () => {
    expect(formatVerdict(result({ passed: true }))).toBe("Pass");
  });

  it("reads a failing binary evaluator as Fail", () => {
    expect(formatVerdict(result({ passed: false }))).toBe("Fail");
  });

  it("says there is no score when a binary evaluator recorded none", () => {
    expect(formatVerdict(result({ passed: null }))).toBe("No score");
  });

  it("shows a rating against its scale", () => {
    expect(
      formatVerdict(
        result({
          output_type: "rating",
          passed: null,
          score: 4,
          scale_min: 1,
          scale_max: 5,
        }),
      ),
    ).toBe("4 out of 5");
  });

  it("shows the bare rating when the scale is unknown", () => {
    expect(
      formatVerdict(
        result({ output_type: "rating", passed: null, score: 3, scale_max: null }),
      ),
    ).toBe("3");
  });

  it("says there is no score when a rating evaluator recorded none", () => {
    expect(
      formatVerdict(result({ output_type: "rating", passed: null, score: null })),
    ).toBe("No score");
  });
});
