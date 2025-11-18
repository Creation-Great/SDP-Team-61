import { Request, Response, NextFunction } from 'express';

/**
 * Authentication Middleware - Database & Security Module
 * Owner: Yanxiao Zheng
 * 
 * Supports multiple authentication strategies:
 * - devAuth: Development-only authentication via headers (for local testing)
 * - ssoAuth: Single Sign-On integration (CAS/SAML) - TODO: Implement in production
 * 
 * Strategy selection via AUTH_MODE environment variable: 'dev' | 'sso' | 'cas'
 */

export type AuthMode = 'dev' | 'sso' | 'cas';

/**
 * Get current authentication mode from environment.
 * Defaults to 'dev' for backward compatibility.
 */
export function getAuthMode(): AuthMode {
  const mode = (process.env.AUTH_MODE || 'dev').toLowerCase();
  
  if (mode === 'sso' || mode === 'cas') {
    return mode as AuthMode;
  }
  
  if (process.env.NODE_ENV === 'production' && mode === 'dev') {
    console.warn('⚠️  WARNING: Using devAuth in production! Set AUTH_MODE=sso or AUTH_MODE=cas');
  }
  
  return 'dev';
}

/**
 * Development-only authentication middleware.
 * Reads user identity from request headers.
 * 
 * Headers:
 * - x-user-id: UUID of the user (defaults to test user)
 * - x-user-role: Role (student | instructor | admin, defaults to 'student')
 * - x-user-course: Course ID (defaults to 'CSE4939W')
 * - x-user-group: Group ID (optional, defaults to 'G1')
 * 
 * SECURITY WARNING: This should NEVER be used in production!
 * Set AUTH_MODE=sso or AUTH_MODE=cas for production deployments.
 */
export function devAuth(req: Request, _res: Response, next: NextFunction) {
  const uid = req.header('x-user-id') || '00000000-0000-0000-0000-0000000000a1';
  const role = (req.header('x-user-role') || 'student').toLowerCase();
  const course = req.header('x-user-course') || 'CSE4939W';
  const group = req.header('x-user-group') || 'G1';
  
  // Validate role
  if (!['student', 'instructor', 'admin'].includes(role)) {
    console.warn(`Invalid role in devAuth: ${role}, defaulting to student`);
    (req as any).user = { 
      user_id: uid, 
      role: 'student', 
      course_id: course, 
      group_id: group 
    };
  } else {
    (req as any).user = { 
      user_id: uid, 
      role, 
      course_id: course, 
      group_id: group 
    };
  }
  
  next();
}

/**
 * Single Sign-On (SSO) authentication middleware.
 * Integrates with university CAS/SAML identity provider.
 * 
 * TODO: Implement SSO integration for production.
 * 
 * Expected flow:
 * 1. Check for existing session (express-session or JWT)
 * 2. If no session, redirect to CAS login URL
 * 3. On callback, validate ticket with CAS server
 * 4. Extract user attributes (netid, roles, groups)
 * 5. Look up or create user in database
 * 6. Set session and attach user to req.user
 * 
 * Required environment variables:
 * - CAS_URL: CAS server base URL (e.g., https://cas.university.edu/cas)
 * - CAS_VERSION: CAS protocol version (default: 3.0)
 * - SERVICE_URL: This application's callback URL
 * - SSO_ROLE_ATTRIBUTE: SAML attribute containing user role
 * - SSO_COURSE_ATTRIBUTE: SAML attribute containing course enrollment
 */
export function ssoAuth(req: Request, res: Response, next: NextFunction) {
  // Check if user already authenticated in session
  const session = (req as any).session;
  if (session?.user) {
    (req as any).user = session.user;
    return next();
  }
  
  // TODO: Implement CAS/SAML authentication flow
  // For now, return 401 to indicate SSO is not yet implemented
  console.error('SSO authentication not yet implemented. Please set AUTH_MODE=dev for development.');
  
  return res.status(401).json({
    error: 'authentication_required',
    detail: 'SSO authentication is enabled but not yet configured. Contact system administrator.',
    auth_mode: 'sso',
    // In production, this would redirect to CAS login
    // redirect_url: constructCASLoginUrl(req)
  });
}

/**
 * CAS-specific authentication middleware (alias for ssoAuth).
 * Uses Central Authentication Service protocol.
 */
export const casAuth = ssoAuth;

/**
 * Main authentication middleware that dispatches to the appropriate strategy.
 * Reads AUTH_MODE environment variable to determine strategy.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const mode = getAuthMode();
  
  switch (mode) {
    case 'dev':
      return devAuth(req, res, next);
    case 'sso':
    case 'cas':
      return ssoAuth(req, res, next);
    default:
      console.error(`Unknown AUTH_MODE: ${mode}, falling back to devAuth`);
      return devAuth(req, res, next);
  }
}

/**
 * Helper function to construct CAS login URL (for future SSO implementation).
 * 
 * @param req - Express request object
 * @returns CAS login URL with service parameter
 */
export function constructCASLoginUrl(req: Request): string {
  const casUrl = process.env.CAS_URL || 'https://cas.example.edu/cas';
  const serviceUrl = process.env.SERVICE_URL || `${req.protocol}://${req.get('host')}/auth/callback`;
  
  return `${casUrl}/login?service=${encodeURIComponent(serviceUrl)}`;
}

/**
 * Helper function to validate CAS ticket (for future SSO implementation).
 * 
 * @param ticket - CAS service ticket from callback
 * @param serviceUrl - Service URL for validation
 * @returns User attributes from CAS
 */
export async function validateCASTicket(
  ticket: string, 
  serviceUrl: string
): Promise<{ netid: string; attributes: any } | null> {
  // TODO: Implement CAS ticket validation
  // 1. Construct validation URL: ${CAS_URL}/serviceValidate?ticket=${ticket}&service=${serviceUrl}
  // 2. Make HTTP GET request to CAS server
  // 3. Parse XML response
  // 4. Extract user attributes
  // 5. Return user data or null if invalid
  
  console.warn('CAS ticket validation not yet implemented');
  return null;
}

// Export the appropriate middleware based on configuration
// For backward compatibility, default export is devAuth
export default process.env.NODE_ENV === 'test' ? devAuth : authenticate;
