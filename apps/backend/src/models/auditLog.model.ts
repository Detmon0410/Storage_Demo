import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface AuditLogFilter {
  entity?: string;
  userId?: number;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogPage {
  items: Awaited<ReturnType<typeof prisma.auditLog.findMany>>;
  total: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function buildWhere(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
  return {
    entity: filter.entity,
    userId: filter.userId,
    action: filter.action,
    createdAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
  };
}

export const AuditLogModelQuery = {
  findMany: async (filter: AuditLogFilter): Promise<AuditLogPage> => {
    const limit = Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = filter.offset ?? 0;
    const where = buildWhere(filter);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, username: true } } },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  },
};
