import { CustomerLicenseStatus } from "@prisma/client";
import { CustomerLicenseModel } from "../models/customerLicense.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const optionalDate = (value: unknown) => (value == null ? undefined : new Date(String(value)));
const optionalString = (value: unknown) => (value == null || value === "" ? null : String(value));

const parseStatus = (value: unknown): CustomerLicenseStatus => {
  if (!Object.values(CustomerLicenseStatus).includes(value as CustomerLicenseStatus)) {
    throw new HttpError(400, `status must be one of ${Object.values(CustomerLicenseStatus).join(", ")}`);
  }
  return value as CustomerLicenseStatus;
};

export const listCustomerLicenses = asyncHandler(async (_req, res) => {
  res.json(await CustomerLicenseModel.findAll());
});

export const getCustomerLicense = asyncHandler(async (req, res) => {
  const license = await CustomerLicenseModel.findById(Number(req.params.id));
  if (!license) throw new HttpError(404, "Customer license not found");
  res.json(license);
});

export const createCustomerLicense = asyncHandler(async (req, res) => {
  const { customerId, licenseNumber, licenseType, applicableChannel, issueDate, expiryDate, status, documentUrl, notes, actor } = req.body;
  if (!customerId || !licenseNumber || !licenseType || !issueDate || !expiryDate || !status) {
    throw new HttpError(400, "customerId, licenseNumber, licenseType, issueDate, expiryDate, and status are required");
  }
  res.status(201).json(
    await CustomerLicenseModel.create({
      customerId: Number(customerId),
      licenseNumber,
      licenseType,
      applicableChannel: optionalString(applicableChannel),
      issueDate: new Date(issueDate),
      expiryDate: new Date(expiryDate),
      status: parseStatus(status),
      documentUrl: optionalString(documentUrl),
      notes: optionalString(notes),
      actor: actor || undefined,
    }),
  );
});

export const updateCustomerLicense = asyncHandler(async (req, res) => {
  const { customerId, licenseNumber, licenseType, applicableChannel, issueDate, expiryDate, status, documentUrl, notes, actor } = req.body;
  res.json(
    await CustomerLicenseModel.update(Number(req.params.id), {
      customerId: customerId == null ? undefined : Number(customerId),
      licenseNumber,
      licenseType,
      applicableChannel: applicableChannel === undefined ? undefined : optionalString(applicableChannel),
      issueDate: optionalDate(issueDate),
      expiryDate: optionalDate(expiryDate),
      status: status == null ? undefined : parseStatus(status),
      documentUrl: documentUrl === undefined ? undefined : optionalString(documentUrl),
      notes: notes === undefined ? undefined : optionalString(notes),
      actor: actor || undefined,
    }),
  );
});

export const deleteCustomerLicense = asyncHandler(async (req, res) => {
  await CustomerLicenseModel.delete(Number(req.params.id));
  res.status(204).end();
});

export const renewCustomerLicense = asyncHandler(async (req, res) => {
  const { licenseNumber, issueDate, expiryDate, documentUrl, notes, actor } = req.body;
  if (!licenseNumber || !issueDate || !expiryDate) {
    throw new HttpError(400, "licenseNumber, issueDate, and expiryDate are required");
  }
  res.status(201).json(
    await CustomerLicenseModel.renew(Number(req.params.id), {
      licenseNumber,
      issueDate: new Date(issueDate),
      expiryDate: new Date(expiryDate),
      documentUrl: optionalString(documentUrl),
      notes: optionalString(notes),
      actor: actor || undefined,
    }),
  );
});
