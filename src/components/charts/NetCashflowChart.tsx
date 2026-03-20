"use client";

import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatCFA, MONTHS_SHORT } from "@/lib/constants";
import type { MonthlyDataPoint } from "./MonthlyBarChart";

/** Solde mensuel (revenus − dépenses agrégés API budget-summary) — tendance pour décisions. */
export default function NetCashflowChart({
  monthlyData,
  currentMonth = new Date().getMonth(),
}: {
  monthlyData: MonthlyDataPoint[];
  currentMonth?: number;
}) {
  const data =
    monthlyData.length === 12
      ? monthlyData.map((d) => {
          const net = d.Revenus - d.Dépenses;
          return {
            name: MONTHS_SHORT[d.month],
            month: d.month,
            net,
            isCurrent: d.month === currentMonth,
          };
        })
      : MONTHS_SHORT.map((name, i) => ({
          name,
          month: i,
          net: 0,
          isCurrent: i === currentMonth,
        }));

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload?.[0]) {
      const v = payload[0].value;
      return (
        <div className="glass-strong rounded-lg px-3 py-2 text-xs border border-white/10">
          <div className="font-medium mb-1">{label}</div>
          <div className={`font-mono font-bold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {v >= 0 ? "+" : ""}
            {formatCFA(v)} FCFA
          </div>
          <div className="text-slate-500 text-[10px] mt-0.5">Revenus − dépenses (mois)</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full" role="img" aria-label="Évolution du solde mensuel revenus moins dépenses">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
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
                    fontSize={isCurrent ? 11 : 10}
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
          <Area
            type="monotone"
            dataKey="net"
            stroke="#4ade80"
            strokeWidth={2}
            fill="url(#netFill)"
            dot={{ r: 3, fill: "#86efac", stroke: "#14532d", strokeWidth: 1 }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
