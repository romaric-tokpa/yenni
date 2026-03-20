"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatCFA, INCOME_SOURCE_SALARY_SETTINGS } from "@/lib/constants";
import { getIncomeSourceLabel } from "@/lib/incomeSources";

const BAR_COLORS = [
  "#22c55e",
  "#34d399",
  "#14b8a6",
  "#2dd4bf",
  "#fbbf24",
  "#fb923c",
  "#a78bfa",
  "#f472b6",
  "#94a3b8",
];

/** Revenus crédités sur la période, regroupés par type (source). */
export default function IncomeMixBarChart({
  totalsBySource,
}: {
  totalsBySource: Record<string, number>;
}) {
  const data = Object.entries(totalsBySource)
    .filter(([, v]) => v > 0)
    .map(([source, value]) => ({
      name:
        source === INCOME_SOURCE_SALARY_SETTINGS
          ? "Salaire (réglages)"
          : getIncomeSourceLabel(source),
      value,
      key: source,
    }))
    .sort((a, b) => b.value - a.value);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: { name: string } }>;
  }) => {
    if (active && payload?.[0]) {
      const row = payload[0];
      return (
        <div className="glass-strong rounded-lg px-3 py-2 text-xs border border-white/10">
          <div className="font-medium">{row.payload.name}</div>
          <div className="font-mono font-bold text-emerald-300">{formatCFA(row.value)} FCFA</div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-500 text-xs px-4 text-center">
        Aucun revenu enregistré sur cette période
      </div>
    );
  }

  return (
    <div className="w-full" role="img" aria-label="Montants encaissés par type de revenu">
      <ResponsiveContainer width="100%" height={Math.max(200, 44 + data.length * 36)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
          barCategoryGap={10}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#737373", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={118}
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
