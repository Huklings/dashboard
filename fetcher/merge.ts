import type { Article } from "../shared/articles";

export interface MergeOptions {
  now: Date;
  maxAgeDays: number;
  maxItems: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Combines this run's articles with the previous run's. Deduplicates by URL
 * (fresh data wins, but the first-seen fetchedAt is kept), drops anything
 * older than maxAgeDays and keeps the newest maxItems.
 */
export function mergeArticles(previous: Article[], fresh: Article[], opts: MergeOptions): Article[] {
  const byUrl = new Map<string, Article>();
  for (const article of previous) byUrl.set(article.url, article);
  for (const article of fresh) {
    const old = byUrl.get(article.url);
    byUrl.set(article.url, old ? { ...article, fetchedAt: old.fetchedAt } : article);
  }

  const cutoff = opts.now.getTime() - opts.maxAgeDays * DAY_MS;
  const latestAllowed = opts.now.getTime() + DAY_MS;
  return [...byUrl.values()]
    .map((a) => (Date.parse(a.publishedAt) > latestAllowed ? { ...a, publishedAt: a.fetchedAt } : a))
    .filter((a) => Date.parse(a.publishedAt) >= cutoff && a.topics.length > 0)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, opts.maxItems);
}
