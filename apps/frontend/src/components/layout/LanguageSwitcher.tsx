import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../../i18n";

const LABELS: Record<string, string> = { en: "EN", ja: "日本語" };

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("ja") ? "ja" : "en";

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5">
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            current === lng ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {LABELS[lng]}
        </button>
      ))}
    </div>
  );
}
