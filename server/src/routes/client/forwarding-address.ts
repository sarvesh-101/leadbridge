/**
 * This broker's own email-forwarding address.
 *
 * Gmail/portal auto-forward rules keep the ORIGINAL `From` header (the portal's
 * address), so a shared mailbox + sender matching only ever works for manual
 * forwards. Everyone gets a unique `leads+<token>@<domain>` address instead:
 * one forward rule per broker, and inbound mail is routed by recipient.
 */
import { FastifyInstance, FastifyRequest } from "fastify";
import { config } from "../../config";
import { buildInboundAddress, ensureInboundToken, forwardingDomain } from "../../utils/inbound-address";

export default async function clientForwardingAddressRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Get (and lazily allocate) this broker's forwarding address ───
  fastify.get("/forwarding/address", async (request: FastifyRequest) => {
    const token = await ensureInboundToken(fastify.prisma, request.clientId!);
    const address = buildInboundAddress(token);

    return {
      address,
      token,
      domain: forwardingDomain(),
      // Kept for brokers still forwarding by hand to the shared mailbox.
      platformEmail: config.FORWARDING_EMAIL || null,
      matching: "recipient_first_then_sender",
      instructions: [
        `Create a forwarding rule in your mailbox: every portal enquiry email → ${address}`,
        "Leave the subject and body untouched — the lead details are parsed from the original text.",
        "Manual forwarding works too: open the enquiry email, Forward, and send it as-is.",
      ],
    };
  });
}
