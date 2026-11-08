/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoundListPrivateMark } from "./rounds-table";

describe("RoundListPrivateMark", () => {
  it("shows the lock mark for a private row", () => {
    render(<RoundListPrivateMark isPrivate />);

    const mark = screen.getByTestId("rounds-table-private-mark");
    expect(mark.getAttribute("title")).toBe("Private feedback");
    expect(screen.getByText("Private feedback").className).toContain("sr-only");
  });

  it("hides the lock mark for a non-private row", () => {
    render(<RoundListPrivateMark isPrivate={false} />);

    expect(screen.queryByTestId("rounds-table-private-mark")).toBeNull();
  });
});
