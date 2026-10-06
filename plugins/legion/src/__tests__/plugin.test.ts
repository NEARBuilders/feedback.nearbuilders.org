import { createPluginRuntime } from "every-plugin";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

function rpcResponse(value: unknown): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "test",
      result: {
        result: Array.from(Buffer.from(JSON.stringify(value), "utf8")),
      },
    }),
  );
}

describe("Legion plugin", () => {
  const runtime = createPluginRuntime({
    registry: { legion: { module: Plugin } },
  });

  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"legion">>>;

  const fetchMock = vi.fn(async (..._args: unknown[]) => rpcResponse("0"));

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    loaded = await runtime.usePlugin("legion", {
      variables: {
        nodeUrl: "https://rpc.mainnet.near.dev",
        contractIds: ["initiate.nearlegion.near", "ascendant.nearlegion.near"],
      },
      secrets: {},
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await runtime.shutdown();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockClear();
  });

  it("registers and serves checkAccess over the contract", async () => {
    const client = loaded.createClient();
    await expect(client.checkAccess({ nearAccountId: "passerby.near" })).resolves.toEqual({
      hasAccess: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://rpc.mainnet.near.dev");
  });

  it("normalizes and denies without crashing on RPC errors", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("node unreachable");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = loaded.createClient();
    await expect(client.checkAccess({ nearAccountId: "holder.near" })).resolves.toEqual({
      hasAccess: false,
    });
    expect(warn).toHaveBeenCalled();
  });

  it("accepts configured variables", async () => {
    fetchMock.mockImplementation(async () => rpcResponse("5"));
    const client = loaded.createClient();
    await expect(client.checkAccess({ nearAccountId: "member.near" })).resolves.toEqual({
      hasAccess: true,
    });
  });
});
