import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Card } from "./Card";
import type { Tone } from "../../lib/status";

export function StatCard({
  label,
  value,
  unit,
  trend,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: { label: string; tone: Tone } | null;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-slate-900">{value}</span>
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
      </div>
      {trend && (
        <div className="mt-2">
          <Badge tone={trend.tone}>{trend.label}</Badge>
        </div>
      )}
    </Card>
  );
}
