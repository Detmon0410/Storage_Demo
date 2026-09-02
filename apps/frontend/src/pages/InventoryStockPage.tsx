import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { importOrderApi, inventoryStockApi, productApi } from "../api/resources";
import type { InventoryStock } from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { type Column, DataTable } from "../components/ui/DataTable";
import { Field, FormGrid, SelectField, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { SearchInput } from "../components/ui/SearchInput";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";
import { useList } from "../hooks/useList";
import { useResource } from "../hooks/useResource";
import { formatDate, formatNumber, toDateInputValue } from "../lib/format";
import { statusTone } from "../lib/status";

type FormState = {
  productId: string;
  importOrderItemId: string;
  lotBatch: string;
  receivedDate: string;
  quantityOnHand: string;
  stockAgeDays: string;
  stockStatus: string;
  warehouse: string;
};

const emptyForm: FormState = {
  productId: "",
  importOrderItemId: "",
  lotBatch: "",
  receivedDate: "",
  quantityOnHand: "",
  stockAgeDays: "0",
  stockStatus: "NORMAL",
  warehouse: "",
};

const STATUS_OPTIONS = ["NORMAL", "AGING_SOON", "AGING"];

export function InventoryStockPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, update, remove } = useResource(
    inventoryStockApi,
    (r) => r.inventoryStockId,
  );
  const products = useList(() => productApi.list());
  const importOrders = useList(() => importOrderApi.list());
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<InventoryStock | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<InventoryStock | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.lotBatch.toLowerCase().includes(q) ||
        (r.product?.productName ?? "").toLowerCase().includes(q) ||
        r.warehouse.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalOnHand = useMemo(() => rows.reduce((sum, r) => sum + r.quantityOnHand, 0), [rows]);
  const agingCount = rows.filter((r) => r.stockStatus !== "NORMAL").length;

  const usedImportOrderItemIds = useMemo(
    () =>
      new Set(
        rows
          .filter((r) => r.inventoryStockId !== editing?.inventoryStockId)
          .map((r) => r.importOrderItemId)
          .filter((id): id is number => id != null),
      ),
    [rows, editing],
  );

  const availableSourceItems = useMemo(() => {
    if (!form.productId) return [];
    return importOrders.flatMap((order) =>
      (order.items ?? [])
        .filter((item) => String(item.productId) === form.productId && !usedImportOrderItemIds.has(item.importOrderItemId))
        .map((item) => ({ ...item, orderNo: order.orderNo, orderStatus: order.status })),
    );
  }, [importOrders, form.productId, usedImportOrderItemIds]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (row: InventoryStock) => {
    setForm({
      productId: String(row.productId),
      importOrderItemId: row.importOrderItemId != null ? String(row.importOrderItemId) : "",
      lotBatch: row.lotBatch,
      receivedDate: toDateInputValue(row.receivedDate),
      quantityOnHand: String(row.quantityOnHand),
      stockAgeDays: String(row.stockAgeDays),
      stockStatus: row.stockStatus,
      warehouse: row.warehouse,
    });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const changeProduct = (productId: string) => setForm({ ...form, productId, importOrderItemId: "" });

  const handleSubmit = async () => {
    if (!form.productId || !form.lotBatch || !form.receivedDate || !form.warehouse) {
      toast.error(t("inventoryStock.toastFillAll"));
      return;
    }
    try {
      const payload = {
        productId: Number(form.productId),
        importOrderItemId: form.importOrderItemId ? Number(form.importOrderItemId) : null,
        lotBatch: form.lotBatch,
        receivedDate: form.receivedDate,
        quantityOnHand: Number(form.quantityOnHand || 0),
        stockAgeDays: Number(form.stockAgeDays || 0),
        stockStatus: form.stockStatus,
        warehouse: form.warehouse,
      };
      if (editing) {
        await update(editing.inventoryStockId, payload);
        toast.success(t("inventoryStock.toast.updated", { lot: form.lotBatch }));
      } else {
        await create(payload);
        toast.success(t("inventoryStock.toast.created", { lot: form.lotBatch }));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.inventoryStockId);
      toast.success(t("inventoryStock.toast.deleted", { lot: deleting.lotBatch }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<InventoryStock>[] = [
    {
      key: "product",
      header: t("common.col.product"),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.product?.productName ?? "-"}</p>
          <p className="font-mono text-xs text-slate-400">{r.product?.productCode}</p>
        </div>
      ),
    },
    { key: "lot", header: t("inventoryStock.col.lot"), render: (r) => <span className="font-mono text-xs">{r.lotBatch}</span> },
    {
      key: "source",
      header: t("inventoryStock.col.source"),
      render: (r) =>
        r.importOrderItem?.importOrder ? (
          <Badge tone="info">{r.importOrderItem.importOrder.orderNo}</Badge>
        ) : (
          <span className="text-xs text-slate-400">{t("inventoryStock.manualEntry")}</span>
        ),
    },
    { key: "warehouse", header: t("common.col.warehouse"), render: (r) => r.warehouse },
    { key: "received", header: t("common.col.receivedDate"), render: (r) => formatDate(r.receivedDate) },
    { key: "qty", header: t("inventoryStock.col.onHand"), render: (r) => formatNumber(r.quantityOnHand) },
    {
      key: "age",
      header: t("inventoryStock.col.ageDays"),
      render: (r) => <span className={r.stockAgeDays > 90 ? "font-semibold text-rose-600" : ""}>{r.stockAgeDays}</span>,
    },
    {
      key: "status",
      header: t("common.col.status"),
      render: (r) => <Badge tone={statusTone(r.stockStatus)}>{t(`status.inventory.${r.stockStatus}`, r.stockStatus)}</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)} icon={<Pencil className="h-3.5 w-3.5" />} />
          <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("inventoryStock.title")}
        subtitle={t("inventoryStock.subtitle", { total: formatNumber(totalOnHand), aging: agingCount })}
        filters={<SearchInput value={search} onChange={setSearch} placeholder={t("inventoryStock.searchPlaceholder")} />}
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("inventoryStock.add")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("inventoryStock.emptyTitle")} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.inventoryStockId}
          rowClassName={(r) => (r.stockStatus === "AGING" ? "bg-rose-50/40" : "")}
        />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("inventoryStock.modalEdit") : t("inventoryStock.modalCreate")}
          subtitle={t("inventoryStock.modalSubtitle")}
          onClose={closeModal}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={closeModal}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
                {t("common.save")}
              </Button>
            </>
          }
        >
          <FormGrid>
            <Field label={t("inventoryStock.field.product")} required colSpan={2}>
              <SelectField value={form.productId} onChange={(e) => changeProduct(e.target.value)}>
                <option value="">{t("inventoryStock.field.productPlaceholder")}</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.productName} ({p.productCode})
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field
              label={t("inventoryStock.field.sourceOrder")}
              colSpan={2}
              helperText={form.productId ? t("inventoryStock.field.sourceOrderHelpWithProduct") : t("inventoryStock.field.sourceOrderHelpNoProduct")}
            >
              <SelectField
                value={form.importOrderItemId}
                onChange={(e) => setForm({ ...form, importOrderItemId: e.target.value })}
                disabled={!form.productId}
              >
                <option value="">{t("inventoryStock.field.sourceOrderNone")}</option>
                {availableSourceItems.map((item) => (
                  <option key={item.importOrderItemId} value={item.importOrderItemId}>
                    {item.orderNo} — {item.quantity} @ {item.unitPrice} ({t(`status.importOrder.${item.orderStatus}`, item.orderStatus)})
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("inventoryStock.field.lotBatch")} required>
              <TextInput value={form.lotBatch} onChange={(e) => setForm({ ...form, lotBatch: e.target.value })} />
            </Field>
            <Field label={t("inventoryStock.field.warehouse")} required>
              <TextInput value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} placeholder={t("inventoryStock.field.warehousePlaceholder")} />
            </Field>
            <Field label={t("inventoryStock.field.receivedDate")} required>
              <TextInput type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />
            </Field>
            <Field label={t("inventoryStock.field.ageDays")}>
              <TextInput type="number" min="0" value={form.stockAgeDays} onChange={(e) => setForm({ ...form, stockAgeDays: e.target.value })} />
            </Field>
            <Field label={t("inventoryStock.field.onHand")} required>
              <TextInput type="number" min="0" value={form.quantityOnHand} onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} />
            </Field>
            <Field label={t("inventoryStock.field.status")}>
              <SelectField value={form.stockStatus} onChange={(e) => setForm({ ...form, stockStatus: e.target.value })}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.inventory.${s}`)}
                  </option>
                ))}
              </SelectField>
            </Field>
          </FormGrid>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("inventoryStock.confirmDeleteTitle")}
          message={t("inventoryStock.confirmDeleteMessage", { lot: deleting.lotBatch })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
