import {
  AlertTriangle,
  ArrowRight,
  FileCheck2,
  PackageX,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { customerApi, dashboardKpiApi, importOrderApi, licenseApi, productApi, salesOrderApi } from "../api/resources";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { type Column, DataTable } from "../components/ui/DataTable";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { LoadingState } from "../components/ui/States";
import { useList } from "../hooks/useList";
import { formatCurrency, formatDate, formatNumber } from "../lib/format";
import { KPI_CONFIG, trendDirectionOf } from "../lib/kpi";
import { statusTone, trendTone } from "../lib/status";

export function DashboardPage() {
  const { t } = useTranslation();
  const kpis = useList(() => dashboardKpiApi.list());
  const licenses = useList(() => licenseApi.list());
  const customers = useList(() => customerApi.list());
  const products = useList(() => productApi.list());
  const importOrders = useList(() => importOrderApi.list());
  const salesOrders = useList(() => salesOrderApi.list());

  const expiringLicenses = useMemo(() => licenses.filter((l) => l.daysRemaining <= 30), [licenses]);
  const creditIssues = useMemo(
    () => customers.filter((c) => c.creditStatus === "OVER_LIMIT" || c.creditStatus === "NO_LICENSE"),
    [customers],
  );
  const lowStockProducts = useMemo(
    () => products.filter((p) => p.status === "LOW_STOCK" || p.status === "OUT_OF_STOCK"),
    [products],
  );
  const problemImports = useMemo(() => importOrders.filter((o) => o.status === "ISSUE"), [importOrders]);

  const recentImports = useMemo(() => importOrders.slice(0, 5), [importOrders]);
  const recentSales = useMemo(() => salesOrders.slice(0, 5), [salesOrders]);

  const loading = kpis.length === 0 && licenses.length === 0 && products.length === 0 && importOrders.length === 0;

  const importColumns: Column<(typeof importOrders)[number]>[] = [
    { key: "orderNo", header: t("common.col.orderNo"), render: (r) => <span className="font-mono text-xs">{r.orderNo}</span> },
    { key: "supplier", header: t("common.col.supplier"), render: (r) => r.supplier?.supplierName ?? "-" },
    { key: "eta", header: t("dashboard.col.eta"), render: (r) => formatDate(r.etaDate) },
    { key: "value", header: t("dashboard.col.value"), render: (r) => formatCurrency(r.totalValue) },
    { key: "status", header: t("common.col.status"), render: (r) => <Badge tone={statusTone(r.status)}>{t(`status.importOrder.${r.status}`, r.status)}</Badge> },
  ];

  const salesColumns: Column<(typeof salesOrders)[number]>[] = [
    { key: "orderNo", header: t("common.col.orderNo"), render: (r) => <span className="font-mono text-xs">{r.orderNo}</span> },
    { key: "customer", header: t("common.col.customer"), render: (r) => r.customer?.customerName ?? "-" },
    { key: "net", header: t("common.col.netValue"), render: (r) => formatCurrency(r.netValue) },
    {
      key: "status",
      header: t("salesOrder.col.delivery"),
      render: (r) => <Badge tone={statusTone(r.deliveryStatus)}>{t(`status.delivery.${r.deliveryStatus}`, r.deliveryStatus)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />

      {loading ? (
        <LoadingState label={t("dashboard.loading")} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {kpis.map((k) => {
              const config = KPI_CONFIG[k.metricName];
              if (!config) return null;
              const deltaValue = Number(k.monthTrend);
              const direction = trendDirectionOf(deltaValue);
              const tone = trendTone(direction, config.direction === "higherIsBetter");
              const judgementKey =
                config.direction === "neutral"
                  ? direction === "up"
                    ? "dashboard.trend.increased"
                    : direction === "down"
                      ? "dashboard.trend.decreased"
                      : "dashboard.trend.unchanged"
                  : direction === "flat"
                    ? "dashboard.trend.unchanged"
                    : tone === "success"
                      ? "dashboard.trend.improved"
                      : "dashboard.trend.worsened";
              const unitLabel = config.unit === "JPY" ? "" : t(`dashboard.unit.${config.unit}`);
              const deltaText =
                config.deltaKind === "percent"
                  ? `${Math.abs(deltaValue).toLocaleString()}%`
                  : `${Math.abs(deltaValue).toLocaleString()}${config.unit === "PERCENT" ? "%" : ` ${unitLabel}`}`;
              const sign = deltaValue > 0 ? "+" : deltaValue < 0 ? "-" : "±";

              return (
                <StatCard
                  key={k.dashboardKpiId}
                  label={t(`dashboard.kpi.${k.metricName}`, k.metricName)}
                  value={config.unit === "JPY" ? formatCurrency(k.currentValue) : formatNumber(k.currentValue, config.valueDigits)}
                  unit={config.unit === "JPY" ? undefined : unitLabel}
                  trend={{ label: `${sign}${deltaText} (${t(judgementKey)})`, tone: direction === "flat" ? "neutral" : tone }}
                />
              );
            })}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("dashboard.alertsHeading")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AlertCard
                icon={FileCheck2}
                tone="warning"
                title={t("dashboard.alert.licensesTitle")}
                count={expiringLicenses.length}
                description={t("dashboard.alert.licensesDesc")}
                to="/licenses"
              />
              <AlertCard
                icon={Users}
                tone="danger"
                title={t("dashboard.alert.creditTitle")}
                count={creditIssues.length}
                description={t("dashboard.alert.creditDesc")}
                to="/customers"
              />
              <AlertCard
                icon={PackageX}
                tone="warning"
                title={t("dashboard.alert.stockTitle")}
                count={lowStockProducts.length}
                description={t("dashboard.alert.stockDesc")}
                to="/products"
              />
              <AlertCard
                icon={AlertTriangle}
                tone="danger"
                title={t("dashboard.alert.importsTitle")}
                count={problemImports.length}
                description={t("dashboard.alert.importsDesc")}
                to="/import-orders"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-slate-800">{t("dashboard.recentImports")}</h3>
                </div>
                <Link to="/import-orders" className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline">
                  {t("dashboard.viewAll")} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="p-2">
                {recentImports.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-400">{t("dashboard.noImports")}</p>
                ) : (
                  <DataTable columns={importColumns} rows={recentImports} getRowKey={(r) => r.importOrderId} />
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-slate-800">{t("dashboard.recentSales")}</h3>
                </div>
                <Link to="/sales-orders" className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline">
                  {t("dashboard.viewAll")} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="p-2">
                {recentSales.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-400">{t("dashboard.noSales")}</p>
                ) : (
                  <DataTable columns={salesColumns} rows={recentSales} getRowKey={(r) => r.salesOrderId} />
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertCard({
  icon: Icon,
  tone,
  title,
  count,
  description,
  to,
}: {
  icon: typeof AlertTriangle;
  tone: "warning" | "danger";
  title: string;
  count: number;
  description: string;
  to: string;
}) {
  const toneClasses = tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600";
  return (
    <Link to={to}>
      <Card className="flex h-full items-start gap-3 p-4 transition-shadow hover:shadow-md">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-slate-900">{count}</p>
          <p className="truncate text-sm font-medium text-slate-700">{title}</p>
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
        </div>
      </Card>
    </Link>
  );
}
