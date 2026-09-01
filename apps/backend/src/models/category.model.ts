import { prisma } from "../lib/prisma.js";

export const CategoryModel = {
  findAll: () => prisma.category.findMany({ orderBy: { categoryId: "asc" } }),

  findById: (categoryId: number) => prisma.category.findUnique({ where: { categoryId } }),

  create: (data: { categoryCode: string; categoryName: string; description?: string; isActive?: boolean }) =>
    prisma.category.create({ data }),

  update: (
    categoryId: number,
    data: Partial<{ categoryCode: string; categoryName: string; description: string; isActive: boolean }>,
  ) => prisma.category.update({ where: { categoryId }, data }),

  delete: (categoryId: number) => prisma.category.delete({ where: { categoryId } }),
};
