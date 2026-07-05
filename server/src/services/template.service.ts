/**
 * Template Service — CRUD for reusable campaign templates.
 * Stores templates as JSON in the EmailCampaign table (type = "TEMPLATE").
 */
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

export async function listTemplates(clientId: string) {
  const campaigns = await prisma.emailCampaign.findMany({
    where: { clientId, status: "TEMPLATE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, subject: true, body: true, createdAt: true },
  });
  return campaigns;
}

export async function saveTemplate(clientId: string, data: { name: string; subject: string; body: string; type?: "email" | "sms" }) {
  const campaign = await prisma.emailCampaign.create({
    data: { clientId, name: data.name, subject: data.subject, body: data.body, type: "TEMPLATE", status: "TEMPLATE", totalRecipients: 0 },
  });
  return campaign;
}

export async function getTemplate(templateId: string, clientId: string) {
  return prisma.emailCampaign.findFirst({ where: { id: templateId, clientId, status: "TEMPLATE" } });
}

export async function updateTemplate(templateId: string, clientId: string, data: { name?: string; subject?: string; body?: string }) {
  return prisma.emailCampaign.update({ where: { id: templateId }, data });
}

export async function deleteTemplate(templateId: string, clientId: string) {
  await prisma.emailCampaign.delete({ where: { id: templateId } });
}
