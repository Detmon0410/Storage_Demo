import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { categoryApi } from "../api/resources";
import type { Category } from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { type Column, DataTable } from "../components/ui/DataTable";
import { CheckboxField, Field, FormGrid, TextInput, TextareaField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { SearchInput } from "../components/ui/SearchInput";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";
import { useResource } from "../hooks/useResource";

type FormState = {
  categoryCode: string;
  categoryName: string;
  description: string;
  isActive: boolean;
};

const emptyForm: FormState = { categoryCode: "", categoryName: "", description: "", isActive: true };

export function CategoriesPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, update, remove } = useResource(categoryApi, (r) => r.categoryId);
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.categoryName.toLowerCase().includes(q) || r.categoryCode.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (row: Category) => {
    setForm({
      categoryCode: row.categoryCode,
      categoryName: row.categoryName,
      description: row.description ?? "",
      isActive: row.isActive,
    });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const handleSubmit = async () => {
    try {
      if (editing) {
        await update(editing.categoryId, form);
        toast.success(t("category.toast.updated", { name: form.categoryName }));
      } else {
        await create(form);
        toast.success(t("category.toast.created", { name: form.categoryName }));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.categoryId);
      toast.success(t("category.toast.deleted", { name: deleting.categoryName }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<Category>[] = [
    { key: "code", header: t("common.col.code"), render: (r) => <span className="font-mono text-xs text-slate-500">{r.categoryCode}</span> },
    {
      key: "name",
      header: t("common.col.name"),
      render: (r) => <span className="font-medium text-slate-900">{t(`category.name.${r.categoryCode}`, r.categoryName)}</span>,
    },
    { key: "desc", header: t("common.col.description"), render: (r) => <span className="text-slate-500">{r.description || "-"}</span> },
    {
      key: "active",
      header: t("common.col.status"),
      render: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{t(r.isActive ? "status.boolean.active" : "status.boolean.inactive")}</Badge>,
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
        title={t("category.title")}
        subtitle={t("category.subtitle")}
        filters={<SearchInput value={search} onChange={setSearch} placeholder={t("category.searchPlaceholder")} />}
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("category.add")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("category.emptyTitle")} description={t("category.emptyDesc")} />
      ) : (
        <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.categoryId} />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("category.modalEdit") : t("category.modalCreate")}
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
            <Field label={t("category.field.code")} required>
              <TextInput
                value={form.categoryCode}
                onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}
                placeholder={t("category.field.codePlaceholder")}
              />
            </Field>
            <Field label={t("category.field.name")} required>
              <TextInput
                value={form.categoryName}
                onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                placeholder={t("category.field.namePlaceholder")}
              />
            </Field>
            <Field label={t("common.col.description")} colSpan={2}>
              <TextareaField
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="" colSpan={2}>
              <CheckboxField
                label={t("category.enable")}
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("category.confirmDeleteTitle")}
          message={t("category.confirmDeleteMessage", { name: deleting.categoryName })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
