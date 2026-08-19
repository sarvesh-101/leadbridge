"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Send, RefreshCw, UserCheck, Target, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import type { LeadStatus } from "@/types";

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  onComplete: () => void;
}

const BULK_ACTIONS = [
  {
    label: "Call",
    icon: RefreshCw,
    action: "call" as const,
    color: "text-blue-400 hover:bg-blue-500/10 border-blue-500/20",
  },
  {
    label: "Message",
    icon: Send,
    action: "message" as const,
    color: "text-violet-400 hover:bg-violet-500/10 border-violet-500/20",
  },
  {
    label: "Assign",
    icon: UserCheck,
    action: "assign" as const,
    color: "text-amber-400 hover:bg-amber-500/10 border-amber-500/20",
  },
  {
    label: "Status",
    icon: Target,
    action: "status" as const,
    color: "text-green-400 hover:bg-green-500/10 border-green-500/20",
  },
  {
    label: "Delete",
    icon: Trash2,
    action: "delete" as const,
    color: "text-red-400 hover:bg-red-500/10 border-red-500/20 destructive",
  },
];

const BULK_STATUSES: { label: string; value: LeadStatus }[] = [
  { label: "Converted", value: "CONVERTED" },
  { label: "Cold", value: "COLD" },
  { label: "Call Again", value: "PENDING" },
  { label: "Follow-up D1", value: "FOLLOWUP_D1" },
];

export function BulkActionBar({ selectedIds, onClear, onComplete }: BulkActionBarProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  if (selectedIds.length === 0) return null;

  async function handleAction(action: string) {
    setActionLoading(action);
    try {
      switch (action) {
        case "call":
          await api.post("/leads/bulk/call", { leadIds: selectedIds });
          toast.success(`Enqueuing calls for ${selectedIds.length} leads`);
          break;
        case "message":
          await api.post("/leads/bulk/message", { leadIds: selectedIds });
          toast.success(`Messages sent to ${selectedIds.length} leads`);
          break;
        case "assign":
          toast.info("Assign feature — select a team member from the sidebar");
          break;
        case "delete":          if (confirm(`Delete ${selectedIds.length} leads? This cannot be undone.`)) {
                await apiFetch("/leads/bulk", { method: "DELETE", body: JSON.stringify({ leadIds: selectedIds }) });
            toast.success(`${selectedIds.length} leads deleted`);
            onClear();
          }
          break;
        default:
          if (BULK_STATUSES.some((s) => s.value === action)) {
            await api.patch("/leads/bulk/status", { leadIds: selectedIds, status: action });
            toast.success(`${selectedIds.length} leads updated to ${action}`);
          }
          break;
      }
      onComplete();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} leads`);
    } finally {
      setActionLoading(null);
      setShowStatusMenu(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4332]/10 border border-[#1B4332]/20"
      >
        <span className="text-sm font-medium text-[#1B4332] mr-2">
          {selectedIds.length} selected
        </span>

        <div className="flex items-center gap-1.5">
          {BULK_ACTIONS.map((action) => (
            <div key={action.action} className="relative">
              {action.action === "status" ? (
                <div className="relative">
                  <button
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    disabled={actionLoading !== null}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      action.color,
                      actionLoading === action.action && "opacity-50"
                    )}
                  >
                    {actionLoading === action.action ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <action.icon className="w-3 h-3" />
                    )}
                    {action.label}
                  </button>
                  {showStatusMenu && (
                    <div className="absolute top-full mt-1 left-0 z-50 w-40 rounded-lg bg-[#F1F3EE] border border-[#E4E7DF] shadow-xl overflow-hidden">
                      {BULK_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => handleAction(s.value)}
                          className="w-full px-3 py-2 text-xs text-left text-[#5C6B62] hover:bg-[#F1F3EE] transition-colors"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleAction(action.action)}
                  disabled={actionLoading !== null}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    action.color,
                    action.action === "delete" && "hover:bg-red-500/20",
                    actionLoading === action.action && "opacity-50"
                  )}
                >
                  {actionLoading === action.action ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <action.icon className="w-3 h-3" />
                  )}
                  {action.label}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onClear}
          className="ml-auto p-1.5 rounded-lg hover:bg-[#F1F3EE] text-[#7C8781] hover:text-[#5C6B62] transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
