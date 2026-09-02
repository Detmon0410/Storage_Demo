import { prisma } from "../lib/prisma.js";

export const CustomerModel = {
  findAll: () =>
    prisma.customer.findMany({
      orderBy: { customerId: "asc" },
      include: { licenses: true },
    }),

  findById: (customerId: number) =>
    prisma.customer.findUnique({
      where: { customerId },
      include: { licenses: true },
    }),

  create: (data: {
    customerCode: string;
    customerName: string;
    channelType: string;
    creditLimit: number;
    currentBalance: number;
    availableCredit: number;
    standardDiscount: number;
    creditStatus: string;
  }) => prisma.customer.create({ data }),

  update: (
    customerId: number,
    data: Partial<{
      customerCode: string;
      customerName: string;
      channelType: string;
      creditLimit: number;
      currentBalance: number;
      availableCredit: number;
      standardDiscount: number;
      creditStatus: string;
    }>,
  ) => prisma.customer.update({ where: { customerId }, data }),

  delete: (customerId: number) => prisma.customer.delete({ where: { customerId } }),
};
