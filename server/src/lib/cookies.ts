import type { Response } from "express";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function parseCookies(cookieHeader: string | undefined) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join("="));
  }

  return cookies;
}

export function setSessionCookie(res: Response, sessionId: string) {
  const name = process.env.SESSION_COOKIE_NAME || "ds_session";
  const maxAgeDays = Number(process.env.SESSION_LIFETIME_DAYS || 30);
  const maxAge = maxAgeDays * ONE_DAY_MS;
  const secure = process.env.NODE_ENV === "production";
  const domain = process.env.COOKIE_DOMAIN;

  const parts = [
    `${name}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  res.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: Response) {
  const name = process.env.SESSION_COOKIE_NAME || "ds_session";
  const secure = process.env.NODE_ENV === "production";
  const domain = process.env.COOKIE_DOMAIN;
  const parts = [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (secure) {
    parts.push("Secure");
  }

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  res.append("Set-Cookie", parts.join("; "));
}
