import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Generate a short-lived download URL for masked_uri when enabled.
// Supported formats:
// - s3://<bucket>/<key>
// Fallback: return the original uri.

let s3Client: S3Client | null = null;
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    });
  }
  return s3Client;
}

function parseS3Uri(uri: string): { bucket: string; key: string } | null {
  if (!uri?.startsWith('s3://')) return null;
  const withoutScheme = uri.slice('s3://'.length);
  const slash = withoutScheme.indexOf('/');
  if (slash <= 0) return null;
  const bucket = withoutScheme.slice(0, slash);
  const key = withoutScheme.slice(slash + 1);
  if (!bucket || !key) return null;
  return { bucket, key };
}

export async function getMaskedDownloadUrl(maskedUri: string): Promise<string> {
  try {
    if (process.env.PRESIGN_MASKED_URLS !== 'true') return maskedUri;
    const parsed = parseS3Uri(maskedUri);
    if (!parsed) return maskedUri; // Not S3, return as-is

    const client = getS3();
    const cmd = new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key });
    const ttl = Number(process.env.SIGNED_URL_TTL || 900);
    const url = await getSignedUrl(client, cmd, { expiresIn: ttl });
    return url;
  } catch (_e) {
    // On any failure, fall back to original maskedUri to avoid breaking UX.
    return maskedUri;
  }
}
