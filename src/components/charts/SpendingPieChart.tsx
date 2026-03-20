"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatCFA } from "@/lib/constants";
import type { Category } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, name, value, percent, fill } = props as {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    name: string;
    value: number;
    percent: number;
    fill: string;
  };
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? "start" : "end";

  if (percent < 0.035) return null;

  const label = name.length > 10 ? name.slice(0, 10) + "…" : name;

  return (
    <g>
      <line
        x1={cx + (outerRadius + 4) * Math.cos(-midAngle * RADIAN)}
        y1={cy + (outerRadius + 4) * Math.sin(-midAngle * RADIAN)}
        x2={x}
        y2={y}
        stroke={fill}
        strokeWidth={1}
        strokeOpacity={0.45}
      />
      <text x={x} y={y - 6} textAnchor={textAnchor} fill="#e2e8f0" fontSize={10} fontWeight={500}>
        {label}
      </text>
      <text
        x={x}
        y={y + 4}
        textAnchor={textAnchor}
        fill="#94a3b8"
        fontSize={9}
        fontFamily="ui-monospace, monospace"
      >
        {formatCFA(value)}
      </text>
    </g>
  );
}

/** Répartition des dépenses variables réelles par catégorie (sur la période chargée). */
export default function SpendingPieChart({
  categories,
  spentByCategoryId,
}: {
  categories: Category[];
  spentByCategoryId: Record<string, number>;
}) {
  const data = categories
    .map((c) => ({
      name: c.label,
      value: spentByCategoryId[c.id] ?? 0,
      color: c.color,
      id: c.id,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: { color: string } }>;
  }) => {
    if (active && payload?.[0]) {
      const d = payload[0];
      return (
        <div className="glass-strong rounded-lg px-3 py-2 text-xs border border-white/10">
          <div className="font-medium mb-0.5">{d.name}</div>
          <div className="font-mono font-bold">{formatCFA(d.value)} FCFA</div>
          <div className="text-slate-400">{((d.value / total) * 100).toFixed(1)} % du total dépenses cat.</div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center text-center text-slate-500 text-xs px-4">
        Aucune dépense par catégorie sur cette période
      </div>
    );
  }

  return (
    <div className="w-full" role="img" aria-label="Répartition des dépenses par catégorie">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={88}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
            label={renderLabel}
            labelLine={false}
          >
            {data.map((d, i) => (
              <Cell key={d.id + i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#e2e8f0"
            fontSize={13}
            fontWeight={700}
            fontFamily="ui-monospace, monospace"
          >
            {formatCFA(total)}
          </text>
          <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" fill="#64748b" fontSize={9}>
            Total
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
