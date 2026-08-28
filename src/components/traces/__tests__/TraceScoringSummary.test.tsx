import { render, screen } from "@/test-utils";
import { TraceScoringSummary } from "../TraceScoringSummary";

it("shows a dash when this trace has never been scored", () => {
  render(<TraceScoringSummary trace={{}} />);
  expect(screen.getByText("—")).toBeInTheDocument();
});

it("shows waiting and scoring without inventing a combined score", () => {
  const { rerender } = render(
    <TraceScoringSummary trace={{ latest_run_status: "pending" }} />,
  );
  expect(screen.getByText("Waiting")).toBeInTheDocument();

  rerender(
    <TraceScoringSummary trace={{ latest_run_status: "processing" }} />,
  );
  expect(screen.getByText("Scoring")).toBeInTheDocument();
});

it("shows the pass count, never an average", () => {
  const { rerender } = render(
    <TraceScoringSummary
      trace={{
        latest_run_status: "completed",
        passed: false,
        n_passed: 1,
        n_total: 3,
      }}
    />,
  );
  expect(screen.getByText("Did not pass")).toBeInTheDocument();
  expect(screen.getByText("1 of 3 passed")).toBeInTheDocument();
  expect(screen.queryByText(/average/i)).not.toBeInTheDocument();

  rerender(
    <TraceScoringSummary
      trace={{
        latest_run_status: "completed",
        passed: true,
        n_passed: 2,
        n_total: 2,
      }}
    />,
  );
  expect(screen.getByText("Passed")).toBeInTheDocument();
  expect(screen.getByText("2 of 2 passed")).toBeInTheDocument();
});

it("shows failed and skipped as statuses", () => {
  const { rerender } = render(
    <TraceScoringSummary trace={{ latest_run_status: "failed" }} />,
  );
  expect(screen.getByText("Failed")).toBeInTheDocument();
  rerender(
    <TraceScoringSummary trace={{ latest_run_status: "skipped" }} />,
  );
  expect(screen.getByText("Skipped")).toBeInTheDocument();
});
