/**
 * Focus Declaration Protocol - Session Awareness Service Client (Layer 2)
 *
 * Implements Section 5.2.3 of the specification
 */

import type {
  CaseContext,
  FDPConfig,
  SessionRegistration,
  SessionWarning,
} from './types';

/** Generate a unique window ID */
function generateWindowId(): string {
  return `win-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Session Awareness Service client */
export class SessionClient {
  private ws: WebSocket | null = null;
  private config: FDPConfig;
  private windowId: string;
  private caseContext: CaseContext | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Event callbacks
  private onWarning?: (warning: SessionWarning) => void;
  private onConnected?: () => void;
  private onDisconnected?: () => void;

  constructor(config: FDPConfig) {
    this.config = config;
    this.windowId = generateWindowId();
  }

  /** Set event handlers */
  setEventHandlers(handlers: {
    onWarning?: (warning: SessionWarning) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }): void {
    this.onWarning = handlers.onWarning;
    this.onConnected = handlers.onConnected;
    this.onDisconnected = handlers.onDisconnected;
  }

  /** Connect to the Session Awareness Service */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.sessionServiceUrl) {
        reject(new Error('Session service URL not configured'));
        return;
      }

      try {
        this.ws = new WebSocket(this.config.sessionServiceUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.onConnected?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[FDP] WebSocket error:', error);
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.onDisconnected?.();
          this.scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /** Handle incoming messages */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'warning':
          this.onWarning?.(message.payload as SessionWarning);
          break;

        case 'ack':
          // Registration/heartbeat acknowledged
          break;

        case 'error':
          console.error('[FDP] Session service error:', message.payload);
          break;

        default:
          console.warn('[FDP] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[FDP] Failed to parse message:', error);
    }
  }

  /** Register a case with the session service */
  register(caseContext: CaseContext): void {
    this.caseContext = caseContext;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[FDP] Cannot register: WebSocket not connected');
      return;
    }

    if (!this.config.userId) {
      console.warn('[FDP] Cannot register: User ID not configured');
      return;
    }

    const registration: SessionRegistration = {
      userId: this.config.userId,
      caseId: caseContext.caseId,
      patientIdentifier: caseContext.patientName,
      viewerType: 'pathology-viewer',
      windowId: this.windowId,
      openedAt: new Date().toISOString(),
    };

    this.send('register', registration);
  }

  /** Deregister the current case */
  deregister(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.send('deregister', { windowId: this.windowId });
    this.caseContext = null;
  }

  /** Send a heartbeat */
  private sendHeartbeat(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.send('heartbeat', {
      windowId: this.windowId,
      focusedAt: new Date().toISOString(),
    });
  }

  /** Start heartbeat interval */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /** Stop heartbeat interval */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /** Schedule a reconnect attempt */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[FDP] Max reconnect attempts reached');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      console.log(
        `[FDP] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
      );
      this.connect()
        .then(() => {
          // Re-register if we had a case context
          if (this.caseContext) {
            this.register(this.caseContext);
          }
        })
        .catch(() => {
          // Will trigger another reconnect via onclose
        });
    }, delay);
  }

  /** Send a message to the session service */
  private send(type: string, payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[FDP] Cannot send: WebSocket not connected');
      return;
    }

    this.ws.send(JSON.stringify({ type, payload }));
  }

  /** Update configuration */
  updateConfig(config: Partial<FDPConfig>): void {
    const oldUrl = this.config.sessionServiceUrl;
    this.config = { ...this.config, ...config };

    // Reconnect if URL changed
    if (config.sessionServiceUrl && config.sessionServiceUrl !== oldUrl) {
      this.disconnect();
      this.connect();
    }
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Get window ID */
  getWindowId(): string {
    return this.windowId;
  }

  /** Disconnect from the session service */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      // Send deregister before closing
      if (this.ws.readyState === WebSocket.OPEN) {
        this.deregister();
      }

      this.ws.close();
      this.ws = null;
    }
  }

  /** Destroy the client */
  destroy(): void {
    this.disconnect();
    this.caseContext = null;
    this.onWarning = undefined;
    this.onConnected = undefined;
    this.onDisconnected = undefined;
  }
}
