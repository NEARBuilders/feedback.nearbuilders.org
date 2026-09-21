import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActivityEmitter } from "@/services/activity-events";

const round = {
  id: "11111111-1111-1111-1111-111111111111",
  ownerAccountId: "owner.near",
  projectSlug: "my-project",
  title: "Try the onboarding flow",
  formats: ["written", "issues"],
  repoUrl: "https://github.com/near/feedback",
};

const feedback = {
  id: "22222222-2222-2222-2222-222222222222",
  roundId: round.id,
  authorAccountId: "tester.near",
  format: "written",
};

function okResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ eventId: "evt_test" }),
  } as Response;
}

let warn: ReturnType<typeof vi.fn<(message: string) => void>>;

beforeEach(() => {
  warn = vi.fn<(message: string) => void>();
});

describe("createActivityEmitter (disabled)", () => {
  it("is disabled and makes no request when the gateway is not configured", async () => {
    const fetchMock = vi.fn();
    const emitter = createActivityEmitter({ fetch: fetchMock, logger: { warn } });

    expect(emitter.enabled).toBe(false);
    await emitter.emitRoundOpened(round);
    await emitter.emitFeedbackPosted(feedback);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("stays disabled when only one of URL / key is set", () => {
    expect(
      createActivityEmitter({ baseUrl: "https://activity.example/api", logger: { warn } }).enabled,
    ).toBe(false);
    expect(createActivityEmitter({ apiKey: "act_secret", logger: { warn } }).enabled).toBe(false);
  });
});

describe("createActivityEmitter (enabled)", () => {
  const config = {
    baseUrl: "https://activity.nearbuilders.org/api/",
    apiKey: "act_secret",
  };

  it("emits round.opened with a bearer key and a round-scoped idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    expect(emitter.enabled).toBe(true);
    await emitter.emitRoundOpened(round);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe("https://activity.nearbuilders.org/api/v1/events");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer act_secret");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      eventType: "round.opened",
      actor: "owner.near",
      idempotencyKey: `round.opened:${round.id}`,
      payload: {
        roundId: round.id,
        projectSlug: "my-project",
        title: "Try the onboarding flow",
        formats: ["written", "issues"],
        repoUrl: "https://github.com/near/feedback",
      },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("emits feedback.posted with a feedback-scoped idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    await emitter.emitFeedbackPosted(feedback);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      eventType: "feedback.posted",
      actor: "tester.near",
      idempotencyKey: `feedback.posted:${feedback.id}`,
      payload: {
        feedbackId: feedback.id,
        roundId: round.id,
        format: "written",
      },
    });
  });

  it("swallows and logs a rejected gateway response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(503));
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    await expect(emitter.emitRoundOpened(round)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("HTTP 503");
    expect(message).toContain(`round.opened:${round.id}`);
  });

  it("swallows and logs an unreachable gateway", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    await expect(emitter.emitFeedbackPosted(feedback)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ECONNREFUSED");
  });

  it("returns the gateway's event id on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    await expect(emitter.emitRoundOpened(round)).resolves.toBe("evt_test");
  });

  it("retracts a previously emitted event", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hiddenEvent: { eventId: "evt_test", reason: "round deleted" },
        projection: { updateId: "upd_1", operation: "exclude" },
      }),
    } as Response);
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    await emitter.retract("evt_test", "round deleted");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe("https://activity.nearbuilders.org/api/v1/events/evt_test/retract");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      reason: "round deleted",
      idempotencyKey: "retract:evt_test",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("is a no-op to retract when disabled", async () => {
    const fetchMock = vi.fn();
    const emitter = createActivityEmitter({ fetch: fetchMock, logger: { warn } });

    await emitter.retract("evt_test", "round deleted");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the leaderboard scoped to the configured source", async () => {
    const leaderboardBody = { period: "weekly", data: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => leaderboardBody,
    } as Response);
    const emitter = createActivityEmitter({
      ...config,
      sourceId: "feedback.nearbuilders.org",
      fetch: fetchMock,
      logger: { warn },
    });

    const result = await emitter.leaderboard({ period: "weekly", type: "feedback.posted" });

    expect(result).toEqual(leaderboardBody);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/v1/leaderboard?");
    expect(url).toContain("source=feedback.nearbuilders.org");
    expect(url).toContain("type=feedback.posted");
    expect(url).toContain("period=weekly");
  });

  it("returns null and logs when the leaderboard request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    const result = await emitter.leaderboard({ period: "all-time" });

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("createActivityEmitter (endorsement reads)", () => {
  const config = { baseUrl: "https://activity.nearbuilders.org/api" };

  it("fetches endorsement counts in one batched POST", async () => {
    const body = { evt1: { eventId: "evt1", totalCount: 3, endorsedByCurrentUser: false } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await emitter.endorsements(["evt1"])).toEqual(body);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://activity.nearbuilders.org/api/v1/events/endorsements");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ eventIds: ["evt1"] });
  });

  it("skips the request when there are no event ids", async () => {
    const fetchMock = vi.fn();
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await emitter.endorsements([])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
