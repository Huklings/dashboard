import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DataFileSchema, type Article, type DataFile, type SourceStatus } from "../shared/articles";
import { allSources, loadConfig } from "./config";
import { parseFeed } from "./feed";
import { fetchText } from "./http";
import { createMatcher } from "./match";
import { mergeArticles } from "./merge";
import { safeUrl } from "./text";

const CONFIG_PATH = "config/interests.yaml";
const OUTPUT_PATH = "public/articles.json";
const CONCURRENCY = 6;
const FEED_LIMITS = { timeoutMs: 10_000, maxBytes: 5 * 1024 * 1024 };
const PREVIOUS_LIMITS = { timeoutMs: 15_000, maxBytes: 20 * 1024 * 1024 };

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 200);
}

async function loadPrevious(url: string | undefined): Promise<Article[]> {
  if (!url) return [];
  try {
    const parsed = DataFileSchema.safeParse(JSON.parse(await fetchText(url, PREVIOUS_LIMITS)));
    if (!parsed.success) {
      console.warn("Previous articles.json did not match the schema; starting fresh.");
      return [];
    }
    return parsed.data.articles.filter((a) => safeUrl(a.url) === a.url && safeUrl(a.source) === a.source);
  } catch (err) {
    console.warn(`No previous articles loaded (${errorMessage(err)}); starting fresh.`);
    return [];
  }
}

async function main() {
  const config = await loadConfig(CONFIG_PATH);
  const matcher = createMatcher(config);
  const now = new Date();
  const fetchedAt = now.toISOString();

  const sources = allSources(config);
  const statuses: SourceStatus[] = [];
  const fresh: Article[] = [];

  const results = await mapLimit(sources, CONCURRENCY, async (source) => {
    try {
      return { source, items: parseFeed(await fetchText(source, FEED_LIMITS), source) };
    } catch (err) {
      return { source, error: errorMessage(err) };
    }
  });

  for (const result of results) {
    if ("error" in result) {
      statuses.push({ url: result.source, ok: false, items: 0, error: result.error });
      console.warn(`✗ ${result.source}: ${result.error}`);
      continue;
    }
    statuses.push({ url: result.source, ok: true, items: result.items.length });
    console.log(`✓ ${result.source}: ${result.items.length} items`);
    for (const item of result.items) {
      const base = { url: item.url, title: item.title, summary: item.summary, source: result.source };
      fresh.push({ ...base, publishedAt: item.publishedAt ?? fetchedAt, fetchedAt, topics: matcher.topicsFor(base) });
    }
  }

  // Re-tag older articles too, so config edits apply to everything shown.
  const previous = (await loadPrevious(process.env.PREVIOUS_URL)).map((a) => ({ ...a, topics: matcher.topicsFor(a) }));
  const articles = mergeArticles(previous, fresh, { now, maxAgeDays: 30, maxItems: 2000 });

  const data: DataFile = {
    generatedAt: fetchedAt,
    spaces: {
      work: config.spaces.work.map((t) => t.name),
      hobby: config.spaces.hobby.map((t) => t.name),
    },
    sources: statuses,
    articles,
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(data));
  const failed = statuses.filter((s) => !s.ok).length;
  console.log(`Wrote ${articles.length} articles (${previous.length} carried over, ${failed}/${sources.length} sources failed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
