import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { auditLogApi } from "../api/resources";
import type { AuditLog } from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { type Column, DataTable } from "../components/ui/DataTable";
import { SelectField, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import type { Tone } from "../lib/status";

const AUDIT_ENTITIES = [
  "Category",
  "Supplier",
  "Product",
  "Customer",
  "CustomerLicense",
  "License",
  "ImportOrder",
  "SalesOrder",
  "InventoryStock",
  "StockTransaction",
  "User",
];

const AUDIT_ACTIONS = ["create", "update", "delete", "login", "logout", "approve", "reject", "export"];

const AUDIT_ACTION_TONE: Record<string, Tone> = {
  create: "success",
  approve: "success",
  update: "info",
  export: "info",
  delete: "danger",
  login: "neutral",
  logout: "neutral",
  reject: "warning",
};

type Filters = {
  entity: string;
  userId: string;
  action: string;
  from: string;
  to: string;
};

const emptyFilters: Filters = { entity: "", userId: "", action: "", from: "", to: "" };

const PAGE_SIZE = 15;

export function AuditLogPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [viewing, setViewing] = useState<AuditLog | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const userId = filters.userId.trim() ? Number(filters.userId.trim()) : undefined;
    auditLogApi.list({
      entity: filters.entity || undefined,
      userId,
      action: filters.action || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((page) => {
        setRows(page.items);
        setTotal(page.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("common.connectionError")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.entity, filters.userId, filters.action, filters.from, filters.to, offset]);

  const updateFilters = (patch: Partial<Filters>) => {
    setOffset(0);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + rows.length, total);

  const columns: Column<AuditLog>[] = [
    { key: "timestamp", header: "Timestamp", render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: "user", header: "User", render: (r) => r.user?.username ?? "-" },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <Badge tone={AUDIT_ACTION_TONE[r.action] ?? "neutral"}>{t(`audit.action.${r.action}`, r.action)}</Badge>
      ),
    },
    { key: "entity", header: "Entity", render: (r) => r.entity },
    { key: "entityId", header: "Entity ID", render: (r) => r.entityId },
    {
      key: "details",
      header: "",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon={<Eye className="h-3.5 w-3.5" />}
            aria-label={t("audit.viewDetails")}
            onClick={() => setViewing(r)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("audit.title")}
        subtitle={t("audit.subtitle")}
        filters={
          <>
            <SelectField
              value={filters.entity}
              onChange={(e) => updateFilters({ entity: e.target.value })}
              aria-label={t("audit.filter.entity")}
            >
              <option value="">{t("audit.allEntities")}</option>
              {AUDIT_ENTITIES.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </SelectField>
            <TextInput
              type="number"
              value={filters.userId}
              onChange={(e) => updateFilters({ userId: e.target.value })}
              placeholder="User ID"
              aria-label={t("audit.filter.user")}
              className="w-28"
            />
            <SelectField
              value={filters.action}
              onChange={(e) => updateFilters({ action: e.target.value })}
              aria-label={t("audit.filter.action")}
            >
              <option value="">{t("audit.allActions")}</option>
              {AUDIT_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {t(`audit.action.${action}`)}
                </option>
              ))}
            </SelectField>
            <TextInput
              type="date"
              value={filters.from}
              onChange={(e) => updateFilters({ from: e.target.value })}
              aria-label={`${t("audit.filter.dateRange")} from`}
              className="w-40"
            />
            <TextInput
              type="date"
              value={filters.to}
              onChange={(e) => updateFilters({ to: e.target.value })}
              aria-label={`${t("audit.filter.dateRange")} to`}
              className="w-40"
            />
          </>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("audit.emptyTitle")} description={t("audit.emptyDesc")} />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} getRowKey={(r) => r.auditLogId} />
          <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
            <span>{t("audit.pageRange", { start: rangeStart, end: rangeEnd, total })}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                {t("audit.prevPage")}
              </Button>
              <span>{t("audit.pageOf", { page, pageCount })}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                {t("audit.nextPage")}
              </Button>
            </div>
          </div>
        </>
      )}

      {viewing && (
        <Modal title={`${viewing.entity} #${viewing.entityId}`} onClose={() => setViewing(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Action:</span> {t(`audit.action.${viewing.action}`, viewing.action)}
              </p>
              <p>
                <span className="font-semibold">User:</span> {viewing.user?.username ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Entity:</span> {viewing.entity} #{viewing.entityId}
              </p>
              <p>
                <span className="font-semibold">Timestamp:</span> {new Date(viewing.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">{t("audit.detailsBefore")}</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
                  {viewing.before === null || viewing.before === undefined
                    ? "null"
                    : JSON.stringify(viewing.before, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">{t("audit.detailsAfter")}</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
                  {viewing.after === null || viewing.after === undefined
                    ? "null"
                    : JSON.stringify(viewing.after, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
