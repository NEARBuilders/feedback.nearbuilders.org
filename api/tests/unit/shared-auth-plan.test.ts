import { describe, expect, it } from "vitest";
import { type AuthSnapshot, type ProjectRef, planRemap } from "../../scripts/shared-auth/plan";

const at = new Date("2026-01-01T00:00:00Z");

function snapshot(partial: Partial<AuthSnapshot> = {}): AuthSnapshot {
  return {
    users: [],
    nearAccounts: [],
    accounts: [],
    organizations: [],
    teams: [],
    members: [],
    teamMembers: [],
    apiKeys: [],
    sessionCount: 0,
    ...partial,
  };
}

const user = (id: string, email = `${id}@example.com`) => ({
  id,
  name: id,
  email,
  emailVerified: true,
  image: null,
  createdAt: at,
  updatedAt: at,
});
const near = (id: string, userId: string, accountId: string) => ({
  id,
  userId,
  accountId,
  network: "mainnet",
  publicKey: `ed25519:${id}`,
  isPrimary: true,
  createdAt: at,
});
const org = (id: string, slug: string) => ({
  id,
  name: slug,
  slug,
  logo: null,
  metadata: null,
  createdAt: at,
});
const team = (id: string, organizationId: string, name: string) => ({
  id,
  name,
  organizationId,
  metadata: null,
  createdAt: at,
  updatedAt: at,
});
const member = (id: string, organizationId: string, userId: string, role = "member") => ({
  id,
  organizationId,
  userId,
  role,
  createdAt: at,
});
const teamMember = (id: string, teamId: string, userId: string) => ({
  id,
  teamId,
  userId,
  createdAt: at,
});
const project = (
  slug: string,
  ownerOrgId: string | null,
  managingTeamId: string | null = null,
): ProjectRef => ({ id: `p_${slug}`, slug, ownerOrgId, managingTeamId });

