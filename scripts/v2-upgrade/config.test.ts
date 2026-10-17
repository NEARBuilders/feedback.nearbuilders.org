import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { checkConfig } from "./checks/config";
import { blockerMessages, warnMessages } from "./test-helpers";

const conformant = join(import.meta.dirname, "fixtures/conformant");
const nonconformant = join(import.meta.dirname, "fixtures/nonconformant");

describe("checkConfig", () => {
  it("passes the conformant fixture with no findings", async () => {
    const findings = await Effect.runPromise(checkConfig(conformant));
    expect(findings).toEqual([]);
  });

  it("blocks when extends is missing or not a bos:// ref", async () => {
    const findings = await Effect.runPromise(checkConfig(nonconformant));
    expect(blockerMessages(findings).join("\n")).toMatch(/"extends" must be a bos:\/\/ ref/);
  });

  it("warns on keys not mappable to the v2 surface", async () => {
    const findings = await Effect.runPromise(checkConfig(nonconformant));
    expect(warnMessages(findings).join("\n")).toMatch(/unknown top-level key "mysteryKey"/);
  });
});
