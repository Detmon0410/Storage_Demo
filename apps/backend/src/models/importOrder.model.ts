import type { PrismaClient, Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { assertProductsNotBlockedTx } from "../utils/licenseGate.js";
import { createStockTransactionTx, reverseAndDeleteByReferenceTx } from "./stockTransaction.model.js";
import { importOrderStockReference } from "../utils/stockReference.js";
import { assertImportValueThresholdTx } from "../utils/importValueGate.js";

type Client = PrismaClient | Prisma.TransactionClient;

const withRelations = {
  supplier: true,
  items: { include: { product: true } },
} as const;

export interface ImportOrderItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  warehouse?: string;
  stockStatus?: string;
}

const toItemRows = (items: ImportOrderItemInput[]) =>
  items.map((item) => {
    const taxRate = item.taxRate ?? 0;
    const subtotal = item.quantity * item.unitPrice;
    const taxAmount = subtotal * (taxRate / 100);
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate,
      taxAmount,
      subtotal,
    };
  });

const orderTotals = (rows: ReturnType<typeof toItemRows>) => {
  const taxTotal = rows.reduce((sum, row) => sum + row.taxAmount, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.subtotal, 0) + taxTotal;
  return { taxTotal, totalValue };
};

const createOrUpdateLotsFromReceivingTx = async (
  tx: Prisma.TransactionClient,
  orderNo: string,
  items: (ImportOrderItemInput & { importOrderItemId?: number })[],
) => {
  const referenceNo = importOrderStockReference(orderNo);
  for (const [index, item] of items.entries()) {
    // quantityOnHand starts at 0 here — createStockTransactionTx below increments it to
    // item.quantity via its InventoryStock sync (03-02), so setting it directly here too
    // would double-count the received quantity.
    const lot = await tx.inventoryStock.create({
      data: {
        productId: item.productId,
        importOrderItemId: item.importOrderItemId ?? null,
        lotBatch: `${orderNo}-${index + 1}`,
        receivedDate: new Date(),
        quantityOnHand: 0,
        stockAgeDays: 0,
        stockStatus: item.stockStatus ?? "NORMAL",
        warehouse: item.warehouse ?? "Unassigned",
      },
    });
    await createStockTransactionTx(tx, {
      transactionNo: `${referenceNo}-${index + 1}`,
      productId: item.productId,
      transactionType: "IN",
      quantity: item.quantity,
      referenceNo,
      inventoryStockId: lot.inventoryStockId,
      note: `Auto-generated from import order ${orderNo} (received)`,
    });
  }
};

