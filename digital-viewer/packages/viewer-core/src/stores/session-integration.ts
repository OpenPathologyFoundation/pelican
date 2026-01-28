/**
 * Session Integration for Viewer Core
 *
 * Provides integration with the FDP Session Awareness Service (Layer 2).
 * Handles session registration, heartbeat, and multi-case warnings.
 *
 * Requirements:
 * - SYS-SES-001: Register with Session Awareness Service upon opening a case
 * - SYS-SES-002: Send heartbeat every 30 seconds
 * - SYS-SES-003: Deregister upon closing viewer
 * - SYS-SES-004: Display multi-case warning
 * - SYS-SES-005: Require explicit confirmation before switching cases
 */

import { writable, type Writable, type Readable, derived, get } from 'svelte/store';

/** Session warning types */
export type SessionWarningType = 'multi-case' | 'case-mismatch' | 'stale-window';

/** Session warning */
export interface SessionWarning {
  type: SessionWarningType;
  message: string;
  cases?: string[];
  windowId?: string;
}

/** Session state */
export interface SessionState {
  connected: boolean;
  windowId: string | null;
  caseId: string | null;
  userId: string | null;
  warning: SessionWarning | null;
  lastHeartbeat: Date | null;
}

/** Session handler interface */
export interface SessionHandler {
  /** Connect to session service */
  connect(): Promise<void>;
  /** Register a case */
  register(caseId: string, patientName: string): void;
  /** Deregister current case */
  deregister(): void;
  /** Check if connected */
  isConnected(): boolean;
  /** Get window ID */
  getWindowId(): string;
  /** Destroy session handler */
  destroy(): void;
}

