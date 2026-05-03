import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Allowed MIME types & their magic-byte signatures ──
const ALLOWED: Record<string, { exts: string[]; magics: Buffer[] }> = {
  'application/pdf': {
    exts: ['.pdf'],
    magics: [Buffer.from('%PDF')],
  },
  'application/msword': {
    exts: ['.doc'],
    // .doc (OLE2 compound document) starts with D0 CF 11 E0
    magics: [Buffer.from([0xd0, 0xcf, 0x11, 0xe0])],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    exts: ['.docx'],
    // .docx is a ZIP archive – starts with PK (50 4B)
    magics: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  },
  'text/plain': {
    exts: ['.txt'],
    magics: [],  // text files have no fixed magic bytes
  },
};

const allowedMimes = new Set(Object.keys(ALLOWED));

// ── Multer config ──
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Cryptographically secure random filename
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

/**
 * First-pass filter: reject obviously wrong MIME types.
 * The real content validation happens in `validateFileContent` below.
 */
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedMimes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10 MB
  },
});

// ── Post-upload magic-byte validation middleware ──

/**
 * Call this AFTER multer has written the file to disk.
 * Reads the first 8 bytes and compares against known magic signatures.
 * Deletes the file and returns 400 if the content doesn't match.
 */
export async function validateFileContent(req: Request, res: Response, next: NextFunction) {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return next();  // no file → let controller handle

  const entry = ALLOWED[file.mimetype];
  if (!entry) {
    // Should not happen because multer fileFilter already blocked it
    fs.unlink(file.path, () => {});
    res.status(400).json({ error: 'validation', message: 'Unsupported file type' });
    return;
  }

  // text/plain has no magic bytes to check
  if (entry.magics.length === 0) return next();

  try {
    const fd = await fs.promises.open(file.path, 'r');
    const headBuf = Buffer.alloc(8);
    await fd.read(headBuf, 0, 8, 0);
    await fd.close();

    const match = entry.magics.some((sig) => headBuf.subarray(0, sig.length).equals(sig));
    if (!match) {
      fs.unlink(file.path, () => {});
      res.status(400).json({
        error: 'validation',
        message: 'File content does not match its declared type',
      });
      return;
    }
  } catch (err) {
    fs.unlink(file.path, () => {});
    res.status(500).json({ error: 'internal', message: 'Failed to validate file' });
    return;
  }

  next();
}
