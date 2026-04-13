import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { HttpError } from "./http.js";

const uploadRoot = process.env.UPLOAD_ROOT || "/var/www/luckydanang-uploads";
const uploadPublicBase = (process.env.UPLOAD_PUBLIC_BASE || "/uploads").replace(/\/+$/, "");

export function getUploadMonth(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getUploadRoot() {
  return uploadRoot;
}

export function getAllowedUploadMimes() {
  return (process.env.UPLOAD_ALLOWED_MIMES || "image/jpeg,image/png,image/webp,image/gif")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getUploadMaxSizeBytes() {
  const mb = Number(process.env.UPLOAD_MAX_SIZE_MB || 5);
  return Math.max(1, mb) * 1024 * 1024;
}

type UploadCategory = "community" | "residents";
type ProcessedUpload = {
  data: Buffer;
  info: sharp.OutputInfo;
};

async function saveProcessedImage(
  buffer: Buffer,
  category: UploadCategory,
  now: Date,
  processor: (image: sharp.Sharp) => Promise<ProcessedUpload>,
) {
  const month = getUploadMonth(now);
  const monthDir = path.join(uploadRoot, category, month);
  await fs.mkdir(monthDir, { recursive: true, mode: 0o755 });

  const filename = `${crypto.randomBytes(16).toString("hex")}.webp`;
  const absolutePath = path.join(monthDir, filename);
  const relativePath = `${category}/${month}/${filename}`;
  const publicUrl = `${uploadPublicBase}/${relativePath}`;
  const image = sharp(buffer).rotate();
  const processed = await processor(image);
  const processedBuffer = processed.data;

  await fs.writeFile(absolutePath, processedBuffer, { mode: 0o644 });

  return {
    url: publicUrl,
    relativePath,
    absolutePath,
    width: processed.info.width ?? 0,
    height: processed.info.height ?? 0,
    sizeBytes: processedBuffer.length,
    mimeType: "image/webp",
  };
}

export async function saveImage(buffer: Buffer, category: "community", now = new Date()) {
  return saveProcessedImage(buffer, category, now, (image) =>
    image
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true }),
  );
}

export async function saveAvatar(buffer: Buffer, now = new Date()) {
  return saveProcessedImage(buffer, "residents", now, (image) =>
    image
      .resize({
        width: 512,
        height: 512,
        fit: "cover",
        position: "attention",
      })
      .webp({ quality: 90 })
      .withMetadata({ orientation: undefined })
      .toBuffer({ resolveWithObject: true }),
  );
}

export function uploadUrlToRelativePath(url: string | null | undefined) {
  if (!url) return null;
  if (!url.startsWith(`${uploadPublicBase}/`)) return null;
  return url.slice(uploadPublicBase.length + 1);
}

export async function deleteImage(relativePath: string) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.resolve(uploadRoot, normalized);
  const rootPath = path.resolve(uploadRoot);

  if (!absolutePath.startsWith(rootPath)) {
    throw new HttpError(400, "Invalid image path");
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
}
