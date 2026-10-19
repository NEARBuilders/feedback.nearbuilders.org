import { ORPCError } from "@orpc/server";
import { Context, Effect, Layer } from "effect";
import { buildScoped, createPlugin } from "every-plugin";
import { z } from "zod";
import { contract } from "./contract";
import { ContextSchema } from "./lib/context";
import type { LegionHolderService } from "./services/legion-holder";
import { LegionHolderLive, LegionHolderTag } from "./services/legion-holder";

export const DEFAULT_LEGION_CONTRACT_IDS = [
  "initiate.nearlegion.near",
  "ascendant.nearlegion.near",
] as const;

type LegionRuntimeShape = { legionHolder: LegionHolderService };

class LegionRuntimeTag extends Context.Service<LegionRuntimeTag, LegionRuntimeShape>()(
  "LegionRuntime",
) {}

let runtime: LegionRuntimeShape | undefined;

const getRuntime = (): LegionRuntimeShape => {
  if (!runtime) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Legion services not initialized" });
  }
  return runtime;
};

export default createPlugin({
  variables: z.object({
    nodeUrl: z.string().url().default("https://free.rpc.fastnear.com"),
    contractIds: z.array(z.string()).default([...DEFAULT_LEGION_CONTRACT_IDS]),
  }),

  secrets: z.object({}),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const legionHolder = yield* buildScoped(
        LegionHolderTag,
        LegionHolderLive({
          nodeUrl: config.variables.nodeUrl,
          contractIds: config.variables.contractIds,
        }),
      );

      console.log(`[Legion] Initialized (contracts: ${config.variables.contractIds.join(", ")})`);

      runtime = { legionHolder };
      return Layer.succeed(LegionRuntimeTag, { legionHolder });
    }),

  createRouter: (builder) => ({
    checkAccess: builder.checkAccess.handler(async ({ input }) => {
      return {
        hasAccess: await getRuntime().legionHolder.checkAccess(input.nearAccountId),
      };
    }),
  }),
});
