import type { ContractType as legionContract } from "../../../plugins/legion/src/contract.ts";
import type { ContractType as nearbuildersContract } from "../../../.bos/generated/plugins/nearbuilders/contract.d.ts";
import type { ContractType as projectsContract } from "../../../.bos/generated/plugins/projects/contract.d.ts";
import type { ContractType as storageContract } from "../../../plugins/storage/src/contract.ts";
import type { ContractType as authContract } from "../../../.bos/generated/auth/contract.d.ts";
import type { RouterContract } from "@orpc/contract";
import type { PluginClientEntry } from "every-plugin";

export type PluginsClient = {
  legion: PluginClientEntry<legionContract>;
  nearbuilders: PluginClientEntry<nearbuildersContract>;
  projects: PluginClientEntry<projectsContract>;
  storage: PluginClientEntry<storageContract>;
  auth: PluginClientEntry<authContract>;
};
