"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCFA } from "@/lib/constants";

interface ScheduleRow {
  number: number;
  remaining_balance: number;
}

interface LoanBalanceChartProps {
  schedule: ScheduleRow[];
}

export default function LoanBalanceChart({ schedule }: LoanBalanceChartProps) {
  const data = schedule.map((s) => ({
    number: s.number,
    name: `Éch. ${s.number}`,
    balance: s.remaining_balance,
  }));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { number: number; balance: number } }>;
  }) => {
    if (active && payload?.[0]) {
      const p = payload[0].payload;
      return (
        <div className="glass-strong rounded-lg px-3 py-2 text-xs">
          <div className="font-medium mb-0.5">Échéance {p.number}</div>
          <div className="font-mono text-emerald-400">{formatCFA(p.balance)} FCFA</div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-slate-500 text-xs">
        Aucune donnée
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="number" tick={{ fontSize: 10 }} stroke="#64748b" />
        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => formatCFA(v)} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="balance" fill="url(#balanceGrad)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
