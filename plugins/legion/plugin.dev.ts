import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3011,
  config: {
    variables: {
      nodeUrl: process.env.LEGION_NODE_URL || "https://rpc.mainnet.near.org",
      contractIds: ["initiate.nearlegion.near", "ascendant.nearlegion.near"],
    },
    secrets: {},
  } satisfies PluginConfigInput<typeof Plugin>,
};
