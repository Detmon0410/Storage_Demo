import { CustomerModel } from "../models/customer.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const optionalNumber = (value: unknown) => (value == null ? undefined : Number(value));

export const listCustomers = asyncHandler(async (_req, res) => {
  res.json(await CustomerModel.findAll());
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await CustomerModel.findById(Number(req.params.id));
  if (!customer) throw new HttpError(404, "Customer not found");
  res.json(customer);
});

export const createCustomer = asyncHandler(async (req, res) => {
  const { customerCode, customerName, channelType, creditLimit, currentBalance, availableCredit, standardDiscount, creditStatus } =
    req.body;
  if (!customerCode || !customerName || !channelType || creditLimit == null || currentBalance == null || availableCredit == null || standardDiscount == null || !creditStatus) {
    throw new HttpError(400, "customerCode, customerName, channelType, creditLimit, currentBalance, availableCredit, standardDiscount, and creditStatus are required");
  }
  res.status(201).json(
    await CustomerModel.create({
      customerCode,
      customerName,
      channelType,
      creditLimit: Number(creditLimit),
      currentBalance: Number(currentBalance),
      availableCredit: Number(availableCredit),
      standardDiscount: Number(standardDiscount),
      creditStatus,
    }),
  );
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const { customerCode, customerName, channelType, creditLimit, currentBalance, availableCredit, standardDiscount, creditStatus } =
    req.body;
  res.json(
    await CustomerModel.update(Number(req.params.id), {
      customerCode,
      customerName,
      channelType,
      creditLimit: optionalNumber(creditLimit),
      currentBalance: optionalNumber(currentBalance),
      availableCredit: optionalNumber(availableCredit),
      standardDiscount: optionalNumber(standardDiscount),
      creditStatus,
    }),
  );
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  await CustomerModel.delete(Number(req.params.id));
  res.status(204).end();
});
