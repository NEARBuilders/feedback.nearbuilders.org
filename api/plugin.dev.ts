/**
 * FRAMEWORK-OWNED — reconciled from the parent template by `bos upgrade`.
 * Local edits are allowed: on the next upgrade the template version wins and your
 * copy is backed up under `.bos/sync-backup/`. To make a change permanent, file an
 * issue: https://github.com/NEARBuilders/everything-dev/issues
 *
 * LOCAL FORK (everything-dev#628): the rc.23 template passes BETTER_AUTH_SECRET
 * into api secrets, but this child's api doesn't host the secrets vault — auth
 * runs as a remote and takes its secret from the host env. Re-apply this removal
 * after every `bos upgrade` until the template stops passing it.
 */
import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3001,
  config: {
    // child-owned-start
    variables: {},
    // child-owned-end
    secrets: {
      API_DATABASE_URL: process.env.API_DATABASE_URL || "pglite:.bos/api/:memory:",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
