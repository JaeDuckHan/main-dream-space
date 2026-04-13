import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http.js";

type KeySource = "user" | "ip";

interface RateLimitOptions {
  key: string;
  windowMs: number;
  max: number;
  keySource?: KeySource;
}

const counters = new Map<string, { count: number; resetAt: number }>();

function buildIdentifier(req: Request, keySource: KeySource) {
  if (keySource === "user" && req.authUser?.id) {
    return `user:${req.authUser.id}`;
  }

  return `ip:${req.ip}`;
}

export function createRateLimit({ key, windowMs, max, keySource = "user" }: RateLimitOptions) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const identifier = buildIdentifier(req, keySource);
    const bucketKey = `${key}:${identifier}`;
    const now = Date.now();
    const bucket = counters.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      counters.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      return next(new HttpError(429, "Rate limit exceeded"));
    }

    bucket.count += 1;
    counters.set(bucketKey, bucket);
    return next();
  };
}
