import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler.js";
import { verifyAccessToken } from "../lib/jwt.js";

export interface AuthenticatedRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(new HttpError(401, "Not authenticated"));
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired session"));
  }
}
