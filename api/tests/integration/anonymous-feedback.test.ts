import { beforeEach, describe, expect, it } from "vitest";
import {
  adminContext,
  authListTeamMembers,
  authListTeams,
  getPluginClient,
  legionCheckAccess,
  nearAuthedContext,
  nostrCreateComment,
} from "../setup";

let counter = 0;

interface RoundOptions {
  allowAnonymous?: boolean;
  isPrivate?: boolean;
  legionOnly?: boolean;
  slug?: string;
}

async function openRound(options: RoundOptions = {}) {
  const n = ++counter;
  const orgId = `anon-org-${n}`;
  const owner = await getPluginClient(
    nearAuthedContext(`anon-owner-${n}.near`, `anon-owner-user-${n}`, orgId, "owner"),
  );
  const round = await owner.createRound({
    projectSlug: options.slug ?? `anon-project-${n}`,
    title: `Anonymous ${n}`,
    description: "Say it without a name.",
    formats: ["written", "recorded"],
    allowAnonymous: options.allowAnonymous,
    isPrivate: options.isPrivate,
    legionOnly: options.legionOnly,
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { n, orgId, owner, round };
}

async function signedInPost(account: string, roundId: string, body: string) {
  const client = await getPluginClient(nearAuthedContext(account));
  await client.joinRound({ id: roundId }).catch(() => undefined);
  return client.postFeedback({ id: roundId, format: "written", body });
}

beforeEach(() => {
  nostrCreateComment.mockClear();
  legionCheckAccess.mockReset();
  legionCheckAccess.mockResolvedValue({ hasAccess: false });
  authListTeams.mockReset();
  authListTeamMembers.mockReset();
  authListTeams.mockResolvedValue([]);
  authListTeamMembers.mockResolvedValue([]);
});

describe("anonymous feedback (#89)", () => {
  it("is off by default and can be turned on when the round is created", async () => {
    const off = await openRound();
    expect(off.round.allowAnonymous).toBe(false);
    const on = await openRound({ allowAnonymous: true });
    expect(on.round.allowAnonymous).toBe(true);
  });

  it("rejects anonymous posts on rounds that didn't opt in", async () => {
    const { round } = await openRound();
    const anon = await getPluginClient();
    await expect(
      anon.postFeedback({ id: round.id, format: "written", body: "hi", anonymous: true }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This round doesn't accept anonymous feedback",
    });
  });

  it("accepts an anonymous post with no session, no NEAR account and no join", async () => {
    const { round, owner } = await openRound({ allowAnonymous: true });
    const anon = await getPluginClient();

    const posted = await anon.postFeedback({
      id: round.id,
      format: "written",
      body: "Nobody needs to know it was me",
      anonymous: true,
    });

    expect(posted).toMatchObject({
      authorAccountId: null,
      authorType: "anonymous",
      body: "Nobody needs to know it was me",
    });
    const { items } = await owner.listFeedback({ id: round.id });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ authorAccountId: null, authorType: "anonymous" });
  });

  it("also takes anonymous recorded sessions", async () => {
    const { round } = await openRound({ allowAnonymous: true });
    const anon = await getPluginClient();
    await expect(
      anon.postFeedback({
        id: round.id,
        format: "recorded",
        url: "https://example.com/session",
        anonymous: true,
      }),
    ).resolves.toMatchObject({ authorType: "anonymous", url: "https://example.com/session" });
  });

  it("ignores who is signed in: the post still carries no identity", async () => {
    const { round } = await openRound({ allowAnonymous: true });
    const member = await getPluginClient(nearAuthedContext("anon-signed-in.near"));
    const posted = await member.postFeedback({
      id: round.id,
      format: "written",
      body: "Signed in, but anonymous",
      anonymous: true,
    });
    expect(posted).toMatchObject({ authorAccountId: null, authorType: "anonymous" });
  });

  it("rejects anonymous posts once the round is closed", async () => {
    const { round, owner } = await openRound({ allowAnonymous: true });
    await owner.closeRound({ id: round.id, credits: [] });
    const anon = await getPluginClient();
    await expect(
      anon.postFeedback({ id: round.id, format: "written", body: "late", anonymous: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses anonymous posts on Legion-only rounds", async () => {
    const { round } = await openRound({ allowAnonymous: true, legionOnly: true });
    const anon = await getPluginClient();
    await expect(
      anon.postFeedback({ id: round.id, format: "written", body: "hi", anonymous: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("publishes to Nostr without the near_account tag, unlike signed-in feedback", async () => {
    const { round } = await openRound({ allowAnonymous: true });
    const anon = await getPluginClient();
    await anon.postFeedback({ id: round.id, format: "written", body: "anon", anonymous: true });
    const anonEvent = nostrCreateComment.mock.calls.at(-1)![0].event;
    expect(anonEvent.tags.some((tag: string[]) => tag[0] === "near_account")).toBe(false);

    await signedInPost("anon-named.near", round.id, "named");
    const namedEvent = nostrCreateComment.mock.calls.at(-1)![0].event;
    expect(namedEvent.tags).toContainEqual(["near_account", "anon-named.near"]);
  });

  it("doesn't publish anonymous feedback from a private round to Nostr", async () => {
    const { round } = await openRound({ allowAnonymous: true, isPrivate: true });
    const anon = await getPluginClient();
    const posted = await anon.postFeedback({
      id: round.id,
      format: "written",
      body: "private and anonymous",
      anonymous: true,
    });
    expect(posted.nostrEventId).toBeNull();
    expect(nostrCreateComment).not.toHaveBeenCalled();
  });

  it("keeps the signed-in flow unchanged: it still needs a session and a join", async () => {
    const { round } = await openRound({ allowAnonymous: true });
    const anon = await getPluginClient();
    await expect(
      anon.postFeedback({ id: round.id, format: "written", body: "no session" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const stranger = await getPluginClient(nearAuthedContext("anon-not-joined.near"));
    await expect(
      stranger.postFeedback({ id: round.id, format: "written", body: "not joined" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const posted = await signedInPost("anon-joined.near", round.id, "joined");
    expect(posted).toMatchObject({ authorAccountId: "anon-joined.near", authorType: "near" });
  });

  it("never lists anonymous posters as credit candidates and can't credit them", async () => {
    const { round, owner } = await openRound({ allowAnonymous: true });
    const anon = await getPluginClient();
    await anon.postFeedback({ id: round.id, format: "written", body: "anon", anonymous: true });
    await signedInPost("anon-credited.near", round.id, "named");

    const candidates = await owner.getCreditCandidates({ id: round.id });
    expect(candidates.map((c) => c.accountId)).toEqual(["anon-credited.near"]);
    await expect(
      owner.closeRound({
        id: round.id,
        credits: [{ builderAccountId: "anonymous", contributedMeaningfully: true }],
      }),
    ).rejects.toThrow("did not post feedback");
  });

  it("lets managers resolve, star and export anonymous feedback without notifying anyone", async () => {
    const { round, owner } = await openRound({ allowAnonymous: true });
    const anon = await getPluginClient();
    const posted = await anon.postFeedback({
      id: round.id,
      format: "written",
      body: "good point",
      anonymous: true,
    });
    const [resolved] = await owner.setFeedbackStatus({
      id: round.id,
      feedbackIds: [posted.id],
      status: "resolved",
    });
    expect(resolved?.status).toBe("resolved");
    const [starred] = await owner.setFeedbackStarred({
      id: round.id,
      feedbackIds: [posted.id],
      starred: true,
    });
    expect(starred?.starredAt).toEqual(expect.any(String));
  });
});

describe("project feedback stream (#89)", () => {
  async function project() {
    const n = ++counter;
    const slug = `stream-project-${n}`;
    const first = await openRound({ slug, allowAnonymous: true });
    const owner = first.owner;
    const second = await owner.createRound({
      projectSlug: slug,
      title: "Second round",
      description: "Round two.",
      formats: ["written", "recorded"],
      allowAnonymous: true,
    });
    return { slug, owner, first: first.round, second };
  }

  it("streams feedback across rounds with round context, oldest first", async () => {
    const { slug, first, second } = await project();
    const anon = await getPluginClient();
    await anon.postFeedback({ id: first.id, format: "written", body: "one", anonymous: true });
    await anon.postFeedback({ id: second.id, format: "written", body: "two", anonymous: true });
    await anon.postFeedback({
      id: second.id,
      format: "recorded",
      url: "https://example.com/r",
      anonymous: true,
    });

    const stream = await anon.listProjectFeedback({ slug });
    expect(stream.items.map((i) => i.body ?? i.url)).toEqual([
      "one",
      "two",
      "https://example.com/r",
    ]);
    expect(stream.items[0]).toMatchObject({
      roundId: first.id,
      roundNumber: first.projectRoundNumber,
      roundTitle: first.title,
      projectSlug: slug,
    });
    expect(stream.items[1]).toMatchObject({ roundNumber: second.projectRoundNumber });
    expect(stream.nextSince).toBe(stream.items.at(-1)?.createdAt);
  });

  it("filters by round, format and author type", async () => {
    const { slug, first, second } = await project();
    const anon = await getPluginClient();
    await anon.postFeedback({ id: first.id, format: "written", body: "a", anonymous: true });
    await anon.postFeedback({
      id: second.id,
      format: "recorded",
      url: "https://example.com/x",
      anonymous: true,
    });
    await signedInPost("stream-named.near", second.id, "named");

    expect(
      (await anon.listProjectFeedback({ slug, roundNumber: second.projectRoundNumber })).items,
    ).toHaveLength(2);
    expect((await anon.listProjectFeedback({ slug, format: "recorded" })).items).toHaveLength(1);
    expect((await anon.listProjectFeedback({ slug, authorType: "near" })).items).toHaveLength(1);
    expect((await anon.listProjectFeedback({ slug, authorType: "anonymous" })).items).toHaveLength(
      2,
    );
  });

  it("reads only what came after `since`, and honours the limit", async () => {
    const { slug, first } = await project();
    const anon = await getPluginClient();
    for (const body of ["a", "b", "c"]) {
      await anon.postFeedback({ id: first.id, format: "written", body, anonymous: true });
    }
    const page = await anon.listProjectFeedback({ slug, limit: 2 });
    expect(page.items.map((i) => i.body)).toEqual(["a", "b"]);

    const next = await anon.listProjectFeedback({ slug, since: page.nextSince ?? undefined });
    expect(next.items.map((i) => i.body)).toEqual(["c"]);

    const empty = await anon.listProjectFeedback({ slug, since: next.nextSince ?? undefined });
    expect(empty).toEqual({ items: [], nextSince: null });
  });

  it("returns NOT_FOUND for an unknown project", async () => {
    const anon = await getPluginClient();
    await expect(anon.listProjectFeedback({ slug: "no-such-project" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("is visibility-aware: private rounds only show a caller their own submissions", async () => {
    const { n, owner } = await openRound({ isPrivate: true, allowAnonymous: true });
    const round = (await owner.listRounds({})).find((r) => r.title === `Anonymous ${n}`)!;
    await signedInPost("stream-priv-a.near", round.id, "A's secret");
    await signedInPost("stream-priv-b.near", round.id, "B's secret");
    const anon = await getPluginClient();
    await anon.postFeedback({
      id: round.id,
      format: "written",
      body: "anon secret",
      anonymous: true,
    });

    // managers read everything, outsiders and logged-out callers read nothing
    const ownerView = await owner.listProjectFeedback({ slug: round.projectSlug });
    expect(ownerView.items.map((i) => i.body).sort()).toEqual([
      "A's secret",
      "B's secret",
      "anon secret",
    ]);
    expect((await anon.listProjectFeedback({ slug: round.projectSlug })).items).toEqual([]);
    const stranger = await getPluginClient(nearAuthedContext("stream-stranger.near"));
    expect((await stranger.listProjectFeedback({ slug: round.projectSlug })).items).toEqual([]);

    // an author sees just their own
    const a = await getPluginClient(nearAuthedContext("stream-priv-a.near"));
    expect(
      (await a.listProjectFeedback({ slug: round.projectSlug })).items.map((i) => i.body),
    ).toEqual(["A's secret"]);
  });

  it("hides rounds and projects that aren't public yet", async () => {
    const n = ++counter;
    const slug = `stream-pending-${n}`;
    const owner = await getPluginClient(
      nearAuthedContext(
        `stream-pending-owner-${n}.near`,
        `stream-pending-user-${n}`,
        `org-sp-${n}`,
        "owner",
      ),
    );
    const pending = await owner.createRound({
      projectSlug: slug,
      title: "Waiting",
      description: "Not approved yet.",
      formats: ["written"],
    });
    expect(pending.status).toBe("pending");

    const anon = await getPluginClient();
    await expect(anon.listProjectFeedback({ slug })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(owner.listProjectFeedback({ slug })).resolves.toMatchObject({ items: [] });
  });
});
