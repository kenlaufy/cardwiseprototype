import { describe, it, expect } from "vitest";
import { publicSupportUrl } from "./support";
describe("public support destination", () => {
  it("accepts an HTTPS help page or a plain email destination", () => {
    expect(publicSupportUrl("https://example.org/help")).toBe("https://example.org/help");
    expect(publicSupportUrl("mailto:help@example.org")).toBe("mailto:help@example.org");
  });
  it("does not publish an unsafe or missing destination", () => {
    for (const value of [
      undefined,
      "",
      "javascript:alert(1)",
      "http://example.org",
      "https://user:password@example.org",
      "mailto:help@example.org?body=private",
    ]) {
      expect(publicSupportUrl(value)).toBeNull();
    }
  });
});