/** Generate a unique window ID */
function generateWindowId(): string {
  return `win-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** No-op session handler for when session service is not configured */
const noopHandler: SessionHandler = {
  connect: async () => {},
  register: () => {},
  deregister: () => {},
  isConnected: () => false,
  getWindowId: () => '',
  destroy: () => {},
};

/** Current session handler */
let currentHandler: SessionHandler = noopHandler;

/** Session state store */
export const sessionState: Writable<SessionState> = writable({
  connected: false,
  windowId: null,
  caseId: null,
  userId: null,
  warning: null,
  lastHeartbeat: null,
});

/** Derived: Is session connected */
export const sessionConnected: Readable<boolean> = derived(
  sessionState,
  ($state) => $state.connected
);

/** Derived: Has active warning */
export const hasSessionWarning: Readable<boolean> = derived(
  sessionState,
  ($state) => $state.warning !== null
);

/** Derived: Current warning */
export const sessionWarning: Readable<SessionWarning | null> = derived(
  sessionState,
  ($state) => $state.warning
);

/** Warning listeners */
const warningListeners: Set<(warning: SessionWarning) => void> = new Set();

/**
 * Configure session with a handler
 *
 * @example
 * ```typescript
 * import { SessionClient } from '@pathology/fdp-lib';
 * import { configureSession } from '@pathology/viewer-core';
 *
 * const client = new SessionClient({ sessionServiceUrl: 'wss://...' });
 * configureSession({
 *   connect: () => client.connect(),
 *   register: (caseId, patientName) => client.register({ caseId, patientName }),
 *   deregister: () => client.deregister(),
 *   isConnected: () => client.isConnected(),
 *   getWindowId: () => client.getWindowId(),
 *   destroy: () => client.destroy(),
 * });
 * ```
 */
export function configureSession(handler: SessionHandler): void {
  currentHandler = handler;
}

/**
 * Connect to session service
 */
export async function connectSession(): Promise<void> {
  try {
    await currentHandler.connect();
    sessionState.update((state) => ({
      ...state,
      connected: true,
      windowId: currentHandler.getWindowId(),
    }));
  } catch (error) {
    console.error('[Session] Failed to connect:', error);
    sessionState.update((state) => ({
      ...state,
      connected: false,
    }));
  }
}

/**
 * Register a case with the session service (SYS-SES-001)
 */
export function registerCase(caseId: string, patientName: string, userId?: string): void {
  currentHandler.register(caseId, patientName);
  sessionState.update((state) => ({
    ...state,
    caseId,
    userId: userId ?? state.userId,
    lastHeartbeat: new Date(),
  }));
}

/**
 * Deregister from session service (SYS-SES-003)
 */
export function deregisterCase(): void {
  currentHandler.deregister();
  sessionState.update((state) => ({
    ...state,
    caseId: null,
    warning: null,
  }));
}

/**
 * Set a warning from the session service (SYS-SES-004)
 */
export function setSessionWarning(warning: SessionWarning | null): void {
  sessionState.update((state) => ({
    ...state,
    warning,
  }));

  // Notify listeners
  if (warning) {
    warningListeners.forEach((listener) => listener(warning));
  }
}

/**
 * Clear the current warning
 */
export function clearSessionWarning(): void {
  setSessionWarning(null);
}

/**
 * Subscribe to warning events
 */
export function onSessionWarning(callback: (warning: SessionWarning) => void): () => void {
  warningListeners.add(callback);
  return () => warningListeners.delete(callback);
}

/**
 * Update heartbeat timestamp (called by heartbeat interval)
 */
export function updateHeartbeat(): void {
  sessionState.update((state) => ({
    ...state,
    lastHeartbeat: new Date(),
  }));
}

/**
 * Destroy session and cleanup
 */
export function destroySession(): void {
  currentHandler.destroy();
  currentHandler = noopHandler;
  sessionState.set({
    connected: false,
    windowId: null,
    caseId: null,
    userId: null,
    warning: null,
    lastHeartbeat: null,
  });
  warningListeners.clear();
}

/**
 * Get session info for debugging
 */
export function getSessionInfo(): SessionState {
  return get(sessionState);
}

// ============ Built-in WebSocket Session Handler ============

/**
 * Create a WebSocket-based session handler
 *
 * @example
 * ```typescript
 * const handler = createWebSocketSessionHandler({
 *   url: 'wss://session.example.com/ws',
 *   userId: 'user-123',
 *   heartbeatInterval: 30000,
 * });
 * configureSession(handler);
 * await connectSession();
 * ```
 */
export interface WebSocketSessionConfig {
  /** WebSocket URL */
  url: string;
  /** User ID */
  userId: string;
  /** Heartbeat interval in ms (default: 30000 per SYS-SES-002) */
  heartbeatInterval?: number;
  /** On warning callback */
  onWarning?: (warning: SessionWarning) => void;
  /** On connected callback */
  onConnected?: () => void;
  /** On disconnected callback */
  onDisconnected?: () => void;
}

export function createWebSocketSessionHandler(
  config: WebSocketSessionConfig
): SessionHandler {
  const heartbeatInterval = config.heartbeatInterval ?? 30000; // 30s default per SYS-SES-002
  const windowId = generateWindowId();

  let ws: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let caseContext: { caseId: string; patientName: string } | null = null;

  function sendMessage(type: string, payload: unknown): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  function startHeartbeat(): void {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      sendMessage('heartbeat', {
        windowId,
        focusedAt: new Date().toISOString(),
      });
      updateHeartbeat();
    }, heartbeatInterval);
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  return {
    async connect(): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          ws = new WebSocket(config.url);

          ws.onopen = () => {
            startHeartbeat();
            config.onConnected?.();
            resolve();
          };

          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              if (message.type === 'warning') {
                const warning = message.payload as SessionWarning;
                setSessionWarning(warning);
                config.onWarning?.(warning);
              }
            } catch (e) {
              console.error('[Session] Failed to parse message:', e);
            }
          };

          ws.onerror = () => {
            reject(new Error('WebSocket connection failed'));
          };

          ws.onclose = () => {
            stopHeartbeat();
            sessionState.update((state) => ({ ...state, connected: false }));
            config.onDisconnected?.();
          };
        } catch (error) {
          reject(error);
        }
      });
    },

    register(caseId: string, patientName: string): void {
      caseContext = { caseId, patientName };
      sendMessage('register', {
        userId: config.userId,
        caseId,
        patientIdentifier: patientName,
        viewerType: 'pathology-viewer',
        windowId,
        openedAt: new Date().toISOString(),
      });
    },

    deregister(): void {
      sendMessage('deregister', { windowId });
      caseContext = null;
    },

    isConnected(): boolean {
      return ws?.readyState === WebSocket.OPEN;
    },

    getWindowId(): string {
      return windowId;
    },

    destroy(): void {
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          sendMessage('deregister', { windowId });
        }
        ws.close();
        ws = null;
      }
      stopHeartbeat();
      caseContext = null;
    },
  };
}
