import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { categoryApi, productApi, supplierApi } from "../api/resources";
import type { Product } from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { type Column, DataTable } from "../components/ui/DataTable";
import { Field, FormGrid, SelectField, TextInput, TextareaField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { SearchInput } from "../components/ui/SearchInput";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";
import { useList } from "../hooks/useList";
import { useResource } from "../hooks/useResource";
import { formatCurrency, formatNumber } from "../lib/format";
import { statusTone } from "../lib/status";

type FormState = {
  productCode: string;
  productName: string;
  categoryId: string;
  supplierId: string;
  unit: string;
  stockQty: string;
  minStock: string;
  unitPrice: string;
  costPrice: string;
  suggestedPrice: string;
  abvPercent: string;
  packageSizeMl: string;
  currency: string;
  status: string;
  description: string;
};

const emptyForm: FormState = {
  productCode: "",
  productName: "",
  categoryId: "",
  supplierId: "",
  unit: "bottle",
  stockQty: "0",
  minStock: "0",
  unitPrice: "",
  costPrice: "",
  suggestedPrice: "",
  abvPercent: "",
  packageSizeMl: "",
  currency: "JPY",
  status: "READY",
  description: "",
};

const STATUS_OPTIONS = ["READY", "LOW_STOCK", "OUT_OF_STOCK", "SUSPENDED"];

export function ProductsPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, update, remove } = useResource(productApi, (r) => r.productId);
  const categories = useList(() => categoryApi.list());
  const suppliers = useList(() => supplierApi.list());
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q || r.productName.toLowerCase().includes(q) || r.productCode.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || r.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (row: Product) => {
    setForm({
      productCode: row.productCode,
      productName: row.productName,
      categoryId: String(row.categoryId),
      supplierId: String(row.supplierId),
      unit: row.unit,
      stockQty: String(row.stockQty),
      minStock: String(row.minStock),
      unitPrice: row.unitPrice,
      costPrice: row.costPrice ?? "",
      suggestedPrice: row.suggestedPrice ?? "",
      abvPercent: row.abvPercent ?? "",
      packageSizeMl: row.packageSizeMl != null ? String(row.packageSizeMl) : "",
      currency: row.currency,
      status: row.status,
      description: row.description ?? "",
    });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const buildPayload = () => ({
    productCode: form.productCode,
    productName: form.productName,
    categoryId: Number(form.categoryId),
    supplierId: Number(form.supplierId),
    unit: form.unit,
    stockQty: Number(form.stockQty || 0),
    minStock: Number(form.minStock || 0),
    unitPrice: Number(form.unitPrice),
    costPrice: form.costPrice ? Number(form.costPrice) : undefined,
    suggestedPrice: form.suggestedPrice ? Number(form.suggestedPrice) : undefined,
    abvPercent: form.abvPercent ? Number(form.abvPercent) : undefined,
    packageSizeMl: form.packageSizeMl ? Number(form.packageSizeMl) : undefined,
    currency: form.currency,
    status: form.status,
    description: form.description || undefined,
  });

  const handleSubmit = async () => {
    if (!form.categoryId || !form.supplierId) {
      toast.error(t("product.toastSelectRequired"));
      return;
    }
    try {
      const payload = buildPayload();
      if (editing) {
        await update(editing.productId, payload);
        toast.success(t("product.toast.updated", { name: form.productName }));
      } else {
        await create(payload);
        toast.success(t("product.toast.created", { name: form.productName }));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.productId);
      toast.success(t("product.toast.deleted", { name: deleting.productName }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "sku",
      header: t("product.col.skuProduct"),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.productName}</p>
          <p className="font-mono text-xs text-slate-400">{r.productCode}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: t("product.field.category"),
      render: (r) => (r.category ? t(`category.name.${r.category.categoryCode}`, r.category.categoryName) : "-"),
    },
    { key: "supplier", header: t("common.col.supplier"), render: (r) => r.supplier?.supplierName ?? "-" },
    {
      key: "abv",
      header: t("product.col.abvSize"),
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.abvPercent ? `${r.abvPercent}%` : "-"} · {r.packageSizeMl ? `${r.packageSizeMl} ml` : "-"}
        </span>
      ),
    },
    {
      key: "stock",
      header: t("product.col.stock"),
      render: (r) => (
        <span className={r.stockQty <= r.minStock ? "font-semibold text-rose-600" : "text-slate-700"}>
          {formatNumber(r.stockQty)} {r.unit}
        </span>
      ),
    },
    { key: "price", header: t("product.col.price"), render: (r) => formatCurrency(r.unitPrice, r.currency) },
    {
      key: "status",
      header: t("common.col.status"),
      render: (r) => <Badge tone={statusTone(r.status)}>{t(`status.product.${r.status}`, r.status)}</Badge>,
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
        title={t("product.title")}
        subtitle={t("product.subtitle")}
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder={t("product.searchPlaceholder")} />
            <SelectField value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
              <option value="">{t("product.allStatuses")}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`status.product.${s}`)}
                </option>
              ))}
            </SelectField>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              {t("product.add")}
            </Button>
          </>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("product.emptyTitle")} description={t("product.emptyDesc")} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.productId}
          rowClassName={(r) => (r.status === "OUT_OF_STOCK" ? "bg-rose-50/40" : "")}
        />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("product.modalEdit") : t("product.modalCreate")}
          subtitle={t("product.modalSubtitle")}
          onClose={closeModal}
          width="max-w-2xl"
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
            <Field label={t("product.field.code")} required>
              <TextInput value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} />
            </Field>
            <Field label={t("product.field.name")} required>
              <TextInput value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
            </Field>
            <Field label={t("product.field.category")} required>
              <SelectField value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">{t("product.field.categoryPlaceholder")}</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {t(`category.name.${c.categoryCode}`, c.categoryName)}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("product.field.supplier")} required>
              <SelectField value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">{t("product.field.supplierPlaceholder")}</option>
                {suppliers.map((s) => (
                  <option key={s.supplierId} value={s.supplierId}>
                    {s.supplierName}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("product.field.unit")} required>
              <TextInput value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={t("product.field.unitPlaceholder")} />
            </Field>
            <Field label={t("product.field.status")}>
              <SelectField value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.product.${s}`)}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("product.field.abv")} helperText={t("product.field.abvHelp")}>
              <TextInput type="number" step="0.1" min="0" max="75" value={form.abvPercent} onChange={(e) => setForm({ ...form, abvPercent: e.target.value })} />
            </Field>
            <Field label={t("product.field.packageSize")}>
              <TextInput type="number" min="0" value={form.packageSizeMl} onChange={(e) => setForm({ ...form, packageSizeMl: e.target.value })} />
            </Field>
            <Field label={t("product.field.stockQty")} required>
              <TextInput type="number" min="0" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} />
            </Field>
            <Field label={t("product.field.minStock")} helperText={t("product.field.minStockHelp")}>
              <TextInput type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            </Field>
            <Field label={t("product.field.currency")}>
              <SelectField value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="JPY">JPY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </SelectField>
            </Field>
            <Field label={t("product.field.costPrice")}>
              <TextInput type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </Field>
            <Field label={t("product.field.suggestedPrice")}>
              <TextInput type="number" min="0" step="0.01" value={form.suggestedPrice} onChange={(e) => setForm({ ...form, suggestedPrice: e.target.value })} />
            </Field>
            <Field label={t("product.field.unitPrice")} required>
              <TextInput type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            </Field>
            <Field label={t("product.field.description")} colSpan={2}>
              <TextareaField value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("product.confirmDeleteTitle")}
          message={t("product.confirmDeleteMessage", { name: deleting.productName })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
