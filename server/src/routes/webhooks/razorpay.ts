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
  fastify.post<{ Body: Record<string, unknown> }>("/webhooks/razorpay", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
          // Activate the client
          await fastify.prisma.client.updateMany({
            where: { razorpaySubId },
            data: { planStatus: "ACTIVE" },
          });

          // FIX #8 (P2): Track trial → paid conversion only on FIRST payment
          // We set convertedFromTrialAt only if it's null (never been paid before)
          const newPayers = await fastify.prisma.client.findMany({
            where: { razorpaySubId, convertedFromTrialAt: null },
            select: { id: true, trialStartedAt: true },
          });
          for (const c of newPayers) {
            await fastify.prisma.client.update({
              where: { id: c.id },
              data: { convertedFromTrialAt: new Date() },
            });
          }

          // Mark the client's latest SENT invoice as PAID
          const clients = await fastify.prisma.client.findMany({
            where: { razorpaySubId },
            select: { id: true },
          });
          for (const c of clients) {
            const latestInvoice = await fastify.prisma.invoice.findFirst({
              where: { clientId: c.id, status: "SENT" },
              orderBy: { issueDate: "desc" },
            });
            if (latestInvoice) {
              await fastify.prisma.invoice.update({
                where: { id: latestInvoice.id },
                data: { status: "PAID", paidAt: new Date() },
              });
              fastify.log.info({ invoiceId: latestInvoice.id, razorpaySubId }, "Invoice marked PAID on subscription.charged");

              // FIX #2: Auto-generate GST invoice PDF
              try {
                const { generateGstInvoiceForInvoice } = await import("../../services/invoice.service");
                generateGstInvoiceForInvoice(fastify.prisma, latestInvoice.id).catch((err: any) =>
                  fastify.log.warn({ err: err.message, invoiceId: latestInvoice.id }, "GST invoice generation deferred")
                );
              } catch (err: any) {
                fastify.log.warn({ err: err.message }, "GST invoice service not available");
              }
            }
          }

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
        const razorpayInvoice = payloadData?.invoice?.entity as Record<string, unknown> | undefined;
        const invoiceId = razorpayInvoice?.id as string | undefined;
        const subId = (razorpayInvoice?.subscription_id as string) || (razorpayInvoice?.subscriptionId as string) || undefined;
        fastify.log.info({ invoiceId, subId }, "Invoice paid via Razorpay");

        // Try to match by subscription ID (more reliable than providerInvoiceId)
        if (subId) {
          const clients = await fastify.prisma.client.findMany({
            where: { razorpaySubId: subId },
            select: { id: true },
          });
          for (const c of clients) {
            const latestInvoice = await fastify.prisma.invoice.findFirst({
              where: { clientId: c.id, status: "SENT" },
              orderBy: { issueDate: "desc" },
            });
            if (latestInvoice) {
              await fastify.prisma.invoice.update({
                where: { id: latestInvoice.id },
                data: { status: "PAID", paidAt: new Date() },
              });
              fastify.log.info({ invoiceId: latestInvoice.id, subId }, "Invoice marked PAID via invoice.paid webhook");
            }
          }
        }
        break;
      }
    }

    return reply.status(200).send({ status: "received" });
  });
}
