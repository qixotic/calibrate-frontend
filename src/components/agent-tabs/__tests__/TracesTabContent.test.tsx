import { render, screen, setupUser, waitFor } from "@/test-utils";
import { TracesTabContent } from "../TracesTabContent";
import { fetchTraces, bulkDeleteMatchingTraces } from "@/lib/tracesApi";

jest.mock("../../../lib/tracesApi", () => ({
  __esModule: true,
  fetchTraces: jest.fn(),
  fetchTrace: jest.fn(),
  bulkDeleteMatchingTraces: jest.fn(),
}));
jest.mock("../../../lib/api", () => ({
  __esModule: true,
  getBackendUrl: jest.fn(() => "https://api.example.com"),
  apiGet: jest.fn().mockResolvedValue({ max_traces: 50000 }),
}));
jest.mock("../../../hooks/useAccessToken", () => ({
  __esModule: true,
  useAccessToken: () => "tok",
  useAuth: () => ({ accessToken: "tok" }),
}));

const mockFetchTraces = fetchTraces as jest.Mock;
const mockBulkDelete = bulkDeleteMatchingTraces as jest.Mock;

const AGENT = "86186be6-d898-404a-b79c-4f6ff5336afb";

const mockReplace = jest.fn();
let searchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: (...args: unknown[]) => mockReplace(...args) }),
  useSearchParams: () => searchParams,
  usePathname: () => `/agents/${AGENT}`,
}));

function summary(uuid: string, overrides = {}) {
  return {
    uuid,
    agent_id: AGENT,
    message_id: `msg-${uuid}`,
    conversation_id: "conv-1",
    input_preview: "When is the next vaccination?",
    response_preview: "At 14 weeks.",
    turn_count: 2,
    tool_call_count: 1,
    tool_call_names: ["get_schedule"],
    metadata_count: 0,
    created_at: "2026-08-14T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockFetchTraces.mockReset();
  mockBulkDelete.mockReset();
  mockReplace.mockReset();
  searchParams = new URLSearchParams();
});

it("reads only this agent's traces", async () => {
  mockFetchTraces.mockResolvedValue({
    items: [summary("t1")],
    total: 1,
    limit: 50,
    offset: 0,
  });

  render(<TracesTabContent agentUuid={AGENT} />);

  await waitFor(() => expect(mockFetchTraces).toHaveBeenCalled());
  expect(mockFetchTraces.mock.calls[0][1].agentUuid).toBe(AGENT);
  expect((await screen.findAllByText("msg-t1")).length).toBeGreaterThan(0);
});

it("shows the ingest snippet with this agent's ID when it has no traces", async () => {
  mockFetchTraces.mockResolvedValue({
    items: [],
    total: 0,
    limit: 50,
    offset: 0,
  });

  render(<TracesTabContent agentUuid={AGENT} />);

  expect(await screen.findByText("No traces yet")).toBeInTheDocument();
  expect(
    screen.getByText(new RegExp(`"agent_id": "${AGENT}"`)),
  ).toBeInTheDocument();
});

it("bounds 'delete all matching' to this agent", async () => {
  searchParams = new URLSearchParams("conversation_id=conv-1");
  mockFetchTraces.mockResolvedValue({
    items: [summary("t1")],
    total: 1,
    limit: 50,
    offset: 0,
  });
  mockBulkDelete.mockResolvedValue({ deleted: 1 });
  const user = setupUser();

  render(<TracesTabContent agentUuid={AGENT} />);

  await user.click(await screen.findByText(/Delete all 1 matching/));
  await user.click(screen.getByRole("button", { name: "Delete all" }));

  await waitFor(() => expect(mockBulkDelete).toHaveBeenCalled());
  expect(mockBulkDelete.mock.calls[0][1]).toMatchObject({
    agentUuid: AGENT,
    conversationId: "conv-1",
  });
});

it("keeps the conversation filter on the agent's own tab URL", async () => {
  mockFetchTraces.mockResolvedValue({
    items: [summary("t1")],
    total: 1,
    limit: 50,
    offset: 0,
  });
  const user = setupUser();

  render(<TracesTabContent agentUuid={AGENT} />);
  await user.click((await screen.findAllByText("conv-1"))[0]);

  const url = mockReplace.mock.calls[0][0] as string;
  expect(url.startsWith(`/agents/${AGENT}?`)).toBe(true);
  const query = new URLSearchParams(url.split("?")[1]);
  expect(query.get("tab")).toBe("traces");
  expect(query.get("conversation_id")).toBe("conv-1");
});

