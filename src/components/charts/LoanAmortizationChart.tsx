"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { formatCFA } from "@/lib/constants";

interface ScheduleRow {
  number: number;
  principal: number;
  interest: number;
  due_date: string;
  status: string;
}

interface LoanAmortizationChartProps {
  schedule: ScheduleRow[];
  currentNumber: number;
}

export default function LoanAmortizationChart({ schedule, currentNumber }: LoanAmortizationChartProps) {
  const data = schedule.map((s) => ({
    number: s.number,
    name: `Éch. ${s.number}`,
    principal: s.principal,
    interest: s.interest,
    total: s.principal + s.interest,
  }));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { number: number; principal: number; interest: number } }>;
  }) => {
    if (active && payload?.[0]) {
      const p = payload[0].payload;
      return (
        <div className="glass-strong rounded-lg px-3 py-2 text-xs">
          <div className="font-medium mb-1">Échéance {p.number}</div>
          <div className="text-emerald-400">Capital: {formatCFA(p.principal)}</div>
          <div className="text-red-400">Intérêts: {formatCFA(p.interest)}</div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-slate-500 text-xs">
        Aucune donnée
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="principalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="number" tick={{ fontSize: 10 }} stroke="#64748b" />
        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => formatCFA(v)} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine x={currentNumber} stroke="#6366f1" strokeDasharray="3 3" />
        <Area type="monotone" dataKey="principal" stackId="1" stroke="#10b981" fill="url(#principalGrad)" />
        <Area type="monotone" dataKey="interest" stackId="1" stroke="#ef4444" fill="url(#interestGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
