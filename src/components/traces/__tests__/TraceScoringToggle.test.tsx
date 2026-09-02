import { act, render, screen, waitFor, setupUser } from "@/test-utils";
import { TraceScoringToggle } from "../TraceScoringToggle";
import {
  fetchTraceScoringEligibility,
  setAgentAutoScoreTraces,
} from "@/lib/tracesApi";
import { fetchEvaluatorDetail } from "@/lib/evaluatorApi";

jest.mock("../../../lib/tracesApi", () => ({
  __esModule: true,
  fetchTraceScoringEligibility: jest.fn(),
  setAgentAutoScoreTraces: jest.fn(),
}));
jest.mock("../../../lib/reportError", () => ({
  __esModule: true,
  reportError: jest.fn(),
}));
jest.mock("../../../hooks", () => ({
  ...jest.requireActual("../../../hooks"),
  useAccessToken: () => "tok",
}));
jest.mock("../../../lib/evaluatorApi", () => ({
  ...jest.requireActual("../../../lib/evaluatorApi"),
  fetchEvaluatorDetail: jest.fn(),
}));

const mockEligibility = fetchTraceScoringEligibility as jest.Mock;
const mockSetFlag = setAgentAutoScoreTraces as jest.Mock;
const mockFetchEvaluator = fetchEvaluatorDetail as jest.Mock;

beforeEach(() => {
  mockEligibility.mockReset();
  mockSetFlag.mockReset();
  mockFetchEvaluator.mockReset();
  mockFetchEvaluator.mockResolvedValue({
    uuid: "ev-1",
    name: "Correctness",
    description: "",
    output_type: "binary" as const,
    evaluator_type: "llm",
    live_version_index: 0,
    versions: [
      {
        uuid: "v1",
        version_number: 1,
        judge_model: "google/gemini-2.5-flash",
        system_prompt: "Judge whether the reply is correct.",
        output_config: null,
        variables: null,
      },
    ],
  });
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
      {
        evaluator_uuid: "",
        name: "Tone",
        reason: "no_live_version",
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
    screen.getByText(/Past traces are not scored/),
  ).toBeInTheDocument();

  await waitFor(() =>
    expect(
      screen.getByText(/Scoring cannot be turned on/),
    ).toBeInTheDocument(),
  );
  expect(
    screen.getByRole("button", { name: "Correctness" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tone" })).not.toBeInTheDocument();
  expect(screen.getByText("Tone")).toBeInTheDocument();
  expect(
    screen.getByText("Needs extra details that are not set for this agent"),
  ).toBeInTheDocument();
  expect(screen.getByText("Has no current version to run")).toBeInTheDocument();
  // The ineligible list is a warning, not an error: it sits in the amber
  // banner the human-alignment pages use for setup gaps.
  const banner = screen
    .getByText(/Scoring cannot be turned on/)
    .closest(".rounded-lg");
  expect(banner).toHaveClass("border-amber-500/30", "bg-amber-500/10");
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
    expect(
      screen.getByRole("heading", { level: 4, name: "Evaluators used" }),
    ).toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "Tone" })).toBeInTheDocument();
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
      screen.getByRole("heading", { level: 4, name: "Evaluators used" }),
    ).toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "Tone" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Helpfulness" }),
  ).toBeInTheDocument();
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

it("places the switch before the heading, matching Settings, and describes blocked state in the page", async () => {
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
    heading.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_PRECEDING,
  ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
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

it("opens how an eligible evaluator judges from its pill", async () => {
  mockEligibility.mockResolvedValue({
    eligible: [
      {
        evaluator_uuid: "ev-1",
        evaluator_version_id: "ver-1",
        name: "Correctness",
      },
    ],
    ineligible: [],
  });
  const user = setupUser();
  render(
    <TraceScoringToggle
      agentUuid="ag-1"
      accessToken="tok"
      enabled={false}
    />,
  );

  await user.click(
    await screen.findByRole("button", { name: "Correctness" }),
  );
  expect(
    await screen.findByText("Judge whether the reply is correct."),
  ).toBeInTheDocument();
  expect(mockFetchEvaluator).toHaveBeenCalledWith("ev-1", "tok");
});
