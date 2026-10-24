import { XMLParser } from "fast-xml-parser";
import { safeUrl, toPlainText, truncate } from "./text";

export interface FeedItem {
  url: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  kind: "article" | "video";
  thumbnail?: string;
}

const TITLE_MAX = 300;
const SUMMARY_MAX = 400;

// Entity processing is off: DOCTYPE entities are never expanded, which rules
// out XXE and entity-expansion bombs. Standard entities are decoded later by
// decodeEntities, on plain strings.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  trimValues: true,
  isArray: (name) => name === "item" || name === "entry" || name === "link",
});

type Node = unknown;

function textOf(node: Node): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return textOf(node[0]);
  if (node && typeof node === "object" && "#text" in node) return textOf((node as Record<string, Node>)["#text"]);
  return "";
}

function field(obj: Record<string, Node>, ...names: string[]): string {
  for (const name of names) {
    const value = textOf(obj[name]);
    if (value) return value;
  }
  return "";
}

function toIsoDate(value: string): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function rssLink(item: Record<string, Node>): string {
  const links = Array.isArray(item.link) ? item.link : [];
  for (const link of links) {
    if (typeof link === "string" && link) return link;
    if (link && typeof link === "object") {
      const rec = link as Record<string, Node>;
      const href = textOf(rec["@_href"]) || textOf(rec["#text"]);
      if (href) return href;
    }
  }
  return field(item, "guid");
}

function atomLink(entry: Record<string, Node>): string {
  const links = (Array.isArray(entry.link) ? entry.link : []) as Record<string, Node>[];
  const alternate = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
  return alternate ? textOf(alternate["@_href"]) : "";
}

function asRecords(value: Node): Record<string, Node>[] {
  return Array.isArray(value) ? value.filter((v): v is Record<string, Node> => !!v && typeof v === "object") : [];
}

function build(rawUrl: string, rawTitle: string, rawSummary: string, rawDate: string, feedUrl: string): FeedItem | null {
  const url = safeUrl(rawUrl, feedUrl);
  const title = truncate(toPlainText(rawTitle), TITLE_MAX);
  if (!url || !title) return null;
  return {
    url,
    title,
    summary: truncate(toPlainText(rawSummary), SUMMARY_MAX),
    publishedAt: toIsoDate(rawDate),
    kind: "article",
  };
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** YouTube channel feeds are Atom with a yt:videoId and the description under media:group. */
function youtubeEntry(entry: Record<string, Node>, feedUrl: string): FeedItem | null {
  const videoId = textOf(entry["yt:videoId"]);
  if (!YOUTUBE_VIDEO_ID.test(videoId)) return null;
  const media = (entry["media:group"] ?? {}) as Record<string, Node>;
  const item = build(
    `https://www.youtube.com/watch?v=${videoId}`,
    field(entry, "title") || field(media, "media:title"),
    field(media, "media:description"),
    field(entry, "published", "updated"),
    feedUrl,
  );
  // Built from the validated id rather than taken from the feed, so it always points at YouTube's image host.
  return item && { ...item, kind: "video", thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` };
}

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom. Items without a safe link or a title are dropped. */
export function parseFeed(xml: string, feedUrl: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, Node>;
  const rss = doc.rss as Record<string, Node> | undefined;
  const rdf = doc["rdf:RDF"] as Record<string, Node> | undefined;
  const atom = doc.feed as Record<string, Node> | undefined;

  const items: (FeedItem | null)[] = [];
  if (rss || rdf) {
    const channel = (rss?.channel ?? rdf) as Record<string, Node> | undefined;
    const raw = asRecords(channel?.item ?? rdf?.item);
    for (const item of raw) {
      items.push(
        build(
          rssLink(item),
          field(item, "title"),
          field(item, "description", "content:encoded"),
          field(item, "pubDate", "dc:date"),
          feedUrl,
        ),
      );
    }
  } else if (atom) {
    for (const entry of asRecords(atom.entry)) {
      if ("yt:videoId" in entry) {
        items.push(youtubeEntry(entry, feedUrl));
        continue;
      }
      items.push(
        build(atomLink(entry), field(entry, "title"), field(entry, "summary", "content"), field(entry, "published", "updated"), feedUrl),
      );
    }
  } else {
    throw new Error("Not an RSS or Atom feed");
  }
  return items.filter((i): i is FeedItem => i !== null);
}
