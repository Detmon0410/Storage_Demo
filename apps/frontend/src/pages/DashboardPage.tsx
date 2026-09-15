import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowRight,
  Clock,
  CreditCard,
  Globe,
  PackageX,
  Receipt,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { customerApi, dashboardKpiApi, importOrderApi, licenseApi, productApi, salesOrderApi } from "../api/resources";
import type { Customer, License, Product } from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { type Column, DataTable } from "../components/ui/DataTable";
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingState } from "../components/ui/States";
import { useList } from "../hooks/useList";
import { formatCurrency, formatDate, formatNumber } from "../lib/format";
import { KPI_CONFIG, trendDirectionOf } from "../lib/kpi";
import { statusTone, trendTone, type Tone } from "../lib/status";

const BAR_TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-slate-300",
};

const DONUT_STROKE_CLASSES: Record<Tone, string> = {
  success: "stroke-emerald-500",
  warning: "stroke-amber-500",
  danger: "stroke-rose-500",
  info: "stroke-sky-500",
  neutral: "stroke-slate-300",
};

const THEME = {
  amber: { chip: "bg-amber-50 text-amber-600", link: "text-amber-600", solid: "bg-amber-600" },
  violet: { chip: "bg-violet-50 text-violet-600", link: "text-violet-600", solid: "bg-violet-600" },
  indigo: { chip: "bg-indigo-50 text-indigo-600", link: "text-indigo-600", solid: "bg-indigo-600" },
  emerald: { chip: "bg-emerald-50 text-emerald-600", link: "text-emerald-600", solid: "bg-emerald-600" },
  rose: { chip: "bg-rose-50 text-rose-600", link: "text-rose-600", solid: "bg-rose-600" },
} as const;

const COUNTRY_BAR_COLORS = ["bg-sky-500", "bg-amber-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-slate-400"];

const DELTA_COLOR: Record<Tone, string> = {
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
  info: "text-sky-600",
  neutral: "text-slate-400",
};

type KpiTile = { label: string; value: string; unit?: string; trend: { label: string; tone: Tone; direction: "up" | "down" | "flat" } };

