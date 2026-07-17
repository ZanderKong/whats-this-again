import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "tests", "fixtures");
const port = Number(process.env.INLINEAI_FIXTURE_PORT) || 4177;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }
  if (request.url === "/favicon.ico") {
    response.writeHead(204, { "cache-control": "no-store" });
    response.end();
    return;
  }
  if (request.url?.startsWith("/v1/models")) {
    response.writeHead(200, { ...corsHeaders(), "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "inlineai-fixture-model" }] }));
    return;
  }
  if (request.url?.startsWith("/v1/chat/completions")) {
    const body = await readJsonBody(request);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const last = String(messages.at(-1)?.content || "");
    const content = messages.some((message) => message.role === "assistant")
      ? `追问回答：${last.includes("继续") ? "已结合上一轮内容。" : "已收到追问。"}`
      : "模拟流式回答：这是一个经过本地端点验证的解释。";
    if (body.stream === false) {
      response.writeHead(200, { ...corsHeaders(), "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
      return;
    }
    response.writeHead(200, {
      ...corsHeaders(),
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    const chunks = [content.slice(0, 7), content.slice(7, 18), content.slice(18)];
    for (const chunk of chunks) {
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    response.end("data: [DONE]\n\n");
    return;
  }
  const relative = request.url === "/" ? "annotation-playground.html" : decodeURIComponent(request.url.split("?")[0]).replace(/^\/+/, "");
  const file = normalize(join(root, relative));
  if (!file.startsWith(root) || !existsSync(file)) { response.writeHead(404); response.end("Not found"); return; }
  response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`Annotation playground: http://127.0.0.1:${port}`));

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch (_) {
    return {};
  }
}
