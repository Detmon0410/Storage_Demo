import { Router } from "express";
import {
  createLicense,
  deleteLicense,
  getLicense,
  listLicenses,
  updateLicense,
} from "../controllers/license.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const licenseRoutes = Router();

licenseRoutes.get("/", requireAuth, requirePermission("LICENSE_VIEW"), listLicenses);
licenseRoutes.get("/:id", requireAuth, requirePermission("LICENSE_VIEW"), getLicense);
licenseRoutes.post("/", requireAuth, createLicense);
licenseRoutes.put("/:id", requireAuth, updateLicense);
licenseRoutes.delete("/:id", requireAuth, deleteLicense);
