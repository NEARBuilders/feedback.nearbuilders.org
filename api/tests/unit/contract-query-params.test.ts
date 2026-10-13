import { describe, expect, it } from "vitest";
import { contract } from "@/contract";

/**
 * Over HTTP, path and query values reach the OpenAPI handler as strings, so
 * any number or boolean a GET route takes has to coerce or the route answers
 * 400 to a plain `?limit=10`.
 */
function parseInput(route: { "~orpc": { inputSchema?: unknown } }, input: unknown) {
  const schema = route["~orpc"].inputSchema as { parse(value: unknown): unknown };
  return schema.parse(input);
}

describe("GET route inputs accept string-typed path and query values", () => {
  it("coerces the round number in a project round URL", () => {
    expect(parseInput(contract.getRoundBySlug, { slug: "kelytra", number: "2" })).toMatchObject({
      number: 2,
    });
  });

  it("coerces limit and parses starred on the feedback list", () => {
    expect(
      parseInput(contract.listFeedback, { id: "round-1", limit: "10", starred: "true" }),
    ).toMatchObject({ limit: 10, starred: true });
    expect(parseInput(contract.listFeedback, { id: "round-1", starred: "false" })).toMatchObject({
      starred: false,
    });
  });

  it("still accepts real booleans from the RPC client", () => {
    expect(parseInput(contract.listFeedback, { id: "round-1", starred: true })).toMatchObject({
      starred: true,
    });
  });

  it("rejects a starred value that is not a boolean", () => {
    expect(() => parseInput(contract.listFeedback, { id: "round-1", starred: "maybe" })).toThrow();
  });

  it("coerces limit on notifications, builder activity and the leaderboard", () => {
    expect(parseInput(contract.listNotifications, { limit: "5" })).toEqual({ limit: 5 });
    expect(
      parseInput(contract.getBuilderActivity, { accountId: "efiz.near", limit: "2" }),
    ).toMatchObject({ limit: 2 });
    expect(parseInput(contract.getLeaderboard, { limit: "3" })).toMatchObject({ limit: 3 });
  });
});
