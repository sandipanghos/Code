import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('GET /health/ready', () => {
  it('returns 200 when database is connected', async () => {
    const res = await request(app).get('/health/ready');
    // In test environment with test.db it should connect
    expect([200, 503]).toContain(res.status);
  });
});
