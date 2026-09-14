import { z } from "zod";
import { AuditLogModelQuery } from "../models/auditLog.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const filterSchema = z.object({
  entity: z.string().optional(),
  userId: z.coerce.number().int().optional(),
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const filter = filterSchema.parse(req.query);
  const { items, total } = await AuditLogModelQuery.findMany(filter);
  res.json({ items, total, limit: filter.limit ?? 50, offset: filter.offset ?? 0 });
});
