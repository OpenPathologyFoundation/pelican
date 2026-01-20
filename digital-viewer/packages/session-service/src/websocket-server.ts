/**
 * Session Awareness Service - WebSocket Server
 *
 * WebSocket server implementation for FDP Layer 2
 */

import { WebSocketServer, WebSocket } from 'ws';
import { SessionStore } from './session-store';
import { SessionManager } from './session-manager';
import type {
  DeregisterPayload,
  FocusPayload,
  HeartbeatPayload,
  IncomingMessage,
  OutgoingMessage,
  RegisterPayload,
  ServerConfig,
  SessionWarning,
} from './types';

/** Extended WebSocket with connection ID */
interface ExtendedWebSocket extends WebSocket {
  connectionId: string;
  userId?: string;
  isAlive: boolean;
}

/** Generate unique connection ID */
function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Session Awareness WebSocket Server */
export class SessionAwarenessServer {
  private wss: WebSocketServer | null = null;
  private store: SessionStore;
  private manager: SessionManager;
  private config: ServerConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Connection map: connectionId -> WebSocket
  private connections: Map<string, ExtendedWebSocket> = new Map();

  constructor(config: ServerConfig) {
    this.config = config;
    this.store = new SessionStore();
    this.manager = new SessionManager(this.store, config);
  }

