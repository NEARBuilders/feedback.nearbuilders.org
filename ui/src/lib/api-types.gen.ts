import type { ContractType as BaseApiContract } from "../../../api/src/contract.ts";
import type { ContractType as authContract } from "../../../.bos/generated/auth/contract.d.ts";
import type { ContractType as legionContract } from "../../../plugins/legion/src/contract.ts";
import type { ContractType as nearbuildersContract } from "../../../.bos/generated/plugins/nearbuilders/contract.d.ts";
import type { ContractType as projectsContract } from "../../../.bos/generated/plugins/projects/contract.d.ts";
import type { ContractType as storageContract } from "../../../plugins/storage/src/contract.ts";

export type ApiContract = BaseApiContract & {
  auth: authContract;
  legion: legionContract;
  nearbuilders: nearbuildersContract;
  projects: projectsContract;
  storage: storageContract;
};
