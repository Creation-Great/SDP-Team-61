/**
 * Object storage abstraction.
 *
 * Supports two adapters:
 *   - local  (default) — stores files on the local filesystem (existing behaviour)
 *   - mock-s3 — stores locally but with S3-style key paths (for future migration)
 *
 * Usage:
 *   import { getStorage } from './objectStorage.js';
 *   const storage = getStorage();
 *   await storage.upload(key, buffer, mimeType);
 *   const url = storage.getUrl(key);
 */
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export interface ObjectStorage {
  upload(key: string, data: Buffer, mimeType?: string): Promise<string>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// ── Local Filesystem Adapter ──────────────────────────────
class LocalStorageAdapter implements ObjectStorage {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  }

  async upload(key: string, data: Buffer): Promise<string> {
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, data);
    return `/uploads/${key}`;
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(path.join(this.basePath, key));
  }
}

// ── Mock S3 Adapter ───────────────────────────────────────
class MockS3Adapter implements ObjectStorage {
  private basePath: string;
  private bucket: string;

  constructor(basePath: string, bucket: string) {
    this.basePath = basePath;
    this.bucket = bucket;
    const dir = path.join(basePath, bucket);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logger.info({ bucket }, 'Mock S3 adapter initialised');
  }

  async upload(key: string, data: Buffer): Promise<string> {
    const filePath = path.join(this.basePath, this.bucket, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, data);
    return `s3://${this.bucket}/${key}`;
  }

  getUrl(key: string): string {
    // In mock mode, serve from local path through the /uploads endpoint
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, this.bucket, key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(path.join(this.basePath, this.bucket, key));
  }
}

// ── Factory ───────────────────────────────────────────────
let instance: ObjectStorage | null = null;

export function getStorage(): ObjectStorage {
  if (instance) return instance;

  const storageType = process.env.OBJECT_STORAGE_TYPE || 'local';
  const basePath = process.env.OBJECT_STORAGE_PATH
    || path.join(process.cwd(), 'uploads');

  if (storageType === 'mock-s3') {
    const bucket = process.env.S3_BUCKET || 'peer-review-uploads';
    instance = new MockS3Adapter(basePath, bucket);
  } else {
    instance = new LocalStorageAdapter(basePath);
  }

  return instance;
}
