import { act, render, screen, waitFor, setupUser } from "@/test-utils";
import { TraceScoringToggle } from "../TraceScoringToggle";
import {
  fetchTraceScoringEligibility,
  setAgentAutoScoreTraces,
} from "@/lib/tracesApi";

jest.mock("../../../lib/tracesApi", () => ({
  __esModule: true,
  fetchTraceScoringEligibility: jest.fn(),
  setAgentAutoScoreTraces: jest.fn(),
}));
jest.mock("../../../lib/reportError", () => ({
  __esModule: true,
  reportError: jest.fn(),
}));

const mockEligibility = fetchTraceScoringEligibility as jest.Mock;
const mockSetFlag = setAgentAutoScoreTraces as jest.Mock;

beforeEach(() => {
  mockEligibility.mockReset();
  mockSetFlag.mockReset();
});

it("shows what automatic scoring does and lists why enable is blocked", async () => {
  mockEligibility.mockResolvedValue({
    eligible: [],
    ineligible: [
      {
        evaluator_uuid: "ev-1",
        name: "Correctness",
        reason: "declares_variables",
      },
    ],
  });

  render(
    <TraceScoringToggle
      agentUuid="ag-1"
      accessToken="tok"
      enabled={false}
    />,
  );

  expect(
    screen.getByText("Score new traces automatically"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Traces already received are not scored/),
  ).toBeInTheDocument();

  await waitFor(() =>
    expect(
      screen.getByText(/Scoring cannot be turned on/),
    ).toBeInTheDocument(),
  );
  expect(
    screen.getByText(/Correctness: Needs extra details that are not set/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("switch", { name: "Score new traces automatically" }),
  ).toBeDisabled();
});

it("lets an already-on agent be turned off even when nothing is eligible", async () => {
  mockEligibility.mockResolvedValue({
    eligible: [],
    ineligible: [
      {
        evaluator_uuid: "ev-1",
        name: "Correctness",
        reason: "no_live_version",
      },
    ],
  });
  mockSetFlag.mockResolvedValue({ auto_score_traces: false });
  const onEnabledChange = jest.fn();
  const user = setupUser();

  render(
    <TraceScoringToggle
      agentUuid="ag-1"
      accessToken="tok"
      enabled
      onEnabledChange={onEnabledChange}
    />,
  );

  const toggle = await screen.findByRole("switch", {
    name: "Score new traces automatically",
  });
  expect(toggle).toBeEnabled();
  await waitFor(() =>
    expect(screen.getByText(/You can still turn scoring off/)).toBeInTheDocument(),
  );

  await user.click(toggle);
  await waitFor(() =>
    expect(mockSetFlag).toHaveBeenCalledWith("tok", "ag-1", false),
  );
  expect(onEnabledChange).toHaveBeenCalledWith(false);
});

it("enables scoring when an eligible evaluator is linked", async () => {
  mockEligibility.mockResolvedValue({
    eligible: [
      {
        evaluator_uuid: "ev-1",
        evaluator_version_id: "ver-1",
        name: "Tone",
      },
    ],
    ineligible: [],
  });
  mockSetFlag.mockResolvedValue({ auto_score_traces: true });
  const user = setupUser();

  render(
    <TraceScoringToggle
      agentUuid="ag-1"
      accessToken="tok"
      enabled={false}
    />,
  );

  await waitFor(() =>
    expect(screen.getByText(/Tone will score new traces/)).toBeInTheDocument(),
  );
  await user.click(
    screen.getByRole("switch", { name: "Score new traces automatically" }),
  );
  await waitFor(() =>
    expect(mockSetFlag).toHaveBeenCalledWith("tok", "ag-1", true),
  );
});

it("names every eligible evaluator when more than one can score", async () => {
  mockEligibility.mockResolvedValue({
    eligible: [
      {
        evaluator_uuid: "ev-1",
        evaluator_version_id: "ver-1",
        name: "Tone",
      },
      {
        evaluator_uuid: "ev-2",
        evaluator_version_id: "ver-2",
        name: "Helpfulness",
      },
    ],
    ineligible: [],
  });
  render(
    <TraceScoringToggle
      agentUuid="ag-1"
      accessToken="tok"
      enabled={false}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByText("Tone, Helpfulness will score new traces."),
    ).toBeInTheDocument(),
  );
});

it("explains when eligibility cannot be checked", async () => {
  mockEligibility.mockRejectedValue(new Error("offline"));
  render(
    <TraceScoringToggle
      agentUuid="ag-1"
      accessToken="tok"
      enabled={false}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByText(/Could not check which evaluators/),
    ).toBeInTheDocument(),
  );
  expect(
    screen.getByRole("switch", { name: "Score new traces automatically" }),
  ).toBeDisabled();
  expect(
    screen.queryByText(/Scoring cannot be turned on/),
  ).not.toBeInTheDocument();
});

it("does not claim there are no eligible evaluators while the check is still running", async () => {
  let resolveEligibility: (value: unknown) => void = () => {};
  mockEligibility.mockReturnValue(
    new Promise((resolve) => {
      resolveEligibility = resolve;
    }),
  );
  render(
    <TraceScoringToggle
      agentUuid="ag-1"
      accessToken="tok"
      enabled={false}
    />,
  );

  expect(
    screen.getByText("Checking which evaluators can score new traces."),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Scoring cannot be turned on/),
  ).not.toBeInTheDocument();
  const toggle = screen.getByRole("switch", {
    name: "Score new traces automatically",
  });
  expect(toggle).toBeDisabled();
  expect(toggle.getAttribute("aria-describedby")?.split(" ").length).toBe(2);

  await act(async () => {
    resolveEligibility({
      eligible: [],
      ineligible: [
        {
          evaluator_uuid: "ev-1",
          name: "Correctness",
          reason: "declares_variables",
        },
      ],
    });
  });
  await waitFor(() =>
    expect(screen.getByText(/Scoring cannot be turned on/)).toBeInTheDocument(),
  );
});

it("keeps the heading before the switch and describes blocked state in the page", async () => {
  mockEligibility.mockResolvedValue({
    eligible: [],
    ineligible: [
      {
        evaluator_uuid: "ev-1",
        name: "Correctness",
        reason: "declares_variables",
      },
    ],
  });
  render(
    <TraceScoringToggle
      agentUuid="ag-1"
      accessToken="tok"
      enabled={false}
    />,
  );
  const heading = await screen.findByText("Score new traces automatically");
  const toggle = screen.getByRole("switch", {
    name: "Score new traces automatically",
  });
  expect(
    heading.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  await waitFor(() =>
    expect(screen.getByText(/Scoring cannot be turned on/)).toBeInTheDocument(),
  );
  const describedBy = toggle.getAttribute("aria-describedby") ?? "";
  const statusNode = describedBy
    .split(" ")
    .map((id) => document.getElementById(id))
    .find((node) => node?.textContent?.includes("Scoring cannot be turned on"));
  expect(statusNode).toBeTruthy();
});
