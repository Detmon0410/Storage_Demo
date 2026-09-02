import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supplierApi } from "../api/resources";
import type { Supplier } from "../api/types";
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
import { useResource } from "../hooks/useResource";
import { statusTone } from "../lib/status";

type FormState = {
  supplierCode: string;
  supplierName: string;
  country: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
};

const emptyForm: FormState = {
  supplierCode: "",
  supplierName: "",
  country: "",
  contactName: "",
  email: "",
  phone: "",
  status: "ACTIVE",
};

export function SuppliersPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, update, remove } = useResource(supplierApi, (r) => r.supplierId);
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.supplierName.toLowerCase().includes(q) ||
        r.supplierCode.toLowerCase().includes(q) ||
        (r.country ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (row: Supplier) => {
    setForm({
      supplierCode: row.supplierCode,
      supplierName: row.supplierName,
      country: row.country ?? "",
      contactName: row.contactName ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      status: row.status,
    });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const handleSubmit = async () => {
    try {
      if (editing) {
        await update(editing.supplierId, form);
        toast.success(t("supplier.toast.updated", { name: form.supplierName }));
      } else {
        await create(form);
        toast.success(t("supplier.toast.created", { name: form.supplierName }));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.supplierId);
      toast.success(t("supplier.toast.deleted", { name: deleting.supplierName }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<Supplier>[] = [
    { key: "code", header: t("common.col.code"), render: (r) => <span className="font-mono text-xs text-slate-500">{r.supplierCode}</span> },
    { key: "name", header: t("common.col.name"), render: (r) => <span className="font-medium text-slate-900">{r.supplierName}</span> },
    { key: "country", header: t("common.col.country"), render: (r) => r.country ?? "-" },
    {
      key: "contact",
      header: t("common.col.contact"),
      render: (r) => (
        <div className="text-xs">
          <p>{r.contactName ?? "-"}</p>
          <p className="text-slate-400">{r.email ?? r.phone ?? ""}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: t("common.col.status"),
      render: (r) => <Badge tone={statusTone(r.status)}>{t(`status.supplier.${r.status}`, r.status)}</Badge>,
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
        title={t("supplier.title")}
        subtitle={t("supplier.subtitle")}
        filters={<SearchInput value={search} onChange={setSearch} placeholder={t("supplier.searchPlaceholder")} />}
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("supplier.add")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("supplier.emptyTitle")} description={t("supplier.emptyDesc")} />
      ) : (
        <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.supplierId} />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("supplier.modalEdit") : t("supplier.modalCreate")}
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
            <Field label={t("supplier.field.code")} required>
              <TextInput value={form.supplierCode} onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} />
            </Field>
            <Field label={t("supplier.field.name")} required>
              <TextInput value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
            </Field>
            <Field label={t("supplier.field.country")}>
              <TextInput value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <Field label={t("supplier.field.status")}>
              <SelectField value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">{t("status.supplier.ACTIVE")}</option>
                <option value="INACTIVE">{t("status.supplier.INACTIVE")}</option>
              </SelectField>
            </Field>
            <Field label={t("supplier.field.contactName")}>
              <TextInput value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </Field>
            <Field label={t("supplier.field.phone")}>
              <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={t("supplier.field.email")} colSpan={2}>
              <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("supplier.confirmDeleteTitle")}
          message={t("supplier.confirmDeleteMessage", { name: deleting.supplierName })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
