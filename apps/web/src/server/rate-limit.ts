// Copyright (c) 2026 Janat Yasser. All rights reserved.
/**
 * Fixed-window, in-memory rate limiter for API routes.
 *
 * Good enough for a single web instance. With several instances behind a load
 * balancer, swap the Map for Redis (same interface).
 */

export interface Limit {
  /** Requests allowed per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function createLimiter(now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = now();

  return function check(key: string, limit: Limit): LimitResult {
    const t = now();
    if (t - lastSweep > 60_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      lastSweep = t;
    }
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + limit.windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    const ok = entry.count <= limit.max;
    return { ok, remaining: Math.max(0, limit.max - entry.count), retryAfterSec: ok ? 0 : Math.ceil((entry.resetAt - t) / 1000) };
  };
}

/** Best-effort client IP (trusts the first X-Forwarded-For hop set by your proxy). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export const LIMITS = {
  login: { max: 10, windowMs: 15 * 60_000 } satisfies Limit,
  loginPerEmail: { max: 5, windowMs: 15 * 60_000 } satisfies Limit,
  signup: { max: 5, windowMs: 60 * 60_000 } satisfies Limit,
  assistant: { max: Number(process.env.ASSISTANT_HOURLY_LIMIT ?? 30), windowMs: 60 * 60_000 } satisfies Limit,
};

/** RFC 6266 / 5987 Content-Disposition that survives quotes and non-ASCII names. */
export function attachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export const limiter = createLimiter();
