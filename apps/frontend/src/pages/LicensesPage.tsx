import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { companyApi, licenseApi, productApi } from "../api/resources";
import type { Company, License } from "../api/types";
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
import { formatDate, toDateInputValue } from "../lib/format";
import { statusTone } from "../lib/status";

type FormState = {
  licenseNo: string;
  licenseType: string;
  holderName: string;
  category: string;
  issueDate: string;
  expiryDate: string;
  companyId: string;
  productId: string;
};

const emptyForm: FormState = {
  licenseNo: "",
  licenseType: "",
  holderName: "",
  category: "IMPORT",
  issueDate: "",
  expiryDate: "",
  companyId: "",
  productId: "",
};

const CATEGORY_OPTIONS = ["IMPORT", "SALES"];

export function LicensesPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, update, remove } = useResource(licenseApi, (r) => r.licenseId);
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editing, setEditing] = useState<License | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<License | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => {
    companyApi.get().then(setCompany);
  }, []);
  const products = useList(() => productApi.list());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q || r.licenseNo.toLowerCase().includes(q) || r.holderName.toLowerCase().includes(q) || r.licenseType.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || r.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [rows, search, categoryFilter]);

  const expiringSoon = useMemo(
    () => rows.filter((r) => r.daysRemaining >= 0 && r.daysRemaining <= 30),
    [rows],
  );
  const expired = useMemo(() => rows.filter((r) => r.daysRemaining < 0), [rows]);

  const openCreate = () => {
    setForm({ ...emptyForm, companyId: company ? String(company.companyId) : "" });
    setEditing(null);
  };

  const openEdit = (row: License) => {
    setForm({
      licenseNo: row.licenseNo,
      licenseType: row.licenseType,
      holderName: row.holderName,
      category: row.category,
      issueDate: toDateInputValue(row.issueDate),
      expiryDate: toDateInputValue(row.expiryDate),
      companyId: row.companyId != null ? String(row.companyId) : "",
      productId: row.productId != null ? String(row.productId) : "",
    });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const handleSubmit = async () => {
    if (!form.licenseNo || !form.holderName || !form.issueDate || !form.expiryDate) {
      toast.error(t("license.toastFillAll"));
      return;
    }
    try {
      const payload = {
        licenseNo: form.licenseNo,
        licenseType: form.licenseType,
        holderName: form.holderName,
        category: form.category,
        issueDate: form.issueDate,
        expiryDate: form.expiryDate,
        companyId: form.companyId ? Number(form.companyId) : null,
        productId: form.productId ? Number(form.productId) : null,
      };
      if (editing) {
        await update(editing.licenseId, payload);
        toast.success(t("license.toast.updated", { no: form.licenseNo }));
      } else {
        await create(payload);
        toast.success(t("license.toast.created", { no: form.licenseNo }));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.licenseId);
      toast.success(t("license.toast.deleted", { no: deleting.licenseNo }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<License>[] = [
    { key: "no", header: t("license.col.licenseNo"), render: (r) => <span className="font-mono text-xs">{r.licenseNo}</span> },
    { key: "type", header: t("license.col.type"), render: (r) => <span className="font-medium text-slate-900">{r.licenseType}</span> },
    { key: "holder", header: t("license.col.holder"), render: (r) => r.holderName },
    {
      key: "category",
      header: t("license.col.category"),
      render: (r) => <Badge tone={r.category === "IMPORT" ? "info" : "neutral"}>{t(`status.licenseCategory.${r.category}`, r.category)}</Badge>,
    },
    { key: "expiry", header: t("license.col.expiry"), render: (r) => formatDate(r.expiryDate) },
    {
      key: "days",
      header: t("license.col.daysLeft"),
      render: (r) => (
        <span className={r.daysRemaining < 0 ? "font-semibold text-rose-600" : r.daysRemaining <= 30 ? "font-semibold text-amber-600" : ""}>
          {r.daysRemaining}
        </span>
      ),
    },
    {
      key: "status",
      header: t("common.col.status"),
      render: (r) => <Badge tone={statusTone(r.status)}>{t(`status.license.${r.status}`, r.status)}</Badge>,
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
        title={t("license.title")}
        subtitle={t("license.subtitle")}
        filters={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder={t("license.searchPlaceholder")} />
            <SelectField value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto">
              <option value="">{t("license.allCategories")}</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`status.licenseCategory.${c}`)}
                </option>
              ))}
            </SelectField>
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("license.add")}
          </Button>
        }
      />

      {(expired.length > 0 || expiringSoon.length > 0) && !loading && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <Trans
              i18nKey="license.alertBanner"
              values={{ expired: expired.length, expiring: expiringSoon.length }}
              components={{ 1: <strong /> }}
            />
          </p>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("license.emptyTitle")} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.licenseId}
          rowClassName={(r) => (r.daysRemaining < 0 ? "bg-rose-50/40" : r.daysRemaining <= 30 ? "bg-amber-50/40" : "")}
        />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("license.modalEdit") : t("license.modalCreate")}
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
            <Field label={t("license.field.licenseNo")} required>
              <TextInput value={form.licenseNo} onChange={(e) => setForm({ ...form, licenseNo: e.target.value })} />
            </Field>
            <Field label={t("license.field.category")} required>
              <SelectField value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(`status.licenseCategory.${c}`)}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("license.field.type")} required colSpan={2}>
              <TextInput
                value={form.licenseType}
                onChange={(e) => setForm({ ...form, licenseType: e.target.value })}
                placeholder={t("license.field.typePlaceholder")}
              />
            </Field>
            <Field label={t("license.field.holder")} required colSpan={2}>
              <TextInput value={form.holderName} onChange={(e) => setForm({ ...form, holderName: e.target.value })} />
            </Field>
            <Field label={t("license.field.issueDate")} required>
              <TextInput type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
            </Field>
            <Field label={t("license.field.expiryDate")} required helperText={t("license.field.expiryHelp")}>
              <TextInput type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </Field>
            <Field label={t("license.field.company")}>
              <SelectField value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                <option value="">-- None --</option>
                {company && <option value={company.companyId}>{company.legalName}</option>}
              </SelectField>
            </Field>
            <Field label={t("license.field.product")} helperText={t("license.field.productPlaceholder")}>
              <SelectField value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">{t("license.field.productPlaceholder")}</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.productName}
                  </option>
                ))}
              </SelectField>
            </Field>
          </FormGrid>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("license.confirmDeleteTitle")}
          message={t("license.confirmDeleteMessage", { no: deleting.licenseNo })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
