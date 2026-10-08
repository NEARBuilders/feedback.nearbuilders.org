import { describe, expect, it } from "vitest";
import {
  imageAltText,
  imageMarkdown,
  imageRejection,
  imagesStillInBody,
  insertAtSelection,
  MAX_IMAGE_BYTES,
  partitionImages,
} from "./image-upload";

const png = { name: "shot.png", type: "image/png", size: 1024 };

describe("imageRejection", () => {
  it("accepts the allowed image types up to the size limit", () => {
    expect(imageRejection(png)).toBeNull();
    expect(imageRejection({ ...png, type: "image/JPEG" })).toBeNull();
    expect(imageRejection({ ...png, size: MAX_IMAGE_BYTES })).toBeNull();
  });

  it("rejects other types and oversized files with a reason naming the file", () => {
    expect(imageRejection({ ...png, name: "notes.pdf", type: "application/pdf" })).toContain(
      "notes.pdf",
    );
    expect(imageRejection({ ...png, type: "image/svg+xml" })).not.toBeNull();
    expect(imageRejection({ ...png, size: MAX_IMAGE_BYTES + 1 })).toContain("5 MB");
    expect(imageRejection({ ...png, type: "" })).not.toBeNull();
  });
});

describe("partitionImages", () => {
  it("separates uploadable files from rejected ones", () => {
    const big = { ...png, name: "big.png", size: MAX_IMAGE_BYTES + 1 };
    const result = partitionImages([png, big]);
    expect(result.accepted).toEqual([png]);
    expect(result.rejected).toHaveLength(1);
  });
});

describe("image markdown", () => {
  it("builds an image link with a markdown-safe alt text", () => {
    expect(imageAltText("Login (error).png")).toBe("Login  error");
    expect(imageAltText(".png")).toBe("image");
    expect(imageMarkdown("shot.png", "https://cdn.test/a.png")).toBe(
      "![shot](https://cdn.test/a.png)",
    );
  });
});

describe("insertAtSelection", () => {
  it("puts the image on its own line at the caret", () => {
    expect(insertAtSelection("Looks off here", 14, 14, "![a](u)")).toEqual({
      text: "Looks off here\n![a](u)",
      caret: 22,
    });
    expect(insertAtSelection("", 0, 0, "![a](u)")).toEqual({ text: "![a](u)", caret: 7 });
  });

  it("replaces a selection and splits surrounding text onto separate lines", () => {
    const result = insertAtSelection("before TEXT after", 7, 11, "![a](u)");
    expect(result.text).toBe("before \n![a](u)\n after");
  });
});

describe("imagesStillInBody", () => {
  it("drops uploads whose markdown the writer deleted", () => {
    const a = { key: "a", url: "https://cdn.test/a.png" };
    const b = { key: "b", url: "https://cdn.test/b.png" };
    expect(imagesStillInBody("text ![x](https://cdn.test/a.png)", [a, b])).toEqual([a]);
  });
});
