import { Context, Effect, Layer } from "every-plugin/effect";

export interface LegionHolderService {
  checkAccess(nearAccountId: string): Promise<boolean>;
}

export class LegionHolderTag extends Context.Tag("LegionHolder")<
  LegionHolderTag,
  LegionHolderService
>() {}

const CACHE_TTL_MS = 60_000;
const RPC_TIMEOUT_MS = 5_000;
const MAX_CACHE_ENTRIES = 10_000;

interface CacheEntry {
  isHolder: boolean;
  expiresAt: number;
}

interface RpcCallFailure {
  contractId: string;
  methodName: string;
  message: string;
}

async function viewNear(
  nodeUrl: string,
  contractId: string,
  methodName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    return await queryNear(nodeUrl, contractId, methodName, args, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`NEAR RPC request timed out after ${RPC_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function queryNear(
  nodeUrl: string,
  contractId: string,
  methodName: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(nodeUrl, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "feedback-legion-holder",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: contractId,
        method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`NEAR RPC request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: { result?: number[] };
  };

  if (payload.error) {
    throw new Error(payload.error.message || "NEAR RPC request failed");
  }

  const rawResult = payload.result?.result;
  if (!Array.isArray(rawResult)) {
    return null;
  }

  const text = Buffer.from(rawResult).toString("utf8");
  return text ? JSON.parse(text) : null;
}

export const LegionHolderLive = (options: { nodeUrl: string; contractIds: readonly string[] }) =>
  Layer.effect(
    LegionHolderTag,
    Effect.gen(function* () {
      const cache = new Map<string, CacheEntry>();
      const inFlight = new Map<string, Promise<boolean>>();

      const remember = (accountId: string, isHolder: boolean) => {
        if (cache.size >= MAX_CACHE_ENTRIES) {
          const now = Date.now();
          for (const [key, entry] of cache) {
            if (entry.expiresAt <= now) cache.delete(key);
          }
          // Map iterates in insertion order, so this drops the oldest entry.
          if (cache.size >= MAX_CACHE_ENTRIES) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }
        }
        cache.set(accountId, { isHolder, expiresAt: Date.now() + CACHE_TTL_MS });
      };

      const lookup = async (accountId: string): Promise<boolean> => {
        const failures: RpcCallFailure[] = [];

        const ownsToken = async (contractId: string): Promise<boolean> => {
          try {
            const supply = await viewNear(options.nodeUrl, contractId, "nft_supply_for_owner", {
              account_id: accountId,
            });
            return BigInt(String(supply ?? 0)) > 0n;
          } catch (error) {
            failures.push({
              contractId,
              methodName: "nft_supply_for_owner",
              message: error instanceof Error ? error.message : String(error),
            });
          }

          try {
            const tokens = await viewNear(options.nodeUrl, contractId, "nft_tokens_for_owner", {
              account_id: accountId,
              from_index: "0",
              limit: 1,
            });
            return Array.isArray(tokens) && tokens.length > 0;
          } catch (fallbackError) {
            failures.push({
              contractId,
              methodName: "nft_tokens_for_owner",
              message:
                fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            });
            return false;
          }
        };

        const results = await Promise.all(options.contractIds.map(ownsToken));
        const isHolder = results.some(Boolean);

        if (failures.length > 0) {
          console.warn(
            `[Legion] RPC checks failed for ${accountId}; ${
              isHolder ? "access granted by another contract" : "denying access"
            }. ${failures.map((f) => `${f.contractId}.${f.methodName}: ${f.message}`).join("; ")}`,
          );
        }

        if (failures.length === 0) {
          remember(accountId, isHolder);
        }

        return isHolder;
      };

      const service: LegionHolderService = {
        checkAccess: async (nearAccountId) => {
          const accountId = nearAccountId.trim().toLowerCase();
          const cached = cache.get(accountId);
          const now = Date.now();

          if (cached && cached.expiresAt > now) {
            return cached.isHolder;
          }

          // Concurrent checks for one account share a single set of RPC calls.
          const pending = inFlight.get(accountId);
          if (pending) return pending;

          const check = lookup(accountId).finally(() => inFlight.delete(accountId));
          inFlight.set(accountId, check);
          return check;
        },
      };

      return service;
    }),
  );
