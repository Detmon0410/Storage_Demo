import { prisma } from "../lib/prisma.js";

const withRelations = {
  product: true,
  importOrderItem: { include: { importOrder: true } },
} as const;

export const InventoryStockModel = {
  findAll: () =>
    prisma.inventoryStock.findMany({
      orderBy: { receivedDate: "asc" },
      include: withRelations,
    }),

  findById: (inventoryStockId: number) =>
    prisma.inventoryStock.findUnique({
      where: { inventoryStockId },
      include: withRelations,
    }),

  create: (data: {
    productId: number;
    importOrderItemId?: number | null;
    lotBatch: string;
    receivedDate: Date;
    quantityOnHand: number;
    stockAgeDays: number;
    stockStatus: string;
    warehouse: string;
  }) => prisma.inventoryStock.create({ data, include: withRelations }),

  update: (
    inventoryStockId: number,
    data: Partial<{
      productId: number;
      importOrderItemId: number | null;
      lotBatch: string;
      receivedDate: Date;
      quantityOnHand: number;
      stockAgeDays: number;
      stockStatus: string;
      warehouse: string;
    }>,
  ) => prisma.inventoryStock.update({ where: { inventoryStockId }, data, include: withRelations }),

  delete: (inventoryStockId: number) => prisma.inventoryStock.delete({ where: { inventoryStockId } }),
};
