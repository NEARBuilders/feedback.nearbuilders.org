import { Context, Effect, Layer } from "every-plugin/effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LegionHolderLive, LegionHolderTag } from "../services/legion-holder";

const NODE_URL = "https://rpc.mainnet.near.dev";
const CONTRACT_IDS = ["initiate.nearlegion.near", "ascendant.nearlegion.near"];

interface RecordedCall {
  contractId: string;
  methodName: string;
  accountId: string;
}

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

function rpcError(message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "test",
      error: { message },
    }),
  );
}

let calls: RecordedCall[] = [];

function stubRpc(handler: (call: RecordedCall) => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const params = JSON.parse(String(init?.body)).params;
      const call: RecordedCall = {
        contractId: params.account_id,
        methodName: params.method_name,
        accountId: JSON.parse(Buffer.from(params.args_base64, "base64").toString("utf8"))
          .account_id,
      };
      calls.push(call);
      return handler(call);
    }),
  );
}

async function buildService(): Promise<Context.Tag.Service<LegionHolderTag>> {
  const context = await Effect.runPromise(
    Effect.scoped(Layer.build(LegionHolderLive({ nodeUrl: NODE_URL, contractIds: CONTRACT_IDS }))),
  );
  return Context.get(context, LegionHolderTag);
}

describe("LegionHolderLive", () => {
  beforeEach(() => {
    calls = [];
    vi.useFakeTimers({ now: 1_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("grants access when the first contract reports a positive supply", async () => {
    stubRpc((call) =>
      call.methodName === "nft_supply_for_owner" ? rpcResponse("1") : rpcResponse([]),
    );

    const service = await buildService();
    await expect(service.checkAccess("holder.near")).resolves.toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      contractId: "initiate.nearlegion.near",
      methodName: "nft_supply_for_owner",
      accountId: "holder.near",
    });
  });

  it("denies access when every contract reports zero supply", async () => {
    stubRpc(() => rpcResponse("0"));

    const service = await buildService();
    await expect(service.checkAccess("passerby.near")).resolves.toBe(false);
    expect(calls).toHaveLength(2);
  });

  it("falls back to nft_tokens_for_owner when the supply check fails", async () => {
    stubRpc((call) =>
      call.methodName === "nft_supply_for_owner"
        ? rpcError("wasm execution failed")
        : rpcResponse([{ token_id: "legion-1" }]),
    );

    const service = await buildService();
    await expect(service.checkAccess("holder.near")).resolves.toBe(true);
    expect(calls[0]?.methodName).toBe("nft_supply_for_owner");
    expect(calls[1]?.methodName).toBe("nft_tokens_for_owner");
  });

  it("denies access and logs when every RPC call fails, without caching the failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubRpc((call) =>
      call.methodName === "nft_tokens_for_owner" ? rpcResponse([]) : rpcError("node unavailable"),
    );

    const service = await buildService();
    await expect(service.checkAccess("unlucky.near")).resolves.toBe(false);
    expect(calls).toHaveLength(4);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("unlucky.near");

    await expect(service.checkAccess("unlucky.near")).resolves.toBe(false);
    expect(calls).toHaveLength(8);
  });

  it("continues to the next contract when the first yields nothing", async () => {
    stubRpc((call) =>
      call.contractId === "ascendant.nearlegion.near" ? rpcResponse("3") : rpcResponse("0"),
    );

    const service = await buildService();
    await expect(service.checkAccess("ascendant.near")).resolves.toBe(true);
    expect(calls[0]?.contractId).toBe("initiate.nearlegion.near");
    expect(calls[1]?.contractId).toBe("ascendant.nearlegion.near");
  });

  it("caches the result for the TTL window once a check succeeds", async () => {
    stubRpc(() => rpcResponse("1"));

    const service = await buildService();
    await expect(service.checkAccess("holder.near")).resolves.toBe(true);
    await expect(service.checkAccess("holder.near")).resolves.toBe(true);
    expect(calls).toHaveLength(1);

    vi.advanceTimersByTime(61_000);
    await expect(service.checkAccess("holder.near")).resolves.toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("caches negative results separately from positive ones", async () => {
    stubRpc((call) => (call.accountId === "holder.near" ? rpcResponse("1") : rpcResponse("0")));

    const service = await buildService();
    await expect(service.checkAccess("holder.near")).resolves.toBe(true);
    await expect(service.checkAccess("passerby.near")).resolves.toBe(false);
    await expect(service.checkAccess("holder.near")).resolves.toBe(true);
    expect(calls).toHaveLength(3);
  });

  it("normalizes account ids before checking and caching", async () => {
    stubRpc(() => rpcResponse("1"));

    const service = await buildService();
    await expect(service.checkAccess("  Holder.Near  ")).resolves.toBe(true);
    await expect(service.checkAccess("holder.near")).resolves.toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.accountId).toBe("holder.near");
  });
});
