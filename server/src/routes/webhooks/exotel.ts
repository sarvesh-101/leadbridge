import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { enqueueCall, enqueueExtraction, enqueueNotification, enqueueFollowup } from "../../workers/queues";
import { shouldRetry, getRetryDelay } from "../../utils/retry-delay";

/**
 * Exotel Webhook Handler — receives call lifecycle events.
 * POST /api/v1/webhooks/exotel/call-events
 *
 * Events: initiated, ringing, answered, completed, no-answer, busy, failed
 */
export default async function exotelWebhookRoutes(fastify: FastifyInstance) {
  fastify.post("/webhooks/exotel/call-events", async (request: FastifyRequest, reply: FastifyReply) => {
    const event = request.body as Record<string, string>;

    const exotelCallSid = event.CallSid || event.ExotelCallSid;
    const status = (event.Status || event.CallStatus || "").toLowerCase();
    const fromNumber = event.From || "";
    const toNumber = event.To || "";
    const duration = parseInt(event.Duration || "0");
    const recordingUrl = event.RecordingUrl || null;

    if (!exotelCallSid) {
      return reply.status(200).send({ error: "Missing CallSid" });
    }

    // Find the call record
    const call = await fastify.prisma.call.findFirst({
      where: { exotelCallSid },
      include: { lead: true },
    });

    if (!call) {
      // Unknown call — create a record if we can identify the lead
      fastify.log.warn({ exotelCallSid }, "Unknown Exotel call event");
      return reply.status(200).send({});
    }

    const lead = call.lead;

    switch (status) {
      case "answered":
      case "in-progress": {
        await fastify.prisma.call.update({
          where: { id: call.id },
          data: { status: "ANSWERED" },
        });
        break;
      }

      case "completed": {
        const updateData: Record<string, unknown> = {
          status: "COMPLETED",
        };
        if (duration > 0) updateData.duration = duration;
        if (recordingUrl) updateData.recordingUrl = recordingUrl;

        await fastify.prisma.call.update({
          where: { id: call.id },
          data: updateData,
        });

        // Enqueue extraction if we have a transcript (Pipecat will send it separately)
        // For now, just mark for extraction
        await enqueueExtraction({
          callId: call.id,
          leadId: call.leadId,
          clientId: call.clientId,
          transcript: "", // Pipecat will send transcript via separate endpoint
        });
        break;
      }

      case "no-answer": {
        await fastify.prisma.call.update({
          where: { id: call.id },
          data: { status: "NO_ANSWER" },
        });

        const attempts = (lead.callAttempts || 0);
        const maxAttempts = lead.maxAttempts || 3;

        // Retry or mark final
        if (shouldRetry(attempts, maxAttempts)) {
          const delayMs = getRetryDelay(attempts);
          await enqueueCall({
            leadId: lead.id,
            clientId: call.clientId,
            callType: "QUALIFICATION",
            attempt: (lead.callAttempts || 0) + 1,
          }, delayMs);

          await fastify.prisma.lead.update({
            where: { id: lead.id },
            data: { nextRetryAt: new Date(Date.now() + delayMs) },
          });
        } else {
          // Final no-answer
          await fastify.prisma.lead.update({
            where: { id: lead.id },
            data: { status: "NO_ANSWER" },
          });

          await enqueueNotification({
            recipient: "owner",
            leadId: lead.id,
            clientId: call.clientId,
            type: "NO_ANSWER",
            data: { leadName: lead.name },
          });
        }
        break;
      }

      case "busy":
      case "failed": {
        await fastify.prisma.call.update({
          where: { id: call.id },
          data: { status: status === "busy" ? "BUSY" : "FAILED" },
        });

        const attempts = (lead.callAttempts || 0);
        const maxAttempts = lead.maxAttempts || 3;

        // Same retry logic as no-answer
        if (shouldRetry(attempts, maxAttempts)) {
          const delayMs = getRetryDelay(attempts);
          await enqueueCall({
            leadId: lead.id,
            clientId: call.clientId,
            callType: call.type as "QUALIFICATION" | "BOOKING_REMINDER" | "FOLLOWUP_D1" | "FOLLOWUP_D3",
            attempt: (lead.callAttempts || 0) + 1,
          }, delayMs);
        }
        break;
      }
    }

    return reply.status(200).send({});
  });
}
