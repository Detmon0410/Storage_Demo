import type { PrismaClient, Prisma } from "@prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

export interface AuditRecordParams {
  entity: string;
  entityId: number | string;
  action: string; // "create" | "update" | "delete" | "login" | "logout" | "approve" | "reject" | "export"
  userId: number | null;
  before: unknown;
  after: unknown;
}

const jsonSafe = (value: unknown) => (value == null ? value : JSON.parse(JSON.stringify(value)));

export const AuditLogModel = {
  record: (client: Client, params: AuditRecordParams) =>
    client.auditLog.create({
      data: {
        entity: params.entity,
        entityId: String(params.entityId),
        action: params.action,
        userId: params.userId,
        before: jsonSafe(params.before),
        after: jsonSafe(params.after),
      },
    }),
};
