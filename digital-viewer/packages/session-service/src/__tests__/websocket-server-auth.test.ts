/**
 * Integration tests for SessionAwarenessServer + JWT authentication.
 *
 * Spins up a real WebSocket server on a random port and drives it with the
 * `ws` client to verify the register handler rejects/accepts as expected.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { WebSocket } from 'ws';
import { SessionAwarenessServer } from '../websocket-server';
import { DEFAULT_SERVER_CONFIG, type ServerConfig } from '../types';

const SECRET = 'z'.repeat(48);
const AUDIENCE = 'starling-tile-server';
const ISSUER = 'starling';

async function mintToken(sub: string): Promise<string> {
  const key = new TextEncoder().encode(SECRET);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .sign(key);
}

async function startServer(overrides: Partial<ServerConfig> = {}): Promise<{
  server: SessionAwarenessServer;
  url: string;
}> {
  const config: ServerConfig = {
    ...DEFAULT_SERVER_CONFIG,
    port: 0,
    host: '127.0.0.1',
    jwtEnabled: true,
    jwtSecret: SECRET,
    jwtAudience: AUDIENCE,
    jwtIssuer: ISSUER,
    ...overrides,
  };

  const server = new SessionAwarenessServer(config);
  await server.start();
  const addr = server.address();
  if (!addr) throw new Error('server address unavailable');
  return { server, url: `ws://${addr.host}:${addr.port}` };
}

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function nextMessage(ws: WebSocket, timeoutMs = 1500): Promise<{
  type: string;
  payload: Record<string, unknown>;
}> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
    ws.once('message', (data: Buffer) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function nextClose(ws: WebSocket, timeoutMs = 1500): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for close')), timeoutMs);
    ws.once('close', (code: number, reason: Buffer) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
}

async function send(ws: WebSocket, payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.send(JSON.stringify(payload), (err) => (err ? reject(err) : resolve()));
  });
}

describe('SessionAwarenessServer — JWT auth', () => {
  let server: SessionAwarenessServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  describe('jwtEnabled: true', () => {
    it('rejects register without a token and closes the socket', async () => {
      const started = await startServer();
      server = started.server;
      const ws = await connect(started.url);

      await send(ws, {
        type: 'register',
        payload: {
          userId: 'attacker',
          caseId: 'C1',
          patientIdentifier: 'X',
          viewerType: 'v',
          windowId: 'w1',
          openedAt: new Date().toISOString(),
        },
      });

      const errMsg = await nextMessage(ws);
      expect(errMsg.type).toBe('error');
      expect(errMsg.payload).toMatchObject({ reason: 'missing' });

      const close = await nextClose(ws);
      expect(close.code).toBe(1008);
    });

    it('accepts a valid token and uses sub claim as authoritative userId', async () => {
      const started = await startServer();
      server = started.server;
      const ws = await connect(started.url);

      const token = await mintToken('identity-real');

      await send(ws, {
        type: 'register',
        payload: {
          token,
          userId: 'identity-claimed-by-client', // should be overridden by sub
          caseId: 'C1',
          patientIdentifier: 'X',
          viewerType: 'v',
          windowId: 'w1',
          openedAt: new Date().toISOString(),
        },
      });

      const ack = await nextMessage(ws);
      expect(ack.type).toBe('ack');
      expect(ack.payload).toMatchObject({ windowId: 'w1', registered: true });

      expect(server.getStats().users).toBe(1);
      ws.close();
    });

    it('rejects a token signed with a wrong secret', async () => {
      const started = await startServer();
      server = started.server;
      const ws = await connect(started.url);

      const foreignKey = new TextEncoder().encode('w'.repeat(48));
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setSubject('any')
        .sign(foreignKey);

      await send(ws, {
        type: 'register',
        payload: {
          token,
          userId: 'any',
          caseId: 'C1',
          patientIdentifier: 'X',
          viewerType: 'v',
          windowId: 'w1',
          openedAt: new Date().toISOString(),
        },
      });

      const errMsg = await nextMessage(ws);
      expect(errMsg.type).toBe('error');
      expect(errMsg.payload).toMatchObject({ reason: 'invalid' });
    });

    it('refuses to construct with jwtEnabled but no secret', () => {
      expect(() =>
        new SessionAwarenessServer({
          ...DEFAULT_SERVER_CONFIG,
          jwtEnabled: true,
        })
      ).toThrow(/jwtSecret is missing/);
    });
  });

  describe('jwtEnabled: false (dev fallback)', () => {
    it('accepts register with client-supplied userId', async () => {
      const started = await startServer({ jwtEnabled: false, jwtSecret: undefined });
      server = started.server;
      const ws = await connect(started.url);

      await send(ws, {
        type: 'register',
        payload: {
          userId: 'dev-user',
          caseId: 'C1',
          patientIdentifier: 'X',
          viewerType: 'v',
          windowId: 'w1',
          openedAt: new Date().toISOString(),
        },
      });

      const ack = await nextMessage(ws);
      expect(ack.type).toBe('ack');
      ws.close();
    });
  });
});
