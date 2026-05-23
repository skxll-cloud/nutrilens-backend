// src/utils/imageUtils.ts
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export async function compressImage(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function bufferToBase64(buffer: Buffer): Promise<string> {
  return buffer.toString('base64');
}

export async function saveTempFile(buffer: Buffer): Promise<string> {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `nutrilens_${uuidv4()}.jpg`);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
}

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return mimeMap[ext] ?? 'image/jpeg';
}
