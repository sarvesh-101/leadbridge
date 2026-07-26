/**
 * Invoice Service — GST invoice generation, PDF creation, and email delivery.
 *
 * FIX #2: Generates proper GST-compliant invoices with 18% GST breakdown:
 *   - taxableAmount = totalAmount / (1 + gstPercentage/100)
 *   - gstAmount = totalAmount - taxableAmount
 *   - PDF via pdfkit
 *   - Email via Nodemailer with PDF attachment
 */

import PDFDocument from "pdfkit";
import { PrismaClient, InvoiceStatus } from "@prisma/client";
import { sendEmail } from "./email.service";
import { config } from "../config";
import { logger } from "../utils/logger";
import path from "path";
import fs from "fs";

const GST_RATE = 0.18; // 18% GST

interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  clientName: string;
  clientBusinessName: string;
  clientEmail: string;
  clientPhone: string;
  clientGstNumber?: string;
  clientAddress?: string;
  description: string;
  taxableAmount: number;
  gstAmount: number;
  gstPercentage: number;
  totalAmount: number;
  status: InvoiceStatus;
  periodStart?: Date;
  periodEnd?: Date;
}

/**
 * Generate a PDF invoice with GST breakdown.
 * Returns the file path of the generated PDF.
 */
export async function generateInvoicePdf(invoice: InvoiceData): Promise<string> {
  const invoicesDir = path.join(process.cwd(), "invoices");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const fileName = `invoice-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  const filePath = path.join(invoicesDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: config.FROM_NAME,
        Subject: `GST Invoice - ${invoice.invoiceNumber}`,
      },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Brand colors
    const PRIMARY = "#4F6EF7";
    const DARK = "#1A1A24";
    const GRAY = "#6B6B8A";
    const LIGHT = "#F0F0F8";

    // ─── Header ───────────────────────────────────────────
    doc.fontSize(28).font("Helvetica-Bold").fillColor(PRIMARY)
      .text("INVOICE", 50, 50);

    doc.fontSize(10).font("Helvetica").fillColor(GRAY)
      .text(config.FROM_NAME || "LeadBridge", 50, 85)
      .text(`GSTIN: 29ABCDE1234F1Z5`, 50, 100) // Placeholder GST
      .text("Bengaluru, Karnataka", 50, 115)
      .text(`www.leadbridge.com`, 50, 130);

    // Invoice number & date — right aligned
    const rightX = 400;
    doc.fontSize(12).font("Helvetica-Bold").fillColor(DARK)
      .text(`#${invoice.invoiceNumber}`, rightX, 50);

    doc.fontSize(9).font("Helvetica").fillColor(GRAY)
      .text(`Issue Date: ${invoice.issueDate.toLocaleDateString("en-IN")}`, rightX, 70)
      .text(`Due Date: ${invoice.dueDate.toLocaleDateString("en-IN")}`, rightX, 85);

    if (invoice.periodStart && invoice.periodEnd) {
      doc.text(
        `Period: ${invoice.periodStart.toLocaleDateString("en-IN")} - ${invoice.periodEnd.toLocaleDateString("en-IN")}`,
        rightX, 100
      );
    }

    // Divider
    doc.moveTo(50, 155).lineTo(545, 155).strokeColor("#E0E0E0").stroke();

    // ─── Bill To ──────────────────────────────────────────
    const billY = 175;
    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK)
      .text("Bill To:", 50, billY);

    doc.fontSize(9).font("Helvetica").fillColor(GRAY)
      .text(invoice.clientBusinessName || invoice.clientName, 50, billY + 18)
      .text(invoice.clientName, 50, billY + 33)
      .text(invoice.clientEmail, 50, billY + 48)
      .text(`Phone: ${invoice.clientPhone}`, 50, billY + 63);

    if (invoice.clientGstNumber) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK)
        .text(`GSTIN: ${invoice.clientGstNumber}`, 50, billY + 78);
    }

    if (invoice.clientAddress) {
      doc.text(invoice.clientAddress, 50, billY + 93);
    }

    // ─── Line Items Table ────────────────────────────────
    const tableY = 320;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#FFFFFF")
      .rect(50, tableY, 495, 22).fill(PRIMARY);

    doc.fillColor("#FFFFFF")
      .text("Description", 60, tableY + 6)
      .text("Amount", 420, tableY + 6, { width: 100, align: "right" });

    doc.fontSize(9).font("Helvetica").fillColor(DARK);
    const descY = tableY + 35;
    doc.text(invoice.description, 60, descY, { width: 340 });
    doc.text(`₹${invoice.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 420, descY, { width: 100, align: "right" });

    // Subtotal line
    const subY = descY + 30;
    doc.moveTo(250, subY).lineTo(545, subY).strokeColor("#E0E0E0").stroke();

    doc.fontSize(9).font("Helvetica").fillColor(GRAY)
      .text("Taxable Amount", 350, subY + 8);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK)
      .text(`₹${invoice.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 420, subY + 8, { width: 100, align: "right" });

    const gstY = subY + 25;
    doc.fontSize(9).font("Helvetica").fillColor(GRAY)
      .text(`GST @ ${(invoice.gstPercentage || 18)}%`, 350, gstY);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK)
      .text(`₹${invoice.gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 420, gstY, { width: 100, align: "right" });

    // Total line
    const totalY = gstY + 30;
    doc.moveTo(250, totalY - 5).lineTo(545, totalY - 5).strokeColor(PRIMARY).stroke();

    doc.fontSize(12).font("Helvetica-Bold").fillColor(PRIMARY)
      .text("Total (incl. GST)", 300, totalY + 2);
    doc.fontSize(14).font("Helvetica-Bold").fillColor(PRIMARY)
      .text(`₹${invoice.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 420, totalY, { width: 100, align: "right" });

    // ─── GST Breakup ──────────────────────────────────────
    const gstBreakY = totalY + 50;
    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK)
      .text("GST Breakup", 50, gstBreakY);

    const gstHalf = invoice.gstAmount / 2;
    doc.fontSize(9).font("Helvetica").fillColor(GRAY);

    doc.text("Central GST (CGST) @ 9%:", 50, gstBreakY + 20);
    doc.text(`₹${gstHalf.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 545, gstBreakY + 20, { align: "right" });

    doc.text("State GST (SGST) @ 9%:", 50, gstBreakY + 37);
    doc.text(`₹${gstHalf.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 545, gstBreakY + 37, { align: "right" });

    // ─── Footer ───────────────────────────────────────────
    const footerY = 680;
    doc.fontSize(8).font("Helvetica").fillColor(GRAY)
      .text("Thank you for your business!", 50, footerY, { align: "center" })
      .text(
        "This is a computer-generated invoice. No signature is required.",
        50, footerY + 14,
        { align: "center" }
      )
      .text(
        `For any questions, contact ${config.FROM_EMAIL}`,
        50, footerY + 28,
        { align: "center" }
      );

    doc.end();

    stream.on("finish", () => {
      logger.info({ invoiceNumber: invoice.invoiceNumber, filePath }, "Invoice PDF generated");
      resolve(filePath);
    });

    stream.on("error", (err) => {
      logger.error({ err: err.message, invoiceNumber: invoice.invoiceNumber }, "Invoice PDF generation failed");
      reject(err);
    });
  });
}

