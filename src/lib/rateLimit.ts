interface RateLimitEntry {
  count: number;
  windowStartMs: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit({
  key,
  max,
  windowMs
}: {
  key: string;
  max: number;
  windowMs: number;
}) {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now - current.windowStartMs >= windowMs) {
    rateLimitStore.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current.windowStartMs)) / 1000))
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  if (rateLimitStore.size > 5000) {
    for (const [entryKey, entry] of rateLimitStore) {
      if (now - entry.windowStartMs > windowMs) rateLimitStore.delete(entryKey);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
