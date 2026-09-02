import { Router } from "express";
import {
  createCustomerLicense,
  deleteCustomerLicense,
  getCustomerLicense,
  listCustomerLicenses,
  renewCustomerLicense,
  updateCustomerLicense,
} from "../controllers/customerLicense.controller.js";

export const customerLicenseRoutes = Router();

customerLicenseRoutes.get("/", listCustomerLicenses);
customerLicenseRoutes.get("/:id", getCustomerLicense);
customerLicenseRoutes.post("/", createCustomerLicense);
customerLicenseRoutes.put("/:id", updateCustomerLicense);
customerLicenseRoutes.delete("/:id", deleteCustomerLicense);
customerLicenseRoutes.post("/:id/renew", renewCustomerLicense);
