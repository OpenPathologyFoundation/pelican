/**
 * Session Awareness Service
 *
 * WebSocket hub for FDP Layer 2 cross-context awareness.
 * Tracks open cases per user and broadcasts warnings for multi-case
 * and case-mismatch scenarios.
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 5.2.3
 *
 * @example
 * ```typescript
 * import { SessionAwarenessServer } from '@pathology/session-service';
 *
 * const server = new SessionAwarenessServer({
 *   port: 8765,
 *   host: '0.0.0.0',
 *   heartbeatTimeout: 60000,
 *   cleanupInterval: 30000,
 *   maxConnectionsPerUser: 10,
 * });
 *
 * await server.start();
 *
 * // Get statistics
 * console.log(server.getStats());
 *
 * // Graceful shutdown
 * await server.stop();
 * ```
 */

export { SessionAwarenessServer } from './websocket-server';
export { SessionManager } from './session-manager';
export { SessionStore } from './session-store';
export type {
  CaseInfo,
  DeregisterPayload,
  FocusPayload,
  HeartbeatPayload,
  IncomingMessage,
  OutgoingMessage,
  RegisterPayload,
  ServerConfig,
  SessionRegistration,
  SessionWarning,
  StoredRegistration,
  WarningType,
} from './types';
export { DEFAULT_SERVER_CONFIG } from './types';
