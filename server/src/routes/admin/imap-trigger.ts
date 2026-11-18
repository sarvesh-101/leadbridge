/**
 * Admin IMAP Trigger — manually run the IMAP email pull on demand.
 *
 * Useful for testing email forwarding without waiting for the 5-min cron.
 * Returns the same summary as runImapEmailPull().
 */
import { FastifyInstance } from "fastify";
import { runImapEmailPull } from "../../cron/email-imap.cron";

export default async function adminImapTriggerRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  fastify.post("/admin/imap/pull", async (_request, reply) => {
    try {
      const result = await runImapEmailPull();
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message || "IMAP pull failed" });
    }
  });

  fastify.get("/admin/imap/status", async (_request, reply) => {
    const { config } = await import("../../config");
    return reply.send({
      configured: !!(config.IMAP_HOST && config.IMAP_USER && config.IMAP_PASS),
      host: config.IMAP_HOST || null,
      user: config.IMAP_USER || null,
      port: config.IMAP_PORT,
      folder: config.IMAP_FOLDER,
      tls: config.IMAP_TLS,
    });
  });
}