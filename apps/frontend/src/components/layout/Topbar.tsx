import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Topbar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
      </div>
      <LanguageSwitcher />
      <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-[11px] font-semibold text-white">
          U
        </span>
        <span className="hidden text-xs font-medium text-slate-600 sm:inline">{t("app.user")}</span>
      </div>
    </header>
  );
}