it("pages through a list longer than one page", async () => {
  // Only `total` drives the paging controls, so keep the fixture small —
  // rendering a full page of rows in jsdom is slow enough to time out.
  mockFetchTraces.mockResolvedValue({
    items: [summary("t1"), summary("t2")],
    total: 120,
    limit: 50,
    offset: 0,
  });
  const user = setupUser();

  render(<TracesTabContent agentUuid={AGENT} />);
  await screen.findByText(/Showing 1–2 of 120/);

  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Next" }));

  await waitFor(() =>
    expect(mockFetchTraces.mock.calls.some((c) => c[1].offset === 50)).toBe(
      true,
    ),
  );
  // The agent stays scoped across pages.
  expect(mockFetchTraces.mock.calls.at(-1)[1].agentUuid).toBe(AGENT);
});

it("opens the detail dialog and deep-links the trace", async () => {
  mockFetchTraces.mockResolvedValue({
    items: [summary("t1")],
    total: 1,
    limit: 50,
    offset: 0,
  });
  const user = setupUser();

  render(<TracesTabContent agentUuid={AGENT} />);
  await user.click((await screen.findAllByText("msg-t1"))[0]);

  // useDialogUrlParam writes through history, not the router, so the deep
  // link shows up in the address bar rather than in a router call.
  await waitFor(() => expect(window.location.search).toContain("traceId=t1"));
});

it("surfaces a load failure instead of an empty list", async () => {
  mockFetchTraces.mockRejectedValue(new Error("boom"));

  render(<TracesTabContent agentUuid={AGENT} />);

  expect(
    await screen.findByText(/Failed to load traces/),
  ).toBeInTheDocument();
  expect(screen.queryByText("No traces yet")).not.toBeInTheDocument();
});

it("keeps the dialog open when deleting everything matching fails", async () => {
  searchParams = new URLSearchParams("conversation_id=conv-1");
  mockFetchTraces.mockResolvedValue({
    items: [summary("t1")],
    total: 1,
    limit: 50,
    offset: 0,
  });
  mockBulkDelete.mockRejectedValue(new Error("nope"));
  const user = setupUser();

  render(<TracesTabContent agentUuid={AGENT} />);
  await user.click(await screen.findByText(/Delete all 1 matching/));
  await user.click(screen.getByRole("button", { name: "Delete all" }));

  await waitFor(() => expect(mockBulkDelete).toHaveBeenCalled());
  expect(
    screen.getByRole("heading", { name: /Delete all 1 matching traces\?/ }),
  ).toBeInTheDocument();
});

it("says no traces match when a filter empties the list", async () => {
  searchParams = new URLSearchParams("conversation_id=conv-zzz");
  mockFetchTraces.mockResolvedValue({
    items: [],
    total: 0,
    limit: 50,
    offset: 0,
  });

  render(<TracesTabContent agentUuid={AGENT} />);

  expect(
    await screen.findByText("No traces match your filters."),
  ).toBeInTheDocument();
  // Not the empty state — this agent may well have traces, just not these.
  expect(screen.queryByText("No traces yet")).not.toBeInTheDocument();
});

describe("storage limit banner", () => {
  // The workspace-wide read is the one with no agentUuid; the agent's own list
  // and count both carry it.
  function mockCounts({
    workspaceTotal,
    agentTotal,
  }: {
    workspaceTotal: number;
    agentTotal: number;
  }) {
    mockFetchTraces.mockImplementation((_token, params) =>
      Promise.resolve({
        items: params.agentUuid && params.limit > 1 ? [summary("t1")] : [],
        total: params.agentUuid === undefined ? workspaceTotal : agentTotal,
        limit: params.limit,
        offset: params.offset,
      }),
    );
  }

  it("warns and points at support once the workspace is full", async () => {
    mockCounts({ workspaceTotal: 50000, agentTotal: 12 });

    render(<TracesTabContent agentUuid={AGENT} />);

    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("new ones are not being saved");
    expect(banner).toHaveTextContent("contact support");
  });

  it("stays hidden while the workspace is under the limit", async () => {
    mockCounts({ workspaceTotal: 49999, agentTotal: 12 });

    render(<TracesTabContent agentUuid={AGENT} />);

    await waitFor(() => expect(mockFetchTraces).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("warns even when this agent holds almost none of the traces", async () => {
    // The limit is workspace-wide, so an agent's own count cannot decide it.
    mockCounts({ workspaceTotal: 50000, agentTotal: 1 });

    render(<TracesTabContent agentUuid={AGENT} />);

    expect(await screen.findByRole("status")).toBeInTheDocument();
  });
});
