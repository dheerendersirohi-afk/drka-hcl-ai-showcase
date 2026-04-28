const DEFAULT_TIMEOUT_MS = 18000;

export function shouldUseSecureApi() {
  const configuredBase = import.meta.env.VITE_SECURE_API_BASE?.trim();

  if (configuredBase) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

export function getSecureApiBase() {
  return import.meta.env.VITE_SECURE_API_BASE?.trim() || '/api';
}

export async function fetchSecureJson<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const base = getSecureApiBase().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  try {
    const response = await fetch(`${base}${normalizedPath}`, {
      ...init,
      signal: init.signal || controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof data === 'string'
          ? data
          : data?.error?.message || data?.message || `Secure API failed with ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  } finally {
    window.clearTimeout(timeout);
  }
}
