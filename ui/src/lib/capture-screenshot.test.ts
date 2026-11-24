import { afterEach, describe, expect, it, vi } from "vitest";
import { appendScreenshot, canCaptureScreen, captureScreenshot } from "./capture-screenshot";

afterEach(() => vi.unstubAllGlobals());

describe("appendScreenshot (#299)", () => {
  it("puts the image after the text", () => {
    expect(appendScreenshot("It broke", "https://cdn.example/a.png")).toBe(
      "It broke\n\n![Screenshot](https://cdn.example/a.png)\n",
    );
  });

  it("does not add a blank lead when the feedback is empty", () => {
    expect(appendScreenshot("", "https://cdn.example/a.png")).toBe(
      "![Screenshot](https://cdn.example/a.png)\n",
    );
  });
});

describe("captureScreenshot", () => {
  it("reports no support when the browser has no screen capture", () => {
    vi.stubGlobal("navigator", { mediaDevices: {} });
    expect(canCaptureScreen()).toBe(false);
  });

  it("returns nothing when the tester dismisses the picker", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: { getDisplayMedia: vi.fn().mockRejectedValue(new Error("NotAllowedError")) },
    });
    expect(canCaptureScreen()).toBe(true);
    expect(await captureScreenshot()).toBeNull();
  });
});
