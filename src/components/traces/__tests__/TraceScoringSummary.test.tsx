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

it("shows Success and Fail count pills, never an average or combined pass string", () => {
  const { rerender } = render(
    <TraceScoringSummary
      trace={{
        latest_run_status: "completed",
        n_passed: 1,
        n_total: 3,
      }}
    />,
  );
  expect(screen.getByText("1 Success")).toBeInTheDocument();
  expect(screen.getByText("2 Fail")).toBeInTheDocument();
  expect(screen.queryByText(/passed/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/average/i)).not.toBeInTheDocument();

  rerender(
    <TraceScoringSummary
      trace={{
        latest_run_status: "completed",
        n_passed: 2,
        n_total: 2,
      }}
    />,
  );
  expect(screen.getByText("2 Success")).toBeInTheDocument();
  expect(screen.queryByText(/Fail/)).not.toBeInTheDocument();

  rerender(
    <TraceScoringSummary
      trace={{
        latest_run_status: "completed",
        n_passed: 0,
        n_total: 3,
      }}
    />,
  );
  expect(screen.getByText("3 Fail")).toBeInTheDocument();
  expect(screen.queryByText(/Success/)).not.toBeInTheDocument();
});

it("shows a dash when a completed run has no result counts", () => {
  render(<TraceScoringSummary trace={{ latest_run_status: "completed" }} />);
  expect(screen.getByText("—")).toBeInTheDocument();
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
