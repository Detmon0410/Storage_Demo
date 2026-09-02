import { Router } from "express";
import {
  createDashboardKpi,
  deleteDashboardKpi,
  getDashboardKpi,
  listDashboardKpis,
  updateDashboardKpi,
} from "../controllers/dashboardKpi.controller.js";

export const dashboardKpiRoutes = Router();

dashboardKpiRoutes.get("/", listDashboardKpis);
dashboardKpiRoutes.get("/:id", getDashboardKpi);
dashboardKpiRoutes.post("/", createDashboardKpi);
dashboardKpiRoutes.put("/:id", updateDashboardKpi);
dashboardKpiRoutes.delete("/:id", deleteDashboardKpi);
