import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Omnidimension Knowledge Base API service.
 * Manage PDF documents: upload, list, attach to agents, detach, delete.
 *
 * Docs: https://docs.omnidim.io/docs/api-reference
 */

const OMNIDIM_BASE = config.OMNIDIM_BASE_URL;

const headers = {
  Authorization: `Bearer ${config.OMNIDIM_API_KEY}`,
};

export interface KnowledgeDoc {
  id: number;
  name: string;
  file_name?: string;
  file_size?: number;
  status?: string;
  created_at?: string;
  attached_agent_id?: number | null;
}

/**
 * List all knowledge base documents.
 */
export async function listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/knowledge_base`, {
      headers: { ...headers, "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { documents?: KnowledgeDoc[] };
    return data.documents || [];
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to list Knowledge Base docs");
    throw new Error(`Failed to list documents: ${error.message}`);
  }
}

/**
 * Upload a PDF document to the Knowledge Base.
 * Must use multipart/form-data for file upload.
 */
export async function uploadKnowledgeDoc(
  fileBuffer: Buffer,
  fileName: string,
): Promise<KnowledgeDoc> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("file", blob, fileName);

  try {
    const response = await fetch(`${OMNIDIM_BASE}/knowledge_base`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.OMNIDIM_API_KEY}`,
        // Do NOT set Content-Type — fetch will set it with the boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as KnowledgeDoc;
    logger.info({ docId: data.id, fileName }, "Knowledge Base document uploaded");
    return data;
  } catch (error: any) {
    logger.error({ fileName, err: error.message }, "Failed to upload Knowledge Base doc");
    throw new Error(`Failed to upload document: ${error.message}`);
  }
}

/**
 * Attach a knowledge base document to an agent.
 */
export async function attachKnowledgeDoc(docId: number, agentId: number): Promise<boolean> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/knowledge_base/attach`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: docId,
        agent_id: agentId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    logger.info({ docId, agentId }, "Knowledge doc attached to agent");
    return true;
  } catch (error: any) {
    logger.error({ docId, agentId, err: error.message }, "Failed to attach Knowledge doc");
    throw new Error(`Failed to attach document: ${error.message}`);
  }
}

/**
 * Detach a knowledge base document from its agent.
 */
export async function detachKnowledgeDoc(docId: number): Promise<boolean> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/knowledge_base/detach`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: docId }),
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    logger.info({ docId }, "Knowledge doc detached");
    return true;
  } catch (error: any) {
    logger.error({ docId, err: error.message }, "Failed to detach Knowledge doc");
    throw new Error(`Failed to detach document: ${error.message}`);
  }
}

/**
 * Delete a knowledge base document.
 */
export async function deleteKnowledgeDoc(docId: number): Promise<boolean> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/knowledge_base/${docId}`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
    });

    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);

    logger.info({ docId }, "Knowledge doc deleted");
    return true;
  } catch (error: any) {
    logger.error({ docId, err: error.message }, "Failed to delete Knowledge doc");
    return false;
  }
}
