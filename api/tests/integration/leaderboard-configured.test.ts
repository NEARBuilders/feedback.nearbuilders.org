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

async function clientFor(activityBaseUrl: string) {
  const runtime = createPluginRuntime({
    registry: { [PLUGIN_ID]: { module: Plugin, description: "leaderboard test runtime" } },
    secrets: {},
  });
  const { router } = await runtime.usePlugin(
    PLUGIN_ID,
    {
      ...pluginDevConfig.config,
      secrets: {
        ...pluginDevConfig.config.secrets,
        ACTIVITY_API_BASE_URL: activityBaseUrl,
        ACTIVITY_API_KEY: "",
        ACTIVITY_SOURCE_ID: "feedback.test",
        PROJECTS_API_BASE_URL: "",
      },
    },
    { nostr: () => ({ createComment: async () => ({ eventId: "x", statuses: [] }) }) },
  );
  return createRouterClient(router, { context: {} });
}

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
});

afterAll(async () => {
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
});

describe("getLeaderboard (activity gateway configured, no API key)", () => {
  it("returns standings from the gateway, scoped to feedback.posted and this source", async () => {
    gatewayStatus = 200;
    requestedUrls = [];
    const client = await clientFor(gatewayUrl);

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
    expect(requested.searchParams.get("type")).toBe("feedback.posted");
    expect(requested.searchParams.get("source")).toBe("feedback.test");
    expect(requested.searchParams.get("period")).toBe("monthly");
    expect(requested.searchParams.get("limit")).toBe("25");
  });

  it("reports configured but unavailable when the gateway errors", async () => {
    gatewayStatus = 500;
    const client = await clientFor(gatewayUrl);

    await expect(client.getLeaderboard({ period: "weekly" })).resolves.toEqual({
      period: "weekly",
      configured: true,
      available: false,
      data: [],
    });
  });
});
