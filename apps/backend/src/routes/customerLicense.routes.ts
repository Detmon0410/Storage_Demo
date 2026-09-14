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
customerLicenseRoutes.post("/", requireAuth, requirePermission("CUSTOMER_LICENSE_CREATE"), createCustomerLicense);
customerLicenseRoutes.put("/:id", requireAuth, requirePermission("CUSTOMER_LICENSE_EDIT"), updateCustomerLicense);
customerLicenseRoutes.delete("/:id", requireAuth, requirePermission("CUSTOMER_LICENSE_DELETE"), deleteCustomerLicense);
customerLicenseRoutes.post("/:id/renew", requireAuth, requirePermission("CUSTOMER_LICENSE_EDIT"), renewCustomerLicense);
