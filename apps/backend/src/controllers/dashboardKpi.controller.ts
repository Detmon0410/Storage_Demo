import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { DashboardKpiModel } from "../models/dashboardKpi.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const listDashboardKpis = asyncHandler(async (_req, res) => {
  res.json(await DashboardKpiModel.findAll());
});

export const getDashboardKpi = asyncHandler(async (req, res) => {
  const kpi = await DashboardKpiModel.findById(Number(req.params.id));
  if (!kpi) throw new HttpError(404, "Dashboard KPI not found");
  res.json(kpi);
});

export const createDashboardKpi = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { metricName, currentValue, unit, monthTrend } = req.body;
  if (!metricName || currentValue == null || !unit || !monthTrend) {
    throw new HttpError(400, "metricName, currentValue, unit, and monthTrend are required");
  }
  const kpi = await prisma.$transaction(async (tx) => {
    const created = await tx.dashboardKpi.create({
      data: { metricName, currentValue: Number(currentValue), unit, monthTrend },
    });
    await AuditLogModel.record(tx, {
      entity: "DashboardKpi",
      entityId: created.dashboardKpiId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(kpi);
});

export const updateDashboardKpi = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { metricName, currentValue, unit, monthTrend } = req.body;
  const kpi = await prisma.$transaction(async (tx) => {
    const before = await tx.dashboardKpi.findUnique({ where: { dashboardKpiId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Dashboard KPI not found");
    const after = await tx.dashboardKpi.update({
      where: { dashboardKpiId: Number(req.params.id) },
      data: {
        metricName,
        currentValue: currentValue == null ? undefined : Number(currentValue),
        unit,
        monthTrend,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "DashboardKpi",
      entityId: after.dashboardKpiId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after,
    });
    return after;
  });
  res.json(kpi);
});

export const deleteDashboardKpi = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.dashboardKpi.findUnique({ where: { dashboardKpiId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Dashboard KPI not found");
    await tx.dashboardKpi.delete({ where: { dashboardKpiId: Number(req.params.id) } });
    await AuditLogModel.record(tx, {
      entity: "DashboardKpi",
      entityId: before.dashboardKpiId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
