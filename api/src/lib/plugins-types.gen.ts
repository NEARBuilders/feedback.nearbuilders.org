import type { ContractType as legionContract } from "../../../plugins/legion/src/contract.ts";
import type { ContractType as nostrContract } from "../../../.bos/generated/plugins/nostr/contract.d.ts";
import type { ContractType as storageContract } from "../../../plugins/storage/src/contract.ts";
import type { ContractType as authContract } from "../../../.bos/generated/auth/contract.d.ts";
import type { RouterContract } from "@orpc/contract";
import type { PluginClientEntry } from "every-plugin";

export type PluginsClient = {
  legion: PluginClientEntry<legionContract>;
  nostr: PluginClientEntry<nostrContract>;
  storage: PluginClientEntry<storageContract>;
  auth: PluginClientEntry<authContract>;
};
