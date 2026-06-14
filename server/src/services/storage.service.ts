import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Supabase storage service — manages call recording uploads and signed URLs.
 */

const supabaseApi = axios.create({
  baseURL: `${config.SUPABASE_URL}/storage/v1`,
  headers: {
    Authorization: `Bearer ${config.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

/**
 * Upload a file to Supabase storage.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string | null> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: contentType });
  formData.append("file", blob, path.split("/").pop());

  try {
    const response = await supabaseApi.post(`/object/${bucket}/${path}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    logger.info({ bucket, path }, "File uploaded to Supabase");
    return `${config.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  } catch (error: any) {
    logger.error({ err: error.response?.data?.error || error.message, bucket, path }, "Upload failed");
    return null;
  }
}

/**
 * Generate a signed URL for temporary access to a recording.
 * Signed URLs expire in 1 hour.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  try {
    const response = await supabaseApi.post(`/object/sign/${bucket}/${path}`, {
      expiresIn: expiresInSeconds,
    });

    const signedPath = response.data.signedURL;
    return `${config.SUPABASE_URL}/storage/v1${signedPath}`;
  } catch (error: any) {
    logger.error({ err: error.message, bucket, path }, "Signed URL generation failed");
    return null;
  }
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
  try {
    await supabaseApi.delete(`/object/${bucket}/${path}`);
    logger.info({ bucket, path }, "File deleted from Supabase");
    return true;
  } catch (error: any) {
    logger.error({ err: error.message, bucket, path }, "File deletion failed");
    return false;
  }
}

/**
 * Get the public URL for a file.
 */
export function getPublicUrl(bucket: string, path: string): string {
  return `${config.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
