import * as argon2 from "@node-rs/argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { UserModel } from "../models/user.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const ROLE_CODES = [
  "SYSTEM_ADMIN",
  "MANAGER_APPROVER",
  "IMPORT_COMPLIANCE_OFFICER",
  "WAREHOUSE_DISTRIBUTION_OFFICER",
  "SALES_OFFICER",
  "FINANCE_ACCOUNTING_OFFICER",
] as const;

const roleCodesSchema = z.array(z.enum(ROLE_CODES)).min(1, "At least one role is required");

const createUserSchema = z.object({
  username: z.string().min(1, "username is required"),
  password: z.string().min(8, "password must be at least 8 characters"),
  roleCodes: roleCodesSchema,
});

const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const assignRolesSchema = z.object({
  roleCodes: roleCodesSchema,
});

type UserWithRoles = {
  id: number;
  username: string;
  status: string;
  userRoles: { role: { roleCode: string } }[];
};

function shapeUser(user: UserWithRoles) {
  return {
    id: user.id,
    username: user.username,
    status: user.status,
    roles: user.userRoles.map((ur) => ur.role.roleCode),
  };
}

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await UserModel.findAllWithRoles();
  res.json(users.map(shapeUser));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await UserModel.findByIdWithRoles(Number(req.params.id));
  if (!user) throw new HttpError(404, "User not found");
  res.json(shapeUser(user));
});

export const createUser = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body");
  const { username, password, roleCodes } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const passwordHash = await argon2.hash(password);
    const created = await tx.user.create({ data: { username: username.toLowerCase(), passwordHash } });
    await UserModel.assignRoles(created.id, roleCodes, tx);
    const withRoles = await tx.user.findUnique({ where: { id: created.id }, include: { userRoles: { include: { role: true } } } });
    await AuditLogModel.record(tx, {
      entity: "User",
      entityId: created.id,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: shapeUser(withRoles!),
    });
    return withRoles!;
  });

  res.status(201).json(shapeUser(result));
});

export const updateUser = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body");
  const id = Number(req.params.id);

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    if (!before) throw new HttpError(404, "User not found");
    await UserModel.update(id, parsed.data, tx);
    const after = await tx.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    await AuditLogModel.record(tx, {
      entity: "User",
      entityId: id,
      action: "update",
      userId: req.userId ?? null,
      before: shapeUser(before),
      after: shapeUser(after!),
    });
    return after!;
  });

  res.json(shapeUser(result));
});

export const deactivateUser = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    if (!before) throw new HttpError(404, "User not found");
    await UserModel.deactivate(id, tx);
    const after = await tx.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    await AuditLogModel.record(tx, {
      entity: "User",
      entityId: id,
      action: "update",
      userId: req.userId ?? null,
      before: shapeUser(before),
      after: shapeUser(after!),
    });
    return after!;
  });

  res.json(shapeUser(result));
});

export const reactivateUser = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    if (!before) throw new HttpError(404, "User not found");
    await UserModel.reactivate(id, tx);
    const after = await tx.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    await AuditLogModel.record(tx, {
      entity: "User",
      entityId: id,
      action: "update",
      userId: req.userId ?? null,
      before: shapeUser(before),
      after: shapeUser(after!),
    });
    return after!;
  });

  res.json(shapeUser(result));
});

export const assignUserRoles = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsed = assignRolesSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body");
  const id = Number(req.params.id);

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    if (!before) throw new HttpError(404, "User not found");
    await UserModel.assignRoles(id, parsed.data.roleCodes, tx);
    const after = await tx.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
    await AuditLogModel.record(tx, {
      entity: "User",
      entityId: id,
      action: "update",
      userId: req.userId ?? null,
      before: shapeUser(before),
      after: shapeUser(after!),
    });
    return after!;
  });

  res.json(shapeUser(result));
});
