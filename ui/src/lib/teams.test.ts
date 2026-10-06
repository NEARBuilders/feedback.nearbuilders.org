import { describe, expect, it } from "vitest";
import {
  delegationOptions,
  describeDelegation,
  isValidTeamName,
  labelForUser,
  memberLabel,
  normalizeTeamName,
  projectsDelegatedTo,
  TEAM_NAME_MAX,
  teamMemberCandidates,
} from "./teams";

const members = [
  { userId: "u1", user: { name: "Zoe", email: "zoe@example.com" } },
  { userId: "u2", user: { name: "", email: "adam@example.com" } },
  { userId: "u3", user: null },
  { userId: "u4", user: { name: "Bea", email: "bea@example.com" } },
];

describe("team names", () => {
  it("collapses whitespace and rejects blank or oversized names", () => {
    expect(normalizeTeamName("  Core   team ")).toBe("Core team");
    expect(isValidTeamName("Core team")).toBe(true);
    expect(isValidTeamName("   ")).toBe(false);
    expect(isValidTeamName("a".repeat(TEAM_NAME_MAX))).toBe(true);
    expect(isValidTeamName("a".repeat(TEAM_NAME_MAX + 1))).toBe(false);
  });
});

describe("memberLabel", () => {
  it("prefers the name, then the email, then the user id", () => {
    expect(memberLabel(members[0] ?? { userId: "" })).toBe("Zoe");
    expect(memberLabel(members[1] ?? { userId: "" })).toBe("adam@example.com");
    expect(memberLabel(members[2] ?? { userId: "" })).toBe("u3");
  });

  it("looks a label up by user id and falls back to the id", () => {
    expect(labelForUser(members, "u4")).toBe("Bea");
    expect(labelForUser(members, "ghost")).toBe("ghost");
  });
});

describe("teamMemberCandidates", () => {
  it("offers only org members who are not on the team, sorted by label", () => {
    expect(teamMemberCandidates(members, ["u1"])).toEqual([
      { userId: "u2", label: "adam@example.com" },
      { userId: "u4", label: "Bea" },
      { userId: "u3", label: "u3" },
    ]);
  });

  it("offers everyone for an empty team and no one when everyone is on it", () => {
    expect(teamMemberCandidates(members, [])).toHaveLength(4);
    expect(teamMemberCandidates(members, ["u1", "u2", "u3", "u4"])).toEqual([]);
  });
});

describe("describeDelegation", () => {
  const teams = [{ id: "t1", name: "Core" }];

  it("names the managing team, or says any member can manage", () => {
    expect(describeDelegation(teams, null)).toBe("Any organization member");
    expect(describeDelegation(teams, "t1")).toBe("Core");
    expect(describeDelegation(teams, "gone")).toBe("Unknown team");
  });
});

describe("delegationOptions", () => {
  const teams = [
    { id: "t1", name: "Core" },
    { id: "t2", name: "Docs" },
  ];

  it("offers any member plus each team", () => {
    expect(delegationOptions(teams, null)).toEqual([
      { value: "", label: "Any organization member" },
      { value: "t1", label: "Core" },
      { value: "t2", label: "Docs" },
    ]);
    expect(delegationOptions(teams, "t2")).toHaveLength(3);
  });

  it("keeps a delegation to a deleted team visible instead of hiding it", () => {
    const options = delegationOptions(teams, "gone");
    expect(options).toHaveLength(4);
    expect(options[3]).toEqual({ value: "gone", label: "Deleted team (only owners and admins)" });
  });
});

describe("projectsDelegatedTo", () => {
  it("finds the projects a team manages", () => {
    const projects = [
      { id: "a", managingTeamId: "t1" },
      { id: "b", managingTeamId: null },
      { id: "c", managingTeamId: "t1" },
      { id: "d", managingTeamId: "t2" },
    ];
    expect(projectsDelegatedTo(projects, "t1").map((p) => p.id)).toEqual(["a", "c"]);
    expect(projectsDelegatedTo(projects, "none")).toEqual([]);
  });
});
