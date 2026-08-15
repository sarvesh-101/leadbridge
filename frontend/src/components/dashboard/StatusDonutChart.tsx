"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { motion } from "framer-motion";

interface StatusDonutChartProps {
  data: Array<{ status: string; _count: { id: number } }>;
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  BOOKED: "#10B981",
  CONVERTED: "#10B981",
  VISITED: "#10B981",
  CALLING: "#3B82F6",
  PENDING: "#8B93A3",
  REMINDED: "#3B82F6",
  FOLLOWUP_D1: "#F59E0B",
  FOLLOWUP_D2: "#F59E0B",
  FOLLOWUP_D3: "#F59E0B",
  REBOOKED: "#10B981",
  NO_ANSWER: "#F59E0B",
  FAQ_ONLY: "#3B82F6",
  NO_SHOW: "#F43F5E",
  COLD: "#F43F5E",
  CALL_FAILED: "#F43F5E",
};

const FALLBACK_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#F43F5E", "#8B93A3", "#C9A84C"];

export function StatusDonutChart({ data, loading }: StatusDonutChartProps) {
  if (loading) {
    return <div className="h-[320px] rounded-lg bg-[#14161C] border border-[#272B34] animate-pulse" />;
  }

  const chartData = data.map((d, i) => ({
    name: d.status,
    value: d._count.id,
    color: STATUS_COLORS[d.status] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[320px] rounded-lg bg-[#14161C] border border-[#272B34] p-5 flex items-center justify-center">
        <p className="text-[13px] text-[#8B93A3]">No leads yet</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg bg-[#14161C] border border-[#272B34] p-5"
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
              backgroundColor: "#1B1E26",
              border: "1px solid #272B34",
              borderRadius: "8px",
              color: "#F2F4F8",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-[12px] text-[#8B93A3]">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
