import { describe, expect, it } from "vitest";
import { type ExportableFeedback, feedbackToCsv, feedbackToJson } from "./feedback-export";

const written: ExportableFeedback = {
  id: "f1",
  authorAccountId: "alice.near",
  format: "written",
  body: 'Said "hi",\nthen left',
  url: null,
  status: "unresolved",
  createdAt: "2026-10-01T00:00:00.000Z",
};

const recorded: ExportableFeedback = {
  id: "f2",
  authorAccountId: "bob.near",
  format: "recorded",
  body: null,
  url: "https://example.com/r",
  status: "resolved",
  starredAt: "2026-10-03T00:00:00.000Z",
  createdAt: "2026-10-02T00:00:00.000Z",
};

describe("feedbackToCsv", () => {
  it("writes a header and quotes cells containing commas, quotes and newlines", () => {
    const csv = feedbackToCsv([written, recorded]);
    expect(csv.split("\r\n")).toEqual([
      "id,author,format,content,status,starred,createdAt",
      'f1,alice.near,written,"Said ""hi"",\nthen left",unresolved,no,2026-10-01T00:00:00.000Z',
      "f2,bob.near,recorded,https://example.com/r,resolved,yes,2026-10-02T00:00:00.000Z",
    ]);
  });

  it("writes only the header for an empty selection", () => {
    expect(feedbackToCsv([])).toBe("id,author,format,content,status,starred,createdAt");
  });
});

describe("feedbackToJson", () => {
  it("exports content from the body for written and the url for recorded", () => {
    expect(JSON.parse(feedbackToJson([written, recorded]))).toEqual([
      {
        id: "f1",
        author: "alice.near",
        format: "written",
        content: 'Said "hi",\nthen left',
        status: "unresolved",
        starred: false,
        createdAt: "2026-10-01T00:00:00.000Z",
      },
      {
        id: "f2",
        author: "bob.near",
        format: "recorded",
        content: "https://example.com/r",
        status: "resolved",
        starred: true,
        createdAt: "2026-10-02T00:00:00.000Z",
      },
    ]);
  });
});

describe("anonymous feedback (#89)", () => {
  const anonymous: ExportableFeedback = {
    id: "f3",
    authorAccountId: null,
    format: "written",
    body: "No name",
    url: null,
    status: "unresolved",
    starredAt: null,
    createdAt: "2026-10-03T00:00:00.000Z",
  };

  it("exports anonymous authors as 'Anonymous'", () => {
    expect(feedbackToCsv([anonymous]).split("\r\n")[1]).toBe(
      "f3,Anonymous,written,No name,unresolved,no,2026-10-03T00:00:00.000Z",
    );
    expect(JSON.parse(feedbackToJson([anonymous]))[0].author).toBe("Anonymous");
  });
});
