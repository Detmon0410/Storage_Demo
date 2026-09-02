import { LicenseModel } from "../models/license.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const optionalDate = (value: unknown) => (value == null ? undefined : new Date(String(value)));
const optionalNumber = (value: unknown) => (value == null ? undefined : Number(value));

export const listLicenses = asyncHandler(async (_req, res) => {
  res.json(await LicenseModel.findAll());
});

export const getLicense = asyncHandler(async (req, res) => {
  const license = await LicenseModel.findById(Number(req.params.id));
  if (!license) throw new HttpError(404, "License not found");
  res.json(license);
});

export const createLicense = asyncHandler(async (req, res) => {
  const { licenseNo, licenseType, holderName, category, issueDate, expiryDate, daysRemaining, status } = req.body;
  if (!licenseNo || !licenseType || !holderName || !category || !issueDate || !expiryDate || daysRemaining == null || !status) {
    throw new HttpError(400, "licenseNo, licenseType, holderName, category, issueDate, expiryDate, daysRemaining, and status are required");
  }
  res.status(201).json(
    await LicenseModel.create({
      licenseNo,
      licenseType,
      holderName,
      category,
      issueDate: new Date(issueDate),
      expiryDate: new Date(expiryDate),
      daysRemaining: Number(daysRemaining),
      status,
    }),
  );
});

export const updateLicense = asyncHandler(async (req, res) => {
  const { licenseNo, licenseType, holderName, category, issueDate, expiryDate, daysRemaining, status } = req.body;
  res.json(
    await LicenseModel.update(Number(req.params.id), {
      licenseNo,
      licenseType,
      holderName,
      category,
      issueDate: optionalDate(issueDate),
      expiryDate: optionalDate(expiryDate),
      daysRemaining: optionalNumber(daysRemaining),
      status,
    }),
  );
});

export const deleteLicense = asyncHandler(async (req, res) => {
  await LicenseModel.delete(Number(req.params.id));
  res.status(204).end();
});
