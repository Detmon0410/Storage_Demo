import { prisma } from "../lib/prisma.js";

export const DashboardKpiModel = {
  findAll: () => prisma.dashboardKpi.findMany({ orderBy: { dashboardKpiId: "asc" } }),

  findById: (dashboardKpiId: number) => prisma.dashboardKpi.findUnique({ where: { dashboardKpiId } }),

  create: (data: { metricName: string; currentValue: number; unit: string; monthTrend: string }) =>
    prisma.dashboardKpi.create({ data }),

  update: (
    dashboardKpiId: number,
    data: Partial<{ metricName: string; currentValue: number; unit: string; monthTrend: string }>,
  ) => prisma.dashboardKpi.update({ where: { dashboardKpiId }, data }),

  delete: (dashboardKpiId: number) => prisma.dashboardKpi.delete({ where: { dashboardKpiId } }),
};
