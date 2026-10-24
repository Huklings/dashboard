import { useEffect, useMemo, useState } from "react";
import type { Article, DataFile, Space } from "../shared/articles";
import { useMarks } from "./storage";

type Filter = "all" | "unread" | "saved" | "videos";

const SPACES: { id: Space; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "hobby", label: "Hobby" },
];

const FILTERS: Filter[] = ["all", "unread", "saved", "videos"];

// The fetcher already only emits http(s) links; this is a second check at render time.
function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

// Thumbnails are only ever loaded from YouTube's image host (the CSP allows nothing else).
function safeThumbnail(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "i.ytimg.com" ? parsed.href : undefined;
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
        (filter !== "videos" || a.kind === "video") &&
        (!q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)),
    );
  }, [inSpace, topic, filter, query, marks.read, marks.saved]);

  const videos = visible.filter((a) => a.kind === "video");
  const articles = visible.filter((a) => a.kind !== "video");
  const cardProps = (a: Article): CardProps => ({
    article: a,
    now,
    isRead: marks.read.has(a.url),
    isSaved: marks.saved.has(a.url),
    onOpen: () => marks.setRead(a.url, true),
    onToggleRead: () => marks.setRead(a.url),
    onToggleSaved: () => marks.toggleSaved(a.url),
  });

  const failing = data?.sources.filter((s) => !s.ok) ?? [];
  const unreadCount = inSpace.filter((a) => !marks.read.has(a.url)).length;

  return (
    <div className="min-h-screen text-slate-200 selection:bg-neon-cyan/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-neon-cyan/70 uppercase">// signal feed</p>
            <h1 className="mt-1 bg-gradient-to-r from-neon-cyan via-sky-300 to-neon-violet bg-clip-text font-mono text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              DASHBOARD
            </h1>
          </div>
          {data && (
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wider uppercase">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                Live · {timeAgo(data.generatedAt, now)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-400">{data.articles.length} items</span>
              {failing.length > 0 && (
                <span
                  title={failing.map((s) => `${s.url}: ${s.error ?? "failed"}`).join("\n")}
                  className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-300"
                >
                  {failing.length} source{failing.length > 1 ? "s" : ""} down
                </span>
              )}
            </div>
          )}
        </header>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <nav className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 backdrop-blur" aria-label="Spaces">
            {SPACES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSpace(s.id);
                  setTopic(null);
                }}
                aria-current={space === s.id ? "page" : undefined}
                className={`rounded-lg px-5 py-2 font-mono text-sm tracking-widest uppercase transition ${
                  space === s.id
                    ? "bg-neon-cyan/15 text-neon-cyan shadow-[0_0_20px_-4px] shadow-neon-cyan/60 ring-1 ring-neon-cyan/50"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          {data && (
            <p className="font-mono text-xs tracking-wider text-slate-500 uppercase">
              <span className="text-neon-violet">{unreadCount}</span> unread in {space}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Topics">
          {[null, ...spaceTopics].map((t) => {
            const count = t ? inSpace.filter((a) => a.topics.includes(t)).length : inSpace.length;
            const active = topic === t;
            return (
              <button
                key={t ?? "__all"}
                type="button"
                onClick={() => setTopic(t)}
                aria-pressed={active}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wider uppercase transition ${
                  active
                    ? "border-neon-violet/60 bg-neon-violet/15 text-violet-200 shadow-[0_0_16px_-4px] shadow-neon-violet/70"
                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-neon-violet/40 hover:text-slate-200"
                }`}
              >
                {t ?? "All"} <span className="ml-1 text-slate-500">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="relative w-full min-w-0 sm:w-auto sm:flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 font-mono text-neon-cyan/70" aria-hidden="true">
              &gt;
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search the feed…"
              aria-label="Search"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pr-3 pl-8 font-mono text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur transition outline-none focus:border-neon-cyan/60 focus:shadow-[0_0_20px_-6px] focus:shadow-neon-cyan/70"
            />
          </label>
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1 font-mono text-xs tracking-wider uppercase" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-md px-3 py-1.5 transition ${
                  filter === f ? "bg-white/10 text-white ring-1 ring-white/20" : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <main className="mt-6">
          {error && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 font-mono text-sm text-amber-200">
              Couldn't load the feed ({error}). The first scheduled run may not have finished yet.
            </p>
          )}
          {!data && !error && <p className="font-mono text-sm text-slate-500">Loading feed…</p>}
          {data && visible.length === 0 && (
            <p className="py-16 text-center font-mono text-sm text-slate-500">
              {spaceTopics.length === 0 ? "No topics in this space yet. Add some in config/interests.yaml." : "No signal. Nothing matches right now."}
            </p>
          )}
          {videos.length > 0 && (
            <section aria-labelledby="videos-heading">
              <SectionHeading id="videos-heading" label="Video feed" count={videos.length} accent="pink" />
              <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-3 sm:mx-0 sm:px-0 sm:[mask-image:linear-gradient(to_right,black_90%,transparent)] [scrollbar-color:rgb(255_79_216/0.4)_transparent] [scrollbar-width:thin]">
                {videos.map((a) => (
                  <VideoCard key={a.url} {...cardProps(a)} />
                ))}
              </ul>
            </section>
          )}
          {filter !== "videos" && articles.length > 0 && (
            <section aria-labelledby="articles-heading" className={videos.length > 0 ? "mt-6" : ""}>
              <SectionHeading id="articles-heading" label="Articles" count={articles.length} accent="cyan" />
              <ul className="grid gap-3 md:grid-cols-2">
                {articles.map((a) => (
                  <ArticleCard key={a.url} {...cardProps(a)} />
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function SectionHeading({ id, label, count, accent }: { id: string; label: string; count: number; accent: "cyan" | "pink" }) {
  const color = accent === "pink" ? "text-neon-pink" : "text-neon-cyan";
  const line = accent === "pink" ? "from-neon-pink/50" : "from-neon-cyan/50";
  return (
    <h2 id={id} className="mb-3 flex items-center gap-3 font-mono text-xs tracking-[0.25em] text-slate-400 uppercase">
      <span className={color}>▸</span>
      {label}
      <span className="text-slate-600">{count}</span>
      <span className={`h-px flex-1 bg-gradient-to-r ${line} to-transparent`} aria-hidden="true" />
    </h2>
  );
}

interface CardProps {
  article: Article;
  now: number;
  isRead: boolean;
  isSaved: boolean;
  onOpen: () => void;
  onToggleRead: () => void;
  onToggleSaved: () => void;
}

function CardActions({ isRead, isSaved, onToggleRead, onToggleSaved }: Pick<CardProps, "isRead" | "isSaved" | "onToggleRead" | "onToggleSaved">) {
  return (
    <span className="ml-auto flex shrink-0 gap-1 font-mono text-[11px] tracking-wider uppercase">
      <button type="button" onClick={onToggleRead} className="rounded px-2 py-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200">
        {isRead ? "Unread" : "Read"}
      </button>
      <button
        type="button"
        onClick={onToggleSaved}
        aria-pressed={isSaved}
        className={`rounded px-2 py-1 transition ${
          isSaved ? "bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/40" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
        }`}
      >
        {isSaved ? "★ Saved" : "☆ Save"}
      </button>
    </span>
  );
}

function TopicTags({ topics }: { topics: string[] }) {
  return (
    <>
      {topics.map((t) => (
        <span key={t} className="rounded border border-neon-violet/30 bg-neon-violet/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-violet-300 uppercase">
          {t}
        </span>
      ))}
    </>
  );
}

const cardShell =
  "group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur transition before:absolute before:inset-y-0 before:left-0 before:w-0.5";

function VideoCard({ article, now, isRead, isSaved, onOpen, onToggleRead, onToggleSaved }: CardProps) {
  const href = safeHref(article.url);
  const thumbnail = safeThumbnail(article.thumbnail);
  return (
    <li
      className={`${cardShell} flex w-64 shrink-0 snap-start flex-col hover:border-neon-pink/50 hover:shadow-[0_0_30px_-12px] hover:shadow-neon-pink/70 sm:w-72 ${
        isRead ? "opacity-50 before:opacity-0" : "before:bg-neon-pink before:opacity-80"
      }`}
    >
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onOpen} className="relative block">
        {thumbnail ? (
          <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="block aspect-video w-full object-cover transition group-hover:scale-105" />
        ) : (
          <span className="block aspect-video w-full bg-neon-pink/10" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20" aria-hidden="true">
          <span className="flex size-10 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-neon-pink/60 shadow-[0_0_20px_-2px] shadow-neon-pink/70">
            ▶
          </span>
        </span>
        <span className="sr-only">{article.title}</span>
      </a>
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate font-mono text-[11px] tracking-wider text-slate-500 uppercase">
          <span className="text-pink-300">{article.author ?? hostOf(article.url)}</span>
          <span className="text-slate-600"> / </span>
          <time dateTime={article.publishedAt}>{timeAgo(article.publishedAt, now)}</time>
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          tabIndex={-1}
          className="mt-1 line-clamp-2 text-sm leading-snug font-semibold text-slate-100 transition hover:text-neon-pink"
        >
          {article.title}
        </a>
        <div className="mt-auto flex items-center pt-2">
          <CardActions isRead={isRead} isSaved={isSaved} onToggleRead={onToggleRead} onToggleSaved={onToggleSaved} />
        </div>
      </div>
    </li>
  );
}

function ArticleCard({ article, now, isRead, isSaved, onOpen, onToggleRead, onToggleSaved }: CardProps) {
  const href = safeHref(article.url);
  return (
    <li
      className={`${cardShell} flex flex-col p-4 hover:border-neon-cyan/40 hover:bg-white/[0.05] hover:shadow-[0_0_30px_-12px] hover:shadow-neon-cyan/60 ${
        isRead ? "opacity-50 before:opacity-0" : "before:bg-neon-cyan before:opacity-80"
      }`}
    >
      <p className="font-mono text-[11px] tracking-wider text-slate-500 uppercase">
        <span className="text-slate-400">{hostOf(article.url)}</span>
        <span className="text-slate-600"> / </span>
        <time dateTime={article.publishedAt}>{timeAgo(article.publishedAt, now)}</time>
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className="mt-1.5 block leading-snug font-semibold text-slate-100 transition hover:text-neon-cyan"
      >
        {article.title}
      </a>
      {article.summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{article.summary}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <TopicTags topics={article.topics} />
        <CardActions isRead={isRead} isSaved={isSaved} onToggleRead={onToggleRead} onToggleSaved={onToggleSaved} />
      </div>
    </li>
  );
}
