import { describe, expect, it } from "vitest";
import { parseConfig } from "../fetcher/config";
import { createMatcher } from "../fetcher/match";

const config = parseConfig(`
spaces:
  work:
    - name: Security
      include: [CVE, zero-day]
      exclude: [webinar]
    - name: JS
      include: [Node.js, C++]
  hobby:
    - name: Space
      sources: [https://space.example/feed]
sources: [https://news.example/rss]
`);
const matcher = createMatcher(config);
const article = (title: string, source = "https://news.example/rss") => ({ title, summary: "", source });

describe("createMatcher", () => {
  it("matches whole words case-insensitively", () => {
    expect(matcher.topicsFor(article("New cve found"))).toEqual(["Security"]);
    expect(matcher.topicsFor(article("CVEs are up"))).toEqual([]);
    expect(matcher.topicsFor(article("Zero-day in Node.js"))).toEqual(["Security", "JS"]);
    expect(matcher.topicsFor(article("Modern C++ tips"))).toEqual(["JS"]);
  });

  it("applies exclude keywords", () => {
    expect(matcher.topicsFor(article("CVE webinar next week"))).toEqual([]);
  });

  it("routes pinned sources to their topic without keywords", () => {
    expect(matcher.topicsFor(article("Anything at all", "https://space.example/feed"))).toEqual(["Space"]);
  });
});

describe("parseConfig", () => {
  it("rejects duplicate topics, empty topics and non-http sources", () => {
    expect(() => parseConfig("spaces: {work: [{name: A, include: [x]}], hobby: [{name: a, include: [y]}]}")).toThrow(/Duplicate/);
    expect(() => parseConfig("spaces: {work: [{name: A}]}")).toThrow(/needs include keywords or sources/);
    expect(() => parseConfig("spaces: {work: []}\nsources: ['file:///etc/passwd']")).toThrow(/http/);
    expect(() => parseConfig("spaces: {work: []}\nsources: ['youtube:not-a-channel']")).toThrow(/http/);
  });

  it("expands youtube:<channel id> to the channel's video feed", () => {
    const cfg = parseConfig("spaces: {hobby: [{name: V, sources: ['youtube:UC0123456789abcdefghijkl']}]}");
    expect(cfg.spaces.hobby[0]?.sources).toEqual(["https://www.youtube.com/feeds/videos.xml?channel_id=UC0123456789abcdefghijkl"]);
  });
});
