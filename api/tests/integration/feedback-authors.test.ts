import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

let counter = 0;

async function openRound() {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`authors-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `authors-project-${n}`,
    title: `Authors ${n}`,
    description: "Review by tester.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { owner, round };
}

async function post(account: string, roundId: string, body: string) {
  const client = await getPluginClient(nearAuthedContext(account));
  await client.joinRound({ id: roundId }).catch(() => undefined);
  return await client.postFeedback({ id: roundId, format: "written", body });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://api.near.social/")) return realFetch(input, init);
    const account = decodeURIComponent(new URL(url).searchParams.get("keys") ?? "").split("/")[0];
    const body =
      account === "authors-alice.near"
        ? { [account]: { profile: { linktree: { telegram: "https://t.me/alice_tests" } } } }
        : {};
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listFeedbackAuthors", () => {
  it("groups a round's feedback by tester, with counts by status and Telegram", async () => {
    const { owner, round } = await openRound();
    const first = await post("authors-alice.near", round.id, "One");
    await post("authors-alice.near", round.id, "Two");
    await post("authors-bob.near", round.id, "Three");
    await owner.setFeedbackStatus({ id: round.id, feedbackIds: [first.id], status: "resolved" });
    await owner.setFeedbackStarred({ id: round.id, feedbackIds: [first.id], starred: true });

    const authors = await owner.listFeedbackAuthors({ id: round.id });

    expect(authors.map((author) => author.accountId)).toEqual([
      "authors-bob.near",
      "authors-alice.near",
    ]);
    expect(authors[1]).toMatchObject({
      telegramHandle: "alice_tests",
      feedbackCount: 2,
      unresolvedCount: 1,
      resolvedCount: 1,
      dismissedCount: 0,
      starredCount: 1,
    });
    expect(authors[0]).toMatchObject({ telegramHandle: null, feedbackCount: 1 });
    expect(Date.parse(authors[1]?.lastPostedAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(authors[1]?.firstPostedAt ?? ""),
    );
  });

  it("is only for the round's managers", async () => {
    const { round } = await openRound();
    await post("authors-carol.near", round.id, "Hi");
    const tester = await getPluginClient(nearAuthedContext("authors-carol.near"));
    await expect(tester.listFeedbackAuthors({ id: round.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
