import "express";

export interface AuthUser {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
}

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUser | null;
    sessionId?: string | null;
  }
}
