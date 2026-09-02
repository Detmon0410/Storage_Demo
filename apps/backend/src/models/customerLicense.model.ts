import { CustomerLicenseStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";

const withRelations = { customer: true } as const;

export const isLicenseValid = (license: { status: CustomerLicenseStatus; expiryDate: Date }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return license.status === CustomerLicenseStatus.ACTIVE && license.expiryDate >= today;
};

export interface CustomerLicenseInput {
  customerId: number;
  licenseNumber: string;
  licenseType: string;
  applicableChannel?: string | null;
  issueDate: Date;
  expiryDate: Date;
  status: CustomerLicenseStatus;
  documentUrl?: string | null;
  notes?: string | null;
  actor?: string;
}

export const CustomerLicenseModel = {
  findAll: () => prisma.customerLicense.findMany({ orderBy: { customerLicenseId: "asc" }, include: withRelations }),

  findById: (customerLicenseId: number) =>
    prisma.customerLicense.findUnique({ where: { customerLicenseId }, include: withRelations }),

  create: (data: CustomerLicenseInput) => {
    const actor = data.actor || "System User";
    return prisma.customerLicense.create({
      data: {
        customerId: data.customerId,
        licenseNumber: data.licenseNumber,
        licenseType: data.licenseType,
        applicableChannel: data.applicableChannel ?? null,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        status: data.status,
        documentUrl: data.documentUrl ?? null,
        notes: data.notes ?? null,
        createdBy: actor,
        updatedBy: actor,
        statusChangedBy: actor,
        statusChangedAt: new Date(),
      },
      include: withRelations,
    });
  },

  update: async (customerLicenseId: number, data: Partial<CustomerLicenseInput>) => {
    const existing = await prisma.customerLicense.findUnique({ where: { customerLicenseId } });
    if (!existing) throw new HttpError(404, "Customer license not found");

    const actor = data.actor || "System User";
    const statusChanged = data.status != null && data.status !== existing.status;

    return prisma.customerLicense.update({
      where: { customerLicenseId },
      data: {
        customerId: data.customerId,
        licenseNumber: data.licenseNumber,
        licenseType: data.licenseType,
        applicableChannel: data.applicableChannel,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        status: data.status,
        documentUrl: data.documentUrl,
        notes: data.notes,
        updatedBy: actor,
        ...(statusChanged ? { statusChangedBy: actor, statusChangedAt: new Date() } : {}),
      },
      include: withRelations,
    });
  },

  delete: (customerLicenseId: number) => prisma.customerLicense.delete({ where: { customerLicenseId } }),

  renew: (customerLicenseId: number, data: { licenseNumber: string; issueDate: Date; expiryDate: Date; documentUrl?: string | null; notes?: string | null; actor?: string }) =>
    prisma.$transaction(async (tx) => {
      const old = await tx.customerLicense.findUnique({ where: { customerLicenseId } });
      if (!old) throw new HttpError(404, "Customer license not found");
      if (old.status !== CustomerLicenseStatus.ACTIVE && old.status !== CustomerLicenseStatus.EXPIRED) {
        throw new HttpError(400, "Only an active or expired license can be renewed");
      }

      const actor = data.actor || "System User";
      const now = new Date();

      if (old.status !== CustomerLicenseStatus.EXPIRED) {
        await tx.customerLicense.update({
          where: { customerLicenseId },
          data: { status: CustomerLicenseStatus.EXPIRED, updatedBy: actor, statusChangedBy: actor, statusChangedAt: now },
        });
      }

      return tx.customerLicense.create({
        data: {
          customerId: old.customerId,
          licenseNumber: data.licenseNumber,
          licenseType: old.licenseType,
          applicableChannel: old.applicableChannel,
          issueDate: data.issueDate,
          expiryDate: data.expiryDate,
          status: CustomerLicenseStatus.ACTIVE,
          documentUrl: data.documentUrl ?? null,
          notes: data.notes ?? null,
          createdBy: actor,
          updatedBy: actor,
          statusChangedBy: actor,
          statusChangedAt: now,
          renewedFromId: customerLicenseId,
        },
        include: withRelations,
      });
    }),
};
