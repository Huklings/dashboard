import { z } from "zod";
import type { FeedItem } from "./feed";
import { toPlainText, truncate } from "./text";

/** CISA's Known Exploited Vulnerabilities catalog: CVEs seen exploited in the wild. */
export const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

// The catalog holds every entry since 2021; only the newest are worth carrying.
const MAX_ENTRIES = 100;
const CVE_ID = /^CVE-\d{4}-\d{4,7}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const short = (max: number) => z.string().transform((s) => truncate(toPlainText(s), max));

const EntrySchema = z.object({
  cveID: z.string().regex(CVE_ID),
  vendorProject: short(80),
  product: short(80),
  vulnerabilityName: short(300),
  dateAdded: z.string().regex(DATE),
  shortDescription: short(400),
  dueDate: z.string().regex(DATE).optional().catch(undefined),
  knownRansomwareCampaignUse: z.string().optional().catch(undefined),
});

/** Parses the KEV JSON. Entries that don't match the expected shape are skipped, not fatal. */
export function parseKev(json: string): FeedItem[] {
  const doc: unknown = JSON.parse(json);
  const raw = doc && typeof doc === "object" && "vulnerabilities" in doc ? doc.vulnerabilities : null;
  if (!Array.isArray(raw)) throw new Error("Not a KEV catalog");

  const entries = raw.flatMap((e) => {
    const parsed = EntrySchema.safeParse(e);
    return parsed.success ? [parsed.data] : [];
  });
  entries.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));

  return entries.slice(0, MAX_ENTRIES).map((e) => ({
    // Built from the validated ID, so the link always points at NVD.
    url: `https://nvd.nist.gov/vuln/detail/${e.cveID}`,
    title: e.vulnerabilityName || e.cveID,
    summary: e.shortDescription,
    publishedAt: `${e.dateAdded}T00:00:00.000Z`,
    kind: "cve",
    cve: {
      id: e.cveID,
      vendor: e.vendorProject,
      product: e.product,
      ...(e.dueDate ? { dueDate: e.dueDate } : {}),
      ransomware: e.knownRansomwareCampaignUse?.toLowerCase() === "known",
    },
  }));
}
