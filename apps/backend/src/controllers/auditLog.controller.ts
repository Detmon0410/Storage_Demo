import { z } from "zod";
import { AuditLogModelQuery } from "../models/auditLog.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const filterSchema = z.object({
  entity: z.string().optional(),
  userId: z.coerce.number().int().optional(),
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const filter = filterSchema.parse(req.query);
  res.json(await AuditLogModelQuery.findMany(filter));
});