/**
 * Calculate GST amounts from total amount.
 * totalAmount = taxableAmount + gstAmount
 * gstAmount = taxableAmount * gstRate
 * taxableAmount = totalAmount / (1 + gstRate)
 */
export function calculateGst(totalAmount: number, gstRate: number = GST_RATE): {
  taxableAmount: number;
  gstAmount: number;
} {
  const taxableAmount = Math.round((totalAmount / (1 + gstRate)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - taxableAmount) * 100) / 100;
  return { taxableAmount, gstAmount };
}

/**
 * Generate and email a GST invoice as PDF to the client.
 * Returns the invoice PDF URL on success.
 */
export async function generateAndSendGstInvoice(params: {
  prisma: PrismaClient;
  invoiceId: string;
}): Promise<string | null> {
  const { prisma } = params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      client: {
        select: {
          businessName: true,
          ownerName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!invoice) {
    logger.error({ invoiceId: params.invoiceId }, "Invoice not found for PDF generation");
    return null;
  }

  // Calculate GST if not already set
  const gstRate = invoice.gstPercentage / 100;
  const { taxableAmount, gstAmount } = invoice.taxableAmount > 0
    ? { taxableAmount: invoice.taxableAmount, gstAmount: invoice.gstAmount }
    : calculateGst(invoice.totalAmount, gstRate);

  const invoiceData: InvoiceData = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    clientName: invoice.client.ownerName,
    clientBusinessName: invoice.client.businessName,
    clientEmail: invoice.client.email,
    clientPhone: invoice.client.phone,
    clientGstNumber: invoice.gstNumber || undefined,
    description: invoice.description || `Subscription payment`,
    taxableAmount,
    gstAmount,
    gstPercentage: invoice.gstPercentage,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
    periodStart: invoice.periodStart || undefined,
    periodEnd: invoice.periodEnd || undefined,
  };

  try {
    // Generate PDF
    const pdfPath = await generateInvoicePdf(invoiceData);

    // Update invoice with GST amounts and PDF URL
    const invoicePdfUrl = `/invoices/${path.basename(pdfPath)}`;
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        taxableAmount,
        gstAmount,
        invoicePdfUrl,
        invoicePdfGeneratedAt: new Date(),
        gstNumber: invoice.gstNumber || invoiceData.clientGstNumber,
      },
    });

    // Send email with PDF attachment
    const emailSent = await sendEmail({
      to: invoice.client.email,
      subject: `GST Invoice ${invoice.invoiceNumber} from ${config.FROM_NAME}`,
      text: [
        `Namaste ${invoice.client.ownerName},`,
        ``,
        `Please find attached your GST invoice ${invoice.invoiceNumber}.`,
        ``,
        `Invoice Summary:`,
        `  Description: ${invoiceData.description}`,
        `  Taxable Amount: ₹${taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        `  GST (${invoice.gstPercentage}%): ₹${gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        `  Total Amount: ₹${invoice.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        `  Due Date: ${invoice.dueDate.toLocaleDateString("en-IN")}`,
        ``,
        `You can also download this invoice from your LeadBridge dashboard.`,
        ``,
        `— ${config.FROM_NAME}`,
      ].join("\n"),
    });

    logger.info(
      { invoiceNumber: invoice.invoiceNumber, emailSent },
      "GST invoice generated and emailed"
    );

    return invoicePdfUrl;
  } catch (err: any) {
    logger.error(
      { err: err.message, invoiceNumber: invoice.invoiceNumber },
      "Failed to generate/send GST invoice"
    );
    return null;
  }
}

/**
 * Generate GST invoice for an invoice (called after payment).
 */
export async function generateGstInvoiceForInvoice(
  prisma: PrismaClient,
  invoiceId: string
): Promise<string | null> {
  return generateAndSendGstInvoice({ prisma, invoiceId });
}
