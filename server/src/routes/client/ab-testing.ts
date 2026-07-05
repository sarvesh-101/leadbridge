/**
 * A/B Testing Routes.
 * POST   /ab-tests/create    — Create a new A/B test
 * GET    /ab-tests/:id       — Get test results
 * GET    /ab-tests           — List tests
 * PATCH  /ab-tests/:id/status — Update test status
 * POST   /ab-tests/:id/record — Record a test result (internal)
 */

import { FastifyInstance, FastifyRequest } from "fastify";
import {
  createABTest,
  getABTestResults,
  listABTests,
  updateABTestStatus,
  recordABTestResult,
} from "../../services/ab-testing.service";

export default async function abTestingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /**
   * Create a new A/B test.
   */
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      campaignId: string;
      variants: Array<{ name: string; config: Record<string, unknown>; trafficPercent: number }>;
      goalMetric: "conversion_rate" | "call_answer_rate" | "booking_rate" | "response_rate";
      minSampleSize: number;
    };
  }>("/ab-tests", async (request: FastifyRequest<{
    Body: { name: string; description?: string; campaignId: string; variants: Array<{ name: string; config: Record<string, unknown>; trafficPercent: number }>; goalMetric: "conversion_rate" | "call_answer_rate" | "booking_rate" | "response_rate"; minSampleSize: number };
  }>) => {
    const clientId = request.clientId!;
    const { name, description, campaignId, variants, goalMetric, minSampleSize } = request.body;

    const testId = await createABTest(clientId, {
      name,
      description,
      campaignId,
      variants,
      goalMetric,
      minSampleSize,
    });
    return { success: true, testId };
  });

  /**
   * Get A/B test results.
   */
  fastify.get<{ Params: { id: string } }>("/ab-tests/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = request.params;
    const results = await getABTestResults(id);
    return { success: true, ...results };
  });

  /**
   * List all A/B tests for the client.
   */
  fastify.get("/ab-tests", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const tests = await listABTests(clientId);
    return { success: true, tests };
  });

  /**
   * Update A/B test status.
   */
  fastify.patch<{
    Params: { id: string };
    Body: { status: "RUNNING" | "PAUSED" | "COMPLETED" };
  }>("/ab-tests/:id/status", async (request: FastifyRequest<{ Params: { id: string }; Body: { status: "RUNNING" | "PAUSED" | "COMPLETED" } }>) => {
    const { id } = request.params;
    const { status } = request.body;
    await updateABTestStatus(id, status);
    return { success: true, status };
  });

  /**
   * Record an A/B test result (internal use by campaign engine).
   */
  fastify.post<{
    Params: { id: string };
    Body: { leadId: string; variantName: string; converted: boolean; metadata?: Record<string, unknown> };
  }>("/ab-tests/:id/record", async (request: FastifyRequest<{ Params: { id: string }; Body: { leadId: string; variantName: string; converted: boolean; metadata?: Record<string, unknown> } }>) => {
    const { id } = request.params;
    const { leadId, variantName, converted, metadata } = request.body;
    await recordABTestResult(id, leadId, variantName, converted, metadata);
    return { success: true };
  });
}
