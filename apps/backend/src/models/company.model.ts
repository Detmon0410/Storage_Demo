import { prisma } from "../lib/prisma.js";

const SINGLETON_ID = 1;

export const CompanyModel = {
  find: () => prisma.company.findUnique({ where: { companyId: SINGLETON_ID } }),

  upsert: (data: { legalName: string; taxId: string; address: string }) =>
    prisma.company.upsert({
      where: { companyId: SINGLETON_ID },
      create: { companyId: SINGLETON_ID, ...data },
      update: data,
    }),
};
