/**
 * A/B Testing Service.
 *
 * Allows brokers to test different campaign variants (scripts, channels, timing)
 * and measure which performs better.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ABTestConfig {
  name: string;
  description?: string;
  campaignId: string;
  variants: Array<{
    name: string;
    config: Record<string, unknown>;
    trafficPercent: number;
  }>;
  goalMetric: "conversion_rate" | "call_answer_rate" | "booking_rate" | "response_rate";
  minSampleSize: number;
}

/**
 * Create an A/B test with multiple variants.
 */
export async function createABTest(
  clientId: string,
  config: ABTestConfig
): Promise<string> {
  const totalTraffic = config.variants.reduce((s, v) => s + v.trafficPercent, 0);
  if (Math.round(totalTraffic) !== 100) {
    throw new Error("Variant traffic percentages must sum to 100");
  }    const test = await prisma.aBTest.create({
      data: {
        clientId,
        name: config.name,
        description: config.description,
        campaignId: config.campaignId,
        goalMetric: config.goalMetric,
        minSampleSize: config.minSampleSize,
        status: "RUNNING",
        variants: config.variants as unknown as any,
      },
    });

    return test.id;
}

/**
 * Get results for an A/B test.
 */
export async function getABTestResults(testId: string) {
  const test = await prisma.aBTest.findUnique({
    where: { id: testId },
    include: { results: { orderBy: { createdAt: "asc" } } },
  });

  if (!test) throw new Error("A/B test not found");

  const variants = test.variants as Array<{
    name: string;
    config: Record<string, unknown>;
    trafficPercent: number;
  }>;

  // Aggregate results by variant
  const variantResults = variants.map((v) => {
    const variantResults = test.results.filter((r) => r.variantName === v.name);
    const totalExposed = variantResults.length;
    const conversions = variantResults.filter((r) => r.converted).length;
    const rate = totalExposed > 0 ? (conversions / totalExposed) * 100 : 0;

    return {
      variantName: v.name,
      trafficPercent: v.trafficPercent,
      totalExposed,
      conversions,
      conversionRate: Math.round(rate * 100) / 100,
      config: v.config,
    };
  });

  // Determine winner
  const sorted = [...variantResults].sort(
    (a, b) => b.conversionRate - a.conversionRate
  );
  const winner = sorted.length > 1 && sorted[0].conversionRate > sorted[1].conversionRate
    ? sorted[0].variantName
    : null;

  const isSignificant =
    test.results.filter((r) => r.converted).length >= test.minSampleSize;

  return {
    testId: test.id,
    name: test.name,
    status: test.status,
    goalMetric: test.goalMetric,
    isSignificant,
    winner,
    variants: variantResults,
    totalResults: test.results.length,
  };
}

/**
 * Record a result for an A/B test variant.
 */
export async function recordABTestResult(
  testId: string,
  leadId: string,
  variantName: string,
  converted: boolean,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.aBTestResult.create({
    data: {
      testId,
      leadId,
      variantName,
      converted,
      metadata: (metadata || {}) as any,
    },
  });
}

/**
 * List A/B tests for a client.
 */
export async function listABTests(clientId: string) {
  const tests = await prisma.aBTest.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { results: true } } },
  });

  return tests.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    goalMetric: t.goalMetric,
    totalResults: t._count.results,
    createdAt: t.createdAt,
  }));
}

/**
 * Update A/B test status.
 */
export async function updateABTestStatus(
  testId: string,
  status: "RUNNING" | "PAUSED" | "COMPLETED"
): Promise<void> {
  await prisma.aBTest.update({
    where: { id: testId },
    data: { status },
  });
}
