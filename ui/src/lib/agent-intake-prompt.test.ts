import { describe, expect, it } from "vitest";
import { buildAgentIntakePrompt } from "./agent-intake-prompt";

describe("buildAgentIntakePrompt", () => {
  const prompt = buildAgentIntakePrompt({
    roundTitle: "Wallet beta",
    projectSlug: "near-wallet",
    roundUrl: "https://feedback.example.org/projects/near-wallet/2",
  });

  it("names the project, the round and its link", () => {
    expect(prompt).toContain('"near-wallet"');
    expect(prompt).toContain('"Wallet beta"');
    expect(prompt).toContain("https://feedback.example.org/projects/near-wallet/2");
  });

  it("asks the assistant to interview first and limits follow-ups", () => {
    expect(prompt).toContain("Interview me before you write anything");
    expect(prompt).toContain("no more than three follow-up questions");
  });

  it("uses the same headings as the guided report", () => {
    expect(prompt).toContain("**What I was trying to do**");
    expect(prompt).toContain("**What happened**");
    expect(prompt).toContain("**What I expected**");
  });

  it("keeps the tester as the author and the draft free of invented details", () => {
    expect(prompt).toContain("Use my own words");
    expect(prompt).toContain("Do not invent");
  });

  it("warns against sharing secrets", () => {
    expect(prompt).toContain("seed phrases");
  });
});
