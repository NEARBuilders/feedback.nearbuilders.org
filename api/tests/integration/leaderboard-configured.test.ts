import { rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createRouterClient } from "@orpc/server";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Plugin from "@/index";
import pluginDevConfig from "../../plugin.dev";

const PLUGIN_ID = pluginDevConfig.pluginId;

let gateway: Server;
let gatewayUrl = "";
let gatewayStatus = 200;
let requestedUrls: string[] = [];

// One runtime for the whole file: the db driver refuses a second concurrent
// PGlite open of the same data dir in one process (ADR 0044), and each runtime
// opens the plugin's configured data dir on boot.
const runtime = createPluginRuntime({
  registry: { [PLUGIN_ID]: { module: Plugin, description: "leaderboard test runtime" } },
  secrets: {},
});

async function createClient(activityBaseUrl: string) {
  const { router } = await runtime.usePlugin(
    PLUGIN_ID,
    {
      ...pluginDevConfig.config,
      secrets: {
        ...pluginDevConfig.config.secrets,
        // Own data dir for this fork: PGlite is single-process per data dir
        // (ADR 0044), and test files run in parallel workers.
        API_DATABASE_URL: `pglite:.bos/db/test-${process.pid}`,
        ACTIVITY_API_BASE_URL: activityBaseUrl,
        ACTIVITY_API_KEY: "",
        ACTIVITY_SOURCE_ID: "feedback.test",
      },
    },
    { nostr: { client: () => ({ createComment: async () => ({ eventId: "x", statuses: [] }) }) } },
  );
  return createRouterClient(router, { context: {} });
}

let client: Awaited<ReturnType<typeof createClient>>;

beforeAll(async () => {
  gateway = createServer((req, res) => {
    requestedUrls.push(req.url ?? "");
    res.setHeader("content-type", "application/json");
    res.statusCode = gatewayStatus;
    res.end(
      gatewayStatus === 200
        ? JSON.stringify({
            period: "monthly",
            data: [
              { rank: 1, actor: "alice.near", score: 12, eventCount: 6, extra: "dropped" },
              { rank: 2, actor: "bob.near", score: 4, eventCount: 2 },
            ],
          })
        : JSON.stringify({ message: "boom" }),
    );
  });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  gatewayUrl = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
  client = await createClient(gatewayUrl);
}, 30000);

afterAll(async () => {
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
  await runtime.shutdown();
  try {
    rmSync(`.bos/db/test-${process.pid}`, { recursive: true, force: true });
  } catch {
    // best effort — a leftover dir under .bos/db is harmless
  }
}, 30000);

describe("getLeaderboard (activity gateway configured, no API key)", () => {
  it("returns standings from the gateway, scoped to this source and every scored type", async () => {
    gatewayStatus = 200;
    requestedUrls = [];

    const board = await client.getLeaderboard({ period: "monthly", limit: 25 });

    expect(board).toEqual({
      period: "monthly",
      configured: true,
      available: true,
      data: [
        { rank: 1, actor: "alice.near", score: 12, eventCount: 6 },
        { rank: 2, actor: "bob.near", score: 4, eventCount: 2 },
      ],
    });
    const requested = new URL(requestedUrls[0] ?? "", gatewayUrl);
    expect(requested.pathname).toBe("/v1/leaderboard");
    // No type filter: the gateway weighs credit.awarded and feedback.accepted
    // above (unscored) feedback.posted, and filtering would discard that.
    expect(requested.searchParams.get("type")).toBeNull();
    expect(requested.searchParams.get("source")).toBe("feedback.test");
    expect(requested.searchParams.get("period")).toBe("monthly");
    expect(requested.searchParams.get("limit")).toBe("25");
  });

  it("reports configured but unavailable when the gateway errors", async () => {
    gatewayStatus = 500;

    await expect(client.getLeaderboard({ period: "weekly" })).resolves.toEqual({
      period: "weekly",
      configured: true,
      available: false,
      data: [],
    });
  });
});
