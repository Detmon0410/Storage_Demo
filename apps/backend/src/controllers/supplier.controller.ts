import { SupplierModel } from "../models/supplier.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listSuppliers = asyncHandler(async (_req, res) => {
  res.json(await SupplierModel.findAll());
});

export const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierModel.findById(Number(req.params.id));
  if (!supplier) throw new HttpError(404, "Supplier not found");
  res.json(supplier);
});

export const createSupplier = asyncHandler(async (req, res) => {
  const { supplierCode, supplierName, contactName, email, phone, status } = req.body;
  if (!supplierCode || !supplierName) {
    throw new HttpError(400, "supplierCode and supplierName are required");
  }
  res.status(201).json(await SupplierModel.create({ supplierCode, supplierName, contactName, email, phone, status }));
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const { supplierCode, supplierName, contactName, email, phone, status } = req.body;
  res.json(
    await SupplierModel.update(Number(req.params.id), {
      supplierCode,
      supplierName,
      contactName,
      email,
      phone,
      status,
    }),
  );
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  await SupplierModel.delete(Number(req.params.id));
  res.status(204).end();
});
