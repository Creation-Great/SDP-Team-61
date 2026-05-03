/**
 * Environment variables for test suite.
 * Loaded via Jest setupFiles before any test modules.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.AI_SERVICE_URL = 'http://localhost:5001';
process.env.AI_API_KEY = 'test-ai-key';
