import { describe, expect, it } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

let counter = 0;

async function openRound() {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`star-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `star-project-${n}`,
    title: `Star ${n}`,
    description: "Spot the standouts.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { n, round, owner };
}

async function post(account: string, roundId: string, body: string) {
  const client = await getPluginClient(nearAuthedContext(account));
  await client.joinRound({ id: roundId }).catch(() => undefined);
  return client.postFeedback({ id: roundId, format: "written", body });
}

describe("starring feedback (#104)", () => {
  it("lets managers star and unstar, independently of status", async () => {
    const { round, owner } = await openRound();
    const item = await post("star-t1.near", round.id, "Great find");
    expect(item.starredAt).toBeNull();

    const [starred] = await owner.setFeedbackStarred({
      id: round.id,
      feedbackIds: [item.id],
      starred: true,
    });
    expect(starred?.starredAt).toEqual(expect.any(String));
    expect(starred?.status).toBe("unresolved");

    await owner.setFeedbackStatus({ id: round.id, feedbackIds: [item.id], status: "resolved" });
    const afterResolve = (await owner.listFeedback({ id: round.id })).items[0];
    expect(afterResolve).toMatchObject({ status: "resolved" });
    expect(afterResolve?.starredAt).toEqual(expect.any(String));

    const [unstarred] = await owner.setFeedbackStarred({
      id: round.id,
      feedbackIds: [item.id],
      starred: false,
    });
    expect(unstarred?.starredAt).toBeNull();
    expect(unstarred?.status).toBe("resolved");
  });

  it("refuses non-managers and signed-out callers with FORBIDDEN/UNAUTHORIZED", async () => {
    const { round } = await openRound();
    const item = await post("star-t2.near", round.id, "Nice");

    const tester = await getPluginClient(nearAuthedContext("star-t2.near"));
    await expect(
      tester.setFeedbackStarred({ id: round.id, feedbackIds: [item.id], starred: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const anon = await getPluginClient();
    await expect(
      anon.setFeedbackStarred({ id: round.id, feedbackIds: [item.id], starred: true }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lets platform admins star, like they can resolve", async () => {
    const { round } = await openRound();
    const item = await post("star-t3.near", round.id, "Admin pick");
    const admin = await getPluginClient(adminContext());
    const [starred] = await admin.setFeedbackStarred({
      id: round.id,
      feedbackIds: [item.id],
      starred: true,
    });
    expect(starred?.starredAt).toEqual(expect.any(String));
  });

  it("only touches feedback inside the given round", async () => {
    const { round, owner } = await openRound();
    const other = await openRound();
    const foreign = await post("star-t4.near", other.round.id, "Elsewhere");
    const result = await owner.setFeedbackStarred({
      id: round.id,
      feedbackIds: [foreign.id],
      starred: true,
    });
    expect(result).toEqual([]);
    const untouched = (await other.owner.listFeedback({ id: other.round.id })).items[0];
    expect(untouched?.starredAt).toBeNull();
  });

  it("bulk-stars several submissions at once", async () => {
    const { round, owner } = await openRound();
    const a = await post("star-t5.near", round.id, "One");
    const b = await post("star-t5.near", round.id, "Two");
    const result = await owner.setFeedbackStarred({
      id: round.id,
      feedbackIds: [a.id, b.id],
      starred: true,
    });
    expect(result).toHaveLength(2);
  });

  it("filters listFeedback to starred submissions (#104)", async () => {
    const { round, owner } = await openRound();
    const a = await post("star-filter.near", round.id, "Starred one");
    await post("star-filter.near", round.id, "Plain one");
    await owner.setFeedbackStarred({ id: round.id, feedbackIds: [a.id], starred: true });

    const starred = await owner.listFeedback({ id: round.id, starred: true });
    expect(starred.items.map((f) => f.id)).toEqual([a.id]);
    const everything = await owner.listFeedback({ id: round.id });
    expect(everything.items).toHaveLength(2);
  });
});

describe("star anti-farming (#104)", () => {
  it("can't be self-farmed: the owning org's members can't join to star their own feedback", async () => {
    const { round } = await openRound();
    const insider = await getPluginClient(
      nearAuthedContext("star-insider.near", "star-insider-user", `org-of-${round.ownerAccountId}`),
    );
    await expect(insider.joinRound({ id: round.id })).rejects.toThrow("organization runs");
  });
});
