import { DashboardKpiModel } from "../models/dashboardKpi.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listDashboardKpis = asyncHandler(async (_req, res) => {
  res.json(await DashboardKpiModel.findAll());
});

export const getDashboardKpi = asyncHandler(async (req, res) => {
  const kpi = await DashboardKpiModel.findById(Number(req.params.id));
  if (!kpi) throw new HttpError(404, "Dashboard KPI not found");
  res.json(kpi);
});

export const createDashboardKpi = asyncHandler(async (req, res) => {
  const { metricName, currentValue, unit, monthTrend } = req.body;
  if (!metricName || currentValue == null || !unit || !monthTrend) {
    throw new HttpError(400, "metricName, currentValue, unit, and monthTrend are required");
  }
  res.status(201).json(await DashboardKpiModel.create({ metricName, currentValue: Number(currentValue), unit, monthTrend }));
});

export const updateDashboardKpi = asyncHandler(async (req, res) => {
  const { metricName, currentValue, unit, monthTrend } = req.body;
  res.json(
    await DashboardKpiModel.update(Number(req.params.id), {
      metricName,
      currentValue: currentValue == null ? undefined : Number(currentValue),
      unit,
      monthTrend,
    }),
  );
});

export const deleteDashboardKpi = asyncHandler(async (req, res) => {
  await DashboardKpiModel.delete(Number(req.params.id));
  res.status(204).end();
});
