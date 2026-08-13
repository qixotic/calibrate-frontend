import { render, screen, setupUser } from "@/test-utils";
import { TracesEmptyState } from "../TracesEmptyState";

jest.mock("../../../lib/api", () => ({
  __esModule: true,
  getBackendUrl: jest.fn(() => "https://api.example.com"),
}));

const AGENT = "86186be6-d898-404a-b79c-4f6ff5336afb";

// user-event's setup() installs its own clipboard stub, so this has to land
// after it — and navigator.clipboard is getter-only, hence defineProperty.
function stubClipboard(writeText: jest.Mock) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

it("explains the feature and links to workspace settings for the API key", () => {
  render(<TracesEmptyState agentUuid={AGENT} />);
  expect(screen.getByText("No traces yet")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: /workspace settings/i });
  expect(link).toHaveAttribute("href", "/workspace-settings");
});

it("shows a copy-paste ingest snippet against the resolved backend URL", () => {
  render(<TracesEmptyState agentUuid={AGENT} />);
  expect(
    screen.getByText(/curl -X POST https:\/\/api\.example\.com\/traces/),
  ).toBeInTheDocument();
});

it("puts this agent's real ID in the snippet, since it is the only place to read it", () => {
  render(<TracesEmptyState agentUuid={AGENT} />);
  expect(screen.getByText(new RegExp(`"agent_id": "${AGENT}"`))).toBeInTheDocument();
});

it("copies the snippet, agent ID and all", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  const user = setupUser();
  stubClipboard(writeText);

  render(<TracesEmptyState agentUuid={AGENT} />);
  await user.click(screen.getByRole("button", { name: "Copy" }));

  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText.mock.calls[0][0]).toContain(`"agent_id": "${AGENT}"`);
  expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
});

it("stays usable when the clipboard is blocked", async () => {
  const writeText = jest.fn().mockRejectedValue(new Error("denied"));
  const user = setupUser();
  stubClipboard(writeText);

  render(<TracesEmptyState agentUuid={AGENT} />);
  await user.click(screen.getByRole("button", { name: "Copy" }));

  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
});

it("falls back to a placeholder host when the backend URL is unset", () => {
  const api = jest.requireMock("../../../lib/api");
  api.getBackendUrl.mockImplementationOnce(() => {
    throw new Error("BACKEND_URL environment variable is not set");
  });
  render(<TracesEmptyState agentUuid={AGENT} />);
  expect(screen.getByText(/curl -X POST https:\/\/<backend>\/traces/)).toBeInTheDocument();
});
