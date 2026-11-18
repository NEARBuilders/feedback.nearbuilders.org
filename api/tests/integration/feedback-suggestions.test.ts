import { beforeEach, describe, expect, it } from "vitest";
import {
  adminContext,
  authListTeamMembers,
  authListTeams,
  getPluginClient,
  nearAuthedContext,
} from "../setup";

let counter = 0;

/** What the host builds for an `org_…` key: an api key, an organization principal, no user. */
function orgKeyContext(organizationId: string): Record<string, unknown> {
  return {
    authType: "apiKey",
    apiKey: { id: `key-${organizationId}`, name: "org key", permissions: null },
    principal: { type: "organization", organizationId },
    organization: { activeOrganizationId: organizationId, organization: null },
    near: { primaryAccountId: null, linkedAccounts: [], hasNearAccount: false },
  };
}

async function roundWithFeedback() {
  const n = ++counter;
  const orgId = `sugg-org-${n}`;
  const owner = await getPluginClient(
    nearAuthedContext(`sugg-owner-${n}.near`, `sugg-owner-user-${n}`, orgId, "owner"),
  );
  const round = await owner.createRound({
    projectSlug: `sugg-project-${n}`,
    title: `Suggestions ${n}`,
    description: "Agents suggest, people decide.",
    formats: ["written"],
    isPrivate: true,
  });
  const admin = await getPluginClient(adminContext());
  if (round.status !== "open") await admin.approveProject({ id: round.projectRecordId });

  const tester = await getPluginClient(nearAuthedContext(`sugg-tester-${n}.near`));
  await tester.joinRound({ id: round.id });
  const feedback = await tester.postFeedback({
    id: round.id,
    format: "written",
    body: "The button does nothing",
  });
  const second = await tester.postFeedback({
    id: round.id,
    format: "written",
    body: "Love the colors",
  });
  return { orgId, owner, round, feedback, second };
}

beforeEach(() => {
  authListTeams.mockReset();
  authListTeamMembers.mockReset();
  authListTeams.mockResolvedValue([{ id: "team-a" }]);
  authListTeamMembers.mockResolvedValue([]);
});

describe("organization keys suggest, people decide (#296)", () => {
  it("lets an org key suggest a status and a star without changing the feedback", async () => {
    const { orgId, round, feedback } = await roundWithFeedback();
    const key = await getPluginClient(orgKeyContext(orgId));

    const saved = await key.suggestFeedback({
      id: round.id,
      suggestions: [
        { feedbackId: feedback.id, status: "dismissed", star: true, note: "Duplicate" },
      ],
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      feedbackId: feedback.id,
      status: "dismissed",
      star: true,
      note: "Duplicate",
      suggestedByKeyId: `key-${orgId}`,
    });

    const { items } = await key.listFeedback({ id: round.id });
    const item = items.find((f) => f.id === feedback.id);
    expect(item).toMatchObject({ status: "unresolved", starredAt: null });
  });

  it("keeps the real status and star routes closed to org keys", async () => {
    const { orgId, round, feedback } = await roundWithFeedback();
    const key = await getPluginClient(orgKeyContext(orgId));

    await expect(
      key.setFeedbackStatus({ id: round.id, feedbackIds: [feedback.id], status: "resolved" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      key.setFeedbackStarred({ id: round.id, feedbackIds: [feedback.id], starred: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a suggestion from a signed-in owner, who can act directly", async () => {
    const { owner, round, feedback } = await roundWithFeedback();
    await expect(
      owner.suggestFeedback({
        id: round.id,
        suggestions: [{ feedbackId: feedback.id, status: "resolved" }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a key from another organization", async () => {
    const { round, feedback } = await roundWithFeedback();
    const other = await getPluginClient(orgKeyContext("someone-elses-org"));
    await expect(
      other.suggestFeedback({
        id: round.id,
        suggestions: [{ feedbackId: feedback.id, status: "resolved" }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects feedback that belongs to a different round", async () => {
    const first = await roundWithFeedback();
    const second = await roundWithFeedback();
    const key = await getPluginClient(orgKeyContext(first.orgId));
    await expect(
      key.suggestFeedback({
        id: first.round.id,
        suggestions: [{ feedbackId: second.feedback.id, status: "resolved" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("needs a status or a star", async () => {
    const { orgId, round, feedback } = await roundWithFeedback();
    const key = await getPluginClient(orgKeyContext(orgId));
    await expect(
      key.suggestFeedback({ id: round.id, suggestions: [{ feedbackId: feedback.id }] }),
    ).rejects.toBeTruthy();
  });

  it("replaces an earlier suggestion on the same item", async () => {
    const { orgId, round, feedback } = await roundWithFeedback();
    const key = await getPluginClient(orgKeyContext(orgId));
    await key.suggestFeedback({
      id: round.id,
      suggestions: [{ feedbackId: feedback.id, status: "dismissed" }],
    });
    await key.suggestFeedback({
      id: round.id,
      suggestions: [{ feedbackId: feedback.id, status: "resolved" }],
    });
    const listed = await key.listFeedbackSuggestions({ id: round.id });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ status: "resolved" });
  });

  it("shows suggestions to the owner, who can reject them; the key can't", async () => {
    const { orgId, owner, round, feedback, second } = await roundWithFeedback();
    const key = await getPluginClient(orgKeyContext(orgId));
    await key.suggestFeedback({
      id: round.id,
      suggestions: [
        { feedbackId: feedback.id, status: "resolved" },
        { feedbackId: second.id, star: true },
      ],
    });

    expect(
      (await owner.listFeedbackSuggestions({ id: round.id })).map((s) => s.feedbackId).sort(),
    ).toEqual([feedback.id, second.id].sort());

    await expect(
      key.clearFeedbackSuggestions({ id: round.id, feedbackIds: [feedback.id] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(
      await owner.clearFeedbackSuggestions({ id: round.id, feedbackIds: [feedback.id] }),
    ).toEqual({ cleared: 1 });
    const left = await owner.listFeedbackSuggestions({ id: round.id });
    expect(left.map((s) => s.feedbackId)).toEqual([second.id]);
  });

  it("drops a status suggestion once the owner has resolved the item", async () => {
    const { orgId, owner, round, feedback } = await roundWithFeedback();
    const key = await getPluginClient(orgKeyContext(orgId));
    await key.suggestFeedback({
      id: round.id,
      suggestions: [{ feedbackId: feedback.id, status: "dismissed" }],
    });
    expect(await owner.listFeedbackSuggestions({ id: round.id })).toHaveLength(1);

    await owner.setFeedbackStatus({
      id: round.id,
      feedbackIds: [feedback.id],
      status: "resolved",
    });
    expect(await owner.listFeedbackSuggestions({ id: round.id })).toEqual([]);
  });

  it("hides suggestions from someone with no access to the round", async () => {
    const { orgId, round, feedback } = await roundWithFeedback();
    const key = await getPluginClient(orgKeyContext(orgId));
    await key.suggestFeedback({
      id: round.id,
      suggestions: [{ feedbackId: feedback.id, status: "resolved" }],
    });
    const stranger = await getPluginClient(nearAuthedContext("sugg-stranger.near"));
    await expect(stranger.listFeedbackSuggestions({ id: round.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
