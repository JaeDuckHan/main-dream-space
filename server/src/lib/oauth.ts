import type { Request } from "express";
import { query } from "../db.js";
import { createOpaqueToken } from "./auth.js";

export type OAuthProvider = "kakao" | "google" | "naver";

interface ProviderProfile {
  providerUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  rawProfile: unknown;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
}

interface StateRow {
  state: string;
  provider: OAuthProvider;
  redirect_after: string | null;
  link_user_id: number | null;
}

export function getOAuthConfig(provider: OAuthProvider) {
  if (provider === "kakao") {
    return {
      clientId: process.env.KAKAO_CLIENT_ID,
      clientSecret: process.env.KAKAO_CLIENT_SECRET,
      redirectUri: process.env.KAKAO_REDIRECT_URI,
      authUrl: "https://kauth.kakao.com/oauth/authorize",
      tokenUrl: "https://kauth.kakao.com/oauth/token",
      profileUrl: "https://kapi.kakao.com/v2/user/me",
      scope: "",
    };
  }

  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      profileUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
      scope: "openid email profile",
    };
  }

  return {
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    redirectUri: process.env.NAVER_REDIRECT_URI,
    authUrl: "https://nid.naver.com/oauth2.0/authorize",
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    profileUrl: "https://openapi.naver.com/v1/nid/me",
    scope: "",
  };
}

export function assertOAuthConfigured(provider: OAuthProvider) {
  const config = getOAuthConfig(provider);
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    const error = new Error(`${provider} OAuth is not configured`);
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  return config;
}

export function buildOAuthAuthorizeUrl(provider: OAuthProvider, state: string) {
  const config = assertOAuthConfigured(provider);
  const params = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.redirectUri!,
    response_type: "code",
    state,
  });

  if (provider === "google") {
    params.set("scope", config.scope);
  }

  return `${config.authUrl}?${params.toString()}`;
}

export async function createOAuthState(
  provider: OAuthProvider,
  redirectAfter: string | null,
  linkUserId: number | null,
) {
  const state = createOpaqueToken(24);
  await query(
    `INSERT INTO oauth_states (state, provider, redirect_after, link_user_id, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
    [state, provider, redirectAfter, linkUserId],
  );

  return state;
}

export async function consumeOAuthState(provider: OAuthProvider, state: string) {
  const rows = await query<StateRow>(
    `DELETE FROM oauth_states
     WHERE state = $1
       AND provider = $2
       AND expires_at > NOW()
     RETURNING state, provider, redirect_after, link_user_id`,
    [state, provider],
  );

  return rows[0] ?? null;
}

export async function exchangeCodeForProfile(provider: OAuthProvider, code: string, state: string) {
  const config = assertOAuthConfigured(provider);

  if (provider === "kakao") {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        code,
        redirect_uri: config.redirectUri!,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(`Kakao token exchange failed: ${JSON.stringify(tokenJson)}`);
    }

    const profileRes = await fetch(config.profileUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profileJson = await profileRes.json();
    if (!profileRes.ok) {
      throw new Error(`Kakao profile fetch failed: ${JSON.stringify(profileJson)}`);
    }

    const email = profileJson?.kakao_account?.email;
    if (!email) {
      throw new Error("Kakao account did not return an email");
    }

    return {
      providerUserId: String(profileJson.id),
      email,
      displayName: profileJson?.kakao_account?.profile?.nickname ?? null,
      avatarUrl: profileJson?.kakao_account?.profile?.profile_image_url ?? null,
      rawProfile: profileJson,
      accessToken: tokenJson.access_token ?? null,
      refreshToken: tokenJson.refresh_token ?? null,
      expiresAt:
        typeof tokenJson.expires_in === "number"
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null,
    } satisfies ProviderProfile;
  }

  if (provider === "google") {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        redirect_uri: config.redirectUri!,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${JSON.stringify(tokenJson)}`);
    }

    const profileRes = await fetch(config.profileUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profileJson = await profileRes.json();
    if (!profileRes.ok) {
      throw new Error(`Google profile fetch failed: ${JSON.stringify(profileJson)}`);
    }

    if (!profileJson?.email) {
      throw new Error("Google account did not return an email");
    }

    return {
      providerUserId: String(profileJson.sub),
      email: profileJson.email,
      displayName: profileJson.name ?? null,
      avatarUrl: profileJson.picture ?? null,
      rawProfile: profileJson,
      accessToken: tokenJson.access_token ?? null,
      refreshToken: tokenJson.refresh_token ?? null,
      expiresAt:
        typeof tokenJson.expires_in === "number"
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null,
    } satisfies ProviderProfile;
  }

  const tokenUrl = new URL(config.tokenUrl);
  tokenUrl.search = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId!,
    client_secret: config.clientSecret!,
    code,
    state,
  }).toString();

  const tokenRes = await fetch(tokenUrl);
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`Naver token exchange failed: ${JSON.stringify(tokenJson)}`);
  }

  const profileRes = await fetch(config.profileUrl, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profileJson = await profileRes.json();
  if (!profileRes.ok) {
    throw new Error(`Naver profile fetch failed: ${JSON.stringify(profileJson)}`);
  }

  const response = profileJson?.response;
  if (!response?.email) {
    throw new Error("Naver account did not return an email");
  }

  return {
    providerUserId: String(response.id),
    email: response.email,
    displayName: response.name ?? response.nickname ?? null,
    avatarUrl: response.profile_image ?? null,
    rawProfile: profileJson,
    accessToken: tokenJson.access_token ?? null,
    refreshToken: tokenJson.refresh_token ?? null,
    expiresAt:
      typeof tokenJson.expires_in === "string"
        ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
        : null,
  } satisfies ProviderProfile;
}

