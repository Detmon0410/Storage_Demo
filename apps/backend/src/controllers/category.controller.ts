import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { CategoryModel } from "../models/category.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const listCategories = asyncHandler(async (_req, res) => {
  res.json(await CategoryModel.findAll());
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await CategoryModel.findById(Number(req.params.id));
  if (!category) throw new HttpError(404, "Category not found");
  res.json(category);
});

export const createCategory = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { categoryCode, categoryName, description, isActive } = req.body;
  if (!categoryCode || !categoryName) {
    throw new HttpError(400, "categoryCode and categoryName are required");
  }
  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.category.create({ data: { categoryCode, categoryName, description, isActive } });
    await AuditLogModel.record(tx, {
      entity: "Category",
      entityId: created.categoryId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { categoryCode, categoryName, description, isActive } = req.body;
  const category = await prisma.$transaction(async (tx) => {
    const before = await tx.category.findUnique({ where: { categoryId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Category not found");
    const after = await tx.category.update({
      where: { categoryId: Number(req.params.id) },
      data: { categoryCode, categoryName, description, isActive },
    });
    await AuditLogModel.record(tx, {
      entity: "Category",
      entityId: after.categoryId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after,
    });
    return after;
  });
  res.json(category);
});

export const deleteCategory = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.category.findUnique({ where: { categoryId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Category not found");
    await tx.category.delete({ where: { categoryId: Number(req.params.id) } });
    await AuditLogModel.record(tx, {
      entity: "Category",
      entityId: before.categoryId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
