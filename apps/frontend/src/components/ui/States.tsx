import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-amber-600" />
      <p className="text-sm">{label ?? t("common.loading")}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-rose-500" />
      <p className="max-w-md text-sm text-rose-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-500">
      <Inbox className="h-8 w-8 text-slate-300" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="max-w-sm text-xs text-slate-400">{description}</p>}
    </div>
  );
}
