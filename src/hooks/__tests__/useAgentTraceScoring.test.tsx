import { act, renderHook, waitFor } from "@testing-library/react";
import { useAgentTraceScoring } from "../useAgentTraceScoring";
import {
  fetchTraceScoringEligibility,
  setAgentAutoScoreTraces,
} from "@/lib/tracesApi";
import { reportError } from "@/lib/reportError";

jest.mock("../../lib/tracesApi", () => ({
  __esModule: true,
  fetchTraceScoringEligibility: jest.fn(),
  setAgentAutoScoreTraces: jest.fn(),
}));
jest.mock("../../lib/reportError", () => ({
  __esModule: true,
  reportError: jest.fn(),
}));

const mockEligibility = fetchTraceScoringEligibility as jest.Mock;
const mockSetFlag = setAgentAutoScoreTraces as jest.Mock;
const mockReportError = reportError as jest.Mock;

const eligible = {
  eligible: [
    {
      evaluator_uuid: "ev-1",
      evaluator_version_id: "ver-1",
      name: "Tone",
    },
  ],
  ineligible: [],
};

const blocked = {
  eligible: [],
  ineligible: [
    {
      evaluator_uuid: "ev-2",
      name: "Correctness",
      reason: "declares_variables" as const,
    },
  ],
};

function setup(enabled = false) {
  return renderHook(
    (props: { enabled: boolean }) =>
      useAgentTraceScoring({
        accessToken: "tok",
        agentUuid: "ag-1",
        enabled: props.enabled,
      }),
    { initialProps: { enabled } },
  );
}

beforeEach(() => {
  mockEligibility.mockReset();
  mockSetFlag.mockReset();
  mockReportError.mockReset();
  mockEligibility.mockResolvedValue(eligible);
  mockSetFlag.mockResolvedValue({ auto_score_traces: true });
});

it("loads eligibility and allows enabling when at least one evaluator can score", async () => {
  const { result } = setup(false);
  await waitFor(() => expect(result.current.isLoadingEligibility).toBe(false));
  expect(result.current.canEnable).toBe(true);
  expect(result.current.enableBlocked).toBe(false);

  await act(async () => {
    await result.current.setEnabled(true);
  });
  expect(mockSetFlag).toHaveBeenCalledWith("tok", "ag-1", true);
  expect(result.current.isEnabled).toBe(true);
});

it("hard-blocks enabling when no evaluator is eligible", async () => {
  mockEligibility.mockResolvedValue(blocked);
  const { result } = setup(false);
  await waitFor(() => expect(result.current.enableBlocked).toBe(true));

  await act(async () => {
    await result.current.setEnabled(true);
  });
  expect(mockSetFlag).not.toHaveBeenCalled();
  expect(result.current.isEnabled).toBe(false);
});

it("still allows turning scoring off after eligibility drifts", async () => {
  mockEligibility.mockResolvedValue(blocked);
  mockSetFlag.mockResolvedValue({ auto_score_traces: false });
  const { result } = setup(true);
  await waitFor(() => expect(result.current.isEnabled).toBe(true));
  expect(result.current.enableBlocked).toBe(false);

  await act(async () => {
    await result.current.setEnabled(false);
  });
  expect(mockSetFlag).toHaveBeenCalledWith("tok", "ag-1", false);
  expect(result.current.isEnabled).toBe(false);
});

it("surfaces a generic error when enabling fails for another reason", async () => {
  mockSetFlag.mockRejectedValue(
    new Error("Request failed: 500 - {\"detail\":\"boom\"}"),
  );
  const { result } = setup(false);
  await waitFor(() => expect(result.current.canEnable).toBe(true));

  await act(async () => {
    await result.current.setEnabled(true);
  });
  expect(result.current.saveError).toBe(
    "Something went wrong on our end. Please try again in a moment.",
  );
  expect(mockReportError).toHaveBeenCalled();
});

it("records when eligibility cannot be loaded", async () => {
  mockEligibility.mockRejectedValue(new Error("offline"));
  const { result } = setup(false);
  await waitFor(() =>
    expect(result.current.eligibilityError).toMatch(/Could not check/),
  );
  expect(result.current.canEnable).toBe(false);
  expect(mockReportError).toHaveBeenCalled();
});

it("surfaces a 422 with ineligible reasons when enabling is refused", async () => {
  mockSetFlag.mockRejectedValue(
    new Error(
      `Request failed: 422 - ${JSON.stringify({
        detail: {
          error: "There are no eligible evaluators configured for this agent",
          ineligible: [
            { name: "Correctness", reason: "declares_variables" },
          ],
        },
      })}`,
    ),
  );
  const { result } = setup(false);
  await waitFor(() => expect(result.current.canEnable).toBe(true));

  await act(async () => {
    await result.current.setEnabled(true);
  });
  expect(result.current.saveError).toMatch(/no evaluators/);
  expect(result.current.eligibility?.ineligible[0].name).toBe("Correctness");
  expect(mockReportError).toHaveBeenCalled();
});

it("does not PUT when scoring is already in the requested state", async () => {
  const { result } = setup(true);
  await waitFor(() => expect(result.current.isEnabled).toBe(true));
  await act(async () => {
    await result.current.setEnabled(true);
  });
  expect(mockSetFlag).not.toHaveBeenCalled();
});

it("reloads eligibility on demand", async () => {
  const { result } = setup(false);
  await waitFor(() => expect(result.current.canEnable).toBe(true));
  mockEligibility.mockResolvedValue(blocked);
  await act(async () => {
    await result.current.reloadEligibility();
  });
  await waitFor(() => expect(result.current.enableBlocked).toBe(true));
});

it("notifies the parent after a successful toggle", async () => {
  const onEnabledChange = jest.fn();
  const { result } = renderHook(() =>
    useAgentTraceScoring({
      accessToken: "tok",
      agentUuid: "ag-1",
      enabled: false,
      onEnabledChange,
    }),
  );
  await waitFor(() => expect(result.current.canEnable).toBe(true));
  await act(async () => {
    await result.current.setEnabled(true);
  });
  expect(onEnabledChange).toHaveBeenCalledWith(true);
});

it("does nothing without an access token", async () => {
  const { result } = renderHook(() =>
    useAgentTraceScoring({
      accessToken: null,
      agentUuid: "ag-1",
      enabled: false,
    }),
  );
  await act(async () => {
    await result.current.setEnabled(true);
    await result.current.reloadEligibility();
  });
  expect(mockEligibility).not.toHaveBeenCalled();
  expect(mockSetFlag).not.toHaveBeenCalled();
});
