"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { motion } from "framer-motion";

interface StatusDonutChartProps {
  data: Array<{ status: string; _count: { id: number } }>;
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  BOOKED: "#047857",
  CONVERTED: "#047857",
  VISITED: "#047857",
  CALLING: "#1B4332",
  PENDING: "#5C6B62",
  REMINDED: "#1B4332",
  FOLLOWUP_D1: "#B45309",
  FOLLOWUP_D2: "#B45309",
  FOLLOWUP_D3: "#B45309",
  REBOOKED: "#047857",
  NO_ANSWER: "#B45309",
  FAQ_ONLY: "#1B4332",
  NO_SHOW: "#E11D48",
  COLD: "#E11D48",
  CALL_FAILED: "#E11D48",
};

const FALLBACK_COLORS = ["#1B4332", "#047857", "#B45309", "#E11D48", "#5C6B62", "#B8860B"];

export function StatusDonutChart({ data, loading }: StatusDonutChartProps) {
  if (loading) {
    return <div className="h-[320px] rounded-lg bg-[#FFFFFF] border border-[#E4E7DF] animate-pulse" />;
  }

  const chartData = data.map((d, i) => ({
    name: d.status,
    value: d._count.id,
    color: STATUS_COLORS[d.status] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[320px] rounded-lg bg-[#FFFFFF] border border-[#E4E7DF] p-5 flex items-center justify-center">
        <p className="text-[13px] text-[#5C6B62]">No leads yet</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg bg-[#FFFFFF] border border-[#E4E7DF] p-5"
    >
      <h3 className="caption mb-4">Lead Status Distribution</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#F1F3EE",
              border: "1px solid #E4E7DF",
              borderRadius: "8px",
              color: "#1E2B24",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-[12px] text-[#5C6B62]">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
