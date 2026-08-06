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

        // Payment entity — used to create a Payment record + track revenue
        // (amount comes in paise from Razorpay)
        const payment = payloadData?.payment?.entity as Record<string, any> | undefined;
        const paymentId = payment?.id as string | undefined;
        const amountInr = ((payment?.amount as number) || 0) / 100;
        const paymentMethod = (payment?.method as string) || "razorpay";
        // When the charge actually happened — used to compute which billing cycle
        // a renewal charge belongs to (falls back to now if payload omits it).
        const chargeDate = payment?.created_at
          ? new Date((payment.created_at as number) * 1000)
          : new Date();

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

          // Mark the client's latest SENT invoice as PAID. Month-2+ charges have
          // no SENT invoice left (month 1 was already paid) — FIX #9 generates a
          // fresh invoice for the current billing cycle so brokers always have a
          // per-month invoice instead of just a silent payment+revenue record.
          const clients = await fastify.prisma.client.findMany({
            where: { razorpaySubId },
            select: { id: true },
          });
          for (const c of clients) {
            const latestInvoice = await fastify.prisma.invoice.findFirst({
              where: { clientId: c.id, status: "SENT" },
              orderBy: { issueDate: "desc" },
            });

            // FIX #9: no SENT invoice → this is a renewal charge; create one for
            // the billing cycle this payment belongs to (idempotent — redelivered
            // webhooks or a paired invoice.paid event never duplicate invoices).
            let invoiceToPay = latestInvoice;
            if (!invoiceToPay) {
              const subscription = await fastify.prisma.subscription.findFirst({
                where: { clientId: c.id, providerSubscriptionId: razorpaySubId },
                orderBy: { createdAt: "desc" },
              });
              if (subscription) {
                invoiceToPay = await ensureInvoiceForCycle(fastify, c.id, subscription, chargeDate, amountInr);
              }
            }

            if (invoiceToPay) {
              await fastify.prisma.invoice.update({
                where: { id: invoiceToPay.id },
                data: { status: "PAID", paidAt: new Date() },
              });
              fastify.log.info({ invoiceId: invoiceToPay.id, razorpaySubId }, "Invoice marked PAID on subscription.charged");

              // FIX #2: Auto-generate GST invoice PDF
              try {
                const { generateGstInvoiceForInvoice } = await import("../../services/invoice.service");
                generateGstInvoiceForInvoice(fastify.prisma, invoiceToPay.id).catch((err: any) =>
                  fastify.log.warn({ err: err.message, invoiceId: invoiceToPay.id }, "GST invoice generation deferred")
                );
              } catch (err: any) {
                fastify.log.warn({ err: err.message }, "GST invoice service not available");
              }
            }

            // FIX: Record the Payment + revenue — this was missing entirely, so
            // the cancel/refund flow could never find a providerPaymentId and
            // profitability never saw subscription revenue. Recorded on EVERY
            // charged event (not only when a SENT invoice exists) so recurring
            // monthly charges from month 2+ are also tracked. The providerPaymentId
            // idempotency guard in the helper prevents double-counting when the
            // same charge is redelivered or also arrives as invoice.paid.
            await recordPaymentAndRevenue(fastify, c.id, {
              invoiceId: invoiceToPay?.id || null,
              amountInr,
              paymentId,
              paymentMethod,
            });          // FIX Round-2 #5: Razorpay renews every 30 days from signup, but the
          // calendar cron resets on the 1st. Each subscription.charged IS a new
          // billing cycle — reset the broker's call allowance here so usage
          // aligns with billing.
          //
          // Idempotency: resetBrokerCycle itself guards via lastCycleResetAt
          // (skips if already reset < 20 days ago), so a redelivered webhook or
          // the calendar cron can never double-reset/double-roll.
          //
          // First charge (trial→paid conversion): the client just entered a paid
          // cycle with a fresh allowance and their trial usage is tiny — skip the
          // reset so we don't roll unused trial allowance into rollover (avoids
          // the reviewer-flagged double-allowance).
          const firstChargeIds = new Set(newPayers.map((p) => p.id));
          if (!firstChargeIds.has(c.id)) {
            try {
              const { resetBrokerCycle } = await import("../../services/credit-manager.service");
              await resetBrokerCycle(fastify.prisma, c.id);
              fastify.log.info({ clientId: c.id, razorpaySubId }, "Broker call cycle reset on subscription.charged");
            } catch (err: any) {
              fastify.log.warn({ clientId: c.id, err: err.message }, "Cycle reset failed on subscription.charged");
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

        // Payment entity may be present on invoice.paid
        const payment = payloadData?.payment?.entity as Record<string, any> | undefined;
        const paymentId = payment?.id as string | undefined;
        const amountInr = ((payment?.amount as number) || (razorpayInvoice?.amount_paid as number) || 0) / 100;
        const paymentMethod = (payment?.method as string) || "razorpay";
        const chargeDate = payment?.created_at
          ? new Date((payment.created_at as number) * 1000)
          : razorpayInvoice?.created_at
            ? new Date((razorpayInvoice.created_at as number) * 1000)
            : new Date();

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

            // FIX #9: same as subscription.charged — ensure a per-cycle invoice
            // exists for renewal charges (idempotent, never duplicates).
            let invoiceToPay = latestInvoice;
            if (!invoiceToPay) {
              const subscription = await fastify.prisma.subscription.findFirst({
                where: { clientId: c.id, providerSubscriptionId: subId },
                orderBy: { createdAt: "desc" },
              });
              if (subscription) {
                invoiceToPay = await ensureInvoiceForCycle(fastify, c.id, subscription, chargeDate, amountInr);
              }
            }

            if (invoiceToPay) {
              await fastify.prisma.invoice.update({
                where: { id: invoiceToPay.id },
                data: { status: "PAID", paidAt: new Date() },
              });
              fastify.log.info({ invoiceId: invoiceToPay.id, subId }, "Invoice marked PAID via invoice.paid webhook");

              // Only record here when the payment entity is present — the
              // providerPaymentId idempotency guard then prevents double-counting
              // against the subscription.charged event for the same charge.
              if (paymentId) {
                await recordPaymentAndRevenue(fastify, c.id, {
                  invoiceId: invoiceToPay.id,
                  amountInr,
                  paymentId,
                  paymentMethod,
                });
              }
            }
          }
        }
        break;
      }
    }

    return reply.status(200).send({ status: "received" });
  });
}

