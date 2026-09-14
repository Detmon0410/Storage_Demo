import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { companyApi } from "../api/resources";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, FormGrid, TextInput } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";

type FormState = { legalName: string; taxId: string; address: string };
const emptyForm: FormState = { legalName: "", taxId: "", address: "" };

export function CompanyPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = () => {
    setLoading(true);
    setError(null);
    companyApi
      .get()
      .then((company) =>
        setForm(company ? { legalName: company.legalName, taxId: company.taxId, address: company.address } : emptyForm),
      )
      .catch(() => setError(t("company.errorLoad")))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async () => {
    if (!form.legalName || !form.taxId || !form.address) {
      toast.error(t("company.errorSave"));
      return;
    }
    setSaving(true);
    try {
      await companyApi.save(form);
      toast.success(t("company.toastSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("company.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("company.title")} subtitle={t("company.subtitle")} />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <Card className="p-4">
          {!form.legalName && !form.taxId && !form.address && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-600">{t("company.emptyTitle")}</p>
              <p className="mt-1 text-xs text-slate-400">{t("company.emptyBody")}</p>
            </div>
          )}
          <FormGrid>
            <Field label={t("company.field.legalName")} required colSpan={2}>
              <TextInput value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </Field>
            <Field label={t("company.field.taxId")} required>
              <TextInput value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
            </Field>
            <Field label={t("company.field.address")} required colSpan={2}>
              <TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </FormGrid>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" loading={saving} onClick={handleSubmit}>
              {t("company.save")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
