"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, Legend,
} from "recharts";
import { motion } from "framer-motion";

interface DataPoint {
  date: string;
  leads: number;
  calls: number;
  bookings: number;
}

interface LeadVolumeChartProps {
  data: DataPoint[];
  loading?: boolean;
}

export function LeadVolumeChart({ data, loading }: LeadVolumeChartProps) {
  if (loading) {
    return <div className="h-[320px] rounded-lg bg-[#FFFFFF] border border-[#E4E7DF] animate-pulse" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg bg-[#FFFFFF] border border-[#E4E7DF] p-5"
    >
      <h3 className="caption mb-4">Lead Activity (Last 30 Days)</h3>
      {data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-[13px] text-[#5C6B62]">
          No data available yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorLeads2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1B4332" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorBookings2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#047857" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#047857" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E7DF" strokeOpacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#5C6B62" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#5C6B62" }}
              tickLine={false}
              axisLine={false}
            />
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
              formatter={(value: string) => (
                <span className="text-[12px] text-[#5C6B62]">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="leads"
              stroke="#1B4332"
              fill="url(#colorLeads2)"
              strokeWidth={2}
              name="Leads"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="bookings"
              stroke="#047857"
              fill="url(#colorBookings2)"
              strokeWidth={2}
              name="Bookings"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
