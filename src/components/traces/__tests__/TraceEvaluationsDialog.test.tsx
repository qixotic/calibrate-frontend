import { render, screen, setupUser, waitFor } from "@/test-utils";
import { TraceEvaluationsDialog } from "../TraceEvaluationsDialog";
import { fetchTraceEvaluations, TraceEvaluationResult } from "@/lib/traceEvalApi";

jest.mock("../../../lib/traceEvalApi", () => ({
  __esModule: true,
  fetchTraceEvaluations: jest.fn(),
  formatVerdict: jest.requireActual("../../../lib/traceEvalApi").formatVerdict,
}));
jest.mock("../../../lib/reportError", () => ({
  __esModule: true,
  reportError: jest.fn(),
}));

const mockFetch = fetchTraceEvaluations as jest.Mock;

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

function renderDialog(
  props: Partial<React.ComponentProps<typeof TraceEvaluationsDialog>> = {},
) {
  const onClose = jest.fn();
  render(
    <TraceEvaluationsDialog
      isOpen
      onClose={onClose}
      accessToken="tok"
      traceUuid="t1"
      messageId="msg-1"
      {...props}
    />,
  );
  return { onClose };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("TraceEvaluationsDialog", () => {
  it("renders nothing while closed and never reads anything", () => {
    renderDialog({ isOpen: false });

    expect(
      screen.queryByText("What the evaluators found"),
    ).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows a loading state before the verdicts arrive", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderDialog();

    expect(screen.getByText("What the evaluators found")).toBeInTheDocument();
    expect(screen.getByText("msg-1")).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("lists one row per evaluator with its verdict and its reason", async () => {
    mockFetch.mockResolvedValue({
      trace_uuid: "t1",
      results: [
        result(),
        result({
          run_uuid: "run-1",
          evaluator_uuid: "ev-2",
          evaluator_name: "Stayed on the approved advice",
          passed: false,
          reasoning: "The agent suggested a dose that is not in the guidance.",
        }),
      ],
    });

    renderDialog();

    await screen.findByText("Answered the caller's question");
    expect(screen.getByText("Stayed on the approved advice")).toBeInTheDocument();
    expect(screen.getByText("Pass")).toBeInTheDocument();
    expect(screen.getByText("Fail")).toBeInTheDocument();
    expect(
      screen.getByText("The agent gave the schedule the caller asked for."),
    ).toBeInTheDocument();
  });

  it("shows a rating against its scale instead of a pass or fail", async () => {
    mockFetch.mockResolvedValue({
      trace_uuid: "t1",
      results: [
        result({
          output_type: "rating",
          passed: null,
          score: 4,
          scale_min: 1,
          scale_max: 5,
        }),
      ],
    });

    renderDialog();

    expect(await screen.findByText("4 out of 5")).toBeInTheDocument();
    expect(screen.queryByText("Pass")).not.toBeInTheDocument();
  });

  it("says there is no score when a binary evaluator recorded none", async () => {
    mockFetch.mockResolvedValue({
      trace_uuid: "t1",
      results: [result({ passed: null })],
    });

    renderDialog();

    expect(await screen.findByText("No score")).toBeInTheDocument();
  });

  it("says so when an evaluator gave no reason", async () => {
    mockFetch.mockResolvedValue({
      trace_uuid: "t1",
      results: [result({ reasoning: null })],
    });

    renderDialog();

    expect(
      await screen.findByText("This evaluator gave no reason."),
    ).toBeInTheDocument();
  });

  it("collapses a long reason and expands it on request", async () => {
    const user = setupUser();
    const long = `${"The agent repeated the advice at length. ".repeat(12)}End.`;
    mockFetch.mockResolvedValue({
      trace_uuid: "t1",
      results: [result({ reasoning: long })],
    });

    renderDialog();

    const toggle = await screen.findByRole("button", { name: "Show more" });
    expect(screen.queryByText(long)).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText(long)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText(long)).not.toBeInTheDocument();
  });

  it("keeps a short reason whole, with no expand control", async () => {
    mockFetch.mockResolvedValue({ trace_uuid: "t1", results: [result()] });

    renderDialog();

    await screen.findByText("The agent gave the schedule the caller asked for.");
    expect(
      screen.queryByRole("button", { name: "Show more" }),
    ).not.toBeInTheDocument();
  });

  it("tells the reader what to do when nothing has scored the trace", async () => {
    mockFetch.mockResolvedValue({ trace_uuid: "t1", results: [] });

    renderDialog();

    expect(
      await screen.findByText(/No evaluator has scored this trace yet/),
    ).toBeInTheDocument();
  });

  it("shows a message the reader can act on when the read fails", async () => {
    mockFetch.mockRejectedValue(new Error("boom"));

    renderDialog();

    expect(
      await screen.findByText("Failed to load these results. Please try again."),
    ).toBeInTheDocument();
  });

  it("closes on the close control", async () => {
    const user = setupUser();
    mockFetch.mockResolvedValue({ trace_uuid: "t1", results: [] });

    const { onClose } = renderDialog();

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("omits the message line when there is none to show", async () => {
    mockFetch.mockResolvedValue({ trace_uuid: "t1", results: [] });

    renderDialog({ messageId: null });

    await screen.findByText(/No evaluator has scored this trace yet/);
    expect(screen.queryByText("msg-1")).not.toBeInTheDocument();
  });
});
