import { AlertTriangle, CheckCircle2, Package, Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { customerApi, customerLicenseApi, inventoryStockApi, productApi, salesOrderApi } from "../api/resources";
import type { Customer, CustomerLicense, SalesOrder } from "../api/types";
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
import { isCustomerLicenseValid } from "./customers/CustomerLicensesPanel";
import { formatCurrency, formatDate } from "../lib/format";
import { statusTone } from "../lib/status";

type ItemRow = { productId: string; quantity: string; unitPrice: string; discount: string; lotBatch: string };

type FormState = {
  orderNo: string;
  customerId: string;
  customerLicenseId: string;
  deliveryStatus: string;
  invoiceNo: string;
  approver: string;
  items: ItemRow[];
};

const emptyForm: FormState = {
  orderNo: "",
  customerId: "",
  customerLicenseId: "",
  deliveryStatus: "PENDING",
  invoiceNo: "",
  approver: "",
  items: [],
};

const emptyItem: ItemRow = { productId: "", quantity: "1", unitPrice: "", discount: "0", lotBatch: "" };

const DELIVERY_OPTIONS = ["PENDING", "SHIPPING", "DELIVERED", "RETURNED", "DAMAGED"];

export function SalesOrdersPage() {
  const { t } = useTranslation();
  const { rows, loading, error, saving, reload, create, update, remove } = useResource(salesOrderApi, (r) => r.salesOrderId);
  const customers = useList(() => customerApi.list());
  const customerLicenses = useList(() => customerLicenseApi.list());
  const products = useList(() => productApi.list());
  const inventoryLots = useList(() => inventoryStockApi.list());
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [editing, setEditing] = useState<SalesOrder | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<SalesOrder | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        r.orderNo.toLowerCase().includes(q) ||
        (r.customer?.customerName ?? "").toLowerCase().includes(q) ||
        (r.items ?? []).some((i) => (i.product?.productName ?? "").toLowerCase().includes(q));
      const matchesDelivery = !deliveryFilter || r.deliveryStatus === deliveryFilter;
      return matchesQuery && matchesDelivery;
    });
  }, [rows, search, deliveryFilter]);

  const sellableProducts = useMemo(() => products.filter((p) => p.status === "READY"), [products]);
  const selectedCustomer = customers.find((c) => String(c.customerId) === form.customerId);

  const validLicensesFor = (customerId: string, customer: Customer | undefined): CustomerLicense[] =>
    customer
      ? customerLicenses.filter(
          (l) =>
            String(l.customerId) === customerId &&
            isCustomerLicenseValid(l) &&
            (!l.applicableChannel || l.applicableChannel === customer.channelType),
        )
      : [];

  const validLicensesForCustomer = useMemo(
    () => validLicensesFor(form.customerId, selectedCustomer),
    [customerLicenses, form.customerId, selectedCustomer],
  );
  const selectedLicense = customerLicenses.find((l) => String(l.customerLicenseId) === form.customerLicenseId);

  const lotsForProduct = (productId: string) => inventoryLots.filter((l) => String(l.productId) === productId && l.quantityOnHand > 0);

  const quantityByProduct = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of form.items) {
      if (!item.productId) continue;
      totals.set(item.productId, (totals.get(item.productId) ?? 0) + Number(item.quantity || 0));
    }
    return totals;
  }, [form.items]);

  const itemSubtotal = (item: ItemRow) => Number(item.quantity || 0) * Number(item.unitPrice || 0) * (1 - Number(item.discount || 0) / 100);
  const orderTotal = form.items.reduce((sum, item) => sum + itemSubtotal(item), 0);

  const validation = useMemo(() => {
    const blockers: string[] = [];
    const warnings: string[] = [];

    for (const [productId, qty] of quantityByProduct) {
      const product = products.find((p) => String(p.productId) === productId);
      if (!product) continue;
      if (product.status !== "READY") {
        blockers.push(t("salesOrder.validation.notSellable", { name: product.productName }));
      }
      if (qty > product.stockQty) {
        blockers.push(t("salesOrder.validation.overStock", { name: product.productName, qty, stock: product.stockQty, unit: product.unit }));
      }
    }

    if (selectedCustomer) {
      if (validLicensesForCustomer.length === 0) {
        blockers.push(t("salesOrder.validation.noLicense"));
      } else if (!form.customerLicenseId) {
        blockers.push(t("salesOrder.validation.licenseRequired"));
      }
      const overDiscountItems = form.items.filter((item) => Number(item.discount || 0) > Number(selectedCustomer.standardDiscount));
      if (overDiscountItems.length > 0) {
        warnings.push(t("salesOrder.validation.overDiscount", { count: overDiscountItems.length, limit: selectedCustomer.standardDiscount }));
      }
      const projectedBalance = Number(selectedCustomer.currentBalance) + orderTotal;
      if (form.items.length > 0 && projectedBalance > Number(selectedCustomer.creditLimit)) {
        warnings.push(
          t("salesOrder.validation.overCredit", {
            projected: formatCurrency(projectedBalance),
            limit: formatCurrency(selectedCustomer.creditLimit),
          }),
        );
      }
    }

    const needsApproval = warnings.length > 0 && !form.approver.trim();
    return { blockers, warnings, needsApproval };
  }, [quantityByProduct, products, selectedCustomer, validLicensesForCustomer, form.customerLicenseId, form.items, form.approver, orderTotal, t]);

  const canSubmit = validation.blockers.length === 0 && !validation.needsApproval;

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (row: SalesOrder) => {
    setForm({
      orderNo: row.orderNo,
      customerId: String(row.customerId),
      customerLicenseId: row.customerLicenseId != null ? String(row.customerLicenseId) : "",
      deliveryStatus: row.deliveryStatus,
      invoiceNo: row.invoiceNo,
      approver: row.approver ?? "",
      items: (row.items ?? []).map((item) => ({
        productId: String(item.productId),
        quantity: String(item.quantity),
        unitPrice: item.unitPrice,
        discount: item.discount,
        lotBatch: item.lotBatch,
      })),
    });
    setEditing(row);
  };

  const closeModal = () => setEditing(undefined);

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const removeItem = (index: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  const updateItem = (index: number, patch: Partial<ItemRow>) =>
    setForm({ ...form, items: form.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  const handleSubmit = async () => {
    if (!form.customerId || !form.orderNo || !form.invoiceNo) {
      toast.error(t("salesOrder.toastFillAll"));
      return;
    }
    if (form.items.length === 0 || form.items.some((i) => !i.productId || !i.quantity || !i.unitPrice || !i.lotBatch)) {
      toast.error(t("salesOrder.toastItemsRequired"));
      return;
    }
    if (!canSubmit) {
      toast.error(t("salesOrder.toastFixIssues"));
      return;
    }
    try {
      const payload = {
        orderNo: form.orderNo,
        customerId: Number(form.customerId),
        customerLicenseId: Number(form.customerLicenseId),
        deliveryStatus: form.deliveryStatus,
        invoiceNo: form.invoiceNo,
        approver: form.approver || undefined,
        items: form.items.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount || 0),
          lotBatch: item.lotBatch,
        })),
      };
      if (editing) {
        await update(editing.salesOrderId, payload);
        toast.success(t("salesOrder.toast.updated", { no: form.orderNo }));
      } else {
        await create(payload);
        toast.success(t("salesOrder.toast.created", { no: form.orderNo }));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.salesOrderId);
      toast.success(t("salesOrder.toast.deleted", { no: deleting.orderNo }));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.deleteFailed"));
    }
  };

  const columns: Column<SalesOrder>[] = [
    { key: "orderNo", header: t("common.col.orderNo"), render: (r) => <span className="font-mono text-xs font-medium text-slate-700">{r.orderNo}</span> },
    { key: "customer", header: t("common.col.customer"), render: (r) => r.customer?.customerName ?? "-" },
    {
      key: "items",
      header: t("salesOrder.col.items"),
      render: (r) => {
        const items = r.items ?? [];
        if (items.length === 0) return <span className="text-slate-400">-</span>;
        const shown = items.slice(0, 2);
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((item) => (
              <span
                key={item.salesOrderItemId}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                <Package className="h-3 w-3" />
                {item.product?.productName ?? item.productId} × {item.quantity}
              </span>
            ))}
            {items.length > shown.length && <span className="text-xs text-slate-400">+{items.length - shown.length}</span>}
          </div>
        );
      },
    },
    { key: "net", header: t("common.col.netValue"), render: (r) => formatCurrency(r.netValue) },
    { key: "invoice", header: t("salesOrder.col.invoice"), render: (r) => <span className="text-xs">{r.invoiceNo}</span> },
    {
      key: "delivery",
      header: t("salesOrder.col.delivery"),
      render: (r) => <Badge tone={statusTone(r.deliveryStatus)}>{t(`status.delivery.${r.deliveryStatus}`, r.deliveryStatus)}</Badge>,
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
        title={t("salesOrder.title")}
        subtitle={t("salesOrder.subtitle")}
        filters={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder={t("salesOrder.searchPlaceholder")} />
            <SelectField value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)} className="w-auto">
              <option value="">{t("salesOrder.allDeliveryStatuses")}</option>
              {DELIVERY_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`status.delivery.${s}`)}
                </option>
              ))}
            </SelectField>
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t("salesOrder.add")}
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("salesOrder.emptyTitle")} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.salesOrderId}
          rowClassName={(r) => (r.deliveryStatus === "RETURNED" || r.deliveryStatus === "DAMAGED" ? "bg-rose-50/40" : "")}
        />
      )}

      {editing !== undefined && (
        <Modal
          title={editing ? t("salesOrder.modalEdit") : t("salesOrder.modalCreate")}
          subtitle={t("salesOrder.modalSubtitle")}
          width="max-w-3xl"
          onClose={closeModal}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={closeModal}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit} disabled={!canSubmit}>
                {t("common.save")}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <FormGrid>
              <Field label={t("salesOrder.field.orderNo")} required>
                <TextInput value={form.orderNo} onChange={(e) => setForm({ ...form, orderNo: e.target.value })} placeholder={t("salesOrder.field.orderNoPlaceholder")} />
              </Field>
              <Field label={t("salesOrder.field.invoiceNo")} required>
                <TextInput value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} placeholder={t("salesOrder.field.invoiceNoPlaceholder")} />
              </Field>
              <Field label={t("salesOrder.field.customer")} required colSpan={2}>
                <SelectField
                  value={form.customerId}
                  onChange={(e) => {
                    const customerId = e.target.value;
                    const customer = customers.find((c) => String(c.customerId) === customerId);
                    const valid = validLicensesFor(customerId, customer);
                    setForm({ ...form, customerId, customerLicenseId: valid.length === 1 ? String(valid[0].customerLicenseId) : "" });
                  }}
                >
                  <option value="">{t("salesOrder.field.customerPlaceholder")}</option>
                  {customers.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.customerName} ({t(`status.channel.${c.channelType}`)})
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field
                label={t("salesOrder.field.license")}
                required
                colSpan={2}
                helperText={
                  form.customerId && validLicensesForCustomer.length === 0
                    ? t("salesOrder.field.licenseHelpNone")
                    : t("salesOrder.field.licenseHelp")
                }
              >
                <SelectField
                  value={form.customerLicenseId}
                  onChange={(e) => setForm({ ...form, customerLicenseId: e.target.value })}
                  disabled={!form.customerId || validLicensesForCustomer.length === 0}
                >
                  <option value="">
                    {!form.customerId
                      ? t("salesOrder.field.licensePlaceholder")
                      : validLicensesForCustomer.length === 0
                        ? t("salesOrder.field.licenseNone")
                        : t("salesOrder.field.licenseSelectPlaceholder")}
                  </option>
                  {validLicensesForCustomer.map((l) => (
                    <option key={l.customerLicenseId} value={l.customerLicenseId}>
                      {l.licenseNumber} — {l.licenseType}
                    </option>
                  ))}
                </SelectField>
              </Field>
              {selectedLicense && (
                <div className="sm:col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <span>
                    {t("customerLicense.field.type")}: <strong>{selectedLicense.licenseType}</strong>
                  </span>
                  <span>
                    {t("salesOrder.field.licenseValidUntil")}: <strong>{formatDate(selectedLicense.expiryDate)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t("salesOrder.field.licenseValid")}
                  </span>
                </div>
              )}
              <Field label={t("salesOrder.field.deliveryStatus")}>
                <SelectField value={form.deliveryStatus} onChange={(e) => setForm({ ...form, deliveryStatus: e.target.value })}>
                  {DELIVERY_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.delivery.${s}`)}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field label={t("salesOrder.field.approver")} helperText={t("salesOrder.field.approverHelp")}>
                <TextInput value={form.approver} onChange={(e) => setForm({ ...form, approver: e.target.value })} />
              </Field>
            </FormGrid>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">{t("salesOrder.items.heading")}</span>
                <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addItem}>
                  {t("salesOrder.items.add")}
                </Button>
              </div>

              {form.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                  {t("salesOrder.items.empty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {form.items.map((item, index) => {
                    const lots = lotsForProduct(item.productId);
                    return (
                      <div key={index} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <SelectField
                              value={item.productId}
                              onChange={(e) => {
                                const product = products.find((p) => String(p.productId) === e.target.value);
                                updateItem(index, { productId: e.target.value, unitPrice: item.unitPrice || product?.unitPrice || "", lotBatch: "" });
                              }}
                              className="bg-white"
                            >
                              <option value="">{t("salesOrder.items.productPlaceholder")}</option>
                              {sellableProducts.map((p) => (
                                <option key={p.productId} value={p.productId}>
                                  {p.productName} — {p.stockQty} {p.unit}
                                </option>
                              ))}
                            </SelectField>
                          </div>
                          <div className="w-20">
                            <TextInput
                              type="number"
                              min="1"
                              placeholder={t("salesOrder.items.quantityPlaceholder")}
                              value={item.quantity}
                              onChange={(e) => updateItem(index, { quantity: e.target.value })}
                              className="bg-white"
                            />
                          </div>
                          <div className="w-24">
                            <TextInput
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={t("salesOrder.items.unitPricePlaceholder")}
                              value={item.unitPrice}
                              onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                              className="bg-white"
                            />
                          </div>
                          <div className="w-20">
                            <TextInput
                              type="number"
                              min="0"
                              max="100"
                              placeholder={t("salesOrder.items.discountPlaceholder")}
                              value={item.discount}
                              onChange={(e) => updateItem(index, { discount: e.target.value })}
                              className="bg-white"
                            />
                          </div>
                          <div className="w-28 pb-2 text-right text-xs text-slate-500">{formatCurrency(itemSubtotal(item))}</div>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(index)} icon={<X className="h-3.5 w-3.5 text-rose-500" />} />
                        </div>
                        <SelectField
                          value={item.lotBatch}
                          onChange={(e) => updateItem(index, { lotBatch: e.target.value })}
                          disabled={!item.productId}
                          className="bg-white"
                        >
                          <option value="">{t("salesOrder.items.lotPlaceholder")}</option>
                          {lots.map((l) => (
                            <option key={l.inventoryStockId} value={l.lotBatch}>
                              {l.lotBatch} ({l.quantityOnHand} · {l.warehouse})
                            </option>
                          ))}
                        </SelectField>
                      </div>
                    );
                  })}
                </div>
              )}

              {form.items.length > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">{t("salesOrder.items.summary", { count: form.items.length })}</span>
                  <span className="font-semibold text-slate-900">{t("salesOrder.items.total", { amount: formatCurrency(orderTotal) })}</span>
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                {t("salesOrder.field.availableCredit")}: <span className="font-medium text-slate-700">{formatCurrency(selectedCustomer.availableCredit)}</span>
              </div>
            )}

            {validation.blockers.map((msg) => (
              <div key={msg} className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{msg}</span>
              </div>
            ))}
            {validation.warnings.map((msg) => (
              <div key={msg} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{msg}</span>
              </div>
            ))}
            {validation.blockers.length === 0 && validation.warnings.length === 0 && form.items.length > 0 && form.customerId && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t("salesOrder.validation.passed")}</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("salesOrder.confirmDeleteTitle")}
          message={t("salesOrder.confirmDeleteMessage", { no: deleting.orderNo })}
          loading={saving}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
