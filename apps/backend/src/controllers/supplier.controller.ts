import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { SupplierModel } from "../models/supplier.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const listSuppliers = asyncHandler(async (_req, res) => {
  res.json(await SupplierModel.findAll());
});

export const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierModel.findById(Number(req.params.id));
  if (!supplier) throw new HttpError(404, "Supplier not found");
  res.json(supplier);
});

export const createSupplier = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { supplierCode, supplierName, country, contactName, email, phone, status } = req.body;
  if (!supplierCode || !supplierName) {
    throw new HttpError(400, "supplierCode and supplierName are required");
  }
  const supplier = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({ data: { supplierCode, supplierName, country, contactName, email, phone, status } });
    await AuditLogModel.record(tx, {
      entity: "Supplier",
      entityId: created.supplierId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(supplier);
});

export const updateSupplier = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { supplierCode, supplierName, country, contactName, email, phone, status } = req.body;
  const supplier = await prisma.$transaction(async (tx) => {
    const before = await tx.supplier.findUnique({ where: { supplierId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Supplier not found");
    const after = await tx.supplier.update({
      where: { supplierId: Number(req.params.id) },
      data: {
        supplierCode,
        supplierName,
        country,
        contactName,
        email,
        phone,
        status,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "Supplier",
      entityId: after.supplierId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after,
    });
    return after;
  });
  res.json(supplier);
});

export const deleteSupplier = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.supplier.findUnique({ where: { supplierId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Supplier not found");
    await tx.supplier.delete({ where: { supplierId: Number(req.params.id) } });
    await AuditLogModel.record(tx, {
      entity: "Supplier",
      entityId: before.supplierId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
