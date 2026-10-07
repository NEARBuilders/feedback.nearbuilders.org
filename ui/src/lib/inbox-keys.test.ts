import { describe, expect, it } from "vitest";
import { inboxKeyAction } from "./inbox-keys";

const IDS = ["a", "b", "c"];

describe("inboxKeyAction", () => {
  it("moves down with j and up with k", () => {
    expect(inboxKeyAction("j", IDS, "a")).toEqual({ type: "open", id: "b" });
    expect(inboxKeyAction("k", IDS, "b")).toEqual({ type: "open", id: "a" });
  });

  it("starts at the first item when nothing is open", () => {
    expect(inboxKeyAction("j", IDS, undefined)).toEqual({ type: "open", id: "a" });
    expect(inboxKeyAction("k", IDS, undefined)).toEqual({ type: "open", id: "a" });
  });

  it("stays put at either end of the list", () => {
    expect(inboxKeyAction("j", IDS, "c")).toBeNull();
    expect(inboxKeyAction("k", IDS, "a")).toBeNull();
  });

  it("resolves with r and dismisses with d the open item", () => {
    expect(inboxKeyAction("r", IDS, "b")).toEqual({ type: "status", id: "b", status: "resolved" });
    expect(inboxKeyAction("d", IDS, "b")).toEqual({ type: "status", id: "b", status: "dismissed" });
  });

  it("stars with s and unstars with u the open item (#104)", () => {
    expect(inboxKeyAction("s", IDS, "b")).toEqual({ type: "star", id: "b", starred: true });
    expect(inboxKeyAction("u", IDS, "b")).toEqual({ type: "star", id: "b", starred: false });
  });

  it("ignores triage keys with nothing open, and unknown keys", () => {
    expect(inboxKeyAction("r", IDS, undefined)).toBeNull();
    expect(inboxKeyAction("s", IDS, undefined)).toBeNull();
    expect(inboxKeyAction("u", IDS, undefined)).toBeNull();
    expect(inboxKeyAction("x", IDS, "a")).toBeNull();
    expect(inboxKeyAction("j", [], undefined)).toBeNull();
  });
});
