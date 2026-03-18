"use client";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatCFA } from "@/lib/constants";
import { Category } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, name, value, percent, fill } = props as {
    cx: number; cy: number; midAngle: number; outerRadius: number;
    name: string; value: number; percent: number; fill: string;
  };
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? "start" : "end";

  if (percent < 0.04) return null;

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
        strokeOpacity={0.5}
      />
      <text x={x} y={y - 8} textAnchor={textAnchor} fill="#e2e8f0" fontSize={11} fontWeight={500}>
        {label}
      </text>
      <text x={x} y={y + 2} textAnchor={textAnchor} fill="#94a3b8" fontSize={10} fontFamily="'Space Mono', monospace">
        {formatCFA(value)}
      </text>
      <text x={x} y={y + 14} textAnchor={textAnchor} fill="#64748b" fontSize={9}>
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
}

export default function BudgetPieChart({
  categories,
  effectiveBudgets,
}: {
  categories: Category[];
  /** Budgets effectifs par catégorie (ex. par mois). Si absent, utilise category.budget */
  effectiveBudgets?: Record<string, number>;
}) {
  const data = categories
    .map((c) => ({
      name: c.label,
      value: effectiveBudgets ? (effectiveBudgets[c.id] ?? c.budget) : c.budget,
      color: c.color,
    }))
    .filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number }>;
  }) => {
    if (active && payload?.[0]) {
      const d = payload[0];
      return (
        <div className="glass-strong rounded-lg px-3 py-2 text-xs">
          <div className="font-medium mb-0.5">{d.name}</div>
          <div className="font-mono font-bold">{formatCFA(d.value)} FCFA</div>
          <div className="text-slate-400">
            {((d.value / total) * 100).toFixed(1)}%
          </div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-slate-500 text-xs">
        Aucun budget défini
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
          label={renderLabel}
          labelLine={false}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e2e8f0"
          fontSize={14}
          fontWeight={700}
          fontFamily="'Space Mono', monospace"
        >
          {formatCFA(total)}
        </text>
        <text
          x="50%"
          y="56%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#64748b"
          fontSize={9}
        >
          FCFA total
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
