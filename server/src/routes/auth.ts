import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { logoutRequest, requireAuth } from "../lib/auth.js";
import { clearSessionCookie, setSessionCookie } from "../lib/cookies.js";
import { createRateLimit } from "../lib/rate-limit.js";
import {
  buildOAuthAuthorizeUrl,
  consumeOAuthState,
  createOAuthState,
  createUserSession,
  exchangeCodeForProfile,
  type OAuthProvider,
  upsertOAuthIdentity,
} from "../lib/oauth.js";

const router = Router();
const providerSchema = z.enum(["kakao", "google", "naver"]);
const loginAttemptLimit = createRateLimit({ key: "auth:login:minute", windowMs: 60_000, max: 10, keySource: "ip" });

router.get("/:provider/login", loginAttemptLimit, async (req, res, next) => {
  try {
    const provider = providerSchema.parse(req.params.provider);
    const redirect = z.string().optional().parse(req.query.redirect);
    const state = await createOAuthState(provider, redirect ?? "/", null);
    res.redirect(buildOAuthAuthorizeUrl(provider, state));
  } catch (error) {
    next(error);
  }
});

router.get("/link/:provider", requireAuth, async (req, res, next) => {
  try {
    const provider = providerSchema.parse(req.params.provider);
    const redirect = z.string().optional().parse(req.query.redirect);
    const state = await createOAuthState(provider, redirect ?? "/business/dashboard", req.authUser!.id);
    res.redirect(buildOAuthAuthorizeUrl(provider, state));
  } catch (error) {
    next(error);
  }
});

router.get("/:provider/callback", async (req, res, next) => {
  try {
    const { provider, code, state } = z
      .object({
        provider: providerSchema,
        code: z.string().min(1),
        state: z.string().min(1),
      })
      .parse({
        provider: req.params.provider,
        code: req.query.code,
        state: req.query.state,
      });

    const storedState = await consumeOAuthState(provider, state);
    if (!storedState) {
      return res.status(400).json({ error: "Invalid or expired OAuth state" });
    }

    const profile = await exchangeCodeForProfile(provider, code, state);
    const user = await upsertOAuthIdentity(provider, profile, storedState.link_user_id);

    if (!storedState.link_user_id) {
      const sessionId = await createUserSession(user.id, req);
      setSessionCookie(res, sessionId);
    }

    return res.redirect(storedState.redirect_after || "/");
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    if (!req.authUser) {
      if (req.sessionId) {
        clearSessionCookie(res);
      }
      return res.json({ user: null });
    }

    const providers = await query<{ provider: OAuthProvider }>(
      `SELECT provider
       FROM user_oauth_accounts
       WHERE user_id = $1
       ORDER BY provider`,
      [req.authUser.id],
    );

    return res.json({
      user: {
        ...req.authUser,
        connected_providers: providers.map((row) => row.provider),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    await logoutRequest(req, res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
