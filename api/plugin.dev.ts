/**
 * Dev-mode plugin configuration for the local API server.
 *
 */

import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3001,
  config: {
    variables: {},
    secrets: {
      API_DATABASE_URL: process.env.API_DATABASE_URL || "pglite:.bos/api/:memory:",
      ACTIVITY_API_BASE_URL: process.env.ACTIVITY_API_BASE_URL || "",
      ACTIVITY_API_KEY: process.env.ACTIVITY_API_KEY || "",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
