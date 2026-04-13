import crypto from "crypto";
import { Router } from "express";
import { pool } from "../db.js";

const router = Router();
const SALT = process.env.HASH_SALT || "luckydanang-dev-salt";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashIp(ip: string) {
  return crypto.createHash("sha256").update(`${ip}${SALT}`).digest("hex");
}

router.post("/subscribe", async (req, res) => {
  const { email, source = "main" } = req.body ?? {};
  const ip =
    req.ip ||
    (typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0]?.trim() : "") ||
    req.socket.remoteAddress ||
    "unknown";
  const ipHash = hashIp(ip);
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }

  if (email.length > 255) {
    return res.status(400).json({ ok: false, error: "EMAIL_TOO_LONG" });
  }

  const client = await pool.connect();

  try {
    const rateLimit = await client.query<{ last_try: string }>(
      "SELECT last_try FROM newsletter_rate_limit WHERE ip_hash = $1",
      [ipHash],
    );

    if (rateLimit.rows[0]) {
      const diff = Date.now() - new Date(rateLimit.rows[0].last_try).getTime();
      if (diff < 60_000) {
        return res.status(429).json({ ok: false, error: "RATE_LIMIT" });
      }
    }

    await client.query(
      `INSERT INTO newsletter_rate_limit (ip_hash, last_try)
       VALUES ($1, NOW())
       ON CONFLICT (ip_hash) DO UPDATE SET last_try = NOW()`,
      [ipHash],
    );

    await client.query(
      `INSERT INTO newsletter_subscribers (email, source, status, ip_hash, user_agent, confirmed_at)
       VALUES ($1, $2, 'confirmed', $3, $4, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase().trim(), source, ipHash, userAgent],
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("[newsletter] subscribe error", error);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  } finally {
    client.release();
  }
});

export default router;
