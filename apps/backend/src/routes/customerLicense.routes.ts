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
import { requirePermission } from "../middleware/permission.js";

export const customerLicenseRoutes = Router();

customerLicenseRoutes.get("/", requireAuth, requirePermission("CUSTOMER_LICENSE_VIEW"), listCustomerLicenses);
customerLicenseRoutes.get("/:id", requireAuth, requirePermission("CUSTOMER_LICENSE_VIEW"), getCustomerLicense);
customerLicenseRoutes.post("/", requireAuth, createCustomerLicense);
customerLicenseRoutes.put("/:id", requireAuth, updateCustomerLicense);
customerLicenseRoutes.delete("/:id", requireAuth, deleteCustomerLicense);
customerLicenseRoutes.post("/:id/renew", requireAuth, renewCustomerLicense);
