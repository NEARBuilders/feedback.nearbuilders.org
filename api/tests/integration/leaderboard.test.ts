import { describe, expect, it } from "vitest";
import { getPluginClient } from "../setup";

describe("getLeaderboard (activity integration unconfigured in tests)", () => {
  it.each([
    "weekly",
    "monthly",
    "all-time",
  ] as const)("reports the %s board unavailable with no entries instead of erroring", async (period) => {
    const client = await getPluginClient();
    await expect(client.getLeaderboard({ period })).resolves.toEqual({
      period,
      configured: false,
      available: false,
      data: [],
    });
  });

  it("defaults to the all-time period", async () => {
    const client = await getPluginClient();
    const board = await client.getLeaderboard({});
    expect(board.period).toBe("all-time");
  });
});
