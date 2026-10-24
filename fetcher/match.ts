import type { Config, Topic } from "./config";
import { safeUrl } from "./text";

export interface Matcher {
  /** Topic names an article belongs to, in config order. */
  topicsFor(article: { title: string; summary: string; source: string }): string[];
}

function keywordPattern(keywords: string[]): RegExp | null {
  if (keywords.length === 0) return null;
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Whole-word match that also works for keywords like "Node.js" or "C++".
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

interface CompiledTopic {
  name: string;
  include: RegExp | null;
  exclude: RegExp | null;
  sources: Set<string>;
}

function compile(topic: Topic): CompiledTopic {
  return {
    name: topic.name,
    include: keywordPattern(topic.include),
    exclude: keywordPattern(topic.exclude),
    sources: new Set(topic.sources.map((s) => safeUrl(s)!)),
  };
}

export function createMatcher(config: Config): Matcher {
  const topics = [...config.spaces.work, ...config.spaces.hobby].map(compile);
  return {
    topicsFor({ title, summary, source }) {
      const text = `${title}\n${summary}`;
      return topics
        .filter((t) => (t.sources.has(source) || t.include?.test(text)) && !t.exclude?.test(text))
        .map((t) => t.name);
    },
  };
}
