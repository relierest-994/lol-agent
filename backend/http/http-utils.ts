import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

export type JsonBody = Record<string, unknown>;

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  path: string;
  method: string;
  cachedBody?: JsonBody;
}

export function writeJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.end(JSON.stringify(data));
}

export async function readBody(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonBody;
  } catch {
    return {};
  }
}

export async function readRequestBody(context: RequestContext): Promise<JsonBody> {
  if (context.cachedBody) return context.cachedBody;
  const body = await readBody(context.req);
  context.cachedBody = body;
  return body;
}

export function asString(input: unknown, fallback = ''): string {
  return typeof input === 'string' ? input : fallback;
}

export function buildRequestContext(req: IncomingMessage, res: ServerResponse): RequestContext {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  return {
    req,
    res,
    url,
    method: req.method ?? 'GET',
    path: url.pathname.replace(/^\/+/, ''),
  };
}

