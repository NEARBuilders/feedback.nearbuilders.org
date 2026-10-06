import type { ContractType as legionContract } from "../../../plugins/legion/src/contract.ts";
import type { ContractType as nostrContract } from "../../../.bos/generated/plugins/nostr/contract.d.ts";
import type { ContractType as storageContract } from "../../../plugins/storage/src/contract.ts";
import type { ContractType as authContract } from "../../../.bos/generated/auth/contract.d.ts";
import type { ContractRouterClient, AnyContractRouter } from "@orpc/contract";
type ClientFactory<C extends AnyContractRouter> = (context?: Record<string, unknown>) => ContractRouterClient<C>;

export type PluginsClient = {
  legion: ClientFactory<legionContract>;
  nostr: ClientFactory<nostrContract>;
  storage: ClientFactory<storageContract>;
  auth: ClientFactory<authContract>;
};
