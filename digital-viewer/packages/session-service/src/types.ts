/**
 * Session Awareness Service - Type Definitions
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 5.2.3
 */

/** Case information for registration */
export interface CaseInfo {
  caseId: string;
  patientName: string;
  slideId?: string;
  location?: string;
}

/** Session registration from a client window */
export interface SessionRegistration {
  userId: string;
  caseId: string;
  patientIdentifier: string;
  viewerType: string;
  windowId: string;
  openedAt: string;
}

/** Stored registration with metadata */
export interface StoredRegistration extends SessionRegistration {
  connectionId: string;
  lastHeartbeat: number;
  caseInfo: CaseInfo;
}

/** Warning types */
export type WarningType = 'multi-case' | 'case-mismatch' | 'stale-window';

/** Warning sent to clients */
export interface SessionWarning {
  type: WarningType;
  message: string;
  cases?: CaseInfo[];
  targetWindowId?: string;
}

/** Incoming message types */
export type IncomingMessageType =
  | 'register'
  | 'deregister'
  | 'heartbeat'
  | 'focus';

/** Incoming message from client */
export interface IncomingMessage {
  type: IncomingMessageType;
  payload: unknown;
}

/** Registration payload */
export interface RegisterPayload {
  userId: string;
  caseId: string;
  patientIdentifier: string;
  viewerType: string;
  windowId: string;
  openedAt: string;
}

/** Deregister payload */
export interface DeregisterPayload {
  windowId: string;
}

/** Heartbeat payload */
export interface HeartbeatPayload {
  windowId: string;
  focusedAt: string;
}

/** Focus change payload */
export interface FocusPayload {
  windowId: string;
  caseId: string;
}

/** Outgoing message types */
export type OutgoingMessageType = 'ack' | 'warning' | 'error' | 'sync';

/** Outgoing message to client */
export interface OutgoingMessage {
  type: OutgoingMessageType;
  payload: unknown;
}

/** Server configuration */
export interface ServerConfig {
  port: number;
  host: string;
  heartbeatTimeout: number; // ms before considering a window stale
  cleanupInterval: number; // ms between cleanup runs
  maxConnectionsPerUser: number;
}

/** Default server configuration */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 8765,
  host: '0.0.0.0',
  heartbeatTimeout: 60000, // 1 minute
  cleanupInterval: 30000, // 30 seconds
  maxConnectionsPerUser: 10,
};
