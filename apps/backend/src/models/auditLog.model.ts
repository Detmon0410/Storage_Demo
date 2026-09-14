import { prisma } from "../lib/prisma.js";

export interface AuditLogFilter {
  entity?: string;
  userId?: number;
  action?: string;
  from?: Date;
  to?: Date;
}

export const AuditLogModelQuery = {
  findMany: (filter: AuditLogFilter) =>
    prisma.auditLog.findMany({
      where: {
        entity: filter.entity,
        userId: filter.userId,
        action: filter.action,
        createdAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, username: true } } },
    }),
};
