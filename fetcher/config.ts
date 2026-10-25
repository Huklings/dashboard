import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";
import { KEV_URL } from "./kev";
import { safeUrl } from "./text";

const YOUTUBE_CHANNEL = /^youtube:(UC[A-Za-z0-9_-]{22})$/;

/** Expands shorthands: `youtube:UC…` becomes that channel's video feed, `cisa:kev` the KEV catalog. */
export function expandSource(source: string): string {
  if (source === "cisa:kev") return KEV_URL;
  const channel = YOUTUBE_CHANNEL.exec(source)?.[1];
  return channel ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}` : source;
}

const FeedUrl = z
  .string()
  .trim()
  .transform(expandSource)
  .refine((s) => safeUrl(s) !== null, { message: "must be an http(s) URL, youtube:<channel id> or cisa:kev" });

const TopicSchema = z.object({
  name: z.string().trim().min(1).max(60),
  include: z.array(z.string().trim().min(1)).default([]),
  exclude: z.array(z.string().trim().min(1)).default([]),
  sources: z.array(FeedUrl).default([]),
});

export const ConfigSchema = z
  .object({
    spaces: z.object({
      work: z.array(TopicSchema).default([]),
      hobby: z.array(TopicSchema).default([]),
    }),
    sources: z.array(FeedUrl).default([]),
  })
  .superRefine((cfg, ctx) => {
    const seen = new Set<string>();
    for (const topic of [...cfg.spaces.work, ...cfg.spaces.hobby]) {
      const key = topic.name.toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", message: `Duplicate topic name "${topic.name}"` });
      seen.add(key);
      if (topic.include.length === 0 && topic.sources.length === 0) {
        ctx.addIssue({ code: "custom", message: `Topic "${topic.name}" needs include keywords or sources` });
      }
    }
  });

export type Config = z.infer<typeof ConfigSchema>;
export type Topic = z.infer<typeof TopicSchema>;

export function parseConfig(yamlText: string): Config {
  return ConfigSchema.parse(parse(yamlText));
}

export async function loadConfig(path: string): Promise<Config> {
  return parseConfig(await readFile(path, "utf8"));
}

/** Every feed URL in the config, normalised and deduplicated. */
export function allSources(config: Config): string[] {
  const urls = [...config.sources, ...config.spaces.work.flatMap((t) => t.sources), ...config.spaces.hobby.flatMap((t) => t.sources)];
  return [...new Set(urls.map((u) => safeUrl(u)!))];
}
