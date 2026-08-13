// Backend-backed Traces flow (`src/components/agent-tabs/TracesTabContent.tsx`).
// Traces live on an agent's Traces tab and are read + curate only — production
// turns are ingested by the customer's backend via `POST /traces`, so this spec
// creates an agent, seeds a couple of traces against it through that endpoint
// (using the signed-in account's own JWT, the same way a browser request
// would), then drives the list, detail dialog, search, and delete.
// Run with `npm run test:e2e:integration`.
import { test, expect } from "./fixtures";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

test.describe("Agent Traces tab (authenticated, real backend)", () => {
  test("empty state, then ingest, list, detail, search, and delete", async ({
    page,
  }) => {
    await page.goto("/agents");

    // The session's own token, used exactly as a customer backend would.
    const auth = await page.evaluate(() => ({
      token: localStorage.getItem("access_token"),
      org: localStorage.getItem("activeOrgUuid"),
    }));
    expect(auth.token).toBeTruthy();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    };
    if (auth.org) headers["X-Org-UUID"] = auth.org;

    const stamp = Date.now();
    const created = await page.request.post(`${BACKEND}/agents`, {
      headers,
      data: { name: `e2e-traces-${stamp}`, type: "agent" },
    });
    expect(created.ok()).toBeTruthy();
    const agentUuid = (await created.json()).uuid as string;

    // Empty state carries this agent's own ID — it is the value a customer has
    // to hardcode, and this screen is the only place to read it.
    await page.goto(`/agents/${agentUuid}?tab=traces`);
    await expect(page.getByText("No traces yet")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(`"agent_id": "${agentUuid}"`)).toBeVisible();

    const term = `polio${stamp}`;
    const targetMsgId = `e2e-${stamp}-a`;
    await page.request.post(`${BACKEND}/traces`, {
      headers,
      data: {
        agent_id: agentUuid,
        message_id: targetMsgId,
        conversation_id: `e2e-conv-${stamp}`,
        input: [{ role: "user", content: `Tell me about ${term} boosters` }],
        output: { response: "Boosters are due at 16 months." },
        metadata: [{ key: "env", value: "e2e" }],
      },
    });
    await page.request.post(`${BACKEND}/traces`, {
      headers,
      data: {
        agent_id: agentUuid,
        message_id: `e2e-${stamp}-b`,
        conversation_id: `e2e-conv-${stamp}`,
        input: [{ role: "user", content: "unrelated question" }],
        output: { tool_calls: [{ tool: "lookup", arguments: {} }] },
      },
    });

    // A trace ingested against a different agent must not surface here.
    const otherAgent = await page.request.post(`${BACKEND}/agents`, {
      headers,
      data: { name: `e2e-traces-other-${stamp}`, type: "agent" },
    });
    const otherUuid = (await otherAgent.json()).uuid as string;
    const foreignMsgId = `e2e-${stamp}-foreign`;
    await page.request.post(`${BACKEND}/traces`, {
      headers,
      data: {
        agent_id: otherUuid,
        message_id: foreignMsgId,
        conversation_id: `e2e-conv-other-${stamp}`,
        input: [{ role: "user", content: `Tell me about ${term} boosters` }],
        output: { response: "Different agent entirely." },
      },
    });

    await page.reload();
    // The message id renders in both the desktop table and the mobile cards
    // (both in the DOM), so scope to the first match.
    const row = page.getByText(targetMsgId).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    // Tool names, not just a count, so the row says what the turn did.
    await expect(page.getByText("lookup").first()).toBeVisible();
    // The other agent's trace matches the same search term but is not ours.
    await page.getByPlaceholder("Search traces").fill(term);
    await expect(page.getByText(targetMsgId).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(foreignMsgId)).toHaveCount(0);

    // Open the detail dialog and confirm it renders the output.
    await row.click();
    const dialog = page.locator(".fixed.inset-0.z-50");
    await expect(
      dialog.getByRole("heading", { name: "Trace", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Boosters are due at 16 months."),
    ).toBeVisible();
    await expect(dialog.getByText("Conversation history")).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();

    // Delete the seeded trace via its row trash icon + confirmation.
    await page.getByPlaceholder("Search traces").fill(term);
    await expect(page.getByText(targetMsgId).first()).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "Delete trace" }).first().click();
    await expect(
      page.getByRole("heading", { name: /Delete this trace\?/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(targetMsgId)).toHaveCount(0, {
      timeout: 15000,
    });
  });
});
