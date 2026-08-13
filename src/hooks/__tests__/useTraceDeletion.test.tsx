import { renderHook, act } from "@testing-library/react";
import { useTraceDeletion } from "@/hooks/useTraceDeletion";
import type { TraceSummary } from "@/lib/tracesApi";

jest.mock("../../lib/reportError", () => ({
  __esModule: true,
  reportError: jest.fn(),
}));

const AGENT = "agent-1";

function trace(uuid: string): TraceSummary {
  return {
    uuid,
    agent_id: AGENT,
    message_id: `msg-${uuid}`,
    conversation_id: "conv-1",
    input_preview: null,
    response_preview: null,
    turn_count: 1,
    tool_call_count: 0,
    tool_call_names: [],
    metadata_count: 0,
    created_at: "2026-07-20T00:00:00Z",
  };
}

const traces = [trace("t1"), trace("t2")];
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:8000";
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

it("bulk-deletes selected traces via POST /traces/bulk-delete with trace_ids", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ deleted: 2 }),
  }) as unknown as typeof fetch;
  const onDeleted = jest.fn();

  const { result } = renderHook(() =>
    useTraceDeletion({ traces, onDeleted, accessToken: "tok", agentUuid: AGENT }),
  );

  act(() => result.current.toggleSelectAll());
  act(() => result.current.openBulkDeleteDialog());
  await act(async () => {
    await result.current.deleteItems();
  });

  expect(global.fetch).toHaveBeenCalledWith(
    "http://localhost:8000/traces/bulk-delete",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ trace_ids: ["t1", "t2"], agent_id: AGENT }),
    }),
  );
  expect(onDeleted).toHaveBeenCalledWith(["t1", "t2"]);
});

it("single-deletes one trace through the same batched endpoint", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ deleted: 1 }),
  }) as unknown as typeof fetch;
  const onDeleted = jest.fn();

  const { result } = renderHook(() =>
    useTraceDeletion({ traces, onDeleted, accessToken: "tok", agentUuid: AGENT }),
  );

  act(() => result.current.openDeleteDialog(traces[0]));
  await act(async () => {
    await result.current.deleteItems();
  });

  expect(global.fetch).toHaveBeenCalledWith(
    "http://localhost:8000/traces/bulk-delete",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ trace_ids: ["t1"], agent_id: AGENT }),
    }),
  );
  expect(onDeleted).toHaveBeenCalledWith(["t1"]);
});

it("bounds the delete to the agent so a stale foreign id cannot widen it", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ deleted: 1 }),
  }) as unknown as typeof fetch;

  const { result } = renderHook(() =>
    useTraceDeletion({
      traces,
      onDeleted: jest.fn(),
      accessToken: "tok",
      agentUuid: "agent-scoped",
    }),
  );

  act(() => result.current.openDeleteDialog(traces[0]));
  await act(async () => {
    await result.current.deleteItems();
  });

  const body = JSON.parse(
    (global.fetch as jest.Mock).mock.calls[0][1].body as string,
  );
  expect(body.agent_id).toBe("agent-scoped");
});
