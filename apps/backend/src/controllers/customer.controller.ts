import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { CustomerModel } from "../models/customer.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const optionalNumber = (value: unknown) => (value == null ? undefined : Number(value));

export const listCustomers = asyncHandler(async (_req, res) => {
  res.json(await CustomerModel.findAll());
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await CustomerModel.findById(Number(req.params.id));
  if (!customer) throw new HttpError(404, "Customer not found");
  res.json(customer);
});

export const createCustomer = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { customerCode, customerName, channelType, creditLimit, currentBalance, availableCredit, standardDiscount, creditStatus } =
    req.body;
  if (!customerCode || !customerName || !channelType || creditLimit == null || currentBalance == null || availableCredit == null || standardDiscount == null || !creditStatus) {
    throw new HttpError(400, "customerCode, customerName, channelType, creditLimit, currentBalance, availableCredit, standardDiscount, and creditStatus are required");
  }
  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        customerCode,
        customerName,
        channelType,
        creditLimit: Number(creditLimit),
        currentBalance: Number(currentBalance),
        availableCredit: Number(availableCredit),
        standardDiscount: Number(standardDiscount),
        creditStatus,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "Customer",
      entityId: created.customerId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(customer);
});

export const updateCustomer = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { customerCode, customerName, channelType, creditLimit, currentBalance, availableCredit, standardDiscount, creditStatus } =
    req.body;
  const customer = await prisma.$transaction(async (tx) => {
    const before = await tx.customer.findUnique({ where: { customerId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Customer not found");
    const after = await tx.customer.update({
      where: { customerId: Number(req.params.id) },
      data: {
        customerCode,
        customerName,
        channelType,
        creditLimit: optionalNumber(creditLimit),
        currentBalance: optionalNumber(currentBalance),
        availableCredit: optionalNumber(availableCredit),
        standardDiscount: optionalNumber(standardDiscount),
        creditStatus,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "Customer",
      entityId: after.customerId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after,
    });
    return after;
  });
  res.json(customer);
});

export const deleteCustomer = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.customer.findUnique({ where: { customerId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Customer not found");
    await tx.customer.delete({ where: { customerId: Number(req.params.id) } });
    await AuditLogModel.record(tx, {
      entity: "Customer",
      entityId: before.customerId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
