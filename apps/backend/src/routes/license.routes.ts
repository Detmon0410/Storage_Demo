import { Router } from "express";
import {
  createLicense,
  deleteLicense,
  getLicense,
  listLicenses,
  updateLicense,
} from "../controllers/license.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const licenseRoutes = Router();

licenseRoutes.get("/", requireAuth, listLicenses);
licenseRoutes.get("/:id", requireAuth, getLicense);
licenseRoutes.post("/", requireAuth, createLicense);
licenseRoutes.put("/:id", requireAuth, updateLicense);
licenseRoutes.delete("/:id", requireAuth, deleteLicense);