/**
 * FIX #9: Ensure an invoice exists for the billing cycle a charge belongs to.
 *
 * Month-1 invoices are created at checkout (SENT) and marked PAID by the
 * webhook. Month-2+ recurring charges find no SENT invoice, so we generate a
 * fresh invoice for the current billing cycle here — otherwise brokers would
 * never see a per-month invoice for renewals (only silent payment+revenue rows).
 *
 * The cycle is derived from the subscription start date + how many full months
 * have elapsed at charge time. Idempotent on (subscription, cycle window) —
 * redelivered webhooks or both subscription.charged + invoice.paid firing for
 * the same charge can never create duplicate invoices.
 */
export async function ensureInvoiceForCycle(
  fastify: FastifyInstance,
  clientId: string,
  subscription: { id: string; planName: string; startDate: Date },
  chargeDate: Date,
  amountInr: number
) {
  if (amountInr <= 0) {
    fastify.log.warn({ clientId, subscriptionId: subscription.id }, "Charge amount missing — skipping renewal invoice");
    return null;
  }

  const start = new Date(subscription.startDate);
  const monthsElapsed = Math.max(
    0,
    (chargeDate.getFullYear() - start.getFullYear()) * 12 +
      (chargeDate.getMonth() - start.getMonth())
  );
  const cycleStart = new Date(start);
  cycleStart.setMonth(cycleStart.getMonth() + monthsElapsed);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);

  // Idempotency: reuse an invoice already covering this cycle.
  const existing = await findInvoiceForCycle(fastify, clientId, subscription.id, cycleStart, cycleEnd);
  if (existing) {
    fastify.log.info({ invoiceId: existing.id, clientId, monthsElapsed }, "Invoice already exists for cycle — reusing");
    return existing;
  }

  const invoice = await createInvoiceForCycle(fastify, clientId, subscription, chargeDate, amountInr, monthsElapsed, cycleStart, cycleEnd);
  return invoice;
}

