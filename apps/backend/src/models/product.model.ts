import { prisma } from "../lib/prisma.js";

export const ProductModel = {
  findAll: () =>
    prisma.product.findMany({
      orderBy: { productId: "asc" },
      include: { category: true, supplier: true },
    }),

  findById: (productId: number) =>
    prisma.product.findUnique({
      where: { productId },
      include: { category: true, supplier: true },
    }),

  create: (data: {
    productCode: string;
    productName: string;
    categoryId: number;
    supplierId: number;
    unit: string;
    stockQty?: number;
    minStock?: number;
    unitPrice: number;
    costPrice?: number;
    suggestedPrice?: number;
    abvPercent?: number;
    packageSizeMl?: number;
    currency?: string;
    status?: string;
    description?: string;
  }) => prisma.product.create({ data }),

  update: (
    productId: number,
    data: Partial<{
      productCode: string;
      productName: string;
      categoryId: number;
      supplierId: number;
      unit: string;
      stockQty: number;
      minStock: number;
      unitPrice: number;
      costPrice: number;
      suggestedPrice: number;
      abvPercent: number;
      packageSizeMl: number;
      currency: string;
      status: string;
      description: string;
    }>,
  ) => prisma.product.update({ where: { productId }, data }),

  delete: (productId: number) => prisma.product.delete({ where: { productId } }),
};
