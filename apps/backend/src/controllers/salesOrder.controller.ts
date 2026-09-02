import { SalesOrderModel, type SalesOrderItemInput } from "../models/salesOrder.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const parseItems = (value: unknown): SalesOrderItemInput[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, "items must be a non-empty array of { productId, quantity, unitPrice, discount, lotBatch }");
  }
  return value.map((raw) => {
    const { productId, quantity, unitPrice, discount, lotBatch } = raw as Record<string, unknown>;
    if (productId == null || quantity == null || unitPrice == null || discount == null || !lotBatch) {
      throw new HttpError(400, "each item requires productId, quantity, unitPrice, discount, and lotBatch");
    }
    return {
      productId: Number(productId),
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      discount: Number(discount),
      lotBatch: String(lotBatch),
    };
  });
};

export const listSalesOrders = asyncHandler(async (_req, res) => {
  res.json(await SalesOrderModel.findAll());
});

export const getSalesOrder = asyncHandler(async (req, res) => {
  const order = await SalesOrderModel.findById(Number(req.params.id));
  if (!order) throw new HttpError(404, "Sales order not found");
  res.json(order);
});

export const createSalesOrder = asyncHandler(async (req, res) => {
  const { orderNo, customerId, customerLicenseId, deliveryStatus, invoiceNo, approver, items } = req.body;
  if (!orderNo || !customerId || !deliveryStatus || !invoiceNo) {
    throw new HttpError(400, "orderNo, customerId, deliveryStatus, and invoiceNo are required");
  }
  if (!customerLicenseId) {
    throw new HttpError(400, "A valid customer license must be selected");
  }
  res.status(201).json(
    await SalesOrderModel.create({
      orderNo,
      customerId: Number(customerId),
      customerLicenseId: Number(customerLicenseId),
      deliveryStatus,
      invoiceNo,
      approver,
      items: parseItems(items),
    }),
  );
});

export const updateSalesOrder = asyncHandler(async (req, res) => {
  const { orderNo, customerId, customerLicenseId, deliveryStatus, invoiceNo, approver, items } = req.body;
  res.json(
    await SalesOrderModel.update(Number(req.params.id), {
      orderNo,
      customerId: customerId == null ? undefined : Number(customerId),
      customerLicenseId: customerLicenseId == null ? undefined : Number(customerLicenseId),
      deliveryStatus,
      invoiceNo,
      approver,
      items: items == null ? undefined : parseItems(items),
    }),
  );
});

export const deleteSalesOrder = asyncHandler(async (req, res) => {
  await SalesOrderModel.delete(Number(req.params.id));
  res.status(204).end();
});
