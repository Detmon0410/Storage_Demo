import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { productApi, stockTransactionApi } from "../api/resources";
import type { StockTransaction, TransactionType } from "../api/types";
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
import { formatDate, formatNumber } from "../lib/format";
import type { Tone } from "../lib/status";

type FormState = {
  transactionNo: string;
  productId: string;
  transactionType: TransactionType;
  quantity: string;
  referenceNo: string;
  note: string;
};

const emptyForm: FormState = {
  transactionNo: "",
  productId: "",
  transactionType: "IN",
  quantity: "",
  referenceNo: "",
  note: "",
};

const TYPE_TONE: Record<TransactionType, Tone> = { IN: "success", OUT: "danger", ADJUSTMENT: "info" };

export function StockTransactionsPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, remove } = useResource(
    stockTransactionApi,
    (r) => r.transactionId,
  );
  const products = useList(() => productApi.list());
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StockTransaction | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        r.transactionNo.toLowerCase().includes(q) ||
        (r.product?.productName ?? "").toLowerCase().includes(q) ||
        (r.referenceNo ?? "").toLowerCase().includes(q);
      const matchesType = !typeFilter || r.transactionType === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [rows, search, typeFilter]);

  const openCreate = () => {
    setForm(emptyForm);
    setCreating(true);
  };

  const handleSubmit = async () => {
    if (!form.productId || !form.transactionNo || !form.quantity) {
      toast.error(t("stockTransaction.toastFillAll"));
      return;
    }
    try {
      await create({
        transactionNo: form.transactionNo,
        productId: Number(form.productId),
        transactionType: form.transactionType,
        quantity: Number(form.quantity),
        referenceNo: form.referenceNo || undefined,
        note: form.note || undefined,
      });
      toast.success(t("stockTransaction.toastSuccess", { no: form.transactionNo }));
      setCreating(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.transactionId);
      toast.success(t("stockTransaction.toastDeleted", { no: deleting.transactionNo }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<StockTransaction>[] = [
    { key: "no", header: t("stockTransaction.col.transactionNo"), render: (r) => <span className="font-mono text-xs text-slate-500">{r.transactionNo}</span> },
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
    {
      key: "type",
      header: t("stockTransaction.col.type"),
      render: (r) => <Badge tone={TYPE_TONE[r.transactionType]}>{t(`status.transaction.${r.transactionType}`)}</Badge>,
    },
    {
      key: "qty",
      header: t("common.col.quantity"),
      render: (r) => (
        <span className={r.transactionType === "OUT" ? "text-rose-600" : "text-emerald-600"}>
          {r.transactionType === "OUT" ? "-" : "+"}
          {formatNumber(r.quantity)}
        </span>
      ),
    },
    { key: "date", header: t("stockTransaction.col.date"), render: (r) => formatDate(r.transactionDate) },
    { key: "ref", header: t("stockTransaction.col.refLot"), render: (r) => r.referenceNo ?? "-" },
    { key: "note", header: t("stockTransaction.col.note"), render: (r) => <span className="text-slate-500">{r.note ?? "-"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("stockTransaction.title")}
        subtitle={t("stockTransaction.subtitle")}
        filters={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder={t("stockTransaction.searchPlaceholder")} />
            <SelectField value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
              <option value="">{t("stockTransaction.allTypes")}</option>
              <option value="IN">{t("status.transaction.IN")}</option>
              <option value="OUT">{t("status.transaction.OUT")}</option>
              <option value="ADJUSTMENT">{t("status.transaction.ADJUSTMENT")}</option>
            </SelectField>
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("stockTransaction.add")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("stockTransaction.emptyTitle")} />
      ) : (
        <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.transactionId} />
      )}

      {creating && (
        <Modal
          title={t("stockTransaction.modalTitle")}
          subtitle={t("stockTransaction.modalSubtitle")}
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
                {t("common.save")}
              </Button>
            </>
          }
        >
          <FormGrid>
            <Field label={t("stockTransaction.field.transactionNo")} required>
              <TextInput
                value={form.transactionNo}
                onChange={(e) => setForm({ ...form, transactionNo: e.target.value })}
                placeholder={t("stockTransaction.field.transactionNoPlaceholder")}
              />
            </Field>
            <Field label={t("stockTransaction.field.type")} required>
              <SelectField
                value={form.transactionType}
                onChange={(e) => setForm({ ...form, transactionType: e.target.value as TransactionType })}
              >
                <option value="IN">{t("status.transaction.IN")}</option>
                <option value="OUT">{t("status.transaction.OUT")}</option>
                <option value="ADJUSTMENT">{t("status.transaction.ADJUSTMENT")}</option>
              </SelectField>
            </Field>
            <Field label={t("stockTransaction.field.product")} required colSpan={2}>
              <SelectField value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">{t("stockTransaction.field.productPlaceholder")}</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.productName} ({p.productCode}) — {t("stockTransaction.field.stockLabel")} {p.stockQty} {p.unit}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("stockTransaction.field.quantity")} required>
              <TextInput type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label={t("stockTransaction.field.referenceNo")}>
              <TextInput value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} />
            </Field>
            <Field label={t("stockTransaction.field.note")} colSpan={2}>
              <TextInput value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("stockTransaction.confirmDeleteTitle")}
          message={t("stockTransaction.confirmDeleteMessage", { no: deleting.transactionNo })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
