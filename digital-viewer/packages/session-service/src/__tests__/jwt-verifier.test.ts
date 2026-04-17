/**
 * Tests for the JWT verifier used to authenticate session-service register messages.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import { createJwtVerifier, JwtVerificationError } from '../jwt-verifier';

const SECRET = 'x'.repeat(48); // >=32 chars required
const OTHER_SECRET = 'y'.repeat(48);
const AUDIENCE = 'starling-tile-server';
const ISSUER = 'starling';

async function mintToken(overrides: {
  secret?: string;
  sub?: string | null;
  audience?: string;
  issuer?: string;
  expiresInSec?: number;
} = {}): Promise<string> {
  const key = new TextEncoder().encode(overrides.secret ?? SECRET);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (overrides.expiresInSec ?? 300);

  const jwt = new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer(overrides.issuer ?? ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE);

  if (overrides.sub !== null) {
    jwt.setSubject(overrides.sub ?? 'user-under-test');
  }

  return jwt.sign(key);
}

describe('createJwtVerifier', () => {
  const verify = createJwtVerifier({
    secret: SECRET,
    audience: AUDIENCE,
    issuer: ISSUER,
  });

  it('rejects when secret is too short', () => {
    expect(() =>
      createJwtVerifier({ secret: 'short', audience: AUDIENCE, issuer: ISSUER })
    ).toThrow(/at least 32 characters/);
  });

  it('accepts a well-formed token and returns the sub claim as userId', async () => {
    const token = await mintToken({ sub: 'identity-42' });
    const identity = await verify(token);
    expect(identity.userId).toBe('identity-42');
    expect(identity.claims.iss).toBe(ISSUER);
    expect(identity.claims.aud).toBe(AUDIENCE);
  });

  it('rejects when the token is missing', async () => {
    await expect(verify(undefined)).rejects.toMatchObject({
      name: 'JwtVerificationError',
      reason: 'missing',
    });
  });

  it('rejects an expired token', async () => {
    const token = await mintToken({ expiresInSec: -1 });
    await expect(verify(token)).rejects.toMatchObject({
      name: 'JwtVerificationError',
      reason: 'expired',
    });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await mintToken({ secret: OTHER_SECRET });
    await expect(verify(token)).rejects.toMatchObject({
      name: 'JwtVerificationError',
      reason: 'invalid',
    });
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await mintToken({ audience: 'some-other-service' });
    await expect(verify(token)).rejects.toMatchObject({
      name: 'JwtVerificationError',
      reason: 'invalid',
    });
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await mintToken({ issuer: 'not-starling' });
    await expect(verify(token)).rejects.toMatchObject({
      name: 'JwtVerificationError',
      reason: 'invalid',
    });
  });

  it('rejects a token without a sub claim', async () => {
    const token = await mintToken({ sub: null });
    await expect(verify(token)).rejects.toMatchObject({
      name: 'JwtVerificationError',
      reason: 'sub-missing',
    });
  });

  it('rejects a tampered token', async () => {
    const token = await mintToken({ sub: 'identity-42' });
    const parts = token.split('.');
    // Flip a byte in the payload (middle section)
    const tampered = parts[0] + '.' + parts[1].slice(0, -1) + 'A' + '.' + parts[2];
    await expect(verify(tampered)).rejects.toMatchObject({
      name: 'JwtVerificationError',
    });
  });

  it('JwtVerificationError is throwable and catchable as Error', async () => {
    try {
      await verify(undefined);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(JwtVerificationError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
