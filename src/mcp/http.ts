import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createServer as createMcpServer, type JsonRpcMessage, type ServerOptions } from "./server.js";
import { ASSUMED_HTTP_PROTOCOL, isOriginAllowed, isProtocolVersion, type ProtocolVersion } from "./protocol.js";

// The Streamable HTTP transport, in its stateless form: one endpoint, POST,
// JSON in and JSON out.
//
// No Mcp-Session-Id is issued, and that is a decision rather than an omission.
// Every reconstruct tool call is self-contained — it carries its own `repo` and
// arguments — so there is nothing for a session to hold. Issuing one would buy
// a class of interop bugs (echo-back, expiry, 404-then-reinitialize, DELETE
// semantics) for no capability. Revisit only when something genuinely spans
// calls.
//
// No SSE either: nothing here sends server-initiated messages, and the spec's
// answer for a server with no stream to offer is 405 on GET, which is what this
// does. server.ts already routes replies through a callback, so adding a stream
// later is a change to this file alone.

const MCP_PATH = "/mcp";
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const CORS_HEADERS = "content-type, accept, mcp-protocol-version, mcp-session-id, authorization, last-event-id";

export interface HttpOptions extends ServerOptions {
  port?: number;
  bind?: string;
  allowOrigin?: string[];
  // Bind somewhere other than loopback. Off by default and loud when used:
  // this server clones arbitrary git URLs and reads files off disk, so an
  // exposed port is a fetch-anything primitive for whoever finds it.
  allowRemote?: boolean;
}

export interface RunningHttpServer {
  server: Server;
  port: number;
  url: string;
  close(): Promise<void>;
}

const LOOPBACK_BIND = new Set(["127.0.0.1", "::1", "localhost"]);

