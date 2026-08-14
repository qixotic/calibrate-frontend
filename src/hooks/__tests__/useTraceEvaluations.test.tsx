import { renderHook, act, waitFor } from "@testing-library/react";
import { useTraceEvaluations } from "@/hooks/useTraceEvaluations";
import { fetchTraceEvaluations } from "@/lib/traceEvalApi";
import { reportError } from "@/lib/reportError";

jest.mock("../../lib/traceEvalApi", () => ({
  __esModule: true,
  fetchTraceEvaluations: jest.fn(),
}));
jest.mock("../../lib/reportError", () => ({
  __esModule: true,
  reportError: jest.fn(),
}));

const mockFetch = fetchTraceEvaluations as jest.Mock;
const mockReportError = reportError as jest.Mock;

const RESULT = {
  run_uuid: "run-1",
  evaluator_uuid: "ev-1",
  evaluator_name: "Answered the caller's question",
  output_type: "binary" as const,
  passed: true,
  score: null,
  scale_min: null,
  scale_max: null,
  reasoning: "Gave the schedule.",
  created_at: "2026-07-20T10:00:00Z",
};

beforeEach(() => {
  mockFetch.mockReset();
  mockReportError.mockReset();
});

describe("useTraceEvaluations", () => {
  it("loads the verdicts for the open trace", async () => {
    mockFetch.mockResolvedValue({ trace_uuid: "t1", results: [RESULT] });

    const { result } = renderHook(() =>
      useTraceEvaluations({
        accessToken: "tok",
        traceUuid: "t1",
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetch).toHaveBeenCalledWith("tok", "t1");
    expect(result.current.results).toEqual([RESULT]);
    expect(result.current.error).toBeNull();
  });

  it("stays idle while the dialog is closed", () => {
    renderHook(() =>
      useTraceEvaluations({
        accessToken: "tok",
        traceUuid: "t1",
        enabled: false,
      }),
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("stays idle without a trace or a token", () => {
    renderHook(() =>
      useTraceEvaluations({
        accessToken: null,
        traceUuid: "t1",
        enabled: true,
      }),
    );
    renderHook(() =>
      useTraceEvaluations({
        accessToken: "tok",
        traceUuid: null,
        enabled: true,
      }),
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("treats a response with no results list as empty", async () => {
    mockFetch.mockResolvedValue({ trace_uuid: "t1" });

    const { result } = renderHook(() =>
      useTraceEvaluations({
        accessToken: "tok",
        traceUuid: "t1",
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.results).toEqual([]));
  });

  it("reports a failure and shows a message the reader can act on", async () => {
    mockFetch.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() =>
      useTraceEvaluations({
        accessToken: "tok",
        traceUuid: "t1",
        enabled: true,
      }),
    );

    await waitFor(() =>
      expect(result.current.error).toBe(
        "Failed to load these results. Please try again.",
      ),
    );
    expect(result.current.results).toBeNull();
    expect(mockReportError).toHaveBeenCalled();
  });

  it("re-reads the verdicts when asked again", async () => {
    mockFetch.mockResolvedValue({ trace_uuid: "t1", results: [] });

    const { result } = renderHook(() =>
      useTraceEvaluations({
        accessToken: "tok",
        traceUuid: "t1",
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.refetch());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it("clears what it holds when the trace is closed", async () => {
    mockFetch.mockResolvedValue({ trace_uuid: "t1", results: [RESULT] });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useTraceEvaluations({
          accessToken: "tok",
          traceUuid: "t1",
          enabled,
        }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.results).toEqual([RESULT]));
    rerender({ enabled: false });
    expect(result.current.results).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
