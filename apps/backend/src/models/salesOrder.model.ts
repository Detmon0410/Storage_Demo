import { prisma } from "../lib/prisma.js";

const withRelations = {
  customer: true,
  items: { include: { product: true } },
} as const;

export interface SalesOrderItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  lotBatch: string;
}

const toItemRows = (items: SalesOrderItemInput[]) =>
  items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    lotBatch: item.lotBatch,
    netValue: item.quantity * item.unitPrice * (1 - item.discount / 100),
  }));

export const SalesOrderModel = {
  findAll: () =>
    prisma.salesOrder.findMany({
      orderBy: { salesOrderId: "asc" },
      include: withRelations,
    }),

  findById: (salesOrderId: number) =>
    prisma.salesOrder.findUnique({
      where: { salesOrderId },
      include: withRelations,
    }),

  create: (data: {
    orderNo: string;
    customerId: number;
    deliveryStatus: string;
    invoiceNo: string;
    approver?: string;
    items: SalesOrderItemInput[];
  }) => {
    const rows = toItemRows(data.items);
    return prisma.salesOrder.create({
      data: {
        orderNo: data.orderNo,
        customerId: data.customerId,
        deliveryStatus: data.deliveryStatus,
        invoiceNo: data.invoiceNo,
        approver: data.approver,
        netValue: rows.reduce((sum, row) => sum + row.netValue, 0),
        items: { create: rows },
      },
      include: withRelations,
    });
  },

  update: (
    salesOrderId: number,
    data: Partial<{
      orderNo: string;
      customerId: number;
      deliveryStatus: string;
      invoiceNo: string;
      approver: string;
      items: SalesOrderItemInput[];
    }>,
  ) => {
    const { items, ...orderFields } = data;
    if (!items) {
      return prisma.salesOrder.update({ where: { salesOrderId }, data: orderFields, include: withRelations });
    }

    const rows = toItemRows(items);
    return prisma.$transaction(async (tx) => {
      await tx.salesOrderItem.deleteMany({ where: { salesOrderId } });
      return tx.salesOrder.update({
        where: { salesOrderId },
        data: {
          ...orderFields,
          netValue: rows.reduce((sum, row) => sum + row.netValue, 0),
          items: { create: rows },
        },
        include: withRelations,
      });
    });
  },

  delete: (salesOrderId: number) => prisma.salesOrder.delete({ where: { salesOrderId } }),
};
