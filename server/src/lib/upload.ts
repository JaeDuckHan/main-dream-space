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

async function saveProcessedImage(
  buffer: Buffer,
  category: "community" | "residents",
  now: Date,
  processor: (image: sharp.Sharp) => Promise<{ data: Buffer; info: sharp.OutputInfo }>,
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
  const month = getUploadMonth(now);
  const monthDir = path.join(uploadRoot, category, month);
  await fs.mkdir(monthDir, { recursive: true, mode: 0o755 });

  const baseHash = crypto.randomBytes(16).toString("hex");
  const image = sharp(buffer).rotate();

  // 원본 (최대 1920×1920, 본문용)
  const fullProcessed = await image
    .clone()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  // 썸네일 (440×360 cover, 220×180 표시 기준 2× retina)
  const thumbProcessed = await image
    .clone()
    .resize({ width: 440, height: 360, fit: "cover", position: "attention" })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  const fullFilename = `${baseHash}.webp`;
  const thumbFilename = `${baseHash}-thumb.webp`;
  const relativePath = `${category}/${month}/${fullFilename}`;
  const thumbRelativePath = `${category}/${month}/${thumbFilename}`;

  await Promise.all([
    fs.writeFile(path.join(monthDir, fullFilename), fullProcessed.data, { mode: 0o644 }),
    fs.writeFile(path.join(monthDir, thumbFilename), thumbProcessed.data, { mode: 0o644 }),
  ]);

  return {
    url: `${uploadPublicBase}/${relativePath}`,
    relativePath,
    absolutePath: path.join(monthDir, fullFilename),
    thumbnailUrl: `${uploadPublicBase}/${thumbRelativePath}`,
    thumbnailRelativePath: thumbRelativePath,
    width: fullProcessed.info.width ?? 0,
    height: fullProcessed.info.height ?? 0,
    sizeBytes: fullProcessed.data.length,
    mimeType: "image/webp",
  };
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

async function tryUnlink(absolutePath: string) {
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
}

export async function deleteImage(relativePath: string) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.resolve(uploadRoot, normalized);
  const rootPath = path.resolve(uploadRoot);

  if (!absolutePath.startsWith(rootPath)) {
    throw new HttpError(400, "Invalid image path");
  }

  await tryUnlink(absolutePath);

  // 썸네일 파일도 같이 삭제 (.webp → -thumb.webp)
  if (absolutePath.endsWith(".webp")) {
    const thumbPath = absolutePath.slice(0, -5) + "-thumb.webp";
    await tryUnlink(thumbPath);
  }
}
