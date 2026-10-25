import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expandSource } from "../fetcher/config";
import { KEV_URL, parseKev } from "../fetcher/kev";

const fixture = readFileSync(new URL("./fixtures/kev.json", import.meta.url), "utf8");

describe("parseKev", () => {
  it("turns catalog entries into newest-first CVE items and skips malformed ones", () => {
    const items = parseKev(fixture);
    expect(items.map((i) => i.cve?.id)).toEqual(["CVE-2026-22222", "CVE-2026-44444", "CVE-2026-11111"]);
    expect(items[0]).toEqual({
      url: "https://nvd.nist.gov/vuln/detail/CVE-2026-22222",
      title: "Contoso Mail Server Remote Code Execution Vulnerability",
      summary: "Contoso Mail Server allows unauthenticated remote code execution.",
      publishedAt: "2026-10-23T00:00:00.000Z",
      kind: "cve",
      cve: { id: "CVE-2026-22222", vendor: "Contoso", product: "Mail Server", dueDate: "2026-11-13", ransomware: true },
    });
  });

  it("strips markup, decodes entities and drops a malformed due date", () => {
    const items = parseKev(fixture);
    expect(items[2]).toMatchObject({
      title: "Acme Gateway Path Traversal Vulnerability",
      summary: "Acme Gateway contains a path traversal vulnerability & more.",
      cve: { ransomware: false },
    });
    expect(items[1]?.cve).not.toHaveProperty("dueDate");
  });

  it("rejects documents that aren't a KEV catalog", () => {
    expect(() => parseKev('{"items": []}')).toThrow("Not a KEV catalog");
    expect(() => parseKev("<rss/>")).toThrow();
  });

  it("expands the cisa:kev shorthand", () => {
    expect(expandSource("cisa:kev")).toBe(KEV_URL);
  });
});
