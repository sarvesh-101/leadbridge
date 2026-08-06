/**
 * Account Cleanup Service — releases a broker's external resources when their
 * account is cancelled/deactivated.
 *
 * FIX P1-5: Previously, dunning set planStatus=CANCELLED but the broker's
 * Omnidimension phone number stayed attached to a live AI agent — the platform
 * kept paying ₹200/mo per cancelled number and inbound calls still rang the
 * agent (answering = platform cost). This service detaches the number and
 * deletes the agent, best-effort, so churned brokers stop costing money.
 */
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma-shared";

/**
 * Best-effort cleanup of a cancelled broker's external resources:
 *  1. Detach + release their Omnidimension phone number
 *  2. Delete their Omnidimension AI agent
 *  3. Clear the stored IDs on the client record
 *
 * Safe to call on any client (missing IDs are no-ops). Never throws — cleanup
 * failures are logged and must not break the cancellation flow.
 */
export async function cleanupBrokerResources(clientId: string): Promise<{
  numberReleased: boolean;
  agentDeleted: boolean;
}> {
  const result = { numberReleased: false, agentDeleted: false };

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        omniPhoneNumberId: true,
        omnidimensionAgentId: true,
        omniAgentId: true,
        phoneSetupStatus: true,
      },
    });

    if (!client) return result;

    // 1. Release phone number
    if (client.omniPhoneNumberId) {
      try {
        const { detachPhoneNumber } = await import("./omnidimension-phone.service");
        await detachPhoneNumber(client.omniPhoneNumberId);
        result.numberReleased = true;
        logger.info({ clientId, phoneNumberId: client.omniPhoneNumberId }, "Phone number detached on account cleanup");
      } catch (err: any) {
        logger.warn({ clientId, err: err.message }, "Failed to detach phone number during cleanup");
      }
    }

    // 2. Delete AI agent (try both ID formats)
    const agentId = client.omnidimensionAgentId ?? (client.omniAgentId ? Number(client.omniAgentId) : null);
    if (agentId) {
      try {
        const { deleteAgent } = await import("./omnidimension-agents.service");
        await deleteAgent(agentId);
        result.agentDeleted = true;
        logger.info({ clientId, agentId }, "AI agent deleted on account cleanup");
      } catch (err: any) {
        logger.warn({ clientId, err: err.message }, "Failed to delete agent during cleanup");
      }
    }

    // 3. Clear stored IDs + reset phone setup status (only if not already done)
    if (client.omniPhoneNumberId || client.omnidimensionAgentId || client.omniAgentId) {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          omniPhoneNumberId: null,
          omniPhoneNumber: null,
          omnidimensionAgentId: null,
          omniAgentId: null,
          phoneSetupStatus: "PENDING",
        },
      });
    }
  } catch (err: any) {
    logger.error({ clientId, err: err.message }, "Account cleanup failed");
  }

  return result;
}

