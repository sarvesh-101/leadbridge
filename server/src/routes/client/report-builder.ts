/**
 * Custom Report Builder Routes.
 * POST /reports/generate  — Generate a custom report
 * POST /reports/export    — Export report as CSV
 * POST /reports/schedule  — Schedule recurring report
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { generateReport, reportToCsv, scheduleReport } from "../../services/report-builder.service";

export default async function reportBuilderRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /**
   * Generate a custom analytics report.
   */
  fastify.post<{
    Body: {
      filters: {
        dateFrom?: string;
        dateTo?: string;
        source?: string[];
        status?: string[];
        location?: string;
        minScore?: number;
        maxScore?: number;
      };
      groupBy: { type: "day" | "week" | "month" | "source" | "status" };
    };
  }>("/reports/generate", async (request: FastifyRequest<{
    Body: {
      filters: Record<string, unknown>;
      groupBy: { type: "day" | "week" | "month" | "source" | "status" };
    };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { filters, groupBy } = request.body;

    const result = await generateReport(clientId, filters || {}, groupBy || { type: "source" });
    return { success: true, report: result };
  });

  /**
   * Export report as CSV.
   */
  fastify.post<{
    Body: {
      filters: Record<string, unknown>;
      groupBy: { type: "day" | "week" | "month" | "source" | "status" };
    };
  }>("/reports/export", async (request: FastifyRequest<{ Body: { filters: Record<string, unknown>; groupBy: { type: "day" | "week" | "month" | "source" | "status" } } }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { filters, groupBy } = request.body;

    const result = await generateReport(clientId, filters || {}, groupBy || { type: "source" });
    const csv = reportToCsv(result);

    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", `attachment; filename="report-${Date.now()}.csv"`);
    return csv;
  });

  /**
   * Schedule a recurring report.
   */
  fastify.post<{
    Body: {
      name: string;
      filters: Record<string, unknown>;
      groupBy: { type: "day" | "week" | "month" | "source" | "status" };
      frequency: "daily" | "weekly" | "monthly";
      recipients: string[];
    };
  }>("/reports/schedule", async (request: FastifyRequest<{ Body: { name: string; filters: Record<string, unknown>; groupBy: { type: string }; frequency: string; recipients: string[] } }>) => {
    const clientId = request.clientId!;
    const { name, filters, groupBy, frequency, recipients } = request.body;

    await scheduleReport(clientId, { name, filters: filters as any, groupBy: groupBy as any, frequency: frequency as "daily" | "weekly" | "monthly", recipients });
    return { success: true, message: `Report scheduled ${frequency}` };
  });
}