export function DashboardPage() {
  const { t } = useTranslation();
  const kpis = useList(() => dashboardKpiApi.list());
  const licenses = useList(() => licenseApi.list());
  const customers = useList(() => customerApi.list());
  const products = useList(() => productApi.list());
  const importOrders = useList(() => importOrderApi.list());
  const salesOrders = useList(() => salesOrderApi.list());
  const [transactionTab, setTransactionTab] = useState<"sales" | "imports">("sales");

  const permitBuckets = useMemo(() => {
    const buckets: Record<string, number> = { PREPARATION: 0, NOTIFY: 0, WARNING: 0, IMPORTANT_WARNING: 0, EXPIRED: 0 };
    for (const l of licenses) {
      if (l.status in buckets) buckets[l.status] += 1;
    }
    return buckets;
  }, [licenses]);
  const creditIssues = useMemo(
    () => customers.filter((c) => c.creditStatus === "OVER_LIMIT" || c.creditStatus === "NO_LICENSE"),
    [customers],
  );
  const lowStockProducts = useMemo(
    () => products.filter((p) => p.status === "LOW_STOCK" || p.status === "OUT_OF_STOCK"),
    [products],
  );
  const attentionLicenses = useMemo(
    () =>
      licenses
        .filter((l) => l.status === "WARNING" || l.status === "IMPORTANT_WARNING" || l.status === "EXPIRED")
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [licenses],
  );
  const problemImports = useMemo(() => importOrders.filter((o) => o.status === "ISSUE"), [importOrders]);
  const licenseIssues = permitBuckets.EXPIRED + permitBuckets.IMPORTANT_WARNING;

  const productStatusChart = useMemo(() => {
    const order = ["READY", "LOW_STOCK", "OUT_OF_STOCK", "SUSPENDED"] as const;
    const counts: Record<string, number> = {};
    for (const p of products) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return order.filter((s) => counts[s]).map((s) => ({ code: s, label: t(`status.product.${s}`, s), value: counts[s] }));
  }, [products, t]);

  const countryChart = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const o of importOrders) totals[o.country] = (totals[o.country] ?? 0) + Number(o.totalValue);
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const topN = sorted.slice(0, COUNTRY_BAR_COLORS.length - 1);
    const rest = sorted.slice(COUNTRY_BAR_COLORS.length - 1);
    const chart = topN.map(([country, value], i) => ({ code: country, label: country, value, color: COUNTRY_BAR_COLORS[i] }));
    if (rest.length > 0) {
      chart.push({
        code: "OTHER",
        label: t("dashboard.inventory.otherCountries"),
        value: rest.reduce((sum, [, v]) => sum + v, 0),
        color: COUNTRY_BAR_COLORS[COUNTRY_BAR_COLORS.length - 1],
      });
    }
    return chart;
  }, [importOrders, t]);

  const permitChart = useMemo(
    () =>
      (["PREPARATION", "NOTIFY", "WARNING", "IMPORTANT_WARNING", "EXPIRED"] as const).map((code) => ({
        code,
        label: t(`dashboard.permit.bucket.${code}`),
        value: permitBuckets[code],
      })),
    [permitBuckets, t],
  );

  const banner = useMemo(() => {
    if (licenseIssues > 0) return { tone: "danger" as const, icon: AlertOctagon, message: t("dashboard.banner.licenses", { count: licenseIssues }), to: "/licenses" };
    if (problemImports.length > 0) return { tone: "danger" as const, icon: AlertTriangle, message: t("dashboard.banner.imports", { count: problemImports.length }), to: "/import-orders" };
    if (creditIssues.length > 0) return { tone: "warning" as const, icon: Users, message: t("dashboard.banner.credit", { count: creditIssues.length }), to: "/customers" };
    if (lowStockProducts.length > 0) return { tone: "warning" as const, icon: PackageX, message: t("dashboard.banner.stock", { count: lowStockProducts.length }), to: "/products" };
    return null;
  }, [licenseIssues, problemImports.length, creditIssues.length, lowStockProducts.length, t]);

  const recentImports = useMemo(() => importOrders.slice(0, 5), [importOrders]);
  const recentSales = useMemo(() => salesOrders.slice(0, 5), [salesOrders]);

  const loading = kpis.length === 0 && licenses.length === 0 && products.length === 0 && importOrders.length === 0;

  const kpiTileByMetric = useMemo(() => {
    const map: Record<string, KpiTile> = {};
    for (const k of kpis) {
      const config = KPI_CONFIG[k.metricName];
      if (!config) continue;
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

      map[k.metricName] = {
        label: t(`dashboard.kpi.${k.metricName}`, k.metricName),
        value: config.unit === "JPY" ? formatCurrency(k.currentValue) : formatNumber(k.currentValue, config.valueDigits),
        unit: config.unit === "JPY" ? undefined : unitLabel,
        trend: { label: `${sign}${deltaText} (${t(judgementKey)})`, tone: direction === "flat" ? "neutral" : tone, direction },
      };
    }
    return map;
  }, [kpis, t]);

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
          {banner && <AlertBanner icon={banner.icon} message={banner.message} to={banner.to} tone={banner.tone} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiTileByMetric.MONTHLY_SALES_TOTAL && <HeroStat theme="emerald" icon={ShoppingCart} tile={kpiTileByMetric.MONTHLY_SALES_TOTAL} />}
            {kpiTileByMetric.TOTAL_STOCK_VALUE && <HeroStat theme="violet" icon={Archive} tile={kpiTileByMetric.TOTAL_STOCK_VALUE} />}
            {kpiTileByMetric.TOTAL_OUTSTANDING_CREDIT && <HeroStat theme="rose" icon={CreditCard} tile={kpiTileByMetric.TOTAL_OUTSTANDING_CREDIT} />}
            {kpiTileByMetric.MONTHLY_TAX_DUTY_COST && <HeroStat theme="amber" icon={Receipt} tile={kpiTileByMetric.MONTHLY_TAX_DUTY_COST} />}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiTileByMetric.AVG_IMPORT_LEAD_TIME && (
              <SecondaryStat theme="amber" icon={Clock} tile={kpiTileByMetric.AVG_IMPORT_LEAD_TIME} to="/import-orders" viewAllLabel={t("dashboard.viewAll")} />
            )}
            {kpiTileByMetric.ON_TIME_DELIVERY_RATE && (
              <SecondaryStat theme="emerald" icon={Truck} tile={kpiTileByMetric.ON_TIME_DELIVERY_RATE} to="/sales-orders" viewAllLabel={t("dashboard.viewAll")} />
            )}
            {kpiTileByMetric.INVENTORY_TURNOVER && (
              <SecondaryStat theme="violet" icon={RefreshCw} tile={kpiTileByMetric.INVENTORY_TURNOVER} to="/inventory-stocks" viewAllLabel={t("dashboard.viewAll")} />
            )}
            {kpiTileByMetric.LICENSES_EXPIRING_SOON && (
              <SecondaryStat theme="indigo" icon={ShieldAlert} tile={kpiTileByMetric.LICENSES_EXPIRING_SOON} to="/licenses" viewAllLabel={t("dashboard.viewAll")} />
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <SectionCard
              theme="violet"
              icon={Archive}
              title={t("dashboard.dept.warehouse")}
              viewAllTo="/products"
              viewAllLabel={t("dashboard.viewAll")}
              className="xl:col-span-3"
            >
              <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
                <MiniFact label={t("dashboard.inventory.totalProducts")} value={String(products.length)} />
                <MiniFact label={t("status.product.READY")} value={String(products.filter((p) => p.status === "READY").length)} />
                <MiniFact label={t("dashboard.alert.stockTitle")} value={String(lowStockProducts.length)} />
              </div>
              <DonutChart data={productStatusChart} />
              {countryChart.length > 0 && (
                <>
                  <p className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <Globe className="h-3.5 w-3.5" />
                    {t("dashboard.inventory.byCountry")}
                  </p>
                  <CategoryBarChart data={countryChart} />
                </>
              )}
            </SectionCard>

            <SectionCard
              theme="indigo"
              icon={ShieldAlert}
              title={t("dashboard.dept.compliance")}
              viewAllTo="/licenses"
              viewAllLabel={t("dashboard.viewAll")}
              className="xl:col-span-2"
            >
              <StatusBarChart data={permitChart} />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard theme="amber" icon={PackageX} title={t("dashboard.alert.stockTitle")} viewAllTo="/products" viewAllLabel={t("dashboard.viewAll")}>
              {lowStockProducts.length === 0 ? (
                <EmptyList label={t("dashboard.list.empty")} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {lowStockProducts.slice(0, 5).map((p: Product) => (
                    <ListRow
                      key={p.productId}
                      avatarText={p.productName}
                      avatarTone={statusTone(p.status)}
                      primary={p.productName}
                      secondary={p.productCode}
                      rightTop={`${p.stockQty}/${p.minStock}`}
                      rightBottom={t(`status.product.${p.status}`, p.status)}
                      rightTone={statusTone(p.status)}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard theme="indigo" icon={AlertOctagon} title={t("dashboard.alert.licensesTitle")} viewAllTo="/licenses" viewAllLabel={t("dashboard.viewAll")}>
              {attentionLicenses.length === 0 ? (
                <EmptyList label={t("dashboard.list.empty")} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {attentionLicenses.slice(0, 5).map((l: License) => (
                    <ListRow
                      key={l.licenseId}
                      avatarText={l.holderName}
                      avatarTone={statusTone(l.status)}
                      primary={l.holderName}
                      secondary={l.licenseNo}
                      rightTop={l.daysRemaining >= 0 ? t("dashboard.list.daysLeft", { count: l.daysRemaining }) : t("dashboard.list.daysOverdue", { count: Math.abs(l.daysRemaining) })}
                      rightBottom={t(`status.license.${l.status}`, l.status)}
                      rightTone={statusTone(l.status)}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard theme="rose" icon={Users} title={t("dashboard.alert.creditTitle")} viewAllTo="/customers" viewAllLabel={t("dashboard.viewAll")}>
              {creditIssues.length === 0 ? (
                <EmptyList label={t("dashboard.list.empty")} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {creditIssues.slice(0, 5).map((c: Customer) => (
                    <ListRow
                      key={c.customerId}
                      avatarText={c.customerName}
                      avatarTone={statusTone(c.creditStatus)}
                      primary={c.customerName}
                      secondary={c.customerCode}
                      rightTop={formatCurrency(c.currentBalance)}
                      rightBottom={t(`status.credit.${c.creditStatus}`, c.creditStatus)}
                      rightTone={statusTone(c.creditStatus)}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex gap-1">
                <TabButton active={transactionTab === "sales"} onClick={() => setTransactionTab("sales")} icon={ShoppingCart} label={t("dashboard.tabs.sales")} />
                <TabButton active={transactionTab === "imports"} onClick={() => setTransactionTab("imports")} icon={Truck} label={t("dashboard.tabs.imports")} />
              </div>
              <Link
                to={transactionTab === "sales" ? "/sales-orders" : "/import-orders"}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
              >
                {t("dashboard.viewAll")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-2">
              {transactionTab === "sales" ? (
                recentSales.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">{t("dashboard.noSales")}</p>
                ) : (
                  <DataTable columns={salesColumns} rows={recentSales} getRowKey={(r) => r.salesOrderId} />
                )
              ) : recentImports.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">{t("dashboard.noImports")}</p>
              ) : (
                <DataTable columns={importColumns} rows={recentImports} getRowKey={(r) => r.importOrderId} />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function AlertBanner({ icon: Icon, message, to, tone }: { icon: LucideIcon; message: string; to: string; tone: "danger" | "warning" }) {
  const classes = tone === "danger" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-amber-50 text-amber-700 border-amber-100";
  return (
    <Link to={to} className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80 ${classes}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

function HeroStat({ theme, icon: Icon, tile }: { theme: keyof typeof THEME; icon: LucideIcon; tile: KpiTile }) {
  const c = THEME[theme];
  return (
    <div className={`rounded-xl ${c.solid} p-5 text-white shadow-sm`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-white/15 px-2 py-1 text-xs font-semibold whitespace-nowrap">{tile.trend.label.split(" (")[0]}</span>
      </div>
      <p className="mt-4 text-xs font-medium text-white/80">{tile.label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight">{tile.value}</span>
        {tile.unit && <span className="text-xs text-white/70">{tile.unit}</span>}
      </div>
    </div>
  );
}

function SecondaryStat({
  theme,
  icon: Icon,
  tile,
  to,
  viewAllLabel,
}: {
  theme: keyof typeof THEME;
  icon: LucideIcon;
  tile: KpiTile;
  to: string;
  viewAllLabel: string;
}) {
  const c = THEME[theme];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{tile.label}</p>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${c.chip}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-xl font-bold tracking-tight text-slate-900">{tile.value}</span>
        {tile.unit && <span className="text-xs text-slate-500">{tile.unit}</span>}
      </div>
      <p className={`mt-1.5 text-xs font-medium ${DELTA_COLOR[tile.trend.tone]}`}>{tile.trend.label}</p>
      <Link to={to} className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium hover:underline ${c.link}`}>
        {viewAllLabel} <ArrowRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}

function SectionCard({
  theme,
  icon: Icon,
  title,
  viewAllTo,
  viewAllLabel,
  className = "",
  children,
}: {
  theme: keyof typeof THEME;
  icon: LucideIcon;
  title: string;
  viewAllTo: string;
  viewAllLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const c = THEME[theme];
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.chip}`}>
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </div>
        <Link to={viewAllTo} className={`flex items-center gap-1 text-xs font-medium hover:underline ${c.link}`}>
          {viewAllLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function InitialAvatar({ text, tone }: { text: string; tone: Tone }) {
  const initial = text.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${BAR_TONE_CLASSES[tone]}`}>
      {initial}
    </span>
  );
}

function ListRow({
  avatarText,
  avatarTone,
  primary,
  secondary,
  rightTop,
  rightBottom,
  rightTone,
}: {
  avatarText: string;
  avatarTone: Tone;
  primary: string;
  secondary: string;
  rightTop: string;
  rightBottom: string;
  rightTone: Tone;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <InitialAvatar text={avatarText} tone={avatarTone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{primary}</p>
        <p className="truncate text-xs text-slate-500">{secondary}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-slate-900">{rightTop}</p>
        <Badge tone={rightTone}>{rightBottom}</Badge>
      </div>
    </div>
  );
}

function EmptyList({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-slate-400">{label}</p>;
}

function DonutChart({ data }: { data: { code: string; label: string; value: number }[] }) {
  const size = 96;
  const thickness = 14;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-slate-100" strokeWidth={thickness} />
          {total > 0 &&
            data
              .filter((d) => d.value > 0)
              .map((d) => {
                const dash = (d.value / total) * circumference;
                const el = (
                  <circle
                    key={d.code}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    className={DONUT_STROKE_CLASSES[statusTone(d.code)]}
                    strokeWidth={thickness}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += dash;
                return el;
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-900">{total}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {data
          .filter((d) => d.value > 0)
          .map((d) => (
            <div key={d.code} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
                <span className={`h-2 w-2 shrink-0 rounded-full ${BAR_TONE_CLASSES[statusTone(d.code)]}`} />
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-700">{d.value}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function StatusBarChart({ data }: { data: { code: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.code} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-slate-500" title={d.label}>
            {d.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${BAR_TONE_CLASSES[statusTone(d.code)]}`}
              style={{ width: `${d.value === 0 ? 0 : Math.max((d.value / max) * 100, 6)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryBarChart({ data }: { data: { code: string; label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.code} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-xs text-slate-500" title={d.label}>
            {d.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${d.color}`} style={{ width: `${Math.max((d.value / max) * 100, 6)}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{formatCurrency(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
