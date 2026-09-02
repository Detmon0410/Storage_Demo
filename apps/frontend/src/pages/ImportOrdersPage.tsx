import { Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { importOrderApi, productApi, supplierApi } from "../api/resources";
import type { ImportOrder, ImportOrderItem } from "../api/types";
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
import { formatCurrency, formatDate, formatNumber, toDateInputValue } from "../lib/format";
import { statusTone } from "../lib/status";

type ItemRow = { productId: string; quantity: string; unitPrice: string };

type FormState = {
  orderNo: string;
  supplierId: string;
  country: string;
  incoterms: string;
  orderDate: string;
  etaDate: string;
  status: string;
  approver: string;
  customsEntryNo: string;
  items: ItemRow[];
};

const emptyForm: FormState = {
  orderNo: "",
  supplierId: "",
  country: "",
  incoterms: "CIF",
  orderDate: "",
  etaDate: "",
  status: "STAGING",
  approver: "",
  customsEntryNo: "",
  items: [],
};

const STATUS_OPTIONS = ["STAGING", "PENDING_APPROVAL", "APPROVED", "CUSTOMS_CLEARED", "RECEIVED", "ISSUE"];

export function ImportOrdersPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, update, remove } = useResource(
    importOrderApi,
    (r) => r.importOrderId,
  );
  const suppliers = useList(() => supplierApi.list());
  const products = useList(() => productApi.list());
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<ImportOrder | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<ImportOrder | null>(null);
  const [viewingItems, setViewingItems] = useState<ImportOrder | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q || r.orderNo.toLowerCase().includes(q) || (r.supplier?.supplierName ?? "").toLowerCase().includes(q);
      const matchesStatus = !statusFilter || r.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const supplierProducts = useMemo(
    () => products.filter((p) => String(p.supplierId) === form.supplierId),
    [products, form.supplierId],
  );

  const itemsTotal = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (row: ImportOrder) => {
    setForm({
      orderNo: row.orderNo,
      supplierId: String(row.supplierId),
      country: row.country,
      incoterms: row.incoterms,
      orderDate: toDateInputValue(row.orderDate),
      etaDate: toDateInputValue(row.etaDate),
      status: row.status,
      approver: row.approver ?? "",
      customsEntryNo: row.customsEntryNo ?? "",
      items: (row.items ?? []).map((item) => ({
        productId: String(item.productId),
        quantity: String(item.quantity),
        unitPrice: item.unitPrice,
      })),
    });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const changeSupplier = (supplierId: string) => {
    const supplier = suppliers.find((s) => String(s.supplierId) === supplierId);
    setForm({ ...form, supplierId, country: supplier?.country ?? form.country, items: [] });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { productId: "", quantity: "1", unitPrice: "" }] });
  const removeItem = (index: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  const updateItem = (index: number, patch: Partial<ItemRow>) =>
    setForm({ ...form, items: form.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  const handleSubmit = async () => {
    if (!form.supplierId || !form.orderNo || !form.orderDate || !form.etaDate) {
      toast.error(t("importOrder.toastFillAll"));
      return;
    }
    if (form.items.length === 0 || form.items.some((i) => !i.productId || !i.quantity || !i.unitPrice)) {
      toast.error(t("importOrder.toastItemsRequired"));
      return;
    }
    try {
      const payload = {
        orderNo: form.orderNo,
        supplierId: Number(form.supplierId),
        country: form.country,
        incoterms: form.incoterms,
        orderDate: form.orderDate,
        etaDate: form.etaDate,
        status: form.status,
        approver: form.approver || undefined,
        customsEntryNo: form.customsEntryNo || undefined,
        items: form.items.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };
      if (editing) {
        await update(editing.importOrderId, payload);
        toast.success(t("importOrder.toast.updated", { no: form.orderNo }));
      } else {
        await create(payload);
        toast.success(t("importOrder.toast.created", { no: form.orderNo }));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.importOrderId);
      toast.success(t("importOrder.toast.deleted", { no: deleting.orderNo }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<ImportOrder>[] = [
    {
      key: "orderNo",
      header: t("common.col.orderNo"),
      headerClassName: "w-[9%]",
      render: (r) => <span className="font-mono text-xs font-medium text-slate-700">{r.orderNo}</span>,
    },
    {
      key: "supplier",
      header: t("common.col.supplier"),
      headerClassName: "w-[15%]",
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.supplier?.supplierName ?? "-"}</p>
          <p className="text-xs text-slate-400">{r.country}</p>
        </div>
      ),
    },
    {
      key: "items",
      header: t("importOrder.col.items"),
      headerClassName: "w-[15%]",
      render: (r) => {
        const items = r.items ?? [];
        if (items.length === 0) return <span className="text-slate-400">-</span>;
        const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
        return (
          <button
            type="button"
            onClick={() => setViewingItems(r)}
            className="rounded-full text-left transition-opacity hover:opacity-75"
          >
            <Badge tone="info" wrap>
              <Package className="h-3 w-3 shrink-0" />
              {t("importOrder.items.badge", { count: items.length, qty: formatNumber(totalQty) })}
            </Badge>
          </button>
        );
      },
    },
    { key: "incoterms", header: t("importOrder.col.incoterms"), headerClassName: "w-[9%]", render: (r) => r.incoterms },
    { key: "orderDate", header: t("importOrder.col.orderDate"), headerClassName: "w-[8%]", render: (r) => formatDate(r.orderDate) },
    { key: "eta", header: t("importOrder.col.eta"), headerClassName: "w-[7%]", render: (r) => formatDate(r.etaDate) },
    { key: "value", header: t("importOrder.col.value"), headerClassName: "w-[8%]", render: (r) => formatCurrency(r.totalValue) },
    {
      key: "status",
      header: t("common.col.status"),
      headerClassName: "w-[13%]",
      render: (r) => (
        <Badge tone={statusTone(r.status)} wrap>
          {t(`status.importOrder.${r.status}`, r.status)}
        </Badge>
      ),
    },
    {
      key: "approver",
      header: t("importOrder.col.approver"),
      headerClassName: "w-[10%]",
      render: (r) => <span className="text-xs text-slate-500">{r.approver ?? "-"}</span>,
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[8%]",
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
        title={t("importOrder.title")}
        subtitle={t("importOrder.subtitle")}
        filters={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder={t("importOrder.searchPlaceholder")} />
            <SelectField value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
              <option value="">{t("common.allStatuses")}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`status.importOrder.${s}`)}
                </option>
              ))}
            </SelectField>
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("importOrder.add")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("importOrder.emptyTitle")} description={t("importOrder.emptyDesc")} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.importOrderId}
          rowClassName={(r) => (r.status === "ISSUE" ? "bg-rose-50/40" : "")}
          fitContainer
        />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("importOrder.modalEdit") : t("importOrder.modalCreate")}
          subtitle={t("importOrder.modalSubtitle")}
          onClose={closeModal}
          width="max-w-3xl"
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
          <div className="space-y-5">
            <FormGrid>
              <Field label={t("importOrder.field.orderNo")} required>
                <TextInput value={form.orderNo} onChange={(e) => setForm({ ...form, orderNo: e.target.value })} placeholder={t("importOrder.field.orderNoPlaceholder")} />
              </Field>
              <Field label={t("importOrder.field.supplier")} required helperText={t("importOrder.field.supplierHelp")}>
                <SelectField value={form.supplierId} onChange={(e) => changeSupplier(e.target.value)}>
                  <option value="">{t("importOrder.field.supplierPlaceholder")}</option>
                  {suppliers.map((s) => (
                    <option key={s.supplierId} value={s.supplierId}>
                      {s.supplierName}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field label={t("importOrder.field.country")} required>
                <TextInput value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
              <Field label={t("importOrder.field.incoterms")} required>
                <SelectField value={form.incoterms} onChange={(e) => setForm({ ...form, incoterms: e.target.value })}>
                  <option value="CIF">CIF</option>
                  <option value="FOB">FOB</option>
                  <option value="EXW">EXW</option>
                  <option value="DDP">DDP</option>
                </SelectField>
              </Field>
              <Field label={t("importOrder.field.orderDate")} required>
                <TextInput type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
              </Field>
              <Field label={t("importOrder.field.etaDate")} required>
                <TextInput type="date" value={form.etaDate} onChange={(e) => setForm({ ...form, etaDate: e.target.value })} />
              </Field>
              <Field label={t("importOrder.field.status")}>
                <SelectField value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.importOrder.${s}`)}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field label={t("importOrder.field.approver")} helperText={t("importOrder.field.approverHelp")}>
                <TextInput value={form.approver} onChange={(e) => setForm({ ...form, approver: e.target.value })} />
              </Field>
              <Field label={t("importOrder.field.customsEntryNo")} colSpan={2}>
                <TextInput value={form.customsEntryNo} onChange={(e) => setForm({ ...form, customsEntryNo: e.target.value })} />
              </Field>
            </FormGrid>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  {t("importOrder.items.heading")} {form.supplierId && <span className="text-slate-400">{t("importOrder.items.headingScoped")}</span>}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={addItem}
                  disabled={!form.supplierId}
                >
                  {t("importOrder.items.add")}
                </Button>
              </div>

              {!form.supplierId ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                  {t("importOrder.items.selectSupplierFirst")}
                </p>
              ) : form.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                  {t("importOrder.items.empty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {form.items.map((item, index) => (
                    <div key={index} className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="flex-1">
                        <SelectField
                          value={item.productId}
                          onChange={(e) => {
                            const product = supplierProducts.find((p) => String(p.productId) === e.target.value);
                            updateItem(index, {
                              productId: e.target.value,
                              unitPrice: item.unitPrice || product?.costPrice || product?.unitPrice || "",
                            });
                          }}
                          className="bg-white"
                        >
                          <option value="">{t("importOrder.items.productPlaceholder")}</option>
                          {supplierProducts.map((p) => (
                            <option key={p.productId} value={p.productId}>
                              {p.productName} ({p.productCode})
                            </option>
                          ))}
                        </SelectField>
                      </div>
                      <div className="w-24">
                        <TextInput
                          type="number"
                          min="1"
                          placeholder={t("importOrder.items.quantityPlaceholder")}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div className="w-28">
                        <TextInput
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={t("importOrder.items.unitPricePlaceholder")}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div className="w-28 pb-2 text-right text-xs text-slate-500">
                        {formatCurrency(Number(item.quantity || 0) * Number(item.unitPrice || 0))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(index)} icon={<X className="h-3.5 w-3.5 text-rose-500" />} />
                    </div>
                  ))}
                </div>
              )}

              {form.items.length > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">{t("importOrder.items.summary", { count: form.items.length })}</span>
                  <span className="font-semibold text-slate-900">{t("importOrder.items.total", { amount: formatCurrency(itemsTotal) })}</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("importOrder.confirmDeleteTitle")}
          message={t("importOrder.confirmDeleteMessage", { no: deleting.orderNo })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}

      {viewingItems && (
        <Modal
          title={t("importOrder.viewItemsTitle", { no: viewingItems.orderNo })}
          subtitle={t("importOrder.items.summary", { count: (viewingItems.items ?? []).length })}
          onClose={() => setViewingItems(null)}
          width="max-w-2xl"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setViewingItems(null)}>
              {t("common.close")}
            </Button>
          }
        >
          <DataTable
            columns={[
              {
                key: "product",
                header: t("common.col.product"),
                render: (item: ImportOrderItem) => (
                  <div>
                    <p className="font-medium text-slate-900">{item.product?.productName ?? item.productId}</p>
                    <p className="font-mono text-xs text-slate-400">{item.product?.productCode}</p>
                  </div>
                ),
              },
              { key: "quantity", header: t("common.col.quantity"), render: (item: ImportOrderItem) => formatNumber(item.quantity) },
              { key: "unitPrice", header: t("common.col.unitPrice"), render: (item: ImportOrderItem) => formatCurrency(item.unitPrice) },
              { key: "subtotal", header: t("importOrder.items.subtotal"), render: (item: ImportOrderItem) => formatCurrency(item.subtotal) },
            ]}
            rows={viewingItems.items ?? []}
            getRowKey={(item) => item.importOrderItemId}
          />
        </Modal>
      )}
    </div>
  );
}
