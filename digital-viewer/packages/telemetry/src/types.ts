/**
 * Telemetry Governance - Type Definitions
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 7
 *
 * Three-tier telemetry model:
 * 1. Ephemeral Wayfinding - Local only, never transmitted, for navigation analytics
 * 2. Workflow Declarations - Transmitted events for workflow tracking
 * 3. Minimal Audit Trail - Required for compliance and patient safety
 */

/** Telemetry tiers */
export type TelemetryTier = 'ephemeral' | 'workflow' | 'audit';

/** Base telemetry event */
export interface BaseTelemetryEvent {
  id: string;
  tier: TelemetryTier;
  timestamp: string;
  sessionId: string;
}

/** Tier 1: Ephemeral Wayfinding Event - Never transmitted */
export interface EphemeralEvent extends BaseTelemetryEvent {
  tier: 'ephemeral';
  type:
    | 'viewport-change'
    | 'zoom'
    | 'pan'
    | 'rotate'
    | 'annotation-hover'
    | 'tool-select'
    | 'shortcut-used';
  data: {
    slideId?: string;
    viewport?: {
      x: number;
      y: number;
      zoom: number;
      rotation: number;
    };
    tool?: string;
    shortcut?: string;
    [key: string]: unknown;
  };
}

/** Tier 2: Workflow Declaration Event - Transmitted for workflow tracking */
export interface WorkflowEvent extends BaseTelemetryEvent {
  tier: 'workflow';
  type:
    | 'case-opened'
    | 'case-closed'
    | 'slide-viewed'
    | 'annotation-created'
    | 'annotation-deleted'
    | 'diagnosis-entered'
    | 'report-generated'
    | 'voice-command';
  userId: string;
  caseId: string;
  data: {
    slideId?: string;
    annotationId?: string;
    annotationType?: string;
    diagnosis?: string;
    command?: string;
    duration?: number;
    [key: string]: unknown;
  };
}

/** Tier 3: Audit Trail Event - Required for compliance */
export interface AuditEvent extends BaseTelemetryEvent {
  tier: 'audit';
  type:
    | 'sign-out'
    | 'amendment'
    | 'access-grant'
    | 'access-revoke'
    | 'phi-access'
    | 'export'
    | 'delete';
  userId: string;
  caseId: string;
  patientId?: string;
  data: {
    action: string;
    reason?: string;
    previousValue?: string;
    newValue?: string;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
  };
  signature?: string; // Digital signature for integrity
}

/** Union type for all telemetry events */
export type TelemetryEvent = EphemeralEvent | WorkflowEvent | AuditEvent;

/** Telemetry configuration */
export interface TelemetryConfig {
  enabled: boolean;
  tiers: {
    ephemeral: {
      enabled: boolean;
      maxBufferSize: number;
      retentionMs: number; // How long to keep locally
    };
    workflow: {
      enabled: boolean;
      batchSize: number;
      flushIntervalMs: number;
      endpoint?: string;
    };
    audit: {
      enabled: boolean;
      endpoint?: string;
      requireSignature: boolean;
    };
  };
  sessionId: string;
  userId?: string;
}

/** Default telemetry configuration */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: true,
  tiers: {
    ephemeral: {
      enabled: true,
      maxBufferSize: 1000,
      retentionMs: 3600000, // 1 hour
    },
    workflow: {
      enabled: true,
      batchSize: 50,
      flushIntervalMs: 30000, // 30 seconds
    },
    audit: {
      enabled: true,
      requireSignature: true,
    },
  },
  sessionId: '',
};

/** Telemetry transport interface */
export interface TelemetryTransport {
  send(events: TelemetryEvent[]): Promise<void>;
  isConnected(): boolean;
}

/** Telemetry analytics (derived from ephemeral data) */
export interface SessionAnalytics {
  sessionId: string;
  totalViewingTime: number;
  slideViewTimes: Map<string, number>;
  zoomDistribution: Map<number, number>;
  toolUsage: Map<string, number>;
  shortcutUsage: Map<string, number>;
  viewportCoverage: Map<string, number>;
}
