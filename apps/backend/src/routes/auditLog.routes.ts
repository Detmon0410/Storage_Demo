import { Router } from "express";
import { listAuditLogs } from "../controllers/auditLog.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const auditLogRoutes = Router();

auditLogRoutes.get("/", requireAuth, requirePermission("AUDIT_LOG_VIEW"), listAuditLogs);
// Deliberately no POST/PUT/DELETE route registered on this router, ever — AUDIT-03 is enforced
// by omission, not by an application-layer check. Do not add one, even for admin convenience.
