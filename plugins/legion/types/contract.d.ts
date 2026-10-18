import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const contract: {
    checkAccess: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        nearAccountId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        hasAccess: z.ZodBoolean;
    }, z.core.$strip>, object>;
};
export type ContractType = typeof contract;
