/**
 * Centralised structured logger (Pino).
 *
 * - In development: pretty-printed, coloured output via pino-pretty.
 * - In production:  newline-delimited JSON (easy to ship to ELK / CloudWatch / Datadog).
 *
 * Usage:
 *   import { logger } from './utils/logger.js';
 *   logger.info({ submissionId }, 'Submission created');
 *   logger.error({ err }, 'Failed to persist');
 *
 * Child loggers for sub-systems:
 *   const log = logger.child({ module: 'mv-refresh' });
 */
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