describe("planRemap", () => {
  const source = snapshot({
    users: [user("fb_alice"), user("fb_bob")],
    nearAccounts: [near("fn_a", "fb_alice", "alice.near"), near("fn_b", "fb_bob", "bob.near")],
    organizations: [org("fb_acme", "acme")],
    teams: [team("fb_ops", "fb_acme", "Ops")],
    members: [member("fm_a", "fb_acme", "fb_alice", "owner"), member("fm_b", "fb_acme", "fb_bob")],
    teamMembers: [teamMember("ftm_b", "fb_ops", "fb_bob")],
  });

  it("maps orgs by slug, teams by name and users by NEAR account", () => {
    const target = snapshot({
      users: [user("nb_alice", "different@example.com"), user("nb_bob", "bob2@example.com")],
      nearAccounts: [near("nn_a", "nb_alice", "alice.near"), near("nn_b", "nb_bob", "BOB.near")],
      organizations: [org("nb_acme", "acme")],
      teams: [team("nb_ops", "nb_acme", " ops ")],
      members: [member("nm_a", "nb_acme", "nb_alice", "owner")],
    });

    const plan = planRemap(source, target, [project("acme-app", "fb_acme", "fb_ops")]);

    expect(plan.conflicts).toEqual([]);
    expect(plan.organizations[0]!.resolution).toEqual({ kind: "slug", targetId: "nb_acme" });
    expect(plan.teams[0]!.resolution).toEqual({ kind: "name", targetId: "nb_ops" });
    expect(plan.users.map((u) => u.resolution)).toEqual([
      { kind: "near-account", targetId: "nb_alice" },
      { kind: "near-account", targetId: "nb_bob" },
    ]);
    expect(plan.inserts.organizations).toEqual([]);
    expect(plan.inserts.users).toEqual([]);
    expect(plan.inserts.members).toEqual([
      expect.objectContaining({ organizationId: "nb_acme", userId: "nb_bob", role: "member" }),
    ]);
    expect(plan.inserts.teamMembers).toEqual([
      expect.objectContaining({ teamId: "nb_ops", userId: "nb_bob" }),
    ]);
    expect(plan.projectUpdates).toEqual([
      {
        projectId: "p_acme-app",
        slug: "acme-app",
        from: { ownerOrgId: "fb_acme", managingTeamId: "fb_ops" },
        to: { ownerOrgId: "nb_acme", managingTeamId: "nb_ops" },
      },
    ]);
  });

  it("copies orgs, teams and users with no shared counterpart, keeping their ids", () => {
    const plan = planRemap(source, snapshot(), [project("acme-app", "fb_acme", "fb_ops")]);

    expect(plan.conflicts).toEqual([]);
    expect(plan.inserts.organizations.map((o) => o.id)).toEqual(["fb_acme"]);
    expect(plan.inserts.teams).toEqual([
      expect.objectContaining({ id: "fb_ops", organizationId: "fb_acme" }),
    ]);
    expect(plan.inserts.users.map((u) => u.id)).toEqual(["fb_alice", "fb_bob"]);
    expect(plan.inserts.nearAccounts.map((a) => a.id)).toEqual(["fn_a", "fn_b"]);
    expect(plan.inserts.members).toHaveLength(2);
    expect(plan.inserts.teamMembers).toHaveLength(1);
    expect(plan.projectUpdates).toEqual([]);
  });

  it("falls back to email when no NEAR account matches", () => {
    const target = snapshot({ users: [user("nb_alice", "FB_ALICE@example.com")] });
    const plan = planRemap(source, target, [project("acme-app", "fb_acme")]);
    expect(plan.users[0]!.resolution).toEqual({ kind: "email", targetId: "nb_alice" });
  });

  it("is a no-op once projects already point at shared ids", () => {
    const target = snapshot({
      organizations: [org("nb_acme", "acme")],
      teams: [team("nb_ops", "nb_acme", "Ops")],
    });
    const plan = planRemap(source, target, [project("acme-app", "nb_acme", "nb_ops")]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.organizations).toEqual([]);
    expect(plan.projectUpdates).toEqual([]);
  });

  it("keeps the shared role when a membership already exists and reports the difference", () => {
    const target = snapshot({
      users: [user("nb_alice")],
      nearAccounts: [near("nn_a", "nb_alice", "alice.near")],
      organizations: [org("nb_acme", "acme")],
      members: [member("nm_a", "nb_acme", "nb_alice", "admin")],
    });
    const plan = planRemap(source, target, [project("acme-app", "fb_acme")]);
    expect(plan.roleDifferences).toEqual([
      { organizationId: "nb_acme", userId: "nb_alice", sourceRole: "owner", targetRole: "admin" },
    ]);
    expect(plan.inserts.members.some((m) => m.userId === "nb_alice")).toBe(false);
  });

  it("honours overrides and rejects ones that point nowhere", () => {
    const target = snapshot({
      organizations: [org("nb_acme_inc", "acme-inc")],
      teams: [team("nb_operations", "nb_acme_inc", "Operations")],
    });
    const plan = planRemap(source, target, [project("acme-app", "fb_acme", "fb_ops")], {
      organizations: { fb_acme: "nb_acme_inc" },
      teams: { fb_ops: "nb_operations" },
    });
    expect(plan.conflicts).toEqual([]);
    expect(plan.projectUpdates[0]!.to).toEqual({
      ownerOrgId: "nb_acme_inc",
      managingTeamId: "nb_operations",
    });

    const bad = planRemap(source, target, [project("acme-app", "fb_acme")], {
      organizations: { fb_acme: "missing" },
    });
    expect(bad.conflicts).toEqual([
      "Override maps org fb_acme to missing, which is not in the shared DB",
    ]);
  });

  it("refuses ambiguous team names", () => {
    const target = snapshot({
      organizations: [org("nb_acme", "acme")],
      teams: [team("nb_ops1", "nb_acme", "Ops"), team("nb_ops2", "nb_acme", "ops")],
    });
    const plan = planRemap(source, target, [project("acme-app", "fb_acme", "fb_ops")]);
    expect(plan.conflicts).toEqual([
      'Team "Ops" (fb_ops) matches 2 teams in shared org nb_acme; add an override',
    ]);
    expect(plan.projectUpdates).toEqual([]);
  });

  it("refuses a user whose NEAR accounts belong to different shared users", () => {
    const split = snapshot({
      ...source,
      nearAccounts: [...source.nearAccounts, near("fn_a2", "fb_alice", "alice2.near")],
    });
    const target = snapshot({
      users: [user("nb_1"), user("nb_2")],
      nearAccounts: [near("n1", "nb_1", "alice.near"), near("n2", "nb_2", "alice2.near")],
    });
    const plan = planRemap(split, target, [project("acme-app", "fb_acme")]);
    expect(plan.conflicts).toEqual([
      "User fb_alice's NEAR accounts belong to 2 different shared users: nb_1, nb_2",
    ]);
  });

  it("flags projects whose org exists in neither auth DB", () => {
    const plan = planRemap(source, snapshot(), [project("ghost", "org_gone")]);
    expect(plan.conflicts).toEqual([
      "Project ghost is owned by org org_gone, which is in neither auth DB",
    ]);
  });

  it("lists feedback API keys and live sessions that will not carry over", () => {
    const withKeys = snapshot({
      ...source,
      apiKeys: [{ id: "k1", name: "ci", referenceId: "fb_acme" }],
      sessionCount: 3,
    });
    const plan = planRemap(withKeys, snapshot(), []);
    expect(plan.apiKeysToReissue).toEqual([{ id: "k1", name: "ci", referenceId: "fb_acme" }]);
    expect(plan.sessionsDropped).toBe(3);
  });
});
