import { CustomerLicenseStatus } from "@prisma/client";
import { CustomerLicenseModel } from "../models/customerLicense.model.js";
import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const optionalDate = (value: unknown) => (value == null ? undefined : new Date(String(value)));
const optionalString = (value: unknown) => (value == null || value === "" ? null : String(value));

const parseStatus = (value: unknown): CustomerLicenseStatus => {
  if (!Object.values(CustomerLicenseStatus).includes(value as CustomerLicenseStatus)) {
    throw new HttpError(400, `status must be one of ${Object.values(CustomerLicenseStatus).join(", ")}`);
  }
  return value as CustomerLicenseStatus;
};

export const listCustomerLicenses = asyncHandler(async (_req, res) => {
  res.json(await CustomerLicenseModel.findAll());
});

export const getCustomerLicense = asyncHandler(async (req, res) => {
  const license = await CustomerLicenseModel.findById(Number(req.params.id));
  if (!license) throw new HttpError(404, "Customer license not found");
  res.json(license);
});

export const createCustomerLicense = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { customerId, licenseNumber, licenseType, applicableChannel, issueDate, expiryDate, status, documentUrl, notes, actor } = req.body;
  if (!customerId || !licenseNumber || !licenseType || !issueDate || !expiryDate || !status) {
    throw new HttpError(400, "customerId, licenseNumber, licenseType, issueDate, expiryDate, and status are required");
  }
  const license = await prisma.$transaction(async (tx) => {
    const created = await CustomerLicenseModel.create(
      {
        customerId: Number(customerId),
        licenseNumber,
        licenseType,
        applicableChannel: optionalString(applicableChannel),
        issueDate: new Date(issueDate),
        expiryDate: new Date(expiryDate),
        status: parseStatus(status),
        documentUrl: optionalString(documentUrl),
        notes: optionalString(notes),
        actor: actor || undefined,
      },
      tx,
    );
    await AuditLogModel.record(tx, {
      entity: "CustomerLicense",
      entityId: created.customerLicenseId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(license);
});

export const updateCustomerLicense = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { customerId, licenseNumber, licenseType, applicableChannel, issueDate, expiryDate, status, documentUrl, notes, actor } = req.body;
  const license = await prisma.$transaction(async (tx) => {
    const before = await CustomerLicenseModel.findById(Number(req.params.id));
    if (!before) throw new HttpError(404, "Customer license not found");
    const after = await CustomerLicenseModel.update(
      Number(req.params.id),
      {
        customerId: customerId == null ? undefined : Number(customerId),
        licenseNumber,
        licenseType,
        applicableChannel: applicableChannel === undefined ? undefined : optionalString(applicableChannel),
        issueDate: optionalDate(issueDate),
        expiryDate: optionalDate(expiryDate),
        status: status == null ? undefined : parseStatus(status),
        documentUrl: documentUrl === undefined ? undefined : optionalString(documentUrl),
        notes: notes === undefined ? undefined : optionalString(notes),
        actor: actor || undefined,
      },
      tx,
    );
    await AuditLogModel.record(tx, {
      entity: "CustomerLicense",
      entityId: after.customerLicenseId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after,
    });
    return after;
  });
  res.json(license);
});

export const deleteCustomerLicense = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.customerLicense.findUnique({ where: { customerLicenseId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Customer license not found");
    await tx.customerLicense.delete({ where: { customerLicenseId: Number(req.params.id) } });
    await AuditLogModel.record(tx, {
      entity: "CustomerLicense",
      entityId: before.customerLicenseId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});

export const renewCustomerLicense = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { licenseNumber, issueDate, expiryDate, documentUrl, notes, actor } = req.body;
  if (!licenseNumber || !issueDate || !expiryDate) {
    throw new HttpError(400, "licenseNumber, issueDate, and expiryDate are required");
  }
  const customerLicenseId = Number(req.params.id);
  const newLicense = await prisma.$transaction(async (tx) => {
    const preRenewalSnapshot = await tx.customerLicense.findUnique({ where: { customerLicenseId } });
    if (!preRenewalSnapshot) throw new HttpError(404, "Customer license not found");

    const created = await CustomerLicenseModel.renew(
      customerLicenseId,
      {
        licenseNumber,
        issueDate: new Date(issueDate),
        expiryDate: new Date(expiryDate),
        documentUrl: optionalString(documentUrl),
        notes: optionalString(notes),
        actor: actor || undefined,
      },
      tx,
    );

    if (preRenewalSnapshot.status !== CustomerLicenseStatus.EXPIRED) {
      await AuditLogModel.record(tx, {
        entity: "CustomerLicense",
        entityId: preRenewalSnapshot.customerLicenseId,
        action: "update",
        userId: req.userId ?? null,
        before: preRenewalSnapshot,
        after: { ...preRenewalSnapshot, status: CustomerLicenseStatus.EXPIRED },
      });
    }

    await AuditLogModel.record(tx, {
      entity: "CustomerLicense",
      entityId: created.customerLicenseId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });

    return created;
  });
  res.status(201).json(newLicense);
});
