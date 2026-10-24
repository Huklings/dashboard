import { useEffect, useMemo, useState } from "react";
import type { Article, DataFile, Space } from "../shared/articles";
import { useMarks } from "./storage";

type Filter = "all" | "unread" | "saved";

const SPACES: { id: Space; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "hobby", label: "Hobby" },
];

// The fetcher already only emits http(s) links; this is a second check at render time.
function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function timeAgo(iso: string, now: number): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

function useData() {
  const [data, setData] = useState<DataFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}articles.json`, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DataFile>;
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);
  return { data, error };
}

export function App() {
  const { data, error } = useData();
  const knownUrls = useMemo(() => (data ? new Set(data.articles.map((a) => a.url)) : null), [data]);
  const marks = useMarks(knownUrls);
  const [space, setSpace] = useState<Space>("work");
  const [topic, setTopic] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const now = Date.now();

  const spaceTopics = data?.spaces[space] ?? [];
  const inSpace = useMemo(
    () => (data?.articles ?? []).filter((a) => a.topics.some((t) => spaceTopics.includes(t))),
    [data, spaceTopics],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inSpace.filter(
      (a) =>
        (!topic || a.topics.includes(topic)) &&
        (filter !== "unread" || !marks.read.has(a.url)) &&
        (filter !== "saved" || marks.saved.has(a.url)) &&
        (!q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)),
    );
  }, [inSpace, topic, filter, query, marks.read, marks.saved]);

  const failing = data?.sources.filter((s) => !s.ok) ?? [];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          {data && (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Updated {timeAgo(data.generatedAt, now)} · {data.articles.length} articles
              {failing.length > 0 && (
                <span title={failing.map((s) => `${s.url}: ${s.error ?? "failed"}`).join("\n")} className="text-amber-700 dark:text-amber-400">
                  {" "}
                  · {failing.length} source{failing.length > 1 ? "s" : ""} failing
                </span>
              )}
            </p>
          )}
        </header>

        <nav className="mt-5 flex gap-1 border-b border-stone-200 dark:border-stone-800" aria-label="Spaces">
          {SPACES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSpace(s.id);
                setTopic(null);
              }}
              aria-current={space === s.id ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                space === s.id
                  ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                  : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Topics">
          {[null, ...spaceTopics].map((t) => {
            const count = t ? inSpace.filter((a) => a.topics.includes(t)).length : inSpace.length;
            const active = topic === t;
            return (
              <button
                key={t ?? "__all"}
                type="button"
                onClick={() => setTopic(t)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-stone-950"
                    : "border-stone-300 hover:border-stone-500 dark:border-stone-700 dark:hover:border-stone-500"
                }`}
              >
                {t ?? "All"} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles and summaries"
            aria-label="Search"
            className="w-full min-w-0 rounded-md sm:w-auto sm:flex-1 border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
          <div className="flex rounded-md border border-stone-300 text-sm dark:border-stone-700" role="group" aria-label="Filter">
            {(["all", "unread", "saved"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-3 py-2 capitalize first:rounded-l-md last:rounded-r-md ${
                  filter === f ? "bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900" : ""
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <main className="mt-4">
          {error && <p className="rounded-md bg-amber-100 p-4 text-sm text-amber-900">Couldn't load articles ({error}). The first scheduled run may not have finished yet.</p>}
          {!data && !error && <p className="text-sm text-stone-500">Loading…</p>}
          {data && visible.length === 0 && (
            <p className="py-10 text-center text-sm text-stone-500">
              {spaceTopics.length === 0 ? "No topics in this space yet. Add some in config/interests.yaml." : "Nothing matches right now."}
            </p>
          )}
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {visible.map((a) => (
              <ArticleRow
                key={a.url}
                article={a}
                now={now}
                isRead={marks.read.has(a.url)}
                isSaved={marks.saved.has(a.url)}
                onOpen={() => marks.setRead(a.url, true)}
                onToggleRead={() => marks.setRead(a.url)}
                onToggleSaved={() => marks.toggleSaved(a.url)}
              />
            ))}
          </ul>
        </main>
      </div>
    </div>
  );
}

interface RowProps {
  article: Article;
  now: number;
  isRead: boolean;
  isSaved: boolean;
  onOpen: () => void;
  onToggleRead: () => void;
  onToggleSaved: () => void;
}

function ArticleRow({ article, now, isRead, isSaved, onOpen, onToggleRead, onToggleSaved }: RowProps) {
  const href = safeHref(article.url);
  return (
    <li className={`py-4 ${isRead ? "opacity-60" : ""}`}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className="font-medium text-stone-900 hover:text-blue-700 hover:underline dark:text-stone-100 dark:hover:text-blue-300"
      >
        {article.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
        <span>{hostOf(article.url)}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={article.publishedAt}>{timeAgo(article.publishedAt, now)}</time>
        {article.topics.map((t) => (
          <span key={t} className="rounded bg-stone-200 px-1.5 py-0.5 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {t}
          </span>
        ))}
      </div>
      {article.summary && <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">{article.summary}</p>}
      <div className="mt-2 flex gap-3 text-xs">
        <button type="button" onClick={onToggleRead} className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
          {isRead ? "Mark unread" : "Mark read"}
        </button>
        <button
          type="button"
          onClick={onToggleSaved}
          aria-pressed={isSaved}
          className={isSaved ? "font-medium text-blue-700 dark:text-blue-300" : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"}
        >
          {isSaved ? "Saved" : "Save for later"}
        </button>
      </div>
    </li>
  );
}
