import { z } from "zod";

// Shape of public/articles.json. The fetcher writes it and also reads the
// previous run's copy back from the live site, so it is validated on the way in.
export const ArticleSchema = z.object({
  url: z.string(),
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  fetchedAt: z.string(),
  topics: z.array(z.string()),
  // Older data files predate these fields.
  kind: z.enum(["article", "video"]).default("article"),
  thumbnail: z.string().optional(),
  // Channel name for videos.
  author: z.string().optional(),
});

export const SourceStatusSchema = z.object({
  url: z.string(),
  ok: z.boolean(),
  items: z.number(),
  error: z.string().optional(),
});

export const DataFileSchema = z.object({
  generatedAt: z.string(),
  spaces: z.object({
    work: z.array(z.string()),
    hobby: z.array(z.string()),
  }),
  sources: z.array(SourceStatusSchema),
  articles: z.array(ArticleSchema),
});

export type Article = z.infer<typeof ArticleSchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
export type DataFile = z.infer<typeof DataFileSchema>;
export type Space = keyof DataFile["spaces"];
