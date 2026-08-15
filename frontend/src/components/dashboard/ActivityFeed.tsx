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
  lead_new: "bg-[#3B82F6]/10 text-[#3B82F6]",
  call_started: "bg-[#F59E0B]/10 text-[#F59E0B]",
  call_completed: "bg-[#10B981]/10 text-[#10B981]",
  booking_made: "bg-[#10B981]/10 text-[#10B981]",
  status_change: "bg-[#3B82F6]/10 text-[#3B82F6]",
  notification_sent: "bg-[#3B82F6]/10 text-[#3B82F6]",
};

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[60px] rounded-lg bg-[#1B1E26] animate-pulse" />
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
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#1B1E26] transition-colors"
          >
            <div className={cn("p-1.5 rounded-full", ACTIVITY_BG[activity.type] || "bg-[#1B1E26] text-[#8B93A3]")}>
              {ACTIVITY_ICONS[activity.type] || <Activity className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#F2F4F8] truncate">
                {activity.title}
              </p>
              <p className="text-[12px] text-[#8B93A3] truncate">
                {activity.description}
              </p>
            </div>
            <p className="text-[11px] text-[#8B93A3] whitespace-nowrap flex-shrink-0">
              {formatDate(activity.timestamp)}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
      {activities.length === 0 && (
        <p className="text-center text-[#8B93A3] text-[13px] py-8">
          No recent activity
        </p>
      )}
    </div>
  );
}
