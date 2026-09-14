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
licenseRoutes.post("/", requireAuth, requirePermission("LICENSE_CREATE"), createLicense);
licenseRoutes.put("/:id", requireAuth, requirePermission("LICENSE_EDIT"), updateLicense);
licenseRoutes.delete("/:id", requireAuth, requirePermission("LICENSE_DELETE"), deleteLicense);
