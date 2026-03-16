"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCFA, MONTHS_SHORT } from "@/lib/constants";

interface Props {
  totalIncome: number;
  totalFixed: number;
  totalVariable: number;
}

export default function MonthlyBarChart({
  totalIncome,
  totalFixed,
  totalVariable,
}: Props) {
  const data = MONTHS_SHORT.map((m) => ({
    name: m,
    Revenus: totalIncome,
    Dépenses: totalFixed + totalVariable,
  }));

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (active && payload?.length) {
      return (
        <div className="glass-strong rounded-lg px-3 py-2 text-xs">
          <div className="font-medium mb-1">{label}</div>
          {payload.map((p, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: p.color }}
              />
              <span>
                {p.name}:{" "}
                <strong className="font-mono">{formatCFA(p.value)}</strong>
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
        />
        <XAxis
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="Revenus"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
          barSize={16}
        />
        <Bar
          dataKey="Dépenses"
          fill="#ef4444"
          radius={[4, 4, 0, 0]}
          barSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
