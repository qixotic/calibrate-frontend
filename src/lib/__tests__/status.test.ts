import { formatStatus, getStatusBadgeClass, isActiveStatus } from "../status";

describe("formatStatus", () => {
  it.each([
    ["queued", "Queued"],
    ["QUEUED", "Queued"],
    ["pending", "Waiting"],
    ["processing", "Scoring"],
    ["in_progress", "Running"],
    ["done", "Done"],
    ["completed", "Completed"],
    ["failed", "Failed"],
    ["skipped", "Skipped"],
    ["weird", "weird"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatStatus(input)).toBe(expected);
  });
});

describe("getStatusBadgeClass", () => {
  it.each([
    ["done", "green"],
    ["completed", "green"],
    ["running", "yellow"],
    ["in_progress", "yellow"],
    ["processing", "yellow"],
    ["failed", "red"],
    ["error", "red"],
    ["pending", "gray"],
    ["queued", "gray"],
    ["skipped", "gray"],
    ["unknown", "gray"],
  ])("returns %s classes containing %s", (input, colorSubstr) => {
    expect(getStatusBadgeClass(input)).toContain(colorSubstr);
  });

  it("is case-insensitive", () => {
    expect(getStatusBadgeClass("DONE")).toBe(getStatusBadgeClass("done"));
  });
});

describe("isActiveStatus", () => {
  it.each([
    ["queued", true],
    ["in_progress", true],
    ["running", true],
    ["pending", true],
    ["processing", true],
    ["QUEUED", true],
    ["done", false],
    ["failed", false],
    ["skipped", false],
    ["other", false],
  ])("isActiveStatus(%s) === %s", (input, expected) => {
    expect(isActiveStatus(input)).toBe(expected);
  });
});
