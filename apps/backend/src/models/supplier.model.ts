import { prisma } from "../lib/prisma.js";

export const SupplierModel = {
  findAll: () => prisma.supplier.findMany({ orderBy: { supplierId: "asc" } }),

  findById: (supplierId: number) => prisma.supplier.findUnique({ where: { supplierId } }),

  create: (data: {
    supplierCode: string;
    supplierName: string;
    contactName?: string;
    email?: string;
    phone?: string;
    status?: string;
  }) => prisma.supplier.create({ data }),

  update: (
    supplierId: number,
    data: Partial<{
      supplierCode: string;
      supplierName: string;
      contactName: string;
      email: string;
      phone: string;
      status: string;
    }>,
  ) => prisma.supplier.update({ where: { supplierId }, data }),

  delete: (supplierId: number) => prisma.supplier.delete({ where: { supplierId } }),
};