interface UserRow {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
}

export async function upsertOAuthIdentity(
  provider: OAuthProvider,
  profile: ProviderProfile,
  linkUserId: number | null,
) {
  const existingProvider = await query<{ user_id: number }>(
    `SELECT user_id
     FROM user_oauth_accounts
     WHERE provider = $1 AND provider_user_id = $2
     LIMIT 1`,
    [provider, profile.providerUserId],
  );

  let userId = existingProvider[0]?.user_id ?? null;

  if (linkUserId) {
    if (userId && userId !== linkUserId) {
      throw new Error("This provider account is already linked to another user");
    }

    const currentUser = await query<UserRow>(
      `SELECT id, email, display_name, avatar_url, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [linkUserId],
    );

    const target = currentUser[0];
    if (!target) {
      throw new Error("Current user not found");
    }

    if (target.email.toLowerCase() !== profile.email.toLowerCase()) {
      throw new Error("Provider email does not match the logged-in user");
    }

    userId = linkUserId;
  }

  if (!userId) {
    const existingUser = await query<UserRow>(
      `SELECT id, email, display_name, avatar_url, role
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [profile.email],
    );

    if (existingUser[0]) {
      userId = existingUser[0].id;
    } else {
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
      const role = superAdminEmail && superAdminEmail === profile.email.toLowerCase() ? "admin" : "user";
      const inserted = await query<{ id: number }>(
        `INSERT INTO users (email, display_name, avatar_url, primary_provider, role, last_login_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [profile.email, profile.displayName, profile.avatarUrl, provider, role],
      );
      userId = inserted[0].id;
    }
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const desiredRole = superAdminEmail && superAdminEmail === profile.email.toLowerCase() ? "admin" : null;

  await query(
    `UPDATE users
     SET
       display_name = COALESCE($2, display_name),
       avatar_url = COALESCE($3, avatar_url),
       primary_provider = COALESCE(primary_provider, $4),
       last_login_at = NOW(),
       role = COALESCE($5, role)
     WHERE id = $1`,
    [userId, profile.displayName, profile.avatarUrl, provider, desiredRole],
  );

  await query(
    `INSERT INTO user_oauth_accounts
       (user_id, provider, provider_user_id, access_token, refresh_token, expires_at, raw_profile)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (provider, provider_user_id)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       raw_profile = EXCLUDED.raw_profile,
       connected_at = NOW()`,
    [
      userId,
      provider,
      profile.providerUserId,
      profile.accessToken,
      profile.refreshToken,
      profile.expiresAt,
      JSON.stringify(profile.rawProfile),
    ],
  );

  const users = await query<UserRow>(
    `SELECT id, email, display_name, avatar_url, role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );

  return users[0];
}

export async function createUserSession(userId: number, req: Request) {
  const sessionId = createOpaqueToken(32);
  const lifetimeDays = Number(process.env.SESSION_LIFETIME_DAYS || 30);

  await query(
    `INSERT INTO user_sessions (id, user_id, expires_at, user_agent, ip_address)
     VALUES ($1, $2, NOW() + ($3::text || ' days')::interval, $4, $5)`,
    [sessionId, userId, lifetimeDays, req.get("user-agent") ?? null, req.ip],
  );

  return sessionId;
}
