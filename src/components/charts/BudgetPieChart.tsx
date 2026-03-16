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

export default function BudgetPieChart({
  categories,
}: {
  categories: Category[];
}) {
  const data = categories.map((c) => ({
    name: `${c.icon} ${c.label}`,
    value: c.budget,
    color: c.color,
  }));
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

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
