import { ImportOrderModel, type ImportOrderItemInput } from "../models/importOrder.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const optionalDate = (value: unknown) => (value == null ? undefined : new Date(String(value)));
const optionalNumber = (value: unknown) => (value == null ? undefined : Number(value));

const parseItems = (value: unknown): ImportOrderItemInput[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, "items must be a non-empty array of { productId, quantity, unitPrice }");
  }
  return value.map((raw) => {
    const { productId, quantity, unitPrice } = raw as Record<string, unknown>;
    if (productId == null || quantity == null || unitPrice == null) {
      throw new HttpError(400, "each item requires productId, quantity, and unitPrice");
    }
    return { productId: Number(productId), quantity: Number(quantity), unitPrice: Number(unitPrice) };
  });
};

export const listImportOrders = asyncHandler(async (_req, res) => {
  res.json(await ImportOrderModel.findAll());
});

export const getImportOrder = asyncHandler(async (req, res) => {
  const order = await ImportOrderModel.findById(Number(req.params.id));
  if (!order) throw new HttpError(404, "Import order not found");
  res.json(order);
});

export const createImportOrder = asyncHandler(async (req, res) => {
  const { orderNo, supplierId, country, incoterms, orderDate, etaDate, status, approver, customsEntryNo, items } =
    req.body;
  if (!orderNo || !supplierId || !country || !incoterms || !orderDate || !etaDate || !status) {
    throw new HttpError(400, "orderNo, supplierId, country, incoterms, orderDate, etaDate, and status are required");
  }
  res.status(201).json(
    await ImportOrderModel.create({
      orderNo,
      supplierId: Number(supplierId),
      country,
      incoterms,
      orderDate: new Date(orderDate),
      etaDate: new Date(etaDate),
      status,
      approver,
      customsEntryNo,
      items: parseItems(items),
    }),
  );
});

export const updateImportOrder = asyncHandler(async (req, res) => {
  const { orderNo, supplierId, country, incoterms, orderDate, etaDate, status, approver, customsEntryNo, items } =
    req.body;
  res.json(
    await ImportOrderModel.update(Number(req.params.id), {
      orderNo,
      supplierId: optionalNumber(supplierId),
      country,
      incoterms,
      orderDate: optionalDate(orderDate),
      etaDate: optionalDate(etaDate),
      status,
      approver,
      customsEntryNo,
      items: items == null ? undefined : parseItems(items),
    }),
  );
});

export const deleteImportOrder = asyncHandler(async (req, res) => {
  await ImportOrderModel.delete(Number(req.params.id));
  res.status(204).end();
});
