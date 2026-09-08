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
  return { ok: status >= 200 && status < 300, status } as Response;
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

    await expect(emitter.emitRoundOpened(round)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("HTTP 503");
    expect(message).toContain(`round.opened:${round.id}`);
  });

  it("swallows and logs an unreachable gateway", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const emitter = createActivityEmitter({ ...config, fetch: fetchMock, logger: { warn } });

    await expect(emitter.emitFeedbackPosted(feedback)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ECONNREFUSED");
  });
});