export function startHttpServer(opts: HttpOptions = {}): Promise<RunningHttpServer> {
  const bind = opts.bind ?? "127.0.0.1";
  if (!LOOPBACK_BIND.has(bind) && !opts.allowRemote) {
    return Promise.reject(
      new Error(
        `refusing to bind ${bind}: reconstruct's MCP server clones arbitrary git URLs and reads local files. Pass --allow-remote if that is really what you want.`,
      ),
    );
  }

  const server = createHttpServer((req, res) => {
    void route(req, res, opts).catch((e) => {
      // Only if nothing was written yet: a throw after the response started
      // (a client that hung up mid-write) must not become a second writeHead.
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendJson(res, 500, { jsonrpc: "2.0", id: null, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } });
    });
  });

  // A cold `reconstruct_doc` runs for minutes. Node's default 300s request timeout
  // would cut the socket with no JSON-RPC error, which the client reports as a
  // crashed server rather than a slow tool.
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  server.keepAliveTimeout = 120_000;

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? 0, bind, () => {
      server.removeListener("error", reject);
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : (opts.port ?? 0);
      const host = bind.includes(":") ? `[${bind}]` : bind;
      resolve({
        server,
        port,
        url: `http://${host}:${port}${MCP_PATH}`,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}

async function route(req: IncomingMessage, res: ServerResponse, opts: HttpOptions): Promise<void> {
  const path = (req.url ?? "").split("?")[0];
  const origin = header(req, "origin");

  // DNS-rebinding defense first, before anything reads the body: a page the
  // user happens to have open must not be able to drive this server.
  if (!isOriginAllowed(origin, opts.allowOrigin)) {
    sendJson(res, 403, { error: "origin not allowed", origin });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...corsHeaders(origin),
      "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
      "access-control-allow-headers": CORS_HEADERS,
      "access-control-max-age": "86400",
    });
    res.end();
    return;
  }

  if (path !== MCP_PATH) {
    sendJson(res, 404, { error: `not found: ${path} (the MCP endpoint is ${MCP_PATH})` }, origin);
    return;
  }

  // GET would open the server→client SSE stream; there isn't one, and 405 is
  // the spec's way of saying so. DELETE terminates a session; there are none.
  if (req.method === "GET" || req.method === "DELETE") {
    res.writeHead(405, { allow: "POST, OPTIONS", ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: `${req.method} is not supported: this server is stateless and offers no server-initiated stream` }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { allow: "POST, OPTIONS", ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: `${req.method} is not supported` }));
    return;
  }

  const contentType = (header(req, "content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (contentType && contentType !== "application/json") {
    sendJson(res, 415, { error: `unsupported content-type "${contentType}" — send application/json` }, origin);
    return;
  }

  // Lenient on Accept: the spec asks clients for
  // "application/json, text/event-stream", but rejecting the ones that send
  // something narrower breaks real integrations and protects nothing.
  const accept = (header(req, "accept") ?? "").toLowerCase();
  if (accept && !/application\/json|text\/event-stream|\*\/\*/.test(accept)) {
    sendJson(res, 406, { error: "this endpoint replies with application/json" }, origin);
    return;
  }

  const declared = header(req, "mcp-protocol-version");
  if (declared !== undefined && !isProtocolVersion(declared)) {
    sendJson(res, 400, { error: `unsupported MCP-Protocol-Version: ${declared}` }, origin);
    return;
  }
  // Absent means a client written against the previous revision, which never
  // sent the header. The spec says assume, not reject.
  const protocol: ProtocolVersion = (declared as ProtocolVersion | undefined) ?? ASSUMED_HTTP_PROTOCOL;

  let raw: string;
  try {
    raw = await readBody(req);
  } catch (e) {
    if ((e as Error).message === "too large") {
      sendJson(res, 413, { error: `request body exceeds ${MAX_BODY_BYTES} bytes` }, origin);
      return;
    }
    sendJson(res, 400, { error: `could not read request body: ${(e as Error).message}` }, origin);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendJson(res, 200, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, origin);
    return;
  }

  // A server instance per request. Stateless means the negotiated version
  // cannot live on the server object: two overlapping requests on different
  // protocol versions would otherwise read each other's.
  const mcp = createMcpServer(opts);
  mcp.setProtocolVersion(protocol);

  const out: JsonRpcMessage[] = [];
  const collect = (m: JsonRpcMessage) => void out.push(m);
  const messages: JsonRpcMessage[] = Array.isArray(parsed) ? (parsed as JsonRpcMessage[]) : [parsed as JsonRpcMessage];
  for (const m of messages) await mcp.handle(m, collect);

  // Nothing to answer means the body held only notifications or responses —
  // `notifications/initialized` arrives exactly this way, and a 200 with a body
  // here is what trips strict clients.
  if (out.length === 0) {
    res.writeHead(202, corsHeaders(origin));
    res.end();
    return;
  }

  sendJson(res, 200, Array.isArray(parsed) ? out : out[0]!, origin);
}

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  return origin ? { "access-control-allow-origin": origin, vary: "origin" } : {};
}

function sendJson(res: ServerResponse, status: number, body: unknown, origin?: string, extra: Record<string, string> = {}): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(text, "utf8")),
    ...corsHeaders(origin),
    ...extra,
  });
  res.end(text);
}

// How much we will read past the cap purely to reach the end of an oversized
// request. Answering a 413 while the client is still writing reaches it as a
// connection reset, not as our explanation — so we stop buffering, keep
// reading, and reply once the request is actually over. Past this ceiling the
// body is not a mistake and we stop humouring it.
const DRAIN_LIMIT = MAX_BODY_BYTES * 8;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;

    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) over = true;

    req.on("data", (c: Buffer) => {
      size += c.length;
      if (over) {
        if (size > DRAIN_LIMIT) {
          req.destroy();
          reject(new Error("too large"));
        }
        return;
      }
      if (size > MAX_BODY_BYTES) {
        over = true;
        chunks.length = 0;
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (over) reject(new Error("too large"));
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
    req.on("aborted", () => reject(new Error("client aborted the request")));
  });
}
