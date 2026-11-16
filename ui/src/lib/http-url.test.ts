import { describe, expect, it } from "vitest";
import { httpUrl } from "./http-url";

describe("httpUrl", () => {
  it("keeps http and https links", () => {
    expect(httpUrl("https://github.com/near/repo")).toBe("https://github.com/near/repo");
    expect(httpUrl("http://example.com/a")).toBe("http://example.com/a");
  });

  it("drops other schemes", () => {
    expect(httpUrl("javascript:alert(1)")).toBeNull();
    expect(httpUrl("data:text/html,<script>1</script>")).toBeNull();
    expect(httpUrl("ftp://example.com/file")).toBeNull();
  });

  it("drops empty and unparseable values", () => {
    expect(httpUrl(null)).toBeNull();
    expect(httpUrl(undefined)).toBeNull();
    expect(httpUrl("")).toBeNull();
    expect(httpUrl("not a url")).toBeNull();
  });
});
