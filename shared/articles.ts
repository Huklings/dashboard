import { z } from "zod";

// Shape of public/articles.json. The fetcher writes it and also reads the
// previous run's copy back from the live site, so it is validated on the way in.
// Extra details for entries from CISA's Known Exploited Vulnerabilities catalog.
export const CveSchema = z.object({
  id: z.string().regex(/^CVE-\d{4}-\d{4,7}$/),
  vendor: z.string(),
  product: z.string(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ransomware: z.boolean(),
});

export const ArticleSchema = z.object({
  url: z.string(),
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  fetchedAt: z.string(),
  topics: z.array(z.string()),
  // Older data files predate these fields.
  kind: z.enum(["article", "video", "cve"]).default("article"),
  thumbnail: z.string().optional(),
  // Channel name for videos.
  author: z.string().optional(),
  cve: CveSchema.optional(),
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
export type CveInfo = z.infer<typeof CveSchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
export type DataFile = z.infer<typeof DataFileSchema>;
export type Space = keyof DataFile["spaces"];
