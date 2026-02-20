const COOKIE_PREFIX = 'drawny_';

interface CookieOptions {
  maxAge?: number;   // seconds
  path?: string;
  sameSite?: 'Lax' | 'Strict' | 'None';
}

const DEFAULT_OPTIONS: CookieOptions = {
  maxAge: 365 * 24 * 60 * 60, // 1 year
  path: '/',
  sameSite: 'Lax',
};

export function setCookie(name: string, value: string, options?: CookieOptions): void {
  if (typeof document === 'undefined') return;
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const key = `${COOKIE_PREFIX}${name}`;
  document.cookie = `${key}=${encodeURIComponent(value)};max-age=${opts.maxAge};path=${opts.path};SameSite=${opts.sameSite}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const key = `${COOKIE_PREFIX}${name}=`;
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    if (cookie.startsWith(key)) {
      return decodeURIComponent(cookie.substring(key.length));
    }
  }
  return null;
}

export function setJsonCookie<T>(name: string, value: T, options?: CookieOptions): void {
  setCookie(name, JSON.stringify(value), options);
}

export function getJsonCookie<T>(name: string): T | null {
  const raw = getCookie(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
