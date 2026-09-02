import { prisma } from "../lib/prisma.js";

export const LicenseModel = {
  findAll: () => prisma.license.findMany({ orderBy: { expiryDate: "asc" } }),

  findById: (licenseId: number) => prisma.license.findUnique({ where: { licenseId } }),

  create: (data: {
    licenseNo: string;
    licenseType: string;
    holderName: string;
    category: string;
    issueDate: Date;
    expiryDate: Date;
    daysRemaining: number;
    status: string;
  }) => prisma.license.create({ data }),

  update: (
    licenseId: number,
    data: Partial<{
      licenseNo: string;
      licenseType: string;
      holderName: string;
      category: string;
      issueDate: Date;
      expiryDate: Date;
      daysRemaining: number;
      status: string;
    }>,
  ) => prisma.license.update({ where: { licenseId }, data }),

  delete: (licenseId: number) => prisma.license.delete({ where: { licenseId } }),
};
