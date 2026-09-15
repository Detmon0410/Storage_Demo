import { Ban, KeyRound, Pencil, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { userApi } from "../api/resources";
import type { RoleCode, User } from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { type Column, DataTable } from "../components/ui/DataTable";
import { CheckboxField, Field, FormGrid, SelectField, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { SearchInput } from "../components/ui/SearchInput";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";
import type { Tone } from "../lib/status";

const ROLE_CODES: RoleCode[] = [
  "SYSTEM_ADMIN",
  "MANAGER_APPROVER",
  "IMPORT_COMPLIANCE_OFFICER",
  "WAREHOUSE_DISTRIBUTION_OFFICER",
  "SALES_OFFICER",
  "FINANCE_ACCOUNTING_OFFICER",
];

const ROLE_TONE: Record<RoleCode, Tone> = {
  SYSTEM_ADMIN: "danger",
  MANAGER_APPROVER: "warning",
  IMPORT_COMPLIANCE_OFFICER: "info",
  WAREHOUSE_DISTRIBUTION_OFFICER: "neutral",
  SALES_OFFICER: "success",
  FINANCE_ACCOUNTING_OFFICER: "info",
};

type FormState = {
  username: string;
  password: string;
  status: string;
  roleCodes: RoleCode[];
};

const emptyForm: FormState = {
  username: "",
  password: "",
  status: "ACTIVE",
  roleCodes: [],
};

const LAST_ADMIN_GUARD_MESSAGE = "At least one active System Admin must remain.";

export function UsersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userApi.list();
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.httpError", { status: "?" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.username.toLowerCase().includes(q));
  }, [rows, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (row: User) => {
    setForm({ username: row.username, password: "", status: row.status, roleCodes: [...row.roles] });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const toggleRole = (code: RoleCode) => {
    setForm((prev) => ({
      ...prev,
      roleCodes: prev.roleCodes.includes(code)
        ? prev.roleCodes.filter((c) => c !== code)
        : [...prev.roleCodes, code],
    }));
  };

  const showGuardOrSaveFailed = (err: unknown) => {
    if (err instanceof ApiError && err.status === 409 && err.message === LAST_ADMIN_GUARD_MESSAGE) {
      toast.error(t("user.toastLastAdminGuard"));
    } else {
      toast.error(t("common.saveFailed"));
    }
  };

  const handleSubmit = async () => {
    if (form.roleCodes.length === 0) {
      toast.error(t("user.toastRolesRequired"));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await userApi.update(editing.id, { username: form.username, status: form.status });
        await userApi.assignRoles(editing.id, form.roleCodes);
        toast.success(t("user.toast.updated", { username: form.username }));
      } else {
        await userApi.create({
          username: form.username,
          password: form.password,
          status: form.status,
          roleCodes: form.roleCodes,
        });
        toast.success(t("user.toast.created", { username: form.username }));
      }
      closeModal();
      await load();
    } catch (err) {
      showGuardOrSaveFailed(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivating) return;
    setSaving(true);
    try {
      await userApi.deactivate(deactivating.id);
      toast.success(t("user.toast.deactivated", { username: deactivating.username }));
      setDeactivating(null);
      await load();
    } catch (err) {
      showGuardOrSaveFailed(err);
    } finally {
      setSaving(false);
    }
  };

  const openResetPassword = (row: User) => {
    setResetPassword("");
    setResetting(row);
  };

  const handleResetPassword = async () => {
    if (!resetting) return;
    if (resetPassword.length < 8) {
      toast.error(t("user.toastPasswordTooShort"));
      return;
    }
    setSaving(true);
    try {
      await userApi.resetPassword(resetting.id, resetPassword);
      toast.success(t("user.toast.passwordReset", { username: resetting.username }));
      setResetting(null);
    } catch (err) {
      showGuardOrSaveFailed(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async (row: User) => {
    try {
      await userApi.reactivate(row.id);
      toast.success(t("user.toast.reactivated", { username: row.username }));
      await load();
    } catch (err) {
      showGuardOrSaveFailed(err);
    }
  };

  const columns: Column<User>[] = [
    { key: "username", header: t("user.field.username"), render: (r) => <span className="font-semibold text-slate-900">{r.username}</span> },
    {
      key: "roles",
      header: t("user.field.roles"),
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.roles.map((code) => (
            <Badge key={code} tone={ROLE_TONE[code]} wrap>
              {t(`user.role.${code}`)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      header: t("common.col.status"),
      render: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.boolean.${r.status === "ACTIVE" ? "active" : "inactive"}`)}</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(r)}
            icon={<Pencil className="h-3.5 w-3.5" />}
            aria-label={`${t("common.edit")} ${r.username}`}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openResetPassword(r)}
            icon={<KeyRound className="h-3.5 w-3.5" />}
            aria-label={`${t("user.resetPassword")} ${r.username}`}
          />
          {r.status === "ACTIVE" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeactivating(r)}
              icon={<Ban className="h-3.5 w-3.5 text-rose-500" />}
              aria-label={`Deactivate ${r.username}`}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReactivate(r)}
              icon={<RotateCcw className="h-3.5 w-3.5 text-emerald-600" />}
              aria-label={`Reactivate ${r.username}`}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("user.title")}
        subtitle={t("user.subtitle")}
        filters={<SearchInput value={search} onChange={setSearch} placeholder={t("user.field.username")} />}
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("user.add")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("user.emptyTitle")} description={t("user.emptyDesc")} />
      ) : (
        <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.id} />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("user.modalEdit") : t("user.modalCreate")}
          subtitle={t("user.modalSubtitle")}
          onClose={closeModal}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={closeModal}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
                {editing ? t("user.modalEditSubmit") : t("user.modalCreateSubmit")}
              </Button>
            </>
          }
        >
          <FormGrid>
            <Field label={t("user.field.username")} required>
              <TextInput value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            {!editing && (
              <Field label={t("user.field.password")} required helperText={t("user.field.passwordHelp")}>
                <TextInput
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
            )}
            <Field label={t("user.field.status")}>
              <SelectField value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">{t("status.boolean.active")}</option>
                <option value="INACTIVE">{t("status.boolean.inactive")}</option>
              </SelectField>
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">{t("user.field.roles")}</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLE_CODES.map((code) => (
                  <CheckboxField
                    key={code}
                    label={t(`user.role.${code}`)}
                    checked={form.roleCodes.includes(code)}
                    onChange={() => toggleRole(code)}
                  />
                ))}
              </div>
              <span className="mt-1 block text-xs text-slate-400">{t("user.field.rolesHelp")}</span>
            </div>
          </FormGrid>
        </Modal>
      )}

      {resetting && (
        <Modal
          title={t("user.resetPasswordTitle", { username: resetting.username })}
          subtitle={t("user.resetPasswordSubtitle")}
          onClose={() => setResetting(null)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setResetting(null)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleResetPassword}>
                {t("user.resetPasswordSubmit")}
              </Button>
            </>
          }
        >
          <FormGrid>
            <Field label={t("user.field.password")} required helperText={t("user.field.passwordHelp")}>
              <TextInput type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {deactivating && (
        <ConfirmDialog
          title={t("user.confirmDeactivateTitle", { username: deactivating.username })}
          message={t("user.confirmDeactivateMessage", { username: deactivating.username })}
          loading={saving}
          onCancel={() => setDeactivating(null)}
          onConfirm={handleDeactivate}
        />
      )}
    </div>
  );
}
