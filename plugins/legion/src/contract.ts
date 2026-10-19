import "@orpc/openapi/extensions/route";
import { oc } from "@orpc/contract";
import { z } from "zod";

export const contract = oc.router({
  checkAccess: oc
    .route({
      method: "POST",
      path: "/check-access",
      summary: "Check Legion holder access",
      description: "Checks whether a NEAR account holds a Legion NFT.",
    })
    .input(
      z.object({
        nearAccountId: z
          .string()
          .trim()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9._-]+$/i, "Invalid NEAR account id"),
      }),
    )
    .output(
      z.object({
        hasAccess: z.boolean(),
      }),
    ),
});

export type ContractType = typeof contract;
