import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { ContextSchema } from "./lib/context";
import { LegionHolderLive, LegionHolderTag } from "./services/legion-holder";

export const DEFAULT_LEGION_CONTRACT_IDS = [
  "initiate.nearlegion.near",
  "ascendant.nearlegion.near",
] as const;

export default createPlugin({
  variables: z.object({
    nodeUrl: z.string().url().default("https://rpc.mainnet.near.org"),
    contractIds: z.array(z.string()).default([...DEFAULT_LEGION_CONTRACT_IDS]),
  }),

  secrets: z.object({}),

  context: ContextSchema,

  contract,

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const legionHolder = yield* tools.buildService(
        LegionHolderTag,
        LegionHolderLive({
          nodeUrl: config.variables.nodeUrl,
          contractIds: config.variables.contractIds,
        }),
      );

      console.log(`[Legion] Initialized (contracts: ${config.variables.contractIds.join(", ")})`);

      return { legionHolder };
    }),

  shutdown: () => Effect.log("[Legion] Shutdown"),

  createRouter: (services, builder) => ({
    checkAccess: builder.checkAccess.handler(async ({ input }) => {
      return {
        hasAccess: await services.legionHolder.checkAccess(input.nearAccountId),
      };
    }),
  }),
});
