import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid request",
      details: err.flatten(),
    });
  }

  if (err instanceof Error && "status" in err && typeof (err as { status?: unknown }).status === "number") {
    return res.status((err as { status: number }).status).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
