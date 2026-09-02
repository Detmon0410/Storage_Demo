import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Modal } from "./Modal";

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t("common.delete")}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
        </span>
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </Modal>
  );
}
