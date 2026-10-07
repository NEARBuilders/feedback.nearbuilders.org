import { describe, expect, it } from "vitest";
import { createOpenRound, joinWithFeedback } from "../fixtures";
import { adminContext, getPluginClient } from "../setup";

describe("updateRound settings (#116)", () => {
  it("changes the feedback formats and the readme", async () => {
    const { round, ownerClient } = await createOpenRound("tabs-owner1.near");

    const updated = await ownerClient.updateRound({
      id: round.id,
      formats: ["written", "recorded"],
      readme: "# Try checkout",
    });

    expect(updated).toMatchObject({ formats: ["written", "recorded"], readme: "# Try checkout" });
  });

  it("refuses the issues format on a round without a repo", async () => {
    const { round, ownerClient } = await createOpenRound("tabs-owner2.near");
    await expect(ownerClient.updateRound({ id: round.id, formats: ["issues"] })).rejects.toThrow(
      "repo URL",
    );
  });
});

describe("listParticipants feedback counts (#116)", () => {
  it("reports how much each participant posted", async () => {
    const { round, ownerClient } = await createOpenRound("tabs-owner3.near");
    await joinWithFeedback(round.id, "tabs-a3.near", ["one", "two"]);
    await joinWithFeedback(round.id, "tabs-b3.near");

    const participants = await ownerClient.listParticipants({ id: round.id });
    expect(participants.map((p) => [p.accountId, p.feedbackCount])).toEqual([
      ["tabs-a3.near", 2],
      ["tabs-b3.near", 0],
    ]);
  });
});

describe("site admins in the console (#116)", () => {
  it("can change round settings", async () => {
    const { round } = await createOpenRound("tabs-owner4.near");
    const admin = await getPluginClient(adminContext("tabs-admin4"));

    await expect(admin.updateRound({ id: round.id, readme: "From admin" })).resolves.toMatchObject({
      readme: "From admin",
    });
  });
});
