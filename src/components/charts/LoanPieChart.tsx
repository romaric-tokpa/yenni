"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCFA } from "@/lib/constants";

const COLORS = {
  capital: "#10b981",
  interest: "#ef4444",
  insurance: "#f59e0b",
  taxes: "#6366f1",
  fees: "#8b5cf6",
};

interface LoanPieChartProps {
  totalBorrowed: number;
  totalInterest: number;
  totalInsurance: number;
  totalTaxes: number;
  totalFees: number;
}

export default function LoanPieChart({
  totalBorrowed,
  totalInterest,
  totalInsurance,
  totalTaxes,
  totalFees,
}: LoanPieChartProps) {
  const data = [
    { name: "Capital", value: totalBorrowed, color: COLORS.capital },
    { name: "Intérêts", value: totalInterest, color: COLORS.interest },
    { name: "Assurance", value: totalInsurance, color: COLORS.insurance },
    { name: "Taxes", value: totalTaxes, color: COLORS.taxes },
    { name: "Frais", value: totalFees, color: COLORS.fees },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { name: string; value: number } }>;
  }) => {
    if (active && payload?.[0]) {
      const d = payload[0].payload;
      return (
        <div className="glass-strong rounded-lg px-3 py-2 text-xs">
          <div className="font-medium mb-0.5">{d.name}</div>
          <div className="font-mono font-bold">{formatCFA(d.value)} FCFA</div>
          <div className="text-slate-400">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-slate-500 text-xs">
        Aucune donnée
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          paddingAngle={2}
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
