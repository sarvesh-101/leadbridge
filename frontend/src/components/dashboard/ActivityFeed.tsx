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
  lead_new: "bg-line-subtle/10 text-line-subtle",
  call_started: "bg-warning/10 text-warning",
  call_completed: "bg-success/10 text-success",
  booking_made: "bg-success/10 text-success",
  status_change: "bg-line-subtle/10 text-line-subtle",
  notification_sent: "bg-line-subtle/10 text-line-subtle",
};

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[60px] rounded-lg bg-surface animate-pulse" />
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
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface transition-colors"
          >
            <div className={cn("p-1.5 rounded-full", ACTIVITY_BG[activity.type] || "bg-surface text-ink-muted")}>
              {ACTIVITY_ICONS[activity.type] || <Activity className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-ink truncate">
                {activity.title}
              </p>
              <p className="text-[12px] text-ink-muted truncate">
                {activity.description}
              </p>
            </div>
            <p className="text-[11px] text-ink-muted whitespace-nowrap flex-shrink-0">
              {formatDate(activity.timestamp)}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
      {activities.length === 0 && (
        <p className="text-center text-ink-muted text-[13px] py-8">
          No recent activity
        </p>
      )}
    </div>
  );
}
