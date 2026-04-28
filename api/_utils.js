const DEFAULT_TIMEOUT_MS = 18000;

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') {
    return false;
  }

  res.statusCode = 204;
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end();
  return true;
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

export async function fetchJson(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof data === 'string'
          ? data
          : data?.Message || data?.message || data?.error?.message || response.statusText;
      const error = new Error(message || `Request failed with ${response.status}`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export function getQueryParam(req, name, fallback = '') {
  const url = new URL(req.url || '/', 'http://localhost');
  return (url.searchParams.get(name) || fallback).trim();
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    const error = new Error(`Missing server environment variable ${name}.`);
    error.status = 503;
    throw error;
  }

  return value;
}
