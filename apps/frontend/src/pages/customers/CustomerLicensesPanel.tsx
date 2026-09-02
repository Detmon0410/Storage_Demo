import { FileText, Pencil, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { renewCustomerLicense } from "../../api/resources";
import type { Customer, CustomerLicense, CustomerLicenseStatus } from "../../api/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { type Column, DataTable } from "../../components/ui/DataTable";
import { Field, FormGrid, SelectField, TextInput, TextareaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { formatDate, toDateInputValue } from "../../lib/format";
import { statusTone } from "../../lib/status";

const CHANNEL_OPTIONS = ["DISTRIBUTOR", "RETAIL_WHOLESALE", "RESTAURANT_BAR", "ONLINE"];
const STATUS_OPTIONS: CustomerLicenseStatus[] = ["PENDING", "ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"];
const ACTOR = "System User";

export function isCustomerLicenseValid(license: Pick<CustomerLicense, "status" | "expiryDate">): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return license.status === "ACTIVE" && new Date(license.expiryDate) >= today;
}

function effectiveStatus(license: CustomerLicense): CustomerLicenseStatus {
  if (license.status === "ACTIVE" && !isCustomerLicenseValid(license)) return "EXPIRED";
  return license.status;
}

type FormState = {
  licenseNumber: string;
  licenseType: string;
  applicableChannel: string;
  issueDate: string;
  expiryDate: string;
  status: CustomerLicenseStatus;
  documentUrl: string;
  notes: string;
};

const emptyForm: FormState = {
  licenseNumber: "",
  licenseType: "",
  applicableChannel: "",
  issueDate: "",
  expiryDate: "",
  status: "PENDING",
  documentUrl: "",
  notes: "",
};

type RenewFormState = { licenseNumber: string; issueDate: string; expiryDate: string; documentUrl: string; notes: string };

const emptyRenewForm: RenewFormState = { licenseNumber: "", issueDate: "", expiryDate: "", documentUrl: "", notes: "" };

export function CustomerLicensesPanel({
  customer,
  licenses,
  saving,
  onClose,
  onCreate,
  onUpdate,
  onRenewed,
}: {
  customer: Customer;
  licenses: CustomerLicense[];
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (id: number, payload: Record<string, unknown>) => Promise<unknown>;
  onRenewed: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [editing, setEditing] = useState<CustomerLicense | null | undefined>(undefined);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [renewing, setRenewing] = useState<CustomerLicense | null>(null);
  const [renewForm, setRenewForm] = useState<RenewFormState>(emptyRenewForm);
  const [renewSaving, setRenewSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (license: CustomerLicense) => {
    setForm({
      licenseNumber: license.licenseNumber,
      licenseType: license.licenseType,
      applicableChannel: license.applicableChannel ?? "",
      issueDate: toDateInputValue(license.issueDate),
      expiryDate: toDateInputValue(license.expiryDate),
      status: license.status,
      documentUrl: license.documentUrl ?? "",
      notes: license.notes ?? "",
    });
    setEditing(license);
  };

  const closeForm = () => setEditing(undefined);

  const handleSubmit = async () => {
    if (!form.licenseNumber || !form.licenseType || !form.issueDate || !form.expiryDate) {
      toast.error(t("customerLicense.toastFillAll"));
      return;
    }
    try {
      const payload = {
        customerId: customer.customerId,
        licenseNumber: form.licenseNumber,
        licenseType: form.licenseType,
        applicableChannel: form.applicableChannel || null,
        issueDate: form.issueDate,
        expiryDate: form.expiryDate,
        status: form.status,
        documentUrl: form.documentUrl || null,
        notes: form.notes || null,
        actor: ACTOR,
      };
      if (editing) {
        await onUpdate(editing.customerLicenseId, payload);
        toast.success(t("customerLicense.toast.updated", { no: form.licenseNumber }));
      } else {
        await onCreate(payload);
        toast.success(t("customerLicense.toast.created", { no: form.licenseNumber }));
      }
      closeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const changeStatus = async (license: CustomerLicense, status: CustomerLicenseStatus) => {
    try {
      await onUpdate(license.customerLicenseId, { status, actor: ACTOR });
      toast.success(t("customerLicense.toast.statusChanged", { no: license.licenseNumber, status: t(`status.customerLicense.${status}`) }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const openRenew = (license: CustomerLicense) => {
    setRenewForm(emptyRenewForm);
    setRenewing(license);
  };

  const handleRenew = async () => {
    if (!renewing) return;
    if (!renewForm.licenseNumber || !renewForm.issueDate || !renewForm.expiryDate) {
      toast.error(t("customerLicense.toastFillAll"));
      return;
    }
    setRenewSaving(true);
    try {
      await renewCustomerLicense(renewing.customerLicenseId, {
        licenseNumber: renewForm.licenseNumber,
        issueDate: renewForm.issueDate,
        expiryDate: renewForm.expiryDate,
        documentUrl: renewForm.documentUrl || undefined,
        notes: renewForm.notes || undefined,
        actor: ACTOR,
      });
      onRenewed();
      toast.success(t("customerLicense.toast.renewed", { old: renewing.licenseNumber, new: renewForm.licenseNumber }));
      setRenewing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setRenewSaving(false);
    }
  };

  const columns: Column<CustomerLicense>[] = [
    {
      key: "number",
      header: t("customerLicense.col.number"),
      render: (l) => (
        <div>
          <p className="font-mono text-xs font-medium text-slate-700">{l.licenseNumber}</p>
          <p className="text-xs text-slate-400">{l.licenseType}</p>
        </div>
      ),
    },
    {
      key: "channel",
      header: t("customerLicense.col.channel"),
      render: (l) => (l.applicableChannel ? t(`status.channel.${l.applicableChannel}`, l.applicableChannel) : t("customerLicense.anyChannel")),
    },
    { key: "issue", header: t("customerLicense.col.issueDate"), render: (l) => formatDate(l.issueDate) },
    { key: "expiry", header: t("customerLicense.col.expiryDate"), render: (l) => formatDate(l.expiryDate) },
    {
      key: "status",
      header: t("common.col.status"),
      render: (l) => {
        const status = effectiveStatus(l);
        return <Badge tone={statusTone(status)}>{t(`status.customerLicense.${status}`, status)}</Badge>;
      },
    },
    {
      key: "document",
      header: t("customerLicense.col.document"),
      render: (l) =>
        l.documentUrl ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <FileText className="h-3.5 w-3.5" /> {l.documentUrl}
          </span>
        ) : (
          <span className="text-xs text-slate-300">-</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (l) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(l)} icon={<Pencil className="h-3.5 w-3.5" />} />
          {(l.status === "ACTIVE" || l.status === "EXPIRED") && (
            <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => openRenew(l)}>
              {t("customerLicense.renew")}
            </Button>
          )}
          {l.status === "PENDING" && (
            <Button variant="secondary" size="sm" onClick={() => changeStatus(l, "ACTIVE")}>
              {t("customerLicense.activate")}
            </Button>
          )}
          {l.status === "ACTIVE" && (
            <Button variant="secondary" size="sm" onClick={() => changeStatus(l, "SUSPENDED")}>
              {t("customerLicense.suspend")}
            </Button>
          )}
          {l.status === "SUSPENDED" && (
            <Button variant="secondary" size="sm" onClick={() => changeStatus(l, "ACTIVE")}>
              {t("customerLicense.reactivate")}
            </Button>
          )}
          {(l.status === "PENDING" || l.status === "ACTIVE" || l.status === "SUSPENDED") && (
            <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => changeStatus(l, "REVOKED")}>
              {t("customerLicense.revoke")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={t("customerLicense.panelTitle", { name: customer.customerName })}
        subtitle={t("customerLicense.panelSubtitle", { count: licenses.length })}
        onClose={onClose}
        width="max-w-4xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              {t("customerLicense.add")}
            </Button>
          </>
        }
      >
        {licenses.length === 0 ? (
          <EmptyState title={t("customerLicense.emptyTitle")} description={t("customerLicense.emptyDesc")} />
        ) : (
          <DataTable columns={columns} rows={licenses} getRowKey={(l) => l.customerLicenseId} />
        )}
      </Modal>

      {editing !== undefined && (
        <Modal
          title={editing ? t("customerLicense.modalEdit") : t("customerLicense.modalCreate")}
          onClose={closeForm}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={closeForm}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
                {t("common.save")}
              </Button>
            </>
          }
        >
          <FormGrid>
            <Field label={t("customerLicense.field.number")} required>
              <TextInput value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
            </Field>
            <Field label={t("customerLicense.field.type")} required>
              <TextInput
                value={form.licenseType}
                onChange={(e) => setForm({ ...form, licenseType: e.target.value })}
                placeholder={t("customerLicense.field.typePlaceholder")}
              />
            </Field>
            <Field label={t("customerLicense.field.channel")} helperText={t("customerLicense.field.channelHelp")}>
              <SelectField value={form.applicableChannel} onChange={(e) => setForm({ ...form, applicableChannel: e.target.value })}>
                <option value="">{t("customerLicense.anyChannel")}</option>
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(`status.channel.${c}`)}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("customerLicense.field.status")}>
              <SelectField value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerLicenseStatus })}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.customerLicense.${s}`)}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label={t("customerLicense.field.issueDate")} required>
              <TextInput type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
            </Field>
            <Field label={t("customerLicense.field.expiryDate")} required>
              <TextInput type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </Field>
            <Field label={t("customerLicense.field.document")} colSpan={2} helperText={t("customerLicense.field.documentHelp")}>
              <TextInput value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })} placeholder={t("customerLicense.field.documentPlaceholder")} />
            </Field>
            <Field label={t("common.col.description")} colSpan={2}>
              <TextareaField value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {renewing && (
        <Modal
          title={t("customerLicense.renewTitle", { no: renewing.licenseNumber })}
          subtitle={t("customerLicense.renewSubtitle")}
          onClose={() => setRenewing(null)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setRenewing(null)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" loading={renewSaving} onClick={handleRenew}>
                {t("customerLicense.renew")}
              </Button>
            </>
          }
        >
          <FormGrid>
            <Field label={t("customerLicense.field.number")} required colSpan={2}>
              <TextInput value={renewForm.licenseNumber} onChange={(e) => setRenewForm({ ...renewForm, licenseNumber: e.target.value })} />
            </Field>
            <Field label={t("customerLicense.field.issueDate")} required>
              <TextInput type="date" value={renewForm.issueDate} onChange={(e) => setRenewForm({ ...renewForm, issueDate: e.target.value })} />
            </Field>
            <Field label={t("customerLicense.field.expiryDate")} required>
              <TextInput type="date" value={renewForm.expiryDate} onChange={(e) => setRenewForm({ ...renewForm, expiryDate: e.target.value })} />
            </Field>
            <Field label={t("customerLicense.field.document")} colSpan={2}>
              <TextInput value={renewForm.documentUrl} onChange={(e) => setRenewForm({ ...renewForm, documentUrl: e.target.value })} placeholder={t("customerLicense.field.documentPlaceholder")} />
            </Field>
            <Field label={t("common.col.description")} colSpan={2}>
              <TextareaField value={renewForm.notes} onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })} />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </>
  );
}
