"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Calendar, MessageSquare, Activity, UserPlus,
  CheckCircle2, XCircle,
} from "lucide-react";
import { formatDate, cn } from "../../lib/utils";

interface ActivityItem {
  id: string;
  type: "lead_new" | "call_started" | "call_completed" | "booking_made" | "status_change" | "notification_sent";
  title: string;
  description: string;
  timestamp: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  loading?: boolean;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  lead_new: <UserPlus className="w-3.5 h-3.5" />,
  call_started: <Phone className="w-3.5 h-3.5" />,
  call_completed: <CheckCircle2 className="w-3.5 h-3.5" />,
  booking_made: <Calendar className="w-3.5 h-3.5" />,
  status_change: <Activity className="w-3.5 h-3.5" />,
  notification_sent: <MessageSquare className="w-3.5 h-3.5" />,
};

const ACTIVITY_BG: Record<string, string> = {
  lead_new: "bg-[#4F6EF7]/10 text-[#4F6EF7]",
  call_started: "bg-[#F59E0B]/10 text-[#F59E0B]",
  call_completed: "bg-[#22D3A5]/10 text-[#22D3A5]",
  booking_made: "bg-[#22D3A5]/10 text-[#22D3A5]",
  status_change: "bg-[#4F6EF7]/10 text-[#4F6EF7]",
  notification_sent: "bg-[#4F6EF7]/10 text-[#4F6EF7]",
};

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[60px] rounded-lg bg-[#1A1A24] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <AnimatePresence mode="popLayout">
        {activities.slice(0, 8).map((activity) => (
          <motion.div
            key={activity.id}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#1A1A24] transition-colors"
          >
            <div className={cn("p-1.5 rounded-full", ACTIVITY_BG[activity.type] || "bg-[#1A1A24] text-[#6B6B8A]")}>
              {ACTIVITY_ICONS[activity.type] || <Activity className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#F0F0F8] truncate">
                {activity.title}
              </p>
              <p className="text-[12px] text-[#6B6B8A] truncate">
                {activity.description}
              </p>
            </div>
            <p className="text-[11px] text-[#6B6B8A] whitespace-nowrap flex-shrink-0">
              {formatDate(activity.timestamp)}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
      {activities.length === 0 && (
        <p className="text-center text-[#6B6B8A] text-[13px] py-8">
          No recent activity
        </p>
      )}
    </div>
  );
}
