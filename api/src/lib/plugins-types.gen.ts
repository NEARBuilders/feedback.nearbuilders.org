import type { ContractType as legionContract } from "../../../plugins/legion/src/contract.ts";
import type { ContractType as storageContract } from "../../../plugins/storage/src/contract.ts";
import type { ContractType as authContract } from "../../../.bos/generated/auth/contract.d.ts";
import type { RouterContract } from "@orpc/contract";
import type { PluginClientEntry } from "every-plugin";

export type PluginsClient = {
  legion: PluginClientEntry<legionContract>;
  storage: PluginClientEntry<storageContract>;
  auth: PluginClientEntry<authContract>;
};
