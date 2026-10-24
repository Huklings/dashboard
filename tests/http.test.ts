import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchText } from "../fetcher/http";

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/big") {
      res.write("x".repeat(2048));
      res.end("x".repeat(2048));
    } else if (req.url === "/slow") {
      setTimeout(() => res.end("late"), 500);
    } else if (req.url === "/missing") {
      res.statusCode = 404;
      res.end();
    } else {
      res.end("hello");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const limits = { timeoutMs: 200, maxBytes: 1024 };

describe("fetchText", () => {
  it("returns the body", async () => {
    await expect(fetchText(`${base}/ok`, limits)).resolves.toBe("hello");
  });
  it("enforces the size cap", async () => {
    await expect(fetchText(`${base}/big`, limits)).rejects.toThrow(/larger than/);
  });
  it("enforces the timeout", async () => {
    await expect(fetchText(`${base}/slow`, limits)).rejects.toThrow();
  });
  it("fails on HTTP errors and non-http schemes", async () => {
    await expect(fetchText(`${base}/missing`, limits)).rejects.toThrow("HTTP 404");
    await expect(fetchText("file:///etc/passwd", limits)).rejects.toThrow(/Only http/);
  });
});
