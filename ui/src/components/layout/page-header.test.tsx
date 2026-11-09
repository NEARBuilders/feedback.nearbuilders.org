/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("PageHeader description", () => {
  it("keeps the line breaks the author typed", () => {
    render(<PageHeader title="Round" description={"Try signup\nTry checkout\nTry refunds"} />);

    const description = screen.getByText(/Try signup/);
    expect(description.className).toContain("whitespace-pre-line");
    expect(description.textContent).toBe("Try signup\nTry checkout\nTry refunds");
  });
});
