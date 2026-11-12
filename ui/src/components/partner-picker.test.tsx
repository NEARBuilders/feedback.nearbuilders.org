/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PartnerPicker } from "./partner-picker";

const suggestions = [
  { slug: "nearlegion", name: "NearLegion", active: true },
  { slug: "pending-org", name: "Pending Org", active: false },
];

afterEach(cleanup);

describe("PartnerPicker", () => {
  it("renders nothing when there are no suggestions", () => {
    render(<PartnerPicker suggestions={[]} uncheckedSlugs={new Set()} onToggle={vi.fn()} />);

    expect(screen.queryByTestId("partner-picker")).toBeNull();
  });

  it("starts every active suggestion checked, inactive ones disabled", () => {
    render(
      <PartnerPicker suggestions={suggestions} uncheckedSlugs={new Set()} onToggle={vi.fn()} />,
    );

    const nearlegion = screen.getByTestId("partner-picker-checkbox-nearlegion");
    expect((nearlegion as HTMLInputElement).checked).toBe(true);
    const pending = screen.getByTestId("partner-picker-checkbox-pending-org");
    expect((pending as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("NearLegion")).toBeTruthy();
    expect(screen.getByText("(not approved yet)")).toBeTruthy();
  });

  it("toggles a suggestion off and back on", () => {
    const onToggle = vi.fn();
    const { unmount } = render(
      <PartnerPicker suggestions={suggestions} uncheckedSlugs={new Set()} onToggle={onToggle} />,
    );

    fireEvent.click(screen.getByTestId("partner-picker-checkbox-nearlegion"));
    expect(onToggle).toHaveBeenCalledWith("nearlegion");
    unmount();

    render(
      <PartnerPicker
        suggestions={suggestions}
        uncheckedSlugs={new Set(["nearlegion"])}
        onToggle={onToggle}
      />,
    );
    expect(
      (screen.getByTestId("partner-picker-checkbox-nearlegion") as HTMLInputElement).checked,
    ).toBe(false);
  });
});
