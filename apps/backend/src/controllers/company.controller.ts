import { CompanyModel } from "../models/company.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getCompany = asyncHandler(async (_req, res) => {
  res.json(await CompanyModel.find());
});

export const saveCompany = asyncHandler(async (req, res) => {
  const { legalName, taxId, address } = req.body;
  if (!legalName || !taxId || !address) {
    throw new HttpError(400, "legalName, taxId, and address are required");
  }
  res.json(await CompanyModel.upsert({ legalName, taxId, address }));
});
