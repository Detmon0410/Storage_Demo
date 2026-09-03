import { Router } from "express";
import {
  createCustomerLicense,
  deleteCustomerLicense,
  getCustomerLicense,
  listCustomerLicenses,
  renewCustomerLicense,
  updateCustomerLicense,
} from "../controllers/customerLicense.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const customerLicenseRoutes = Router();

customerLicenseRoutes.get("/", requireAuth, listCustomerLicenses);
customerLicenseRoutes.get("/:id", requireAuth, getCustomerLicense);
customerLicenseRoutes.post("/", createCustomerLicense);
customerLicenseRoutes.put("/:id", updateCustomerLicense);
customerLicenseRoutes.delete("/:id", deleteCustomerLicense);
customerLicenseRoutes.post("/:id/renew", renewCustomerLicense);
