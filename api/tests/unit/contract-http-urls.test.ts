import { describe, expect, it } from "vitest";
import { contract, HttpUrlSchema } from "@/contract";

type Route = { "~orpc": { inputSchemas?: readonly unknown[] } };

function accepts(route: Route, input: unknown): boolean {
  const schema = route["~orpc"].inputSchemas?.[0] as
    | { safeParse(value: unknown): { success: boolean } }
    | undefined;
  return schema ? schema.safeParse(input).success : false;
}

const BAD_URLS = [
  "javascript:alert(1)",
  "data:text/html,<script>1</script>",
  "ftp://example.com/x",
];
const GOOD_URLS = ["https://github.com/near/feedback", "http://example.com/recording"];

const createRound = {
  projectSlug: "my-project",
  title: "Try the onboarding flow",
  description: "Please test it",
  formats: ["written"],
};

describe("HttpUrlSchema", () => {
  it("accepts http and https links", () => {
    for (const url of GOOD_URLS) expect(HttpUrlSchema.safeParse(url).success).toBe(true);
  });

  it("rejects other schemes and non-URLs", () => {
    for (const url of [...BAD_URLS, "not a url", ""]) {
      expect(HttpUrlSchema.safeParse(url).success).toBe(false);
    }
  });
});

describe("URL fields only take http(s) links", () => {
  it.each(BAD_URLS)("rejects %s on repoUrl, bannerUrl and feedback url", (url) => {
    expect(accepts(contract.createRound, { ...createRound, repoUrl: url })).toBe(false);
    expect(accepts(contract.createRound, { ...createRound, bannerUrl: url })).toBe(false);
    expect(accepts(contract.updateRound, { id: "round-1", bannerUrl: url })).toBe(false);
    expect(accepts(contract.postFeedback, { id: "round-1", format: "recorded", url })).toBe(false);
    expect(
      accepts(contract.editFeedback, {
        id: "round-1",
        feedbackId: "11111111-1111-4111-8111-111111111111",
        url,
      }),
    ).toBe(false);
  });

  it.each(GOOD_URLS)("accepts %s on repoUrl, bannerUrl and feedback url", (url) => {
    expect(accepts(contract.createRound, { ...createRound, repoUrl: url })).toBe(true);
    expect(accepts(contract.createRound, { ...createRound, bannerUrl: url })).toBe(true);
    expect(accepts(contract.updateRound, { id: "round-1", bannerUrl: url })).toBe(true);
    expect(accepts(contract.postFeedback, { id: "round-1", format: "recorded", url })).toBe(true);
    expect(
      accepts(contract.editFeedback, {
        id: "round-1",
        feedbackId: "11111111-1111-4111-8111-111111111111",
        url,
      }),
    ).toBe(true);
  });

  it("still lets a banner be removed with null", () => {
    expect(accepts(contract.updateRound, { id: "round-1", bannerUrl: null })).toBe(true);
  });
});
