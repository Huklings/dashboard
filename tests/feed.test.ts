import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFeed } from "../fetcher/feed";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("parseFeed", () => {
  it("parses RSS 2.0 into plain text and drops unsafe or untitled items", () => {
    const items = parseFeed(fixture("rss.xml"), "https://example.com/feed");
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      url: "https://example.com/news/1",
      title: "Critical CVE in Node.js & npm",
      summary: "A zero-day was patched.",
      publishedAt: "2026-10-23T10:00:00.000Z",
    });
    expect(items[1]).toMatchObject({
      url: "https://example.com/news/2",
      summary: "Escaped markup – and an em—dash",
      publishedAt: null,
    });
    expect(items.some((i) => i.url.startsWith("javascript:"))).toBe(false);
  });

  it("parses Atom and picks the alternate link", () => {
    const [entry] = parseFeed(fixture("atom.xml"), "https://example.org/feed");
    expect(entry).toEqual({
      url: "https://example.org/posts/1",
      title: "SpaceX launches new rocket",
      summary: "Launch went well.",
      publishedAt: "2026-10-22T08:30:00.000Z",
    });
  });

  it("parses RSS 1.0 (RDF)", () => {
    const items = parseFeed(fixture("rdf.xml"), "https://example.net/rss");
    expect(items).toEqual([{ url: "https://example.net/a", title: "RDF item", summary: "", publishedAt: "2026-10-20T12:00:00.000Z" }]);
  });

  it("refuses external entities (XXE)", () => {
    expect(() => parseFeed(fixture("xxe.xml"), "https://example.com/feed")).toThrow();
  });

  it("never expands internal entities (billion laughs)", () => {
    const [item] = parseFeed(fixture("lol.xml"), "https://example.com/feed");
    expect(item?.summary).toBe("&lol3;");
  });

  it("rejects documents that are not feeds", () => {
    expect(() => parseFeed("<html><body>nope</body></html>", "https://example.com")).toThrow("Not an RSS or Atom feed");
  });
});
