import { describe, expect, it } from "vitest";
import {
  type ExportableFeedback,
  feedbackToCsv,
  feedbackToJson,
  filterFeedbackByStatus,
} from "./feedback-export";

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
  createdAt: "2026-10-02T00:00:00.000Z",
};

describe("feedbackToCsv", () => {
  it("writes a header and quotes cells containing commas, quotes and newlines", () => {
    const csv = feedbackToCsv([written, recorded]);
    expect(csv.split("\r\n")).toEqual([
      "id,author,format,content,status,createdAt",
      'f1,alice.near,written,"Said ""hi"",\nthen left",unresolved,2026-10-01T00:00:00.000Z',
      "f2,bob.near,recorded,https://example.com/r,resolved,2026-10-02T00:00:00.000Z",
    ]);
  });

  it("writes only the header for an empty selection", () => {
    expect(feedbackToCsv([])).toBe("id,author,format,content,status,createdAt");
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
        createdAt: "2026-10-01T00:00:00.000Z",
      },
      {
        id: "f2",
        author: "bob.near",
        format: "recorded",
        content: "https://example.com/r",
        status: "resolved",
        createdAt: "2026-10-02T00:00:00.000Z",
      },
    ]);
  });
});

describe("filterFeedbackByStatus", () => {
  it("returns everything for all and only the matching status otherwise", () => {
    expect(filterFeedbackByStatus([written, recorded], "all")).toHaveLength(2);
    expect(filterFeedbackByStatus([written, recorded], "resolved")).toEqual([recorded]);
    expect(filterFeedbackByStatus([written, recorded], "dismissed")).toEqual([]);
  });
});
