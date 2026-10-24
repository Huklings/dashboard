import { describe, expect, it } from "vitest";
import type { Article } from "../shared/articles";
import { mergeArticles } from "../fetcher/merge";

const now = new Date("2026-10-24T12:00:00Z");
const make = (url: string, publishedAt: string, extra: Partial<Article> = {}): Article => ({
  url,
  title: url,
  summary: "",
  source: "https://feed.example/rss",
  publishedAt,
  fetchedAt: "2026-10-24T12:00:00.000Z",
  topics: ["T"],
  kind: "article",
  ...extra,
});
const opts = { now, maxAgeDays: 30, maxItems: 100, sources: new Set(["https://feed.example/rss"]) };

describe("mergeArticles", () => {
  it("dedupes by URL, keeps first-seen fetchedAt, and sorts newest first", () => {
    const previous = [make("a", "2026-10-20T00:00:00Z", { fetchedAt: "2026-10-20T01:00:00Z", title: "old" })];
    const fresh = [make("a", "2026-10-20T00:00:00Z", { title: "new" }), make("b", "2026-10-23T00:00:00Z")];
    const merged = mergeArticles(previous, fresh, opts);
    expect(merged.map((a) => a.url)).toEqual(["b", "a"]);
    expect(merged[1]).toMatchObject({ title: "new", fetchedAt: "2026-10-20T01:00:00Z" });
  });

  it("drops old and untagged articles and caps the count", () => {
    const merged = mergeArticles([], [make("old", "2026-09-01T00:00:00Z"), make("untagged", "2026-10-23T00:00:00Z", { topics: [] })], opts);
    expect(merged).toEqual([]);
    const many = Array.from({ length: 5 }, (_, i) => make(`u${i}`, `2026-10-2${i}T00:00:00Z`));
    expect(mergeArticles([], many, { ...opts, maxItems: 2 }).map((a) => a.url)).toEqual(["u4", "u3"]);
  });

  it("clamps publish dates far in the future to fetch time", () => {
    const [a] = mergeArticles([], [make("f", "2030-01-01T00:00:00Z")], opts);
    expect(a?.publishedAt).toBe("2026-10-24T12:00:00.000Z");
  });

  it("drops previous articles from sources no longer in the config", () => {
    const previous = [make("gone", "2026-10-22T00:00:00Z", { source: "https://removed.example/rss" }), make("kept", "2026-10-21T00:00:00Z")];
    expect(mergeArticles(previous, [], opts).map((a) => a.url)).toEqual(["kept"]);
  });
});
