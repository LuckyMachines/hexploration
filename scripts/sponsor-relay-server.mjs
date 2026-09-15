#!/usr/bin/env node
import 'dotenv/config';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { SponsorBudgetLedger } from './sponsor-relay-ledger.mjs';
import { parseRelayConfig, RelayError } from './sponsor-relay-core.mjs';
import { createRelayClients, SponsorRelayService } from './sponsor-relay-service.mjs';
import { bearerSession, issueAuthoritySession } from './game-authority.mjs';

function log(event, details = {}) {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), event, ...details })}\n`);
}

function send(res, status, body, extraHeaders = {}) {
  const payload = `${JSON.stringify(body)}\n`;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...extraHeaders,
  });
  res.end(payload);
}

function tokenMatches(received, expected) {
  const left = createHash('sha256').update(String(received || '')).digest();
  const right = createHash('sha256').update(String(expected || '')).digest();
  return timingSafeEqual(left, right);
}

function clientAddress(req, trustProxy) {
  if (trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '');
    const address = forwarded.split(',').map((value) => value.trim()).find((value) => isIP(value));
    if (address) return address;
  }
  return req.socket.remoteAddress || 'unknown';
}

function consumeRateLimit(windows, address, limit) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const addressHash = createHash('sha256').update(address).digest('hex').slice(0, 24);
  const key = `${hour}:${addressHash}`;
  if (!windows.has(key) && windows.size >= 10_000) {
    for (const existing of windows.keys()) if (!existing.startsWith(`${hour}:`)) windows.delete(existing);
    if (windows.size >= 10_000) throw new RelayError(503, 'rate_limit_capacity', 'The relay request limiter is at capacity');
  }
  const count = (windows.get(key) || 0) + 1;
  windows.set(key, count);
  if (count > limit) throw new RelayError(429, 'ip_rate_limit', 'Too many requests from this network');
}

async function readJson(req, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new RelayError(413, 'body_too_large', 'Request body is too large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RelayError(400, 'invalid_json', 'Request body must be valid JSON'); }
}

export function createSponsorRelayHttpServer({ config, service, ledger }) {
  const ipWindows = new Map();
  const sessionWindows = new Map();
  const readWindows = new Map();
  const adminWindows = new Map();
  let inFlight = 0;
  return createServer(async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const url = new URL(req.url || '/', 'http://relay.local');
    const origin = req.headers.origin;
    const cors = origin && config.allowedOrigins.has(origin) ? {
      'access-control-allow-origin': origin,
      vary: 'Origin',
    } : {};

    try {
      if (origin && !config.allowedOrigins.has(origin)) throw new RelayError(403, 'origin_denied', 'This browser origin is not allowed');
      if (req.method === 'OPTIONS') {
        if (!origin) throw new RelayError(400, 'origin_required', 'Origin is required');
        res.writeHead(204, {
          ...cors,
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type,authorization',
          'access-control-max-age': '600',
        });
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/livez') {
        send(res, 200, { live: true }, cors);
      } else if (req.method === 'GET' && url.pathname === '/healthz') {
        const health = await service.checkReadiness({ force: true });
        send(res, health.ready ? 200 : 503, { ready: health.ready }, cors);
      } else if (req.method === 'POST' && url.pathname === '/v1/game/session') {
        consumeRateLimit(sessionWindows, clientAddress(req, config.trustProxy), config.perIpHourlySessions);
        const issued = issueAuthoritySession(config);
        const session = bearerSession({ headers: { authorization: `Bearer ${issued.token}` } }, config);
        send(res, 201, { ...issued, playerIdentity: service.playerIdentity(session).address }, cors);
      } else if (req.method === 'GET' && url.pathname === '/v1/game/status') {
        const health = await service.checkReadiness();
        send(res, health.ready ? 200 : 503, { available: health.ready, maintenance: health.paused }, cors);
      } else if (req.method === 'POST' && url.pathname === '/v1/game/state') {
        consumeRateLimit(readWindows, clientAddress(req, config.trustProxy), config.perIpHourlyReads);
        bearerSession(req, config);
        const body = await readJson(req, config.maxBodyBytes);
        send(res, 200, { result: await service.readAuthorityState(body) }, cors);
      } else if (req.method === 'POST' && ['/v1/game/commands/create', '/v1/game/commands/join', '/v1/game/commands/action'].includes(url.pathname)) {
        consumeRateLimit(ipWindows, clientAddress(req, config.trustProxy), config.perIpHourlyRequests);
        if (inFlight >= config.maxInFlight) throw new RelayError(503, 'service_busy', 'Live play is busy; try again shortly');
        const session = bearerSession(req, config);
        const body = await readJson(req, config.maxBodyBytes);
        inFlight += 1;
        try {
          const result = url.pathname.endsWith('/create')
            ? await service.createAuthorityGame(session, body)
            : url.pathname.endsWith('/join')
              ? await service.registerAuthorityPlayer(session, body)
              : await service.submitAuthorityAction(session, body);
          send(res, 202, result, cors);
        } finally {
          inFlight -= 1;
        }
      } else if (req.method === 'GET' && /^\/v1\/game\/operations\/[a-zA-Z0-9_-]+$/.test(url.pathname)) {
        bearerSession(req, config);
        send(res, 200, await service.authorityStatus(url.pathname.split('/').at(-1)), cors);
      } else if (config.legacySponsorApi && req.method === 'GET' && url.pathname === '/v1/sponsor/config') {
        send(res, 200, service.publicConfig(), cors);
      } else if (config.legacySponsorApi && req.method === 'POST' && ['/v1/sponsor/actions', '/v1/sponsor/actions/batch'].includes(url.pathname)) {
        consumeRateLimit(ipWindows, clientAddress(req, config.trustProxy), config.perIpHourlyRequests);
        if (inFlight >= config.maxInFlight) throw new RelayError(503, 'relay_busy', 'The sponsor relay is at its safe concurrency limit');
        const body = await readJson(req, config.maxBodyBytes);
        inFlight += 1;
        try {
          send(res, 202, url.pathname.endsWith('/batch')
            ? await service.submitBatch(body.actions)
            : await service.submit(body.action || body), cors);
        } finally {
          inFlight -= 1;
        }
      } else if (config.legacySponsorApi && req.method === 'GET' && /^\/v1\/sponsor\/actions\/0x[0-9a-fA-F]{64}$/.test(url.pathname)) {
        send(res, 200, await service.status(url.pathname.split('/').at(-1)), cors);
      } else if (req.method === 'GET' && url.pathname === '/admin/budget') {
        consumeRateLimit(adminWindows, clientAddress(req, config.trustProxy), 20);
        const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!tokenMatches(bearer, config.adminToken)) throw new RelayError(401, 'admin_auth_failed', 'Administrator authentication failed');
        send(res, 200, service.spendStatus(), cors);
      } else if (req.method === 'POST' && ['/admin/pause', '/admin/resume'].includes(url.pathname)) {
        consumeRateLimit(adminWindows, clientAddress(req, config.trustProxy), 20);
        const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!tokenMatches(bearer, config.adminToken)) throw new RelayError(401, 'admin_auth_failed', 'Administrator authentication failed');
        const body = url.pathname.endsWith('/pause') ? await readJson(req, 2048) : {};
        const state = await ledger.setPaused(url.pathname.endsWith('/pause'), body.reason);
        service.readiness = null;
        log(state.paused ? 'relay_paused' : 'relay_resumed', { requestId, reason: state.reason });
        send(res, 200, state, cors);
      } else {
        throw new RelayError(404, 'not_found', 'Route not found');
      }
      log('relay_request', { requestId, method: req.method, path: url.pathname, status: res.statusCode, durationMs: Date.now() - startedAt });
    } catch (error) {
      const relayError = error instanceof RelayError ? error : new RelayError(500, 'internal_error', 'The relay could not process this request');
      send(res, relayError.status, { error: { code: relayError.code, message: relayError.message, details: relayError.details }, requestId }, cors);
      log('relay_request_failed', { requestId, method: req.method, path: url.pathname, status: relayError.status, code: relayError.code, durationMs: Date.now() - startedAt });
    }
  });
}

export async function startSponsorRelay(env = process.env) {
  const config = parseRelayConfig(env);
  const ledger = await new SponsorBudgetLedger(config.stateFile, config).init();
  const clients = createRelayClients(config);
  const service = new SponsorRelayService({ config, ledger, ...clients, logger: log });
  const server = createSponsorRelayHttpServer({ config, service, ledger });
  server.requestTimeout = 20_000;
  server.headersTimeout = 22_000;
  server.keepAliveTimeout = 5_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });
  log('game_authority_started', { host: config.host, port: config.port });
  return { config, ledger, service, server };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startSponsorRelay().then(({ server }) => {
    let closing = false;
    const shutdown = (signal) => {
      if (closing) return;
      closing = true;
      log('sponsor_relay_stopping', { signal });
      const forced = setTimeout(() => process.exit(1), 10_000);
      forced.unref();
      server.close(() => clearTimeout(forced));
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }).catch((error) => {
    process.stderr.write(`Sponsor relay failed to start: ${error.message}\n`);
    process.exitCode = 1;
  });
}
