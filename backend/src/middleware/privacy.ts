import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { hashSensitiveData } from '../utils/audit';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      ipHash?: string;
      userAgentHash?: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use existing correlation ID from header, or generate new one
  req.correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  
  // Set response header for client tracking
  res.setHeader('X-Correlation-ID', req.correlationId);
  
  next();
}

export function privacyHashMiddleware(req: Request, res: Response, next: NextFunction) {
  const salt = process.env.PRIVACY_SALT || process.env.AUDIT_SALT || 'change-me-in-production';
  
  // Hash IP address (privacy-safe, cannot reverse)
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  req.ipHash = hashSensitiveData(ip, salt);
  
  // Hash User-Agent
  const userAgent = req.headers['user-agent'] || 'unknown';
  req.userAgentHash = hashSensitiveData(userAgent, salt);
  
  next();
}

const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
};

export function maskPII(text: string, replacementMap?: Map<string, string>): string {
  if (!text) return text;
  
  let masked = text;
  
  masked = masked.replace(PII_PATTERNS.email, (match) => {
    if (replacementMap?.has(match)) {
      return replacementMap.get(match)!;
    }
    const [local, domain] = match.split('@');
    return `${local[0]}***@${domain}`;
  });
  
  masked = masked.replace(PII_PATTERNS.ssn, 'XXX-XX-XXXX');
  masked = masked.replace(PII_PATTERNS.phone, 'XXX-XXX-XXXX');
  masked = masked.replace(PII_PATTERNS.creditCard, '**** **** **** XXXX');
  
  return masked;
}

export function maskPIIInObject(obj: any, fieldsToMask: string[] = ['email', 'phone', 'ssn']): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => maskPIIInObject(item, fieldsToMask));
  }
  
  const masked: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (fieldsToMask.includes(key.toLowerCase()) && typeof value === 'string') {
      masked[key] = maskPII(value);
    } else if (typeof value === 'object') {
      masked[key] = maskPIIInObject(value, fieldsToMask);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}

export function sanitizeRequestMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalBody = req.body;
  
  (req as any).sanitizedBody = maskPIIInObject(originalBody);
  
  next();
}

export function pseudonymize(identifier: string, salt: string = ''): string {
  const hash = hashSensitiveData(identifier, salt);
  return `anon_${hash.substring(0, 8)}`;
}

export function containsPII(text: string): boolean {
  if (!text) return false;
  
  return Object.values(PII_PATTERNS).some(pattern => pattern.test(text));
}

export function rejectPIIMiddleware(fieldsToCheck: string[] = ['text', 'content', 'message']) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body) {
      return next();
    }
    
    for (const field of fieldsToCheck) {
      const value = req.body[field];
      if (value && typeof value === 'string' && containsPII(value)) {
        return res.status(400).json({
          error: 'pii_detected',
          detail: `Field '${field}' appears to contain PII. Please use masked text only.`,
          field
        });
      }
    }
    
    next();
  };
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  
  next();
}

export function validateSecurityConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!process.env.AUDIT_SALT || process.env.AUDIT_SALT === 'default-salt-change-in-production') {
    warnings.push('AUDIT_SALT not set or using default value - change in production!');
  }
  
  if (!process.env.PRIVACY_SALT) {
    warnings.push('PRIVACY_SALT not set - using AUDIT_SALT as fallback');
  }
  
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('ssl=true')) {
    warnings.push('DATABASE_URL does not enforce SSL - insecure for production');
  }
  
  if (!process.env.S3_ENCRYPTION_KEY && !process.env.STORAGE_ENCRYPTION) {
    warnings.push('No storage encryption configured - files stored without encryption');
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  };
}
