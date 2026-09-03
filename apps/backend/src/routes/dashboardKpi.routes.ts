import { Router } from "express";
import {
  createDashboardKpi,
  deleteDashboardKpi,
  getDashboardKpi,
  listDashboardKpis,
  updateDashboardKpi,
} from "../controllers/dashboardKpi.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardKpiRoutes = Router();

dashboardKpiRoutes.get("/", requireAuth, listDashboardKpis);
dashboardKpiRoutes.get("/:id", requireAuth, getDashboardKpi);
dashboardKpiRoutes.post("/", requireAuth, createDashboardKpi);
dashboardKpiRoutes.put("/:id", requireAuth, updateDashboardKpi);
dashboardKpiRoutes.delete("/:id", deleteDashboardKpi);
