import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DataSource } from 'typeorm';
import { bootstrap } from '../src/bootstrap';
import { ErrorCode } from '../src/api/errors/error-code';

describe('App e2e', () => {
  let app: NestFastifyApplication;
  let dbDir: string;
  let dbPath: string;

  beforeEach(async () => {
    dbDir = mkdtempSync(join(tmpdir(), 'novabook-tax-'));
    dbPath = join(dbDir, 'events.sqlite');
    process.env.SQLITE_PATH = dbPath;
    delete process.env.REQUEST_LOGGING;
    delete process.env.CORS_ORIGIN;
    app = await bootstrap({ listen: false });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.CORS_ORIGIN;
    rmSync(dbDir, { recursive: true, force: true });
  });

  const inject = (
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: object,
  ) => app.inject({ method, url, payload });

  it('ingests a sale and returns tax position', async () => {
    const ingest = await inject('POST', '/transactions', {
      eventType: 'SALES',
      date: '2024-02-22T17:29:39Z',
      invoiceId: '3419027d-960f-4e8f-b8b7-f7b2b4791824',
      items: [
        {
          itemId: '02db47b6-fe68-4005-a827-24c6e962f3df',
          cost: 1099,
          taxRate: 0.2,
        },
      ],
    });
    expect(ingest.statusCode).toBe(202);
    expect(ingest.body).toBe('');

    const query = await inject(
      'GET',
      '/tax-position?date=2024-02-22T17:29:39Z',
    );
    expect(query.statusCode).toBe(200);
    expect(query.json()).toEqual({
      date: '2024-02-22T17:29:39Z',
      taxPosition: 220,
    });
  });

  it('ingests a tax payment', async () => {
    const ingest = await inject('POST', '/transactions', {
      eventType: 'TAX_PAYMENT',
      date: '2024-02-22T17:29:39Z',
      amount: 74901,
    });
    expect(ingest.statusCode).toBe(202);

    const query = await inject(
      'GET',
      '/tax-position?date=2024-02-22T17:29:39Z',
    );
    expect(query.json()).toEqual({
      date: '2024-02-22T17:29:39Z',
      taxPosition: -74901,
    });
  });

  it('amends a sale that does not exist yet', async () => {
    const amend = await inject('PATCH', '/sale', {
      date: '2024-02-22T17:29:39Z',
      invoiceId: '3419027d-960f-4e8f-b8b7-f7b2b4791824',
      itemId: '02db47b6-fe68-4005-a827-24c6e962f3df',
      cost: 798,
      taxRate: 0.15,
    });
    expect(amend.statusCode).toBe(202);
    expect(amend.body).toBe('');

    const query = await inject(
      'GET',
      '/tax-position?date=2024-02-22T17:29:39Z',
    );
    expect(query.json().taxPosition).toBe(Math.round(798 * 0.15));
  });

  it('returns INVALID_DATE for a malformed date', async () => {
    const res = await inject('POST', '/transactions', {
      eventType: 'TAX_PAYMENT',
      date: 'not-a-date',
      amount: 1,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(ErrorCode.INVALID_DATE);
  });

  it('returns INVALID_EVENT_TYPE for an unknown eventType', async () => {
    const res = await inject('POST', '/transactions', {
      eventType: 'REFUND',
      date: '2024-02-22T17:29:39Z',
      amount: 1,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(ErrorCode.INVALID_EVENT_TYPE);
  });

  it('returns INVALID_AMOUNT for a negative amount', async () => {
    const res = await inject('POST', '/transactions', {
      eventType: 'TAX_PAYMENT',
      date: '2024-02-22T17:29:39Z',
      amount: -1,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it('returns INVALID_TAX_RATE for a negative taxRate', async () => {
    const res = await inject('PATCH', '/sale', {
      date: '2024-02-22T17:29:39Z',
      invoiceId: 'inv',
      itemId: 'item',
      cost: 100,
      taxRate: -0.1,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(ErrorCode.INVALID_TAX_RATE);
  });

  it('returns MISSING_DATE when tax-position has no date', async () => {
    const res = await inject('GET', '/tax-position');
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(ErrorCode.MISSING_DATE);
  });

  it('returns INVALID_DATE when tax-position date is malformed', async () => {
    const res = await inject('GET', '/tax-position?date=not-a-date');
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(ErrorCode.INVALID_DATE);
  });

  it('returns VALIDATION_ERROR for unknown fields', async () => {
    const res = await inject('POST', '/transactions', {
      eventType: 'TAX_PAYMENT',
      date: '2024-02-22T17:29:39Z',
      amount: 1,
      extra: true,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('reports health with the database up', async () => {
    const res = await inject('GET', '/health');
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
    expect(res.json().database).toBe('up');
  });

  it('sends Helmet security headers', async () => {
    const res = await inject('GET', '/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('serves Swagger UI from bootstrap', async () => {
    const res = await inject('GET', '/api-docs');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Swagger');
  });

  it('reflects CORS_ORIGIN when set', async () => {
    await app.close();
    process.env.CORS_ORIGIN = 'http://reviewer.example';
    app = await bootstrap({ listen: false });
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://reviewer.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://reviewer.example',
    );
  });

  it('writes an HTTP access log through Nest Logger', async () => {
    const spy = jest.spyOn(Logger.prototype, 'log');
    await inject('GET', '/health');
    const httpLog = spy.mock.calls
      .map((call) => call[0])
      .find(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          (entry as { type?: string; path?: string }).type === 'http' &&
          (entry as { path?: string }).path === '/health',
      );
    expect(httpLog).toMatchObject({
      type: 'http',
      method: 'GET',
      path: '/health',
      statusCode: 200,
    });
    spy.mockRestore();
  });

  it('returns DATABASE_UNAVAILABLE when the database ping fails', async () => {
    await app.get(DataSource).destroy();
    const res = await inject('GET', '/health');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      statusCode: 503,
      error: ErrorCode.DATABASE_UNAVAILABLE,
      details: [{ field: 'database', issue: 'down' }],
    });
  });

  it('keeps tax position after a process restart (new DataSource, same file)', async () => {
    await inject('POST', '/transactions', {
      eventType: 'SALES',
      date: '2024-02-22T17:29:39Z',
      invoiceId: 'inv-1',
      items: [{ itemId: 'item-1', cost: 1000, taxRate: 0.2 }],
    });
    await app.close();

    process.env.SQLITE_PATH = dbPath;
    app = await bootstrap({ listen: false });
    const query = await inject(
      'GET',
      '/tax-position?date=2024-02-22T17:29:39Z',
    );
    expect(query.json().taxPosition).toBe(200);
  });
});
