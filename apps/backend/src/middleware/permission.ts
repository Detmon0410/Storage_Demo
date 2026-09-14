import type { NextFunction, Response } from "express";
import { HttpError } from "./errorHandler.js";
import { RoleModel } from "../models/role.model.js";
import type { AuthenticatedRequest } from "./auth.js";

export interface PermissionRequest extends AuthenticatedRequest {
  permissions?: Set<string>;
}

export function requirePermission(code: string) {
  return async (req: PermissionRequest, _res: Response, next: NextFunction) => {
    if (!req.userId) return next(new HttpError(401, "Not authenticated"));
    try {
      req.permissions ??= await RoleModel.getUserPermissionCodes(req.userId);
      if (!req.permissions.has(code)) {
        return next(new HttpError(403, "Insufficient permissions"));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
