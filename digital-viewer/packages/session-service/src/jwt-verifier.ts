/**
 * JWT verification for the Session Awareness Service.
 *
 * The orchestrator (`starling-auth`) mints HS256 tokens via `/auth/token`;
 * the digital viewer forwards them on the `register` WebSocket message and
 * we verify them here before trusting the caller's claimed identity.
 */

import { jwtVerify } from 'jose';

export interface VerifierConfig {
  secret: string;
  audience?: string;
  issuer?: string;
}

export interface VerifiedIdentity {
  /** JWT `sub` claim — the authoritative user identity. */
  userId: string;
  /** Full decoded claim set (roles, permissions, etc.). */
  claims: Record<string, unknown>;
}

export class JwtVerificationError extends Error {
  constructor(message: string, readonly reason: 'missing' | 'invalid' | 'expired' | 'sub-missing') {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

export type JwtVerifier = (token: string | undefined) => Promise<VerifiedIdentity>;

/**
 * Build a JWT verifier bound to the given secret/audience/issuer.
 *
 * Returns a function that validates signature, exp, aud, and iss, and
 * requires a non-empty `sub` claim. Throws {@link JwtVerificationError}
 * for every failure mode the caller might need to distinguish.
 */
export function createJwtVerifier(config: VerifierConfig): JwtVerifier {
  if (!config.secret || config.secret.length < 32) {
    throw new Error(
      'JWT secret must be at least 32 characters for HS256 (matches auth-system JwtConfig)'
    );
  }
  const secretKey = new TextEncoder().encode(config.secret);

  return async (token) => {
    if (!token) {
      throw new JwtVerificationError('token missing', 'missing');
    }

    let payload: Record<string, unknown>;
    try {
      const result = await jwtVerify(token, secretKey, {
        algorithms: ['HS256'],
        audience: config.audience,
        issuer: config.issuer,
      });
      payload = result.payload as Record<string, unknown>;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'ERR_JWT_EXPIRED') {
        throw new JwtVerificationError('token expired', 'expired');
      }
      throw new JwtVerificationError(
        `token invalid: ${(err as Error).message}`,
        'invalid'
      );
    }

    const sub = payload.sub;
    if (typeof sub !== 'string' || sub.length === 0) {
      throw new JwtVerificationError('token has no sub claim', 'sub-missing');
    }

    return { userId: sub, claims: payload };
  };
}
