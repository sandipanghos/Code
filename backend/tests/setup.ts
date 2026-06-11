import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables before any imports
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'file:./test.db';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = 'test-secret-that-is-at-least-32-characters-long';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-at-least-32-chars-ok';
process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef';
process.env['PORT'] = '3002';
process.env['API_BASE_URL'] = 'http://localhost:3002';
process.env['GITHUB_TOKEN'] = 'test-github-token';
process.env['SMTP_HOST'] = 'smtp.ethereal.email';
process.env['SMTP_PORT'] = '587';
process.env['SMTP_USER'] = 'test@ethereal.email';
process.env['SMTP_PASS'] = 'testpassword';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';

beforeAll(() => {
  // Global test setup
});

afterEach(() => {
  // Clear all mocks between tests
});

afterAll(() => {
  // Global cleanup
});
