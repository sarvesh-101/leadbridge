import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { logger } from "./logger";

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads/properties");

/**
 * Ensure the uploads directory exists.
 */
async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    logger.error({ err }, "Failed to create uploads directory");
  }
}

/**
 * Generate a unique filename with the original extension.
 */
function generateFilename(originalName: string): string {
  const ext = path.extname(originalName) || ".jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}${ext}`;
}

/**
 * Save an uploaded file buffer to local storage.
 * Returns the public URL path for the file.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  await ensureDir();
  const filename = generateFilename(originalName);
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.writeFile(filePath, buffer);
  logger.info({ filename, size: buffer.length }, "File saved locally");

  // Return the relative URL path
  return `/uploads/properties/${filename}`;
}

/**
 * Save a file from a readable stream to local storage.
 * Returns the public URL path for the file.
 */
export async function saveFileFromStream(
  stream: NodeJS.ReadableStream,
  originalName: string,
): Promise<string> {
  await ensureDir();
  const filename = generateFilename(originalName);
  const filePath = path.join(UPLOADS_DIR, filename);

  const writeStream = createWriteStream(filePath);
  await pipeline(stream, writeStream);

  logger.info({ filename }, "File saved locally from stream");
  return `/uploads/properties/${filename}`;
}

/**
 * Delete a file from local storage by its URL path.
 */
export async function deleteFileByUrl(urlPath: string): Promise<boolean> {
  const filename = path.basename(urlPath);
  const filePath = path.join(UPLOADS_DIR, filename);

  try {
    await fs.unlink(filePath);
    logger.info({ filename }, "File deleted locally");
    return true;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // File doesn't exist — not an error
      return true;
    }
    logger.error({ err, filename }, "Failed to delete file");
    return false;
  }
}

/**
 * Delete multiple files by their URL paths.
 */
export async function deleteFilesByUrls(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map((url) => deleteFileByUrl(url)));
}
