import { describe, expect, it } from "vitest";
import { projectIdMismatchesRegistry } from "@/services/project-id";

describe("projectIdMismatchesRegistry", () => {
  it("accepts an id that matches the registry", () => {
    expect(projectIdMismatchesRegistry({ id: "proj_1" }, "proj_1")).toBe(false);
  });
  it("rejects an id that differs from the registry's", () => {
    expect(projectIdMismatchesRegistry({ id: "proj_1" }, "proj_2")).toBe(true);
  });
  it("does not block when the registry has no entry or is unreachable", () => {
    expect(projectIdMismatchesRegistry(null, "proj_2")).toBe(false);
  });
  it("does not block when no id was sent", () => {
    expect(projectIdMismatchesRegistry({ id: "proj_1" }, null)).toBe(false);
    expect(projectIdMismatchesRegistry({ id: "proj_1" }, undefined)).toBe(false);
  });
});
