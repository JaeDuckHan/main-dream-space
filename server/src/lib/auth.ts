import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { query } from "../db.js";
import { clearSessionCookie, parseCookies } from "./cookies.js";

const SESSION_NAME = process.env.SESSION_COOKIE_NAME || "ds_session";

interface SessionRow {
  id: string;
  user_id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
}

export function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export async function authSessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    req.authUser = null;
    req.sessionId = null;

    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[SESSION_NAME];
    if (!sessionId) {
      return next();
    }

    const rows = await query<SessionRow>(
      `SELECT
         s.id,
         s.user_id,
         u.email,
         u.display_name,
         u.avatar_url,
         u.role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
         AND s.expires_at > NOW()
         AND u.is_active = TRUE
       LIMIT 1`,
      [sessionId],
    );

    const row = rows[0];
    if (!row) {
      req.sessionId = sessionId;
      return next();
    }

    req.sessionId = row.id;
    req.authUser = {
      id: row.user_id,
      email: row.email,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      role: row.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: "Authentication required" });
  }

  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.authUser.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}

export async function destroySession(sessionId: string | null | undefined) {
  if (!sessionId) return;
  await query("DELETE FROM user_sessions WHERE id = $1", [sessionId]);
}

export async function logoutRequest(req: Request, res: Response) {
  await destroySession(req.sessionId);
  clearSessionCookie(res);
}
