import { Router } from "express";
import {
  createDashboardKpi,
  deleteDashboardKpi,
  getDashboardKpi,
  listDashboardKpis,
  updateDashboardKpi,
} from "../controllers/dashboardKpi.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const dashboardKpiRoutes = Router();

dashboardKpiRoutes.get("/", requireAuth, requirePermission("DASHBOARD_VIEW"), listDashboardKpis);
dashboardKpiRoutes.get("/:id", requireAuth, requirePermission("DASHBOARD_VIEW"), getDashboardKpi);
dashboardKpiRoutes.post("/", requireAuth, requirePermission("DASHBOARD_MANAGE"), createDashboardKpi);
dashboardKpiRoutes.put("/:id", requireAuth, requirePermission("DASHBOARD_MANAGE"), updateDashboardKpi);
dashboardKpiRoutes.delete("/:id", requireAuth, requirePermission("DASHBOARD_MANAGE"), deleteDashboardKpi);