/** Find an invoice covering a billing cycle window (used for idempotency). */
async function findInvoiceForCycle(
  fastify: FastifyInstance,
  clientId: string,
  subscriptionId: string,
  cycleStart: Date,
  cycleEnd: Date
) {
  return fastify.prisma.invoice.findFirst({
    where: {
      clientId,
      subscriptionId,
      periodStart: { gte: cycleStart, lt: cycleEnd },
    },
  });
}

/**
 * Create the cycle invoice, recovering gracefully if a concurrent webhook
 * (subscription.charged + invoice.paid for the same charge) already created
 * it between our findFirst guard and this create — the DB unique index
 * (20260805000000_invoice_cycle_unique) makes that a unique violation instead
 * of a duplicate row, so we treat it as "already exists" and reuse it.
 */
async function createInvoiceForCycle(
  fastify: FastifyInstance,
  clientId: string,
  subscription: { id: string; planName: string },
  chargeDate: Date,
  amountInr: number,
  monthsElapsed: number,
  cycleStart: Date,
  cycleEnd: Date
) {
  try {
    const invoice = await fastify.prisma.invoice.create({
      data: {
        clientId,
        subscriptionId: subscription.id,
        invoiceNumber: `INV-${Date.now()}-${clientId.slice(-4)}`,
        status: "SENT",
        description: `${subscription.planName} (Monthly) — Renewal cycle ${monthsElapsed + 1}`,
        amount: amountInr,
        totalAmount: amountInr,
        issueDate: chargeDate,
        dueDate: cycleEnd,
        periodStart: cycleStart,
        periodEnd: cycleEnd,
      },
    });
    fastify.log.info({ invoiceId: invoice.id, clientId, monthsElapsed }, "Renewal invoice generated for month-2+ charge");
    return invoice;
  } catch (err: any) {
    // Only a unique-violation (P2002) from the DB index is the benign
    // concurrent-duplicate race; anything else must surface as a real error.
    if (err?.code !== "P2002") {
      throw err;
    }
    // A sibling webhook won the race and created this cycle's invoice after
    // our findFirst. Reuse it instead of 500ing the webhook.
    const raced = await findInvoiceForCycle(fastify, clientId, subscription.id, cycleStart, cycleEnd);
    if (raced) {
      fastify.log.info({ invoiceId: raced.id, clientId, monthsElapsed }, "Invoice already created by concurrent webhook — reusing");
      return raced;
    }
    throw err;
  }
}

/**
 * Create a Payment record + increment the client's revenue for a successful
 * charge. Idempotent on providerPaymentId — a redelivered webhook can never
 * double-count revenue or create duplicate Payment rows.
 */
export async function recordPaymentAndRevenue(
  fastify: FastifyInstance,
  clientId: string,
  params: { invoiceId?: string | null; amountInr: number; paymentId?: string; paymentMethod?: string }
) {
  if (params.amountInr <= 0) {
    fastify.log.warn({ clientId, paymentId: params.paymentId }, "Payment amount missing — skipping Payment record");
    return;
  }

  if (params.paymentId) {
    const existing = await fastify.prisma.payment.findFirst({
      where: { providerPaymentId: params.paymentId },
      select: { id: true },
    });
    if (existing) {
      fastify.log.info({ paymentId: params.paymentId }, "Duplicate payment event — revenue already recorded");
      return;
    }
  }

  await fastify.prisma.payment.create({
    data: {
      clientId,
      invoiceId: params.invoiceId || null,
      amount: params.amountInr,
      currency: "INR",
      status: "SUCCESSFUL",
      paymentMethod: params.paymentMethod || "razorpay",
      provider: "razorpay",
      providerPaymentId: params.paymentId || null,
    },
  });

  await fastify.prisma.client.update({
    where: { id: clientId },
    data: { totalRevenueGenerated: { increment: params.amountInr } },
  });

  fastify.log.info(
    { clientId, amountInr: params.amountInr, paymentId: params.paymentId },
    "Payment recorded + revenue incremented"
  );
}
