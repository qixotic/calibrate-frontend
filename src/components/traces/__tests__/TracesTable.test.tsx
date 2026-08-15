import { render, screen, setupUser } from "@/test-utils";
import {
  TracesTable,
  evalSummaryState,
  formatTraceDate,
} from "../TracesTable";
import type { TraceSummary } from "@/lib/tracesApi";

function trace(overrides: Partial<TraceSummary> = {}): TraceSummary {
  return {
    uuid: "t1",
    agent_id: "a1",
    message_id: "msg-1",
    conversation_id: "conv-1",
    input_preview: "When is the next vaccination?",
    response_preview: "At 14 weeks.",
    turn_count: 3,
    tool_call_count: 1,
    tool_call_names: ["get_schedule"],
    metadata_count: 2,
    eval_summary: null,
    created_at: "2026-07-20T10:00:00Z",
    ...overrides,
  };
}


function renderTable(props: Partial<React.ComponentProps<typeof TracesTable>> = {}) {
  const onOpen = jest.fn();
  const onOpenEvaluations = jest.fn();
  const onDelete = jest.fn();
  const onFilterConversation = jest.fn();
  const onToggleSelectAll = jest.fn();
  const checkboxProps = jest.fn(() => ({
    checked: false,
    onToggle: jest.fn(),
    disabled: false,
    label: "Select trace",
  }));
  render(
    <TracesTable
      traces={[trace()]}
      checkboxProps={checkboxProps}
      allSelected={false}
      hasSelectableItems
      onToggleSelectAll={onToggleSelectAll}
      onOpen={onOpen}
      onOpenEvaluations={onOpenEvaluations}
      onDelete={onDelete}
      onFilterConversation={onFilterConversation}
      {...props}
    />,
  );
  return {
    onOpen,
    onOpenEvaluations,
    onDelete,
    onFilterConversation,
    onToggleSelectAll,
  };
}

describe("formatTraceDate", () => {
  it("formats an ISO timestamp", () => {
    expect(formatTraceDate("2026-07-20T10:00:00Z")).toMatch(/2026/);
  });
  it("returns the raw value for an unparseable date", () => {
    expect(formatTraceDate("not-a-date")).toBe("not-a-date");
  });
});

describe("TracesTable", () => {
  it("renders message id, previews, and counts (desktop table)", () => {
    renderTable();
    // message_id + previews appear in both desktop and mobile layouts.
    expect(screen.getAllByText("msg-1").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("When is the next vaccination?").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("At 14 weeks.").length).toBeGreaterThan(0);
  });

  it("shows a 'Tool calls only' placeholder when there is no response preview", () => {
    renderTable({
      traces: [trace({ response_preview: null })],
    });
    expect(screen.getAllByText("Tool calls only").length).toBeGreaterThan(0);
  });

  it("opens a trace when its row is clicked", async () => {
    const user = setupUser();
    const { onOpen } = renderTable();
    // The desktop row shows the created date; click it.
    await user.click(screen.getAllByText("msg-1")[0]);
    expect(onOpen).toHaveBeenCalledWith("t1");
  });

  it("filters by conversation without opening the row", async () => {
    const user = setupUser();
    const { onFilterConversation, onOpen } = renderTable();
    await user.click(screen.getAllByText("conv-1")[0]);
    expect(onFilterConversation).toHaveBeenCalledWith("conv-1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("deletes a trace without opening the row", async () => {
    const user = setupUser();
    const { onDelete, onOpen } = renderTable();
    await user.click(screen.getAllByTitle("Delete trace")[0]);
    expect(onDelete).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("toggles select-all from the header", async () => {
    const user = setupUser();
    const { onToggleSelectAll } = renderTable();
    await user.click(screen.getByLabelText("Select all traces"));
    expect(onToggleSelectAll).toHaveBeenCalled();
  });
});

it("names the tools a turn called instead of only counting them", () => {
  renderTable({
    traces: [
      trace({
        tool_call_count: 2,
        tool_call_names: ["get_schedule", "send_reminder"],
      }),
    ],
  });

  // Rendered twice: the desktop table and the mobile card are both in the DOM.
  expect(screen.getAllByText("get_schedule").length).toBeGreaterThan(0);
  expect(screen.getAllByText("send_reminder").length).toBeGreaterThan(0);
});

it("closes the gap with +N when more tools were called than are previewed", () => {
  renderTable({
    traces: [
      trace({ tool_call_count: 9, tool_call_names: ["a", "b", "c", "d", "e"] }),
    ],
  });

  expect(screen.getAllByText("+4").length).toBeGreaterThan(0);
});

it("shows a plain zero when the turn called no tools", () => {
  renderTable({ traces: [trace({ tool_call_count: 0, tool_call_names: [] })] });

  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
});

describe("evalSummaryState", () => {
  it("treats a missing summary as not evaluated", () => {
    expect(evalSummaryState(null)).toBe("not-evaluated");
    expect(evalSummaryState(undefined)).toBe("not-evaluated");
  });

  it("does not read no evaluators as nothing passing", () => {
    expect(evalSummaryState({ passed: 0, total: 0 })).toBe("not-evaluated");
  });

  it("separates all, some, and none passing", () => {
    expect(evalSummaryState({ passed: 3, total: 3 })).toBe("all-passed");
    expect(evalSummaryState({ passed: 2, total: 3 })).toBe("some-passed");
    expect(evalSummaryState({ passed: 0, total: 3 })).toBe("none-passed");
  });
});

describe("the evaluations column", () => {
  it("marks a trace nothing has scored yet, without showing a count", () => {
    renderTable({ traces: [trace({ eval_summary: null })] });

    // Desktop table and mobile card both render it.
    expect(screen.getAllByText("Not evaluated yet").length).toBe(2);
    expect(screen.queryByText(/passed/)).not.toBeInTheDocument();
  });

  it("keeps a trace nothing passed distinct from one nothing scored", () => {
    renderTable({ traces: [trace({ eval_summary: { passed: 0, total: 3 } })] });

    expect(screen.getAllByText("0 of 3 passed").length).toBe(2);
    expect(screen.queryByText("Not evaluated yet")).not.toBeInTheDocument();
  });

  it("counts how many evaluators passed a trace", () => {
    renderTable({ traces: [trace({ eval_summary: { passed: 3, total: 3 } })] });

    expect(screen.getAllByText("3 of 3 passed").length).toBe(2);
  });

  it("counts a partly passing trace", () => {
    renderTable({ traces: [trace({ eval_summary: { passed: 2, total: 3 } })] });

    expect(screen.getAllByText("2 of 3 passed").length).toBe(2);
  });

  it("does not offer to open results for a trace nothing has scored", () => {
    renderTable({ traces: [trace({ eval_summary: null })] });

    expect(
      screen.queryByTitle("See what the evaluators found"),
    ).not.toBeInTheDocument();
  });

  it("asks to open the evaluator results without opening the trace itself", async () => {
    const user = setupUser();
    const row = trace({ eval_summary: { passed: 2, total: 3 } });
    const { onOpen, onOpenEvaluations } = renderTable({ traces: [row] });

    await user.click(screen.getAllByTitle("See what the evaluators found")[0]);

    expect(onOpenEvaluations).toHaveBeenCalledWith(row);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not offer the results for a trace nothing has scored", () => {
    const { onOpenEvaluations } = renderTable({
      traces: [trace({ eval_summary: null })],
    });

    expect(
      screen.queryByTitle("See what the evaluators found"),
    ).not.toBeInTheDocument();
    expect(onOpenEvaluations).not.toHaveBeenCalled();
  });
});
