import type { ListAccountsResponseT } from "better-near-auth";
import { describe, expect, it } from "vitest";

import { resolveListedNearAccount } from "./use-near-account";

function account(accountId: string, overrides: Partial<{ isPrimary: boolean }> = {}) {
  return {
    id: accountId,
    userId: "user-1",
    accountId,
    network: "mainnet" as const,
    publicKey: "key",
    isPrimary: false,
    createdAt: new Date(),
    providerId: "siwn" as const,
    isActive: true,
    isAvailable: true,
    ...overrides,
  };
}

function listResponse(
  accounts: ReturnType<typeof account>[],
  activeAccount: ReturnType<typeof account> | null = null,
): ListAccountsResponseT {
  return { accounts, activeAccount, availableAccounts: accounts };
}

describe("resolveListedNearAccount", () => {
  it("prefers the active account", () => {
    const response = listResponse([account("a.near"), account("b.near")], account("b.near"));
    expect(resolveListedNearAccount(response)).toBe("b.near");
  });

  it("falls back to the primary account", () => {
    const response = listResponse([account("a.near"), account("b.near", { isPrimary: true })]);
    expect(resolveListedNearAccount(response)).toBe("b.near");
  });

  it("falls back to the first listed account", () => {
    const response = listResponse([account("a.near"), account("b.near")]);
    expect(resolveListedNearAccount(response)).toBe("a.near");
  });

  it("returns null when the server lists nothing", () => {
    expect(resolveListedNearAccount(listResponse([]))).toBeNull();
    expect(resolveListedNearAccount(listResponse([], null))).toBeNull();
  });

  it("returns null when there is no server answer", () => {
    expect(resolveListedNearAccount(null)).toBeNull();
    expect(resolveListedNearAccount(undefined)).toBeNull();
  });
});
