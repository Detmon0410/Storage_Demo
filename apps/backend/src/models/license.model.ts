import { prisma } from "../lib/prisma.js";
import { computePermitStatus } from "../utils/permitStatus.js";

const withRelations = { company: true, product: true } as const;

const shape = <T extends { expiryDate: Date }>(license: T) => ({
  ...license,
  ...computePermitStatus(license.expiryDate),
});

export const LicenseModel = {
  findAll: async () => {
    const rows = await prisma.license.findMany({ orderBy: { expiryDate: "asc" }, include: withRelations });
    return rows.map(shape);
  },

  findById: async (licenseId: number) => {
    const license = await prisma.license.findUnique({ where: { licenseId }, include: withRelations });
    return license ? shape(license) : null;
  },

  create: async (data: {
    licenseNo: string;
    licenseType: string;
    holderName: string;
    category: string;
    issueDate: Date;
    expiryDate: Date;
    companyId?: number | null;
    productId?: number | null;
  }) => shape(await prisma.license.create({ data, include: withRelations })),

  update: async (
    licenseId: number,
    data: Partial<{
      licenseNo: string;
      licenseType: string;
      holderName: string;
      category: string;
      issueDate: Date;
      expiryDate: Date;
      companyId: number | null;
      productId: number | null;
    }>,
  ) => shape(await prisma.license.update({ where: { licenseId }, data, include: withRelations })),

  delete: (licenseId: number) => prisma.license.delete({ where: { licenseId } }),
};
