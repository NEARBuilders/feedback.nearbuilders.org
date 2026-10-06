import { beforeEach, describe, expect, it } from "vitest";
import { getPluginClient, legionCheckAccess, nearAuthedContext } from "../setup";

describe("getMyLegionAccess (#128)", () => {
  beforeEach(() => {
    legionCheckAccess.mockReset();
    legionCheckAccess.mockResolvedValue({ hasAccess: false });
  });

  it("denies unauthenticated callers and points them at the mint page", async () => {
    const client = await getPluginClient();
    await expect(client.getMyLegionAccess()).resolves.toEqual({
      hasAccess: false,
      linkedNearAccount: null,
      mintUrl: "https://nearlegion.com/mint",
    });
    expect(legionCheckAccess).not.toHaveBeenCalled();
  });

  it("asks the legion plugin about the session's linked NEAR account", async () => {
    legionCheckAccess.mockResolvedValue({ hasAccess: true });
    const client = await getPluginClient(nearAuthedContext("holder.near"));
    await expect(client.getMyLegionAccess()).resolves.toEqual({
      hasAccess: true,
      linkedNearAccount: "holder.near",
      mintUrl: "https://nearlegion.com/mint",
    });
    expect(legionCheckAccess).toHaveBeenCalledWith({ nearAccountId: "holder.near" });
  });

  it("fails closed when the legion plugin errors", async () => {
    legionCheckAccess.mockRejectedValue(new Error("plugin unavailable"));
    const client = await getPluginClient(nearAuthedContext("unlucky.near"));
    await expect(client.getMyLegionAccess()).resolves.toEqual({
      hasAccess: false,
      linkedNearAccount: "unlucky.near",
      mintUrl: "https://nearlegion.com/mint",
    });
  });
});
