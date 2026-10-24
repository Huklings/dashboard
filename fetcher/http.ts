import { safeUrl } from "./text";

const USER_AGENT = "dashboard-news-fetcher (+https://github.com/Huklings/dashboard)";

export interface FetchLimits {
  timeoutMs: number;
  maxBytes: number;
}

/** GETs an http(s) URL as text, with a hard timeout and a body size cap. */
export async function fetchText(rawUrl: string, limits: FetchLimits): Promise<string> {
  const url = safeUrl(rawUrl);
  if (!url) throw new Error("Only http and https URLs are allowed");

  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(limits.timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > limits.maxBytes) throw new Error(`Response larger than ${limits.maxBytes} bytes`);
  if (!res.body) return "";

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limits.maxBytes) {
      await reader.cancel();
      throw new Error(`Response larger than ${limits.maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}
