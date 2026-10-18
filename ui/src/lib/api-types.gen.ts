import type { ContractType as BaseApiContract } from "../../../api/src/contract.ts";
import type { ContractType as authContract } from "../../../.bos/generated/auth/contract.d.ts";
import type { ContractType as legionContract } from "../../../plugins/legion/src/contract.ts";
import type { ContractType as storageContract } from "../../../plugins/storage/src/contract.ts";

export type ApiContract = BaseApiContract & {
  auth: authContract;
  legion: legionContract;
  storage: storageContract;
};