  /** Start the server */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.config.port,
          host: this.config.host,
        });

        this.wss.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws as ExtendedWebSocket);
        });

        this.wss.on('error', (error) => {
          console.error('[SessionService] Server error:', error);
          reject(error);
        });

        this.wss.on('listening', () => {
          console.log(
            `[SessionService] Listening on ${this.config.host}:${this.config.port}`
          );

          // Start cleanup interval
          this.startCleanupInterval();

          // Start ping interval for connection health
          this.startPingInterval();

          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /** Handle new connection */
  private handleConnection(ws: ExtendedWebSocket): void {
    ws.connectionId = generateConnectionId();
    ws.isAlive = true;
    this.connections.set(ws.connectionId, ws);

    console.log(`[SessionService] New connection: ${ws.connectionId}`);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      this.handleClose(ws);
    });

    ws.on('error', (error) => {
      console.error(
        `[SessionService] Connection error (${ws.connectionId}):`,
        error
      );
    });
  }

  /** Handle incoming message */
  private handleMessage(ws: ExtendedWebSocket, data: string): void {
    let message: IncomingMessage;

    try {
      message = JSON.parse(data);
    } catch {
      this.send(ws, { type: 'error', payload: { message: 'Invalid JSON' } });
      return;
    }

    switch (message.type) {
      case 'register':
        this.handleRegister(ws, message.payload as RegisterPayload);
        break;

      case 'deregister':
        this.handleDeregister(ws, message.payload as DeregisterPayload);
        break;

      case 'heartbeat':
        this.handleHeartbeat(ws, message.payload as HeartbeatPayload);
        break;

      case 'focus':
        this.handleFocus(ws, message.payload as FocusPayload);
        break;

      default:
        this.send(ws, {
          type: 'error',
          payload: { message: `Unknown message type: ${message.type}` },
        });
    }
  }

  /** Handle register message */
  private handleRegister(ws: ExtendedWebSocket, payload: RegisterPayload): void {
    ws.userId = payload.userId;

    const result = this.manager.register(ws.connectionId, payload);

    // Send acknowledgment
    this.send(ws, {
      type: 'ack',
      payload: { windowId: payload.windowId, registered: true },
    });

    // Send warnings to affected connections
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        this.broadcastToConnections(result.affectedConnectionIds, {
          type: 'warning',
          payload: warning,
        });
      }
    }

    // Send initial sync of user's state
    const userState = this.manager.getUserState(payload.userId);
    if (userState.length > 1) {
      this.send(ws, {
        type: 'sync',
        payload: {
          registrations: userState.map((r) => ({
            windowId: r.windowId,
            caseId: r.caseId,
            patientName: r.patientIdentifier,
            viewerType: r.viewerType,
          })),
        },
      });
    }

    console.log(
      `[SessionService] Registered: user=${payload.userId}, window=${payload.windowId}, case=${payload.caseId}`
    );
  }

  /** Handle deregister message */
  private handleDeregister(
    ws: ExtendedWebSocket,
    payload: DeregisterPayload
  ): void {
    const result = this.manager.deregister(payload.windowId, ws.userId);

    // Send acknowledgment
    this.send(ws, {
      type: 'ack',
      payload: { windowId: payload.windowId, deregistered: true },
    });

    // Send updated warnings to affected connections
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        this.broadcastToConnections(result.affectedConnectionIds, {
          type: 'warning',
          payload: warning,
        });
      }
    }

    if (result.removed) {
      console.log(
        `[SessionService] Deregistered: window=${payload.windowId}`
      );
    }
  }

  /** Handle heartbeat message */
  private handleHeartbeat(
    ws: ExtendedWebSocket,
    payload: HeartbeatPayload
  ): void {
    const updated = this.manager.updateHeartbeat(payload.windowId, ws.userId);

    this.send(ws, {
      type: 'ack',
      payload: { windowId: payload.windowId, heartbeat: updated },
    });
  }

  /** Handle focus change message */
  private handleFocus(ws: ExtendedWebSocket, payload: FocusPayload): void {
    if (!ws.userId) {
      this.send(ws, {
        type: 'error',
        payload: { message: 'Not registered' },
      });
      return;
    }

    const result = this.manager.handleFocusChange(
      ws.userId,
      payload.windowId,
      payload.caseId
    );

    if (result.warning) {
      this.broadcastToConnections(result.affectedConnectionIds, {
        type: 'warning',
        payload: result.warning,
      });
    }
  }

  /** Handle connection close */
  private handleClose(ws: ExtendedWebSocket): void {
    console.log(`[SessionService] Connection closed: ${ws.connectionId}`);

    const result = this.manager.handleConnectionClose(ws.connectionId);
    this.connections.delete(ws.connectionId);

    // Notify remaining connections of updated warnings
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        this.broadcastToConnections(result.affectedConnectionIds, {
          type: 'warning',
          payload: warning,
        });
      }
    }
  }

  /** Send message to a single connection */
  private send(ws: ExtendedWebSocket, message: OutgoingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /** Broadcast message to specific connections */
  private broadcastToConnections(
    connectionIds: string[],
    message: OutgoingMessage
  ): void {
    for (const connId of connectionIds) {
      const ws = this.connections.get(connId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  /** Broadcast message to all connections */
  private broadcastAll(message: OutgoingMessage): void {
    const data = JSON.stringify(message);
    for (const [, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /** Start cleanup interval */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const result = this.manager.cleanup();

      if (result.removed.length > 0) {
        console.log(
          `[SessionService] Cleaned up ${result.removed.length} stale registrations`
        );
      }
    }, this.config.cleanupInterval);
  }

  /** Start ping interval for connection health */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      for (const [connId, ws] of this.connections) {
        if (!ws.isAlive) {
          console.log(`[SessionService] Terminating dead connection: ${connId}`);
          ws.terminate();
          this.connections.delete(connId);
          continue;
        }

        ws.isAlive = false;
        ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  /** Get server statistics */
  getStats(): {
    connections: number;
    registrations: number;
    users: number;
  } {
    const managerStats = this.manager.getStats();
    return {
      connections: this.connections.size,
      registrations: managerStats.totalRegistrations,
      users: managerStats.activeUsers,
    };
  }

  /** Stop the server */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Close all connections
      for (const [, ws] of this.connections) {
        ws.close(1000, 'Server shutting down');
      }
      this.connections.clear();

      // Close server
      if (this.wss) {
        this.wss.close(() => {
          console.log('[SessionService] Server stopped');
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
