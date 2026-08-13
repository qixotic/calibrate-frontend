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
