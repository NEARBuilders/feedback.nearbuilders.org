import type { ContractType as apiContract } from "../../../.bos/generated/api/contract.d.ts";
import type { ContractType as authContract } from "../../../.bos/generated/auth/contract.d.ts";
import type { ContractType as nostrContract } from "../../../.bos/generated/plugins/nostr/contract.d.ts";

export type ApiContract = apiContract & {
  auth: authContract;
  nostr: nostrContract;
};
