import { z } from "every-plugin/zod";
export declare const contract: {
    checkAccess: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccountId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        hasAccess: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
};
export type ContractType = typeof contract;
