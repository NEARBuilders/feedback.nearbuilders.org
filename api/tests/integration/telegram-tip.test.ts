import { describe, expect, it } from "vitest";
import { getPluginClient } from "../setup";

describe("getTelegramTip (#105)", () => {
  it("needs a signed-in caller, so handle lookups aren't an open proxy", async () => {
    const anon = await getPluginClient();
    await expect(anon.getTelegramTip({ accountId: "alice.near" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
