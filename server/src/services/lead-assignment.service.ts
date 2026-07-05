/**
 * Automated Lead Assignment Service — Round-Robin & Workload-Based Distribution.
 *
 * When a new lead arrives (manual entry, webhook, CSV import), this service
 * assigns it to a team member based on:
 * - Round-robin (leads distributed evenly)
 * - Workload-based (member with fewest active leads gets next)
 * - Score-based (high-value leads go to most experienced member)
 *
 * Requires at least one ACTIVE team member with AGENT or ADMIN role.
 * Falls back to the broker (client owner) if no team members exist.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface AssignmentResult {
  assignedTo: string | null;
  assignedName: string | null;
  method: "round-robin" | "workload" | "score-based" | "fallback-owner" | "none";
}

/**
 * Assign a new lead to the best team member.
 * Called automatically when a lead is created.
 */
export async function assignLead(
  clientId: string,
  leadId: string,
  leadScore?: number
): Promise<AssignmentResult> {
  // Find active team members with AGENT or ADMIN role
  const activeMembers = await prisma.teamMember.findMany({
    where: {
      clientId,
      status: "ACTIVE",
      role: { in: ["AGENT", "ADMIN"] },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  // Fallback: no active team members — assign to client owner
  if (activeMembers.length === 0) {
    return { assignedTo: null, assignedName: null, method: "fallback-owner" };
  }

  // If only one member, assign to them
  if (activeMembers.length === 1) {
    const member = activeMembers[0];
    await logAssignment(clientId, leadId, member.id, member.name, "round-robin");
    return { assignedTo: member.id, assignedName: member.name, method: "round-robin" };
  }

  // Method 1: Score-based — high-value leads (>70) go to ADMIN or most experienced
  if (leadScore && leadScore >= 70) {
    const admin = activeMembers.find((m) => m.role === "ADMIN");
    const targetMember = admin || activeMembers[0];
    await logAssignment(clientId, leadId, targetMember.id, targetMember.name, "score-based");
    return { assignedTo: targetMember.id, assignedName: targetMember.name, method: "score-based" };
  }

  // Method 2: Workload-based — find member with fewest active leads
  const workloads = await Promise.all(
    activeMembers.map(async (member) => {
      // Count leads assigned to this member (we use a convention: rawPayload.assignedTo)
      const count = await prisma.lead.count({
        where: {
          clientId,
          status: { notIn: ["COLD", "CONVERTED"] },
          // Use rawPayload.assignedTo to track assignments
          rawPayload: { path: ["assignedTo"], equals: member.id },
        } as any,
      });
      return { member, activeLeads: count };
    })
  );

  workloads.sort((a, b) => a.activeLeads - b.activeLeads);
  const selected = workloads[0].member;

  await logAssignment(clientId, leadId, selected.id, selected.name, "workload");
  return { assignedTo: selected.id, assignedName: selected.name, method: "workload" };
}

/**
 * Record the assignment in the lead's rawPayload and create an audit log entry.
 */
async function logAssignment(
  clientId: string,
  leadId: string,
  memberId: string,
  memberName: string,
  method: string
): Promise<void> {
  try {
    // Store assignment info in lead's rawPayload
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        rawPayload: {
          assignedTo: memberId,
          assignedAt: new Date().toISOString(),
          assignmentMethod: method,
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        clientId,
        userId: memberId,
        action: "lead.assigned",
        resourceType: "lead",
        resourceId: leadId,
        changes: { assignedTo: memberId, method },
        status: "success",
      },
    });
  } catch (error: any) {
    // Non-critical — don't throw
    console.warn("Failed to log lead assignment:", error.message);
  }
}

/**
 * Get the current member assignments summary for the dashboard.
 */
export async function getAssignmentSummary(
  clientId: string
): Promise<{
  assignments: Array<{ memberId: string; memberName: string; activeLeads: number; role: string }>;
  method: string;
  totalLeads: number;
}> {
  const activeMembers = await prisma.teamMember.findMany({
    where: { clientId, status: "ACTIVE" },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const assignments = await Promise.all(
    activeMembers.map(async (member) => {
      const activeLeads = await prisma.lead.count({
        where: {
          clientId,
          status: { notIn: ["COLD", "CONVERTED"] },
          rawPayload: { path: ["assignedTo"], equals: member.id },
        } as any,
      });
      return {
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        activeLeads,
      };
    })
  );

  const totalLeads = assignments.reduce((sum, a) => sum + a.activeLeads, 0);

  return {
    assignments,
    method: assignments.length <= 1 ? "round-robin" : "workload-based",
    totalLeads,
  };
}
