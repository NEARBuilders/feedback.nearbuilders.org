/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectRoundsTable } from "./project-rounds-table";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

const round = (id: string, projectRoundNumber: number, isPrivate: boolean) => ({
  id,
  ownerAccountId: "owner.near",
  title: `Round ${projectRoundNumber}`,
  status: "open" as const,
  projectRoundNumber,
  endsAt: null,
  isPrivate,
});

afterEach(cleanup);

describe("ProjectRoundsTable", () => {
  it("marks only the private rounds", () => {
    render(
      <ProjectRoundsTable
        projects={[
          {
            id: "p1",
            name: "Project",
            slug: "project",
            rounds: [round("r1", 1, true), round("r2", 2, false)],
          },
        ]}
      />,
    );

    expect(screen.getAllByTestId("rounds-table-private-mark")).toHaveLength(1);
  });
});
