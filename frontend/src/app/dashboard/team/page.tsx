"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { PLANS } from "@/lib/plans.autogen";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Users, Plus, X, Loader2, Shield, User, Eye, Mail,
  Trash2, ArrowUpDown, ChevronDown, Copy, AlertTriangle,
} from "lucide-react";

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "AGENT" | "VIEWER";
  status: "PENDING" | "ACTIVE" | "DECLINED";
  invitedAt: string;
  acceptedAt?: string;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  ADMIN: <Shield className="w-4 h-4" />,
  AGENT: <User className="w-4 h-4" />,
  VIEWER: <Eye className="w-4 h-4" />,
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  AGENT: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  VIEWER: "bg-neutral-soft/10 text-ink-soft border-line/30",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Full access — manage team, billing, and all features",
  AGENT: "Manage leads, calls, bookings, and campaigns",
  VIEWER: "Read-only access to dashboard and reports",
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "AGENT" | "VIEWER">("AGENT");

  // Invite result — honest: if the email failed, show a copyable link instead of fake success
  const [inviteResult, setInviteResult] = useState<{ emailSent: boolean; inviteUrl: string; email: string } | null>(null);

  // Confirm delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get<{ members: TeamMember[] }>("/team/members");
      setMembers(res.members);
    } catch (err: any) {
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setActionLoading("invite");
    setInviteResult(null);
    try {
      const res = await api.post<{ emailSent: boolean; inviteUrl: string }>("/team/invite", {
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
      });
      await loadMembers();
      if (res.emailSent) {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setShowInvite(false);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("AGENT");
      } else {
        // Email failed — show the copyable invite link instead of lying
        setInviteResult({ emailSent: false, inviteUrl: res.inviteUrl, email: inviteEmail.trim() });
        toast.warning("Invitation created, but the email failed to send. Share the link manually.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove(memberId: string) {
    setActionLoading(`remove-${memberId}`);
    try {
      await api.delete(`/team/members/${memberId}`);
      toast.success("Team member removed");
      setDeleteConfirmId(null);
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRoleChange(memberId: string, role: "ADMIN" | "AGENT" | "VIEWER") {
    setActionLoading(`role-${memberId}`);
    try {
      await api.patch(`/team/members/${memberId}/role`, { role });
      toast.success("Role updated");
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setActionLoading(null);
    }
  }

  const activeMembers = members.filter(m => m.status === "ACTIVE");
  const pendingInvites = members.filter(m => m.status === "PENDING");

  // T3: seats come from the generated plans config (3 / 15 / 50), the same
  // numbers the server enforces on POST /team/invite.
  const currentPlan = useAuthStore((s) => s.user?.plan);
  const planConfig = PLANS.plans.find((p) => p.id === currentPlan);
  const seatLimit = planConfig?.teamUsers ?? null;
  const seatsUsed = activeMembers.length + pendingInvites.length;
  const atSeatLimit = seatLimit !== null && seatsUsed >= seatLimit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Team</h1>
          <p className="text-ink-soft mt-1">Manage your team members and permissions</p>
        </div>
        <div className="flex flex-col sm:items-end gap-1.5">
          <button onClick={() => setShowInvite(true)} disabled={atSeatLimit}
            title={atSeatLimit ? "All seats are in use — remove a member or upgrade" : "Invite a team member"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Invite Member
          </button>
          {seatLimit !== null && (
            <p className="text-[11px] text-ink-soft">
              {seatsUsed} of {seatLimit} seats used · {planConfig?.name} plan
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Active Members", value: loading ? "—" : activeMembers.length, color: "text-success" },
          { icon: Mail, label: "Pending Invites", value: loading ? "—" : pendingInvites.length, color: "text-yellow-400" },
          { icon: Shield, label: "Roles", value: loading ? "—" : "ADMIN · AGENT · VIEWER", color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl app-card">
            {loading ? (
              <div className="animate-pulse"><div className="h-7 w-12 bg-white/[0.06] rounded" /></div>
            ) : (
              <>
                <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
                <div className="text-xl font-bold text-ink">{s.value}</div>
                <div className="text-xs text-ink-soft">{s.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Seat limit reached (T3) */}
      {atSeatLimit && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <p className="flex-1 text-sm text-warning">
            All {seatLimit} seats on the {planConfig?.name} plan are in use. Remove a member or upgrade to add more.
          </p>
          <Link href="/dashboard/billing"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-all"
          >
            Upgrade plan
          </Link>
        </div>
      )}

      {/* Role descriptions */}
      <div className="grid sm:grid-cols-3 gap-3">
        {(["ADMIN", "AGENT", "VIEWER"] as const).map((role) => (
          <div key={role} className={cn("p-3 rounded-xl border", ROLE_COLORS[role])}>
            <div className="flex items-center gap-2 mb-1">
              {ROLE_ICONS[role]}
              <span className="text-xs font-semibold">{role}</span>
            </div>
            <p className="text-[11px] opacity-70">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      {/* Member list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl app-card animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 rounded-xl app-card">
          <Users className="w-12 h-12 mx-auto mb-4 text-ink-soft" />
          <h3 className="text-lg font-medium text-ink mb-2">No team members yet</h3>
          <p className="text-sm text-ink-soft mb-6">Invite your first team member to get started</p>
          <button onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Invite Member
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member, i) => (
            <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-4 rounded-xl app-card app-card-hover hover:bg-white/[0.06] transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-line-subtle/20 to-brand-deep/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-brand-deep">{member.name[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{member.name}</span>
                  <div className="flex items-center gap-1.5">
                    {/* Role selector */}
                    <div className="relative group">
                      <button
                        onClick={() => handleRoleChange(member.id, member.role === "ADMIN" ? "AGENT" : member.role === "AGENT" ? "VIEWER" : "ADMIN")}
                        disabled={actionLoading === `role-${member.id}`}
                        className={cn(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all",
                          ROLE_COLORS[member.role]
                        )}
                      >
                        {ROLE_ICONS[member.role]}
                        {member.role}
                        <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />
                      </button>
                    </div>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      member.status === "ACTIVE" ? "bg-success/10 text-success" :
                      member.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                      "bg-danger/10 text-danger"
                    )}>
                      {member.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-ink-soft mt-0.5">{member.email}</p>
              </div>
              <div className="shrink-0">
                {member.status === "PENDING" ? (
                  <button onClick={() => setDeleteConfirmId(member.id)}
                    className="p-2 rounded-lg text-ink-soft hover:text-danger hover:bg-danger/10 transition-all"
                    title="Cancel invitation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => setDeleteConfirmId(member.id)}
                    className="p-2 rounded-lg text-ink-soft hover:text-danger hover:bg-danger/10 transition-all"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md mx-4 p-6 rounded-2xl app-card"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-ink">Invite Team Member</h2>
                <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-ink-soft">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">Name</label>
                  <input value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g., Priya Sharma"
                    className="w-full px-4 py-2.5 rounded-xl app-card text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-brand/60"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">Email</label>
                  <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    type="email"
                    placeholder="priya@example.com"
                    className="w-full px-4 py-2.5 rounded-xl app-card text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-brand/60"
                  />
                </div>
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["ADMIN", "AGENT", "VIEWER"] as const).map((role) => (
                      <button key={role} onClick={() => setInviteRole(role)}
                        className={cn(
                          "p-3 rounded-xl border text-xs text-center transition-all",
                          inviteRole === role
                            ? ROLE_COLORS[role]
                            : "border-line text-ink-soft hover:bg-white/[0.06]"
                        )}
                      >
                        <div className="flex justify-center mb-1">{ROLE_ICONS[role]}</div>
                        <div className="font-semibold">{role}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-ink-soft mt-2">{ROLE_DESCRIPTIONS[inviteRole]}</p>
                </div>
              </div>

              {/* Honest invite result — shown only when the email couldn't be sent */}
              {inviteResult && !inviteResult.emailSent && (
                <div className="mt-5 p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-warning mb-1">
                        The invite email couldn&apos;t be sent (email provider issue).
                      </p>
                      <p className="text-[11px] text-ink-soft mb-2">
                        Share this invite link with {inviteResult.email} manually:
                      </p>
                      <code className="block text-[11px] text-warning bg-black/30 px-2.5 py-2 rounded-lg break-all font-mono">
                        {inviteResult.inviteUrl}
                      </code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(inviteResult.inviteUrl); toast.success("Invite link copied!"); }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-[11px] font-medium hover:bg-warning/30"
                      >
                        <Copy className="w-3 h-3" /> Copy Invite Link
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => { setShowInvite(false); setInviteResult(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-line text-ink-soft text-sm font-medium hover:bg-white/[0.06]"
                >
                  Close
                </button>
                {!inviteResult ? (
                  <button onClick={handleInvite} disabled={!inviteEmail.trim() || !inviteName.trim() || actionLoading === "invite"}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {actionLoading === "invite" ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                    ) : (
                      <><Mail className="w-4 h-4" /> Send Invite</>
                    )}
                  </button>
                ) : (
                  <button onClick={() => { setShowInvite(false); setInviteResult(null); setInviteEmail(""); setInviteName(""); setInviteRole("AGENT"); }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90"
                  >
                    Done
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm mx-4 p-6 rounded-2xl app-card"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-ink mb-2">Remove Team Member?</h3>
              <p className="text-xs text-ink-soft mb-6">They will lose access to this account immediately.</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-line text-ink-soft text-sm font-medium hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
                <button onClick={() => handleRemove(deleteConfirmId)}
                  disabled={actionLoading === `remove-${deleteConfirmId}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-danger text-white text-sm font-medium hover:bg-danger disabled:opacity-50"
                >
                  {actionLoading === `remove-${deleteConfirmId}` ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Removing...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Remove</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
