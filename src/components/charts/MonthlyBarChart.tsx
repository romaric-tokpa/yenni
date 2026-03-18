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
import { formatCFA, MONTHS_SHORT } from "@/lib/constants";

export type MonthlyDataPoint = { month: number; Revenus: number; Dépenses: number };

interface Props {
  /** Données par mois (12 éléments). Si absent, utilise totalIncome/totalFixed/totalVariable pour tous les mois (legacy). */
  monthlyData?: MonthlyDataPoint[];
  totalIncome?: number;
  totalFixed?: number;
  totalVariable?: number;
  /** Mois à mettre en évidence (index 0-11) */
  currentMonth?: number;
}

export default function MonthlyBarChart({
  monthlyData,
  totalIncome = 0,
  totalFixed = 0,
  totalVariable = 0,
  currentMonth = new Date().getMonth(),
}: Props) {
  const data =
    monthlyData && monthlyData.length === 12
      ? monthlyData.map((d) => ({
          name: MONTHS_SHORT[d.month],
          month: d.month,
          Revenus: d.Revenus,
          Dépenses: d.Dépenses,
          isCurrent: d.month === currentMonth,
        }))
      : MONTHS_SHORT.map((m, i) => ({
          name: m,
          month: i,
          Revenus: totalIncome,
          Dépenses: totalFixed + totalVariable,
          isCurrent: i === currentMonth,
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
      <BarChart data={data} barGap={4} barCategoryGap="12%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="name"
          tick={(props) => {
            const { x, y, payload } = props;
            const isCurrent = data[payload.index]?.isCurrent;
            return (
              <g transform={`translate(${x},${y})`}>
                <text
                  x={0}
                  y={0}
                  dy={8}
                  textAnchor="middle"
                  fill={isCurrent ? "#22c55e" : "#737373"}
                  fontSize={isCurrent ? 12 : 10}
                  fontWeight={isCurrent ? 600 : 400}
                >
                  {payload.value}
                </text>
              </g>
            );
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#737373", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="Revenus" radius={[4, 4, 0, 0]} barSize={14}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isCurrent ? "#22c55e" : "rgba(34, 197, 94, 0.5)"}
              stroke={entry.isCurrent ? "#22c55e" : "none"}
              strokeWidth={entry.isCurrent ? 2 : 0}
            />
          ))}
        </Bar>
        <Bar dataKey="Dépenses" radius={[4, 4, 0, 0]} barSize={14}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isCurrent ? "#ef4444" : "rgba(239, 68, 68, 0.5)"}
              stroke={entry.isCurrent ? "#ef4444" : "none"}
              strokeWidth={entry.isCurrent ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