export const ImportOrderModel = {
  findAll: () =>
    prisma.importOrder.findMany({
      orderBy: { orderDate: "desc" },
      include: withRelations,
    }),

  findById: (importOrderId: number) =>
    prisma.importOrder.findUnique({
      where: { importOrderId },
      include: withRelations,
    }),

  create: (
    data: {
      orderNo: string;
      supplierId: number;
      country: string;
      incoterms: string;
      orderDate: Date;
      etaDate: Date;
      logisticsStatus: string;
      customsEntryNo?: string;
      items: ImportOrderItemInput[];
      createdById?: number;
    },
    client: Client = prisma,
  ) => {
    const rows = toItemRows(data.items);
    const { totalValue } = orderTotals(rows);
    const { requiresApproval } = assertImportValueThresholdTx(totalValue);
    const status: OrderStatus = requiresApproval ? "PENDING_APPROVAL" : "APPROVED";
    const run = async (tx: Client) => {
      await assertProductsNotBlockedTx(tx as Prisma.TransactionClient, data.items.map((i) => i.productId));
      const order = await tx.importOrder.create({
        data: {
          orderNo: data.orderNo,
          supplierId: data.supplierId,
          country: data.country,
          incoterms: data.incoterms,
          orderDate: data.orderDate,
          etaDate: data.etaDate,
          logisticsStatus: data.logisticsStatus,
          status,
          customsEntryNo: data.customsEntryNo,
          skuItemCount: rows.length,
          ...orderTotals(rows),
          items: { create: rows },
          createdById: data.createdById,
        },
        include: withRelations,
      });
      // APPROVAL-02/03 + Phase 3 RECEIVED-gate precedent: lot creation requires BOTH the logistics
      // pipeline to be at RECEIVED AND the order's approval status to be APPROVED. Gating on only
      // one re-introduces an approval-bypass bug — see RESEARCH.md Anti-Patterns.
      if (data.logisticsStatus === "RECEIVED" && status === "APPROVED") {
        const createdItems = await tx.importOrderItem.findMany({ where: { importOrderId: order.importOrderId } });
        const itemsWithIds = data.items.map((item, index) => ({
          ...item,
          importOrderItemId: createdItems[index]?.importOrderItemId,
        }));
        await createOrUpdateLotsFromReceivingTx(tx as Prisma.TransactionClient, data.orderNo, itemsWithIds);
      }
      return order;
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },

  update: (
    importOrderId: number,
    data: Partial<{
      orderNo: string;
      supplierId: number;
      country: string;
      incoterms: string;
      orderDate: Date;
      etaDate: Date;
      logisticsStatus: string;
      customsEntryNo: string;
      items: ImportOrderItemInput[];
    }>,
    client: Client = prisma,
  ) => {
    const { items, ...orderFields } = data;
    if (!items) {
      return client.importOrder.update({ where: { importOrderId }, data: orderFields, include: withRelations });
    }

    const rows = toItemRows(items);
    const run = async (tx: Client) => {
      const existingStatus = await tx.importOrder.findUnique({
        where: { importOrderId },
        select: { orderNo: true, logisticsStatus: true, status: true },
      });
      if (!existingStatus) throw new HttpError(404, "Import order not found");
      if (existingStatus.logisticsStatus === "RECEIVED") {
        throw new HttpError(400, "Cannot edit items on a received import order; use a stock-adjustment instead");
      }

      await assertProductsNotBlockedTx(tx as Prisma.TransactionClient, items.map((i) => i.productId));
      await reverseAndDeleteByReferenceTx(
        tx as Prisma.TransactionClient,
        importOrderStockReference(existingStatus.orderNo),
      );
      await tx.importOrderItem.deleteMany({ where: { importOrderId } });

      const updated = await tx.importOrder.update({
        where: { importOrderId },
        data: {
          ...orderFields,
          skuItemCount: rows.length,
          ...orderTotals(rows),
          items: { create: rows },
        },
        include: withRelations,
      });

      const orderNo = data.orderNo ?? existingStatus.orderNo;
      const resolvedApprovalStatus = updated.status;
      // Same dual gate as create(): logisticsStatus transitioning to RECEIVED is necessary but not
      // sufficient — the order's approval status must also be APPROVED.
      if (
        data.logisticsStatus === "RECEIVED" &&
        existingStatus.logisticsStatus !== "RECEIVED" &&
        resolvedApprovalStatus === "APPROVED"
      ) {
        const createdItems = await tx.importOrderItem.findMany({ where: { importOrderId } });
        const itemsWithIds = items.map((item, index) => ({
          ...item,
          importOrderItemId: createdItems[index]?.importOrderItemId,
        }));
        await createOrUpdateLotsFromReceivingTx(tx as Prisma.TransactionClient, orderNo, itemsWithIds);
      }
      return updated;
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },

  delete: (importOrderId: number, client: Client = prisma) => {
    const run = async (tx: Client) => {
      const existing = await tx.importOrder.findUnique({ where: { importOrderId }, select: { orderNo: true } });
      if (!existing) throw new HttpError(404, "Import order not found");

      await reverseAndDeleteByReferenceTx(tx as Prisma.TransactionClient, importOrderStockReference(existing.orderNo));
      return tx.importOrder.delete({ where: { importOrderId } });
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },
};
