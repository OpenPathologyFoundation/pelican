/**
 * Telemetry Governance
 *
 * Three-tier telemetry model for digital pathology with privacy-preserving collection.
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 7
 *
 * Tiers:
 * 1. **Ephemeral Wayfinding** - Local only, never transmitted, for navigation analytics
 * 2. **Workflow Declarations** - Transmitted events for workflow tracking
 * 3. **Minimal Audit Trail** - Required for compliance and patient safety
 *
 * @example
 * ```typescript
 * import { TelemetryManager } from '@pathology/telemetry';
 *
 * const telemetry = new TelemetryManager({
 *   userId: 'user-123',
 *   tiers: {
 *     workflow: { endpoint: '/api/telemetry/workflow' },
 *     audit: { endpoint: '/api/telemetry/audit' }
 *   }
 * });
 *
 * // Tier 1: Local only (never transmitted)
 * telemetry.trackEphemeral('zoom', { viewport: { x: 0.5, y: 0.5, zoom: 10, rotation: 0 } });
 *
 * // Tier 2: Workflow event (batched)
 * telemetry.trackWorkflow('slide-viewed', 'CASE-001', { slideId: 'SLIDE-001' });
 *
 * // Tier 3: Audit event (immediate)
 * await telemetry.trackAudit('sign-out', 'CASE-001', { action: 'case-signed-out' });
 * ```
 */

export { TelemetryManager } from './telemetry-manager';

export type {
  AuditEvent,
  BaseTelemetryEvent,
  EphemeralEvent,
  SessionAnalytics,
  TelemetryConfig,
  TelemetryEvent,
  TelemetryTier,
  TelemetryTransport,
  WorkflowEvent,
} from './types';

export { DEFAULT_TELEMETRY_CONFIG } from './types';
