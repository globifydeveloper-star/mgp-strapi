import type { Context } from 'koa';
import { getClientIp } from './get-client-ip';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

const cleanup = (now: number): void => {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

/**
 * In-memory fixed-window limiter. Good enough for a single Strapi instance;
 * if this ever runs behind multiple instances/processes, back it with Redis instead.
 */
const isRateLimited = (key: string, limit: number, windowMs: number): boolean => {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
};

// getClientIp is imported from get-client-ip.ts

/**
 * Enforces a per-IP rate limit for a public route. Returns true (and writes a
 * 429 response) if the caller should stop handling the request.
 */
export const enforceRateLimit = (
  ctx: Context,
  routeKey: string,
  limit: number,
  windowMs: number
): boolean => {
  const key = `${routeKey}:${getClientIp(ctx)}`;
  if (isRateLimited(key, limit, windowMs)) {
    ctx.status = 429;
    ctx.body = { success: false, message: 'Too many requests. Please try again later.' };
    return true;
  }
  return false;
};
