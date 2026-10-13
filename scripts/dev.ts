// Runs the chat page and the API locally, with in-memory limits instead of DynamoDB:
//   LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm run dev     (or AWS credentials for Bedrock)
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { extname } from "node:path";
import type { LambdaFunctionURLEvent } from "aws-lambda";
import { loadConfig } from "../src/config.js";
import { createHandler } from "../src/handler.js";
import { MemoryLimiter } from "../src/limits.js";
import { modelTargets } from "../src/llm.js";

const PORT = Number(process.env.PORT ?? 8080);
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

execFileSync(process.execPath, ["scripts/site.mjs", "/api"], { stdio: "inherit" });
const site = new URL("../dist/site/", import.meta.url);
const config = loadConfig();
const api = createHandler({
  config,
  targets: modelTargets(config),
  limiter: new MemoryLimiter(),
  log: (line) => console.log(line),
  today: () => new Date().toISOString().slice(0, 10),
});

async function body(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path === "/api") {
    const event = {
      body: await body(req),
      isBase64Encoded: false,
      requestContext: { http: { method: req.method ?? "GET", sourceIp: req.socket.remoteAddress ?? "local" } },
    } as unknown as LambdaFunctionURLEvent;
    const result = await api(event);
    res.writeHead(result.statusCode, result.headers).end(result.body);
    return;
  }
  const file = path === "/" ? "index.html" : path.slice(1);
  try {
    if (file.includes("..")) throw new Error("bad path");
    const content = await readFile(new URL(file, site));
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(content);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`Chat page on http://localhost:${PORT} (answers from ${config.provider})`));
