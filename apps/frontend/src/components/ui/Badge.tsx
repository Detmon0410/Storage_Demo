import type { Tone } from "../../lib/status";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function Badge({
  tone = "neutral",
  wrap,
  children,
}: {
  tone?: Tone;
  /** Allow the badge's text to wrap instead of forcing it onto one line — for use in narrow/responsive layouts. */
  wrap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${wrap ? "" : "whitespace-nowrap"} ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
