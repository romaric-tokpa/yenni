"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatCFA, MONTHS_SHORT } from "@/lib/constants";

interface Props {
  savings: number[];
  goal: number;
  target: number;
}

export default function SavingsLineChart({ savings, goal, target }: Props) {
  let cumul = 0;
  const data = MONTHS_SHORT.map((m, i) => {
    cumul += savings[i] || 0;
    return { name: m, Cumulé: cumul, Objectif: target * (i + 1) };
  });

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
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
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
        {goal > 0 && (
          <ReferenceLine
            y={goal}
            stroke="#f59e0b"
            strokeDasharray="8 4"
            label={{
              value: `Objectif: ${formatCFA(goal)}`,
              fill: "#f59e0b",
              fontSize: 10,
              position: "right",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="Objectif"
          stroke="#64748b"
          strokeDasharray="5 5"
          strokeWidth={1.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="Cumulé"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ fill: "#10b981", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
