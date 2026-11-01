import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * High-performance, in-memory sliding window rate limiter
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const hits = new Map<string, RateLimitRecord>();

  // Cleanup expired keys periodically to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 60000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Derive client IP safely
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
               req.socket.remoteAddress ||
               'unknown_ip';

    const now = Date.now();
    let record = hits.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + options.windowMs };
      hits.set(ip, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, options.max - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > options.max) {
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: options.message || 'Too many requests. Please try again after a few minutes.',
        retryAfter: retryAfterSec
      });
    }

    next();
  };
}

// Preset Limiters for sensitive endpoints
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts from this network. Please wait 15 minutes before trying again.'
});

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many registration requests. Please wait an hour before creating another account.'
});

export const otpRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 6,
  message: 'Too many verification code attempts. Please wait 10 minutes before requesting a new code.'
});

export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5,
  message: 'Too many password reset requests. Please try again later.'
});
