import { prisma } from "../lib/prisma.js";

const withRelations = {
  supplier: true,
  items: { include: { product: true } },
} as const;

export interface ImportOrderItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

const toItemRows = (items: ImportOrderItemInput[]) =>
  items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.quantity * item.unitPrice,
  }));

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

  create: (data: {
    orderNo: string;
    supplierId: number;
    country: string;
    incoterms: string;
    orderDate: Date;
    etaDate: Date;
    status: string;
    approver?: string;
    customsEntryNo?: string;
    items: ImportOrderItemInput[];
  }) => {
    const rows = toItemRows(data.items);
    return prisma.importOrder.create({
      data: {
        orderNo: data.orderNo,
        supplierId: data.supplierId,
        country: data.country,
        incoterms: data.incoterms,
        orderDate: data.orderDate,
        etaDate: data.etaDate,
        status: data.status,
        approver: data.approver,
        customsEntryNo: data.customsEntryNo,
        skuItemCount: rows.length,
        totalValue: rows.reduce((sum, row) => sum + row.subtotal, 0),
        items: { create: rows },
      },
      include: withRelations,
    });
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
      status: string;
      approver: string;
      customsEntryNo: string;
      items: ImportOrderItemInput[];
    }>,
  ) => {
    const { items, ...orderFields } = data;
    if (!items) {
      return prisma.importOrder.update({ where: { importOrderId }, data: orderFields, include: withRelations });
    }

    const rows = toItemRows(items);
    return prisma.$transaction(async (tx) => {
      await tx.importOrderItem.deleteMany({ where: { importOrderId } });
      return tx.importOrder.update({
        where: { importOrderId },
        data: {
          ...orderFields,
          skuItemCount: rows.length,
          totalValue: rows.reduce((sum, row) => sum + row.subtotal, 0),
          items: { create: rows },
        },
        include: withRelations,
      });
    });
  },

  delete: (importOrderId: number) => prisma.importOrder.delete({ where: { importOrderId } }),
};
