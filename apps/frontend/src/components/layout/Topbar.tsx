import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../ui/Button";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Topbar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

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
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 hover:bg-slate-200"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-[11px] font-semibold text-white">
            {(user?.username ?? "U").slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden text-xs font-medium text-slate-600 sm:inline">{user?.username ?? t("app.user")}</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-3.5 w-3.5" />}
              className="w-full justify-start"
              onClick={handleLogout}
            >
              {t("auth.logoutButton")}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
