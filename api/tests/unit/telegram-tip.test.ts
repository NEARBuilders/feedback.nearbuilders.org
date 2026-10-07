import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTelegramTipLookup,
  DEFAULT_TIP_MESSAGE_TEMPLATE,
  normalizeTelegramHandle,
  renderTipMessage,
  telegramShareUrl,
} from "@/services/telegram-tip";

let warn: ReturnType<typeof vi.fn<(message: string) => void>>;

beforeEach(() => {
  warn = vi.fn<(message: string) => void>();
});

function json(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("normalizeTelegramHandle", () => {
  it("strips t.me URLs, @ and trailing path or query", () => {
    expect(normalizeTelegramHandle("https://t.me/alice_dev")).toBe("alice_dev");
    expect(normalizeTelegramHandle("http://www.t.me/alice_dev/123?start=x")).toBe("alice_dev");
    expect(normalizeTelegramHandle("t.me/alice_dev")).toBe("alice_dev");
    expect(normalizeTelegramHandle("https://telegram.me/alice_dev")).toBe("alice_dev");
    expect(normalizeTelegramHandle("@alice_dev")).toBe("alice_dev");
    expect(normalizeTelegramHandle("  alice_dev ")).toBe("alice_dev");
  });

  it("rejects things that aren't a Telegram username", () => {
    expect(normalizeTelegramHandle("")).toBeNull();
    expect(normalizeTelegramHandle("abc")).toBeNull();
    expect(normalizeTelegramHandle("1alice")).toBeNull();
    expect(normalizeTelegramHandle("has space")).toBeNull();
    expect(normalizeTelegramHandle("https://example.com/alice_dev")).toBeNull();
    expect(normalizeTelegramHandle("https://t.me/joinchat/AAAAAEabc")).toBeNull();
    expect(normalizeTelegramHandle("https://t.me/+AbCdEfGh1234")).toBeNull();
    expect(normalizeTelegramHandle("https://t.me/addstickers/pack")).toBeNull();
    expect(normalizeTelegramHandle(undefined)).toBeNull();
    expect(normalizeTelegramHandle(42)).toBeNull();
  });
});

describe("tip message", () => {
  it("defaults to the plain tip command and fills in the placeholders", () => {
    expect(DEFAULT_TIP_MESSAGE_TEMPLATE).toBe("/tip @{handle}");
    expect(renderTipMessage(undefined, "alice_dev", "alice.near")).toBe("/tip @alice_dev");
    expect(renderTipMessage("  ", "alice_dev", "alice.near")).toBe("/tip @alice_dev");
    expect(
      renderTipMessage("/send {handle} 5 for {account} ({handle})", "alice_dev", "alice.near"),
    ).toBe("/send alice_dev 5 for alice.near (alice_dev)");
  });

  it("builds a t.me deep link carrying the message", () => {
    const url = telegramShareUrl("/tip @alice_dev");
    expect(url.startsWith("https://t.me/share/url?")).toBe(true);
    expect(new URL(url).searchParams.get("text")).toBe("/tip @alice_dev");
  });
});

describe("createTelegramTipLookup", () => {
  const config = { baseUrl: "https://nearbuilders.org/api/" };

  it("uses the nearbuilders.org builders API first", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ links: { telegram: "https://t.me/alice_dev" } }));
    const lookup = createTelegramTipLookup({ ...config, fetch: fetchMock, logger: { warn } });

    const tip = await lookup.getTip("alice.near");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://nearbuilders.org/api/v1/builders/alice.near",
    );
    expect(tip).toMatchObject({
      handle: "alice_dev",
      source: "nearbuilders",
      available: true,
      message: "/tip @alice_dev",
    });
    expect(new URL(tip.shareUrl ?? "").searchParams.get("text")).toBe("/tip @alice_dev");
  });

  it("also reads the handle from a data envelope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ data: { links: { telegram: "@alice_dev" } } }));
    const lookup = createTelegramTipLookup({ ...config, fetch: fetchMock, logger: { warn } });
    expect((await lookup.resolveHandle("alice.near")).handle).toBe("alice_dev");
  });

  it("falls back to the NEAR Social profile when the builders API has no handle", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ links: {} }))
      .mockResolvedValueOnce(
        json({ "alice.near": { profile: { linktree: { telegram: "social_alice" } } } }),
      );
    const lookup = createTelegramTipLookup({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await lookup.resolveHandle("alice.near")).toEqual({
      handle: "social_alice",
      source: "near-social",
      available: true,
    });
    const socialUrl = new URL(fetchMock.mock.calls[1]?.[0] as string);
    expect(socialUrl.origin).toBe("https://api.near.social");
    expect(socialUrl.searchParams.get("keys")).toBe("alice.near/profile/**");
  });

  it("falls back when the builders API errors, and logs it", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(
        json({ "alice.near": { profile: { linktree: { telegram: "social_alice" } } } }),
      );
    const lookup = createTelegramTipLookup({ ...config, fetch: fetchMock, logger: { warn } });

    expect((await lookup.resolveHandle("alice.near")).handle).toBe("social_alice");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ECONNREFUSED");
  });

  it("reports no handle but available when the sources answer without one", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(null, 404))
      .mockResolvedValueOnce(json({}));
    const lookup = createTelegramTipLookup({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await lookup.getTip("nobody.near")).toEqual({
      handle: null,
      source: null,
      available: true,
      message: null,
      shareUrl: null,
    });
  });

  it("degrades gracefully, with available=false, when every source fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 503));
    const lookup = createTelegramTipLookup({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await lookup.getTip("alice.near")).toMatchObject({
      handle: null,
      available: false,
      message: null,
    });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("skips the builders API when no base URL is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    const lookup = createTelegramTipLookup({ fetch: fetchMock, logger: { warn } });
    await lookup.resolveHandle("alice.near");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.near.social");
  });

  it("uses the configured message template", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ links: { telegram: "https://t.me/alice_dev" } }));
    const lookup = createTelegramTipLookup({
      ...config,
      messageTemplate: "/give @{handle} 10 NEAR",
      fetch: fetchMock,
      logger: { warn },
    });
    expect((await lookup.getTip("alice.near")).message).toBe("/give @alice_dev 10 NEAR");
  });
});
