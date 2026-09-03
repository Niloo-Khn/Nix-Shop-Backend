import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Handler = (request: RequestContext) => Promise<{ status?: number; body?: Json }>;
type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler };

export class HttpError extends Error { constructor(public readonly status: number, message: string) { super(message); } }

export class RequestContext {
  constructor(public readonly request: IncomingMessage, public readonly params: Record<string, string>) {}
  get header(): Record<string, string | string[] | undefined> { return this.request.headers; }
  async json<T>(): Promise<T> {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of this.request) { size += chunk.length; if (size > 32_768) throw new HttpError(413, "Request body too large"); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T; } catch { throw new HttpError(400, "Invalid JSON body"); }
  }
}

export class HttpApplication {
  private readonly routes: Route[] = [];
  constructor(private readonly name: string, private readonly allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://localhost:4173") {}
  route(method: string, path: string, handler: Handler): void {
    const keys: string[] = [];
    const pattern = new RegExp(`^${path.replace(/:([A-Za-z]+)/g, (_, key: string) => { keys.push(key); return "([^/]+)"; })}$`);
    this.routes.push({ method, pattern, keys, handler });
  }
  listen(port: number): void {
    createServer(async (request, response) => {
      this.securityHeaders(response);
      if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const route = this.routes.find((candidate) => candidate.method === request.method && candidate.pattern.test(pathname));
      if (!route) { this.send(response, 404, { error: "Route not found" }); return; }
      const match = route.pattern.exec(pathname); const params: Record<string, string> = {};
      route.keys.forEach((key, index) => { params[key] = decodeURIComponent(match?.[index + 1] ?? ""); });
      try { const result = await route.handler(new RequestContext(request, params)); this.send(response, result.status ?? 200, result.body ?? null); }
      catch (error) { const status = error instanceof HttpError ? error.status : 500; const message = error instanceof HttpError ? error.message : "Internal server error"; this.send(response, status, { error: message, requestId: randomUUID() }); if (status === 500) console.error(error); }
    }).listen(port, () => console.log(`${this.name} listening on http://localhost:${port}`));
  }
  private securityHeaders(response: ServerResponse): void {
    response.setHeader("Access-Control-Allow-Origin", this.allowedOrigin); response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key"); response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"); response.setHeader("X-Content-Type-Options", "nosniff"); response.setHeader("Referrer-Policy", "no-referrer"); response.setHeader("Cache-Control", "no-store");
  }
  private send(response: ServerResponse, status: number, body: Json): void { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(body)); }
}

export interface Repository<T extends { id: string }> { list(): Promise<T[]>; find(id: string): Promise<T | undefined>; save(entity: T): Promise<T>; }
export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private readonly records = new Map<string, T>();
  constructor(seed: T[] = []) { seed.forEach((record) => this.records.set(record.id, record)); }
  async list(): Promise<T[]> { return [...this.records.values()]; }
  async find(id: string): Promise<T | undefined> { return this.records.get(id); }
  async save(entity: T): Promise<T> { this.records.set(entity.id, entity); return entity; }
}

export function requireFields(value: unknown, fields: string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new HttpError(400, "A JSON object is required");
  const body = value as Record<string, unknown>;
  for (const field of fields) if (typeof body[field] !== "string" || !(body[field] as string).trim()) throw new HttpError(400, `${field} is required`);
  return body;
}
export function requireAdmin(context: RequestContext): void { const expected = process.env.ADMIN_API_KEY; if (!expected || context.header["x-admin-key"] !== expected) throw new HttpError(401, "Admin authentication required"); }
