import { Context, Effect, Layer } from "every-plugin/effect";

export interface LegionHolderService {
  checkAccess(nearAccountId: string): Promise<boolean>;
}

export class LegionHolderTag extends Context.Tag("LegionHolder")<
  LegionHolderTag,
  LegionHolderService
>() {}

const CACHE_TTL_MS = 60_000;

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
  const response = await fetch(nodeUrl, {
    method: "POST",
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

      const service: LegionHolderService = {
        checkAccess: async (nearAccountId) => {
          const accountId = nearAccountId.trim().toLowerCase();
          const cached = cache.get(accountId);
          const now = Date.now();

          if (cached && cached.expiresAt > now) {
            return cached.isHolder;
          }

          const failures: RpcCallFailure[] = [];
          let isHolder = false;

          for (const contractId of options.contractIds) {
            try {
              const supply = await viewNear(options.nodeUrl, contractId, "nft_supply_for_owner", {
                account_id: accountId,
              });

              if (BigInt(String(supply ?? 0)) > 0n) {
                isHolder = true;
                break;
              }
            } catch (error) {
              failures.push({
                contractId,
                methodName: "nft_supply_for_owner",
                message: error instanceof Error ? error.message : String(error),
              });

              try {
                const tokens = await viewNear(options.nodeUrl, contractId, "nft_tokens_for_owner", {
                  account_id: accountId,
                  from_index: "0",
                  limit: 1,
                });

                if (Array.isArray(tokens) && tokens.length > 0) {
                  isHolder = true;
                  break;
                }
              } catch (fallbackError) {
                failures.push({
                  contractId,
                  methodName: "nft_tokens_for_owner",
                  message:
                    fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                });
              }
            }
          }

          if (failures.length > 0) {
            console.warn(
              `[Legion] RPC checks failed for ${accountId}; denying access. ${failures
                .map((f) => `${f.contractId}.${f.methodName}: ${f.message}`)
                .join("; ")}`,
            );
          }

          if (failures.length === 0) {
            cache.set(accountId, {
              isHolder,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });
          }

          return isHolder;
        },
      };

      return service;
    }),
  );
