import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";

const withRelations = {
  product: true,
  importOrderItem: { include: { importOrder: true } },
} as const;

export type StockAdjustmentReasonCode = "DAMAGE" | "THEFT" | "RECOUNT" | "EXPIRY" | "CORRECTION" | "OTHER";

export interface StockAdjustmentInput {
  inventoryStockId: number;
  delta: number; // signed: positive = add, negative = remove
  reasonCode: StockAdjustmentReasonCode;
  note?: string;
}

export const adjustStockTx = async (tx: Prisma.TransactionClient, data: StockAdjustmentInput) => {
  const lot = await tx.inventoryStock.findUnique({ where: { inventoryStockId: data.inventoryStockId } });
  if (!lot) throw new HttpError(404, `Inventory lot ${data.inventoryStockId} not found`);
  if (lot.quantityOnHand + data.delta < 0) {
    throw new HttpError(400, `Adjustment would make quantity negative for lot ${lot.lotBatch}`);
  }
  const after = await tx.inventoryStock.update({
    where: { inventoryStockId: data.inventoryStockId },
    data: { quantityOnHand: { increment: data.delta } },
  });
  return { before: lot, after };
};

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
      stockAgeDays: number;
      stockStatus: string;
      warehouse: string;
    }>,
  ) => prisma.inventoryStock.update({ where: { inventoryStockId }, data, include: withRelations }),

  delete: (inventoryStockId: number) => prisma.inventoryStock.delete({ where: { inventoryStockId } }),
};
