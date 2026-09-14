import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { LicenseModel } from "../models/license.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { computePermitStatus } from "../utils/permitStatus.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const withRelations = { company: true, product: true } as const;
const shape = <T extends { expiryDate: Date }>(license: T) => ({ ...license, ...computePermitStatus(license.expiryDate) });

const optionalDate = (value: unknown) => (value == null ? undefined : new Date(String(value)));
const optionalNullableId = (value: unknown) => (value === undefined ? undefined : value === null || value === "" ? null : Number(value));

export const listLicenses = asyncHandler(async (_req, res) => {
  res.json(await LicenseModel.findAll());
});

export const getLicense = asyncHandler(async (req, res) => {
  const license = await LicenseModel.findById(Number(req.params.id));
  if (!license) throw new HttpError(404, "License not found");
  res.json(license);
});

export const createLicense = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { licenseNo, licenseType, holderName, category, issueDate, expiryDate, companyId, productId } = req.body;
  if (!licenseNo || !licenseType || !holderName || !category || !issueDate || !expiryDate) {
    throw new HttpError(400, "licenseNo, licenseType, holderName, category, issueDate, and expiryDate are required");
  }
  const license = await prisma.$transaction(async (tx) => {
    const created = await tx.license.create({
      data: {
        licenseNo,
        licenseType,
        holderName,
        category,
        issueDate: new Date(issueDate),
        expiryDate: new Date(expiryDate),
        companyId: optionalNullableId(companyId) ?? null,
        productId: optionalNullableId(productId) ?? null,
      },
      include: withRelations,
    });
    await AuditLogModel.record(tx, {
      entity: "License",
      entityId: created.licenseId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(shape(license));
});

export const updateLicense = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { licenseNo, licenseType, holderName, category, issueDate, expiryDate, companyId, productId } = req.body;
  const license = await prisma.$transaction(async (tx) => {
    const before = await tx.license.findUnique({ where: { licenseId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "License not found");
    const after = await tx.license.update({
      where: { licenseId: Number(req.params.id) },
      data: {
        licenseNo,
        licenseType,
        holderName,
        category,
        issueDate: optionalDate(issueDate),
        expiryDate: optionalDate(expiryDate),
        companyId: optionalNullableId(companyId),
        productId: optionalNullableId(productId),
      },
      include: withRelations,
    });
    await AuditLogModel.record(tx, {
      entity: "License",
      entityId: after.licenseId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after,
    });
    return after;
  });
  res.json(shape(license));
});

export const deleteLicense = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.license.findUnique({ where: { licenseId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "License not found");
    await tx.license.delete({ where: { licenseId: Number(req.params.id) } });
    await AuditLogModel.record(tx, {
      entity: "License",
      entityId: before.licenseId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
