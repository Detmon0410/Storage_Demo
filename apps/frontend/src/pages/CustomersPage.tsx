import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { customerApi, customerLicenseApi } from "../api/resources";
import type { Customer } from "../api/types";
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
import { CustomerLicensesPanel, isCustomerLicenseValid } from "./customers/CustomerLicensesPanel";
import { formatCurrency } from "../lib/format";
import { statusTone } from "../lib/status";

type FormState = {
  customerCode: string;
  customerName: string;
  channelType: string;
  creditLimit: string;
  currentBalance: string;
  availableCredit: string;
  standardDiscount: string;
  creditStatus: string;
};

const emptyForm: FormState = {
  customerCode: "",
  customerName: "",
  channelType: "DISTRIBUTOR",
  creditLimit: "",
  currentBalance: "0",
  availableCredit: "",
  standardDiscount: "5",
  creditStatus: "NORMAL",
};

const CHANNEL_OPTIONS = ["DISTRIBUTOR", "RETAIL_WHOLESALE", "RESTAURANT_BAR", "ONLINE"];
const CREDIT_STATUS_OPTIONS = ["NORMAL", "NEAR_LIMIT", "OVER_LIMIT", "NO_LICENSE"];

export function CustomersPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, update, remove } = useResource(customerApi, (r) => r.customerId);
  const {
    rows: customerLicenses,
    saving: licenseSaving,
    reload: reloadLicenses,
    create: createLicense,
    update: updateLicense,
  } = useResource(customerLicenseApi, (r) => r.customerLicenseId);
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [managingLicenses, setManagingLicenses] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const licensesByCustomerId = useMemo(() => {
    const map = new Map<number, typeof customerLicenses>();
    for (const license of customerLicenses) {
      const list = map.get(license.customerId);
      if (list) list.push(license);
      else map.set(license.customerId, [license]);
    }
    return map;
  }, [customerLicenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery = !q || r.customerName.toLowerCase().includes(q) || r.customerCode.toLowerCase().includes(q);
      const matchesChannel = !channelFilter || r.channelType === channelFilter;
      return matchesQuery && matchesChannel;
    });
  }, [rows, search, channelFilter]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (row: Customer) => {
    setForm({
      customerCode: row.customerCode,
      customerName: row.customerName,
      channelType: row.channelType,
      creditLimit: row.creditLimit,
      currentBalance: row.currentBalance,
      availableCredit: row.availableCredit,
      standardDiscount: row.standardDiscount,
      creditStatus: row.creditStatus,
    });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const recalcCredit = (creditLimit: string, currentBalance: string) => {
    const limit = Number(creditLimit || 0);
    const balance = Number(currentBalance || 0);
    const available = limit - balance;
    return {
      availableCredit: String(available),
      creditStatus: available < 0 ? "OVER_LIMIT" : available < limit * 0.1 ? "NEAR_LIMIT" : "NORMAL",
    };
  };

  const handleSubmit = async () => {
    if (!form.customerCode || !form.customerName || !form.creditLimit) {
      toast.error(t("customer.toastFillAll"));
      return;
    }
    try {
      const payload = {
        customerCode: form.customerCode,
        customerName: form.customerName,
        channelType: form.channelType,
        creditLimit: Number(form.creditLimit),
        currentBalance: Number(form.currentBalance || 0),
        availableCredit: Number(form.availableCredit || 0),
        standardDiscount: Number(form.standardDiscount || 0),
        creditStatus: form.creditStatus,
      };
      if (editing) {
        await update(editing.customerId, payload);
        toast.success(t("customer.toast.updated", { name: form.customerName }));
      } else {
        await create(payload);
        toast.success(t("customer.toast.created", { name: form.customerName }));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.customerId);
      toast.success(t("customer.toast.deleted", { name: deleting.customerName }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: t("customer.col.customer"),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.customerName}</p>
          <p className="font-mono text-xs text-slate-400">{r.customerCode}</p>
        </div>
      ),
    },
    { key: "channel", header: t("customer.col.channel"), render: (r) => t(`status.channel.${r.channelType}`, r.channelType) },
    {
      key: "license",
      header: t("customer.col.license"),
      render: (r) => {
        const licenses = licensesByCustomerId.get(r.customerId) ?? [];
        const hasValid = licenses.some((l) => isCustomerLicenseValid(l));
        return (
          <button type="button" onClick={() => setManagingLicenses(r)} className="rounded-full transition-opacity hover:opacity-75">
            {licenses.length === 0 ? (
              <Badge tone="danger">{t("customer.noLicense")}</Badge>
            ) : (
              <Badge tone={hasValid ? "info" : "danger"}>{t("customerLicense.count", { count: licenses.length })}</Badge>
            )}
          </button>
        );
      },
    },
    {
      key: "credit",
      header: t("customer.col.credit"),
      render: (r) => {
        const limit = Number(r.creditLimit);
        const balance = Number(r.currentBalance);
        const pct = limit > 0 ? Math.min(100, Math.max(0, (balance / limit) * 100)) : 0;
        return (
          <div className="w-36">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{formatCurrency(r.currentBalance)}</span>
              <span>{formatCurrency(r.creditLimit)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    { key: "discount", header: t("customer.col.discount"), render: (r) => `${r.standardDiscount}%` },
    {
      key: "status",
      header: t("customer.col.creditStatus"),
      render: (r) => <Badge tone={statusTone(r.creditStatus)}>{t(`status.credit.${r.creditStatus}`, r.creditStatus)}</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setManagingLicenses(r)} icon={<Eye className="h-3.5 w-3.5" />} />
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)} icon={<Pencil className="h-3.5 w-3.5" />} />
          <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("customer.title")}
        subtitle={t("customer.subtitle")}
        filters={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder={t("customer.searchPlaceholder")} />
            <SelectField value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="w-auto">
              <option value="">{t("customer.allChannels")}</option>
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`status.channel.${c}`)}
                </option>
              ))}
            </SelectField>
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("customer.add")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("customer.emptyTitle")} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.customerId}
          rowClassName={(r) => (r.creditStatus === "OVER_LIMIT" || r.creditStatus === "NO_LICENSE" ? "bg-rose-50/40" : "")}
        />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("customer.modalEdit") : t("customer.modalCreate")}
          width="max-w-2xl"
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
            <Field label={t("customer.field.code")} required>
              <TextInput value={form.customerCode} onChange={(e) => setForm({ ...form, customerCode: e.target.value })} />
            </Field>
            <Field label={t("customer.field.name")} required>
              <TextInput value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </Field>
            <Field label={t("customer.field.channel")} required>
              <SelectField value={form.channelType} onChange={(e) => setForm({ ...form, channelType: e.target.value })}>
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(`status.channel.${c}`)}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("customer.field.standardDiscount")}>
              <TextInput type="number" min="0" max="100" value={form.standardDiscount} onChange={(e) => setForm({ ...form, standardDiscount: e.target.value })} />
            </Field>
            <Field label={t("customer.field.creditLimit")} required>
              <TextInput
                type="number"
                min="0"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value, ...recalcCredit(e.target.value, form.currentBalance) })}
              />
            </Field>
            <Field label={t("customer.field.currentBalance")}>
              <TextInput
                type="number"
                min="0"
                value={form.currentBalance}
                onChange={(e) => setForm({ ...form, currentBalance: e.target.value, ...recalcCredit(form.creditLimit, e.target.value) })}
              />
            </Field>
            <Field label={t("customer.field.availableCredit")}>
              <TextInput type="number" value={form.availableCredit} disabled />
            </Field>
            <Field label={t("customer.field.creditStatus")}>
              <SelectField value={form.creditStatus} onChange={(e) => setForm({ ...form, creditStatus: e.target.value })}>
                {CREDIT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.credit.${s}`)}
                  </option>
                ))}
              </SelectField>
            </Field>
          </FormGrid>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("customer.confirmDeleteTitle")}
          message={t("customer.confirmDeleteMessage", { name: deleting.customerName })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}

      {managingLicenses && (
        <CustomerLicensesPanel
          customer={managingLicenses}
          licenses={licensesByCustomerId.get(managingLicenses.customerId) ?? []}
          saving={licenseSaving}
          onClose={() => setManagingLicenses(null)}
          onCreate={createLicense}
          onUpdate={updateLicense}
          onRenewed={reloadLicenses}
        />
      )}
    </div>
  );
}
