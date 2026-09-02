import { Router } from "express";
import {
  createLicense,
  deleteLicense,
  getLicense,
  listLicenses,
  updateLicense,
} from "../controllers/license.controller.js";

export const licenseRoutes = Router();

licenseRoutes.get("/", listLicenses);
licenseRoutes.get("/:id", getLicense);
licenseRoutes.post("/", createLicense);
licenseRoutes.put("/:id", updateLicense);
licenseRoutes.delete("/:id", deleteLicense);
