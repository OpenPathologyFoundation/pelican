/**
 * Telemetry Governance - Telemetry Manager
 *
 * Manages the 3-tier telemetry model with privacy-preserving collection
 */

import type {
  AuditEvent,
  EphemeralEvent,
  SessionAnalytics,
  TelemetryConfig,
  TelemetryEvent,
  TelemetryTransport,
  WorkflowEvent,
} from './types';
import { DEFAULT_TELEMETRY_CONFIG } from './types';

/** Generate unique event ID */
function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Telemetry Manager */
export class TelemetryManager {
  private config: TelemetryConfig;
  private transport: TelemetryTransport | null = null;

  // Tier 1: Ephemeral buffer (local only)
  private ephemeralBuffer: EphemeralEvent[] = [];
  private ephemeralCleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Tier 2: Workflow buffer (for batching)
  private workflowBuffer: WorkflowEvent[] = [];
  private workflowFlushInterval: ReturnType<typeof setInterval> | null = null;

  // Tier 3: Audit events (sent immediately)
  private auditQueue: AuditEvent[] = [];

  // Analytics
  private analytics: SessionAnalytics;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      ...DEFAULT_TELEMETRY_CONFIG,
      ...config,
      sessionId: config.sessionId || this.generateSessionId(),
    };

    this.analytics = {
      sessionId: this.config.sessionId,
      totalViewingTime: 0,
      slideViewTimes: new Map(),
      zoomDistribution: new Map(),
      toolUsage: new Map(),
      shortcutUsage: new Map(),
      viewportCoverage: new Map(),
    };

    this.startIntervals();
  }

  /** Generate session ID */
  private generateSessionId(): string {
    return `telemetry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /** Start cleanup and flush intervals */
  private startIntervals(): void {
    // Ephemeral cleanup
    if (this.config.tiers.ephemeral.enabled) {
      this.ephemeralCleanupInterval = setInterval(() => {
        this.cleanupEphemeral();
      }, 60000); // Every minute
    }

    // Workflow flush
    if (this.config.tiers.workflow.enabled) {
      this.workflowFlushInterval = setInterval(() => {
        this.flushWorkflow();
      }, this.config.tiers.workflow.flushIntervalMs);
    }
  }

  /** Set transport for sending events */
  setTransport(transport: TelemetryTransport): void {
    this.transport = transport;
  }

  /** Track ephemeral event (Tier 1 - never transmitted) */
  trackEphemeral(
    type: EphemeralEvent['type'],
    data: EphemeralEvent['data']
  ): void {
    if (!this.config.enabled || !this.config.tiers.ephemeral.enabled) {
      return;
    }

    const event: EphemeralEvent = {
      id: generateEventId(),
      tier: 'ephemeral',
      timestamp: new Date().toISOString(),
      sessionId: this.config.sessionId,
      type,
      data,
    };

    // Add to buffer with size limit
    this.ephemeralBuffer.push(event);
    if (this.ephemeralBuffer.length > this.config.tiers.ephemeral.maxBufferSize) {
      this.ephemeralBuffer.shift();
    }

    // Update analytics
    this.updateAnalytics(event);
  }

  /** Track workflow event (Tier 2 - batched transmission) */
  trackWorkflow(
    type: WorkflowEvent['type'],
    caseId: string,
    data: WorkflowEvent['data']
  ): void {
    if (!this.config.enabled || !this.config.tiers.workflow.enabled) {
      return;
    }

    if (!this.config.userId) {
      console.warn('[Telemetry] User ID not set for workflow event');
      return;
    }

    const event: WorkflowEvent = {
      id: generateEventId(),
      tier: 'workflow',
      timestamp: new Date().toISOString(),
      sessionId: this.config.sessionId,
      type,
      userId: this.config.userId,
      caseId,
      data,
    };

    this.workflowBuffer.push(event);

    // Flush if batch size reached
    if (this.workflowBuffer.length >= this.config.tiers.workflow.batchSize) {
      this.flushWorkflow();
    }
  }

  /** Track audit event (Tier 3 - immediate transmission) */
  async trackAudit(
    type: AuditEvent['type'],
    caseId: string,
    data: AuditEvent['data'],
    patientId?: string
  ): Promise<void> {
    if (!this.config.enabled || !this.config.tiers.audit.enabled) {
      return;
    }

    if (!this.config.userId) {
      console.warn('[Telemetry] User ID not set for audit event');
      return;
    }

    const event: AuditEvent = {
      id: generateEventId(),
      tier: 'audit',
      timestamp: new Date().toISOString(),
      sessionId: this.config.sessionId,
      type,
      userId: this.config.userId,
      caseId,
      patientId,
      data: {
        ...data,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
      },
    };

    // Add signature if required
    if (this.config.tiers.audit.requireSignature) {
      event.signature = await this.signEvent(event);
    }

    // Send immediately
    if (this.transport) {
      try {
        await this.transport.send([event]);
      } catch (error) {
        console.error('[Telemetry] Failed to send audit event:', error);
        // Queue for retry
        this.auditQueue.push(event);
      }
    } else {
      this.auditQueue.push(event);
    }
  }

  /** Sign audit event for integrity */
  private async signEvent(event: AuditEvent): Promise<string> {
    // Simple hash-based signature (in production, use proper crypto)
    const data = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      userId: event.userId,
      caseId: event.caseId,
      data: event.data,
    });

    // Use SubtleCrypto if available
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback: simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /** Update local analytics from ephemeral events */
  private updateAnalytics(event: EphemeralEvent): void {
    switch (event.type) {
      case 'zoom':
        if (event.data.viewport?.zoom) {
          const zoomLevel = Math.round(event.data.viewport.zoom);
          const count = this.analytics.zoomDistribution.get(zoomLevel) || 0;
          this.analytics.zoomDistribution.set(zoomLevel, count + 1);
        }
        break;

      case 'tool-select':
        if (event.data.tool) {
          const count = this.analytics.toolUsage.get(event.data.tool) || 0;
          this.analytics.toolUsage.set(event.data.tool, count + 1);
        }
        break;

      case 'shortcut-used':
        if (event.data.shortcut) {
          const count = this.analytics.shortcutUsage.get(event.data.shortcut) || 0;
          this.analytics.shortcutUsage.set(event.data.shortcut, count + 1);
        }
        break;
    }
  }

  /** Cleanup old ephemeral events */
  private cleanupEphemeral(): void {
    const cutoff = Date.now() - this.config.tiers.ephemeral.retentionMs;

    this.ephemeralBuffer = this.ephemeralBuffer.filter((event) => {
      return new Date(event.timestamp).getTime() > cutoff;
    });
  }

  /** Flush workflow buffer */
  private async flushWorkflow(): Promise<void> {
    if (this.workflowBuffer.length === 0) return;

    const events = [...this.workflowBuffer];
    this.workflowBuffer = [];

    if (this.transport) {
      try {
        await this.transport.send(events);
      } catch (error) {
        console.error('[Telemetry] Failed to flush workflow events:', error);
        // Re-add to buffer
        this.workflowBuffer.unshift(...events);
      }
    }
  }

  /** Retry failed audit events */
  async retryAuditQueue(): Promise<void> {
    if (this.auditQueue.length === 0 || !this.transport) return;

    const events = [...this.auditQueue];
    this.auditQueue = [];

    try {
      await this.transport.send(events);
    } catch (error) {
      console.error('[Telemetry] Failed to retry audit events:', error);
      this.auditQueue.unshift(...events);
    }
  }

  /** Get session analytics */
  getAnalytics(): SessionAnalytics {
    return { ...this.analytics };
  }

  /** Get ephemeral events (for local analysis only) */
  getEphemeralEvents(): EphemeralEvent[] {
    return [...this.ephemeralBuffer];
  }

  /** Update configuration */
  updateConfig(config: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Set user ID */
  setUserId(userId: string): void {
    this.config.userId = userId;
  }

  /** Destroy manager */
  async destroy(): Promise<void> {
    // Clear intervals
    if (this.ephemeralCleanupInterval) {
      clearInterval(this.ephemeralCleanupInterval);
    }
    if (this.workflowFlushInterval) {
      clearInterval(this.workflowFlushInterval);
    }

    // Flush remaining workflow events
    await this.flushWorkflow();

    // Clear buffers
    this.ephemeralBuffer = [];
    this.workflowBuffer = [];
  }
}
