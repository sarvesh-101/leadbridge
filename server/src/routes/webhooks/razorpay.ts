import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyWebhookSignature } from "../../services/razorpay.service";

/**
 * Razorpay Webhook Handler — receives payment lifecycle events.
 * POST /api/v1/webhooks/razorpay
 *
 * Events: subscription.charged, subscription.cancelled, payment.failed, etc.
 * All requests are HMAC-SHA256 verified.
 */
export default async function razorpayWebhookRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: Record<string, unknown> }>("/webhooks/razorpay", async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers["x-razorpay-signature"] as string;
    const payload = JSON.stringify(request.body);

    // Verify signature
    if (!verifyWebhookSignature(payload, signature)) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const event = request.body as Record<string, any>;
    const eventType = event.event as string;

    fastify.log.info({ eventType }, "Razorpay webhook received");

    switch (eventType) {
      case "subscription.charged": {
        const payloadData = event.payload as Record<string, any> | undefined;
        const subscription = payloadData?.subscription?.entity as Record<string, unknown> | undefined;
        const razorpaySubId = subscription?.id as string | undefined;

        if (razorpaySubId) {
          await fastify.prisma.client.updateMany({
            where: { razorpaySubId },
            data: { planStatus: "ACTIVE" },
          });
          fastify.log.info({ razorpaySubId }, "Subscription charged — client activated");
        }
        break;
      }

      case "subscription.cancelled": {
        const payloadData = event.payload as Record<string, any> | undefined;
        const subscription = payloadData?.subscription?.entity as Record<string, unknown> | undefined;
        const razorpaySubId = subscription?.id as string | undefined;

        if (razorpaySubId) {
          await fastify.prisma.client.updateMany({
            where: { razorpaySubId },
            data: { planStatus: "CANCELLED" },
          });
          fastify.log.info({ razorpaySubId }, "Subscription cancelled");
        }
        break;
      }

      case "subscription.pending": {
        const payloadData = event.payload as Record<string, any> | undefined;
        const subscription = payloadData?.subscription?.entity as Record<string, unknown> | undefined;
        const razorpaySubId = subscription?.id as string | undefined;

        if (razorpaySubId) {
          await fastify.prisma.client.updateMany({
            where: { razorpaySubId },
            data: { planStatus: "PAST_DUE" },
          });
        }
        break;
      }

      case "payment.failed": {
        const payloadData = event.payload as Record<string, any> | undefined;
        const payment = payloadData?.payment?.entity as Record<string, unknown> | undefined;
        const orderId = payment?.order_id as string | undefined;
        fastify.log.warn({ orderId, error: payment?.error_description }, "Payment failed");
        break;
      }

      case "invoice.paid": {
        const payloadData = event.payload as Record<string, any> | undefined;
        const invoice = payloadData?.invoice?.entity as Record<string, unknown> | undefined;
        fastify.log.info({ invoiceId: invoice?.id }, "Invoice paid successfully");
        break;
      }
    }

    return reply.status(200).send({ status: "received" });
  });
}
