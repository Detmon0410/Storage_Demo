import type { Prisma } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";

export interface LotQuantityCheckItem {
  inventoryStockId: number;
  quantity: number;
}

export const assertLotQuantityTx = async (tx: Prisma.TransactionClient, items: LotQuantityCheckItem[]) => {
  const ids = [...new Set(items.map((i) => i.inventoryStockId))].filter((id) => Number.isFinite(id));
  if (ids.length === 0) return;

  const lots = await tx.inventoryStock.findMany({ where: { inventoryStockId: { in: ids } } });
  const byId = new Map(lots.map((l) => [l.inventoryStockId, l]));

  for (const item of items) {
    const lot = byId.get(item.inventoryStockId);
    if (!lot) throw new HttpError(404, `Inventory lot ${item.inventoryStockId} not found`);
    if (lot.quantityOnHand < item.quantity) {
      throw new HttpError(
        400,
        `Insufficient stock for lot ${lot.lotBatch}: requested ${item.quantity}, available ${lot.quantityOnHand}`,
      );
    }
  }
};

// D-02: backend suggests the oldest available lot (FIFO by receivedDate) for a product; the
// sales-order UI defaults its lot dropdown to this suggestion but a user may still pick a
// different lot for the same product (not FIFO-forced). Not called from any guard — this is an
// advisory helper only, wired into a lookup path by whichever plan needs to expose it.
export const suggestFifoLot = (tx: Prisma.TransactionClient, productId: number) =>
  tx.inventoryStock.findFirst({
    where: { productId, quantityOnHand: { gt: 0 } },
    orderBy: { receivedDate: "asc" },
  });
