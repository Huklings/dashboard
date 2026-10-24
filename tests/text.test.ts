import { describe, expect, it } from "vitest";
import { decodeEntities, safeUrl, toPlainText, truncate } from "../fetcher/text";

describe("text helpers", () => {
  it("decodes numeric and common named entities, leaves unknown ones", () => {
    expect(decodeEntities("a &amp; b &#39;c&#x27; &hellip; &bogus; &#0; &#xD800;")).toBe("a & b 'c' … &bogus;  ");
  });

  it("strips tags, comments, scripts and styles", () => {
    expect(toPlainText("<p>Hi <!-- x --><style>p{}</style><script>alert(1)</script><b>there</b></p>")).toBe("Hi there");
    expect(toPlainText("&lt;img src=x onerror=alert(1)&gt;Safe")).toBe("Safe");
  });

  it("truncates on a word boundary", () => {
    expect(truncate("one two three four", 12)).toBe("one two…");
    expect(truncate("short", 12)).toBe("short");
  });

  it("only allows plain http(s) URLs", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("/b", "https://example.com/feed")).toBe("https://example.com/b");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl(" JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
    expect(safeUrl("https://user:pass@example.com")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
  });
});
