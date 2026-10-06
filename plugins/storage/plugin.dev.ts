import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3012,
  config: {
    variables: {},
    secrets: {
      STORAGE_DATABASE_URL: process.env.STORAGE_DATABASE_URL || "pglite:.bos/storage/:memory:",
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT || undefined,
      STORAGE_BUCKET: process.env.STORAGE_BUCKET || undefined,
      STORAGE_REGION: process.env.STORAGE_REGION || undefined,
      STORAGE_PUBLIC_URL: process.env.STORAGE_PUBLIC_URL || undefined,
      STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID || undefined,
      STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY || undefined,
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
