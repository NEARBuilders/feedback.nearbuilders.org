import { describe, expect, it } from "vitest";
import { buildAgentReviewPrompt, MCP_PATH } from "./agent-review";

describe("buildAgentReviewPrompt", () => {
  const prompt = buildAgentReviewPrompt({
    mcpUrl: "https://feedback.example.org/api/mcp",
    projectSlug: "near-wallet",
    roundNumber: 3,
  });

  it("names the round so the agent can look it up", () => {
    expect(prompt).toContain('"slug": "near-wallet"');
    expect(prompt).toContain('"number": 3');
    expect(prompt).toContain("round 3");
  });

  it("points the agent at the MCP endpoint", () => {
    expect(prompt).toContain("https://feedback.example.org/api/mcp");
  });

  it("tells the agent the key is read-only and a person applies statuses", () => {
    expect(prompt).toContain("read-only");
    expect(prompt).toContain("Do not try to change any status");
  });

  it("never embeds a key", () => {
    expect(prompt).not.toMatch(/org_[A-Za-z0-9]/);
  });
});

describe("MCP_PATH", () => {
  it("matches the endpoint documented in skill.md", () => {
    expect(MCP_PATH).toBe("/api/mcp");
  });
});
