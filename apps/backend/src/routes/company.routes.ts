import { Router } from "express";
import { getCompany, saveCompany } from "../controllers/company.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const companyRoutes = Router();

companyRoutes.get("/", requireAuth, getCompany);
companyRoutes.put("/", requireAuth, saveCompany);
