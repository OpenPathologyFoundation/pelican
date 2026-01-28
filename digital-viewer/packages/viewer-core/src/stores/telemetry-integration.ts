/**
 * Telemetry Integration for Viewer Core
 *
 * Provides hooks to wire telemetry tracking into viewer components.
 * Ensures compliance with SRS Telemetry requirements:
 * - SYS-TEL-002: NO Tier 1 (ephemeral) data transmitted
 * - SYS-TEL-003: Tier 1 purged on session close
 * - SYS-TEL-004: NO tile coordinates in audit logs
 * - SYS-TEL-005: NO viewing duration calculated or stored
 */

import { writable, type Writable } from 'svelte/store';

/**
 * Telemetry event types for the viewer
 * (mirrors the TelemetryManager types for decoupling)
 */
export type ViewerTelemetryEvent =
  | { tier: 'ephemeral'; type: 'zoom'; data: { zoom: number } }
  | { tier: 'ephemeral'; type: 'pan'; data: { direction: string } }
  | { tier: 'ephemeral'; type: 'rotate'; data: { degrees: number } }
  | { tier: 'ephemeral'; type: 'tool-select'; data: { tool: string } }
  | { tier: 'ephemeral'; type: 'shortcut-used'; data: { shortcut: string } }
  | { tier: 'workflow'; type: 'case-opened'; caseId: string; data: { source?: string } }
  | { tier: 'workflow'; type: 'case-closed'; caseId: string; data: Record<string, unknown> }
  | { tier: 'workflow'; type: 'slide-viewed'; caseId: string; data: { slideId: string } }
  | { tier: 'workflow'; type: 'annotation-created'; caseId: string; data: { annotationId: string; type: string } }
  | { tier: 'workflow'; type: 'measurement-created'; caseId: string; data: { measurementId: string; type: string } }
  | { tier: 'workflow'; type: 'dx-mode-changed'; caseId: string; data: { enabled: boolean; reason: string } }
  | { tier: 'audit'; type: 'sign-out'; caseId: string; data: { action: string } }
  | { tier: 'audit'; type: 'dx-mode-opt-out'; caseId: string; data: { reason: string; attestation: string } };

/**
 * Telemetry handler interface
 * Implement this to integrate with your telemetry backend
 */
export interface TelemetryHandler {
  /** Track ephemeral event (local only, never transmitted per SYS-TEL-002) */
  trackEphemeral(type: string, data: Record<string, unknown>): void;
  /** Track workflow event (batched transmission) */
  trackWorkflow(type: string, caseId: string, data: Record<string, unknown>): void;
  /** Track audit event (immediate transmission) */
  trackAudit(type: string, caseId: string, data: Record<string, unknown>): Promise<void>;
  /** Destroy/cleanup handler (purges Tier 1 per SYS-TEL-003) */
  destroy(): Promise<void>;
}

/**
 * No-op telemetry handler for when telemetry is disabled
 */
const noopHandler: TelemetryHandler = {
  trackEphemeral: () => {},
  trackWorkflow: () => {},
  trackAudit: async () => {},
  destroy: async () => {},
};

/** Current telemetry handler */
let currentHandler: TelemetryHandler = noopHandler;

/** Store for telemetry enabled state */
export const telemetryEnabled: Writable<boolean> = writable(false);

/**
 * Configure telemetry with a handler
 *
 * @example
 * ```typescript
 * import { TelemetryManager } from '@pathology/telemetry';
 * import { configureTelemetry } from '@pathology/viewer-core';
 *
 * const manager = new TelemetryManager({ userId: 'user-123' });
 * configureTelemetry({
 *   trackEphemeral: (type, data) => manager.trackEphemeral(type, data),
 *   trackWorkflow: (type, caseId, data) => manager.trackWorkflow(type, caseId, data),
 *   trackAudit: (type, caseId, data) => manager.trackAudit(type, caseId, data),
 *   destroy: () => manager.destroy(),
 * });
 * ```
 */
export function configureTelemetry(handler: TelemetryHandler): void {
  currentHandler = handler;
  telemetryEnabled.set(true);
}

/**
 * Disable telemetry and cleanup
 */
export async function disableTelemetry(): Promise<void> {
  await currentHandler.destroy();
  currentHandler = noopHandler;
  telemetryEnabled.set(false);
}

/**
 * Track ephemeral event (Tier 1 - local only)
 * Per SYS-TEL-002: Never transmitted to server
 */
export function trackEphemeral(type: string, data: Record<string, unknown>): void {
  currentHandler.trackEphemeral(type, data);
}

/**
 * Track workflow event (Tier 2 - batched)
 */
export function trackWorkflow(type: string, caseId: string, data: Record<string, unknown>): void {
  currentHandler.trackWorkflow(type, caseId, data);
}

/**
 * Track audit event (Tier 3 - immediate)
 */
export async function trackAudit(
  type: string,
  caseId: string,
  data: Record<string, unknown>
): Promise<void> {
  await currentHandler.trackAudit(type, caseId, data);
}

// ============ Viewer-specific tracking functions ============

/**
 * Track zoom event (Tier 1 - ephemeral)
 */
export function trackZoom(zoom: number): void {
  trackEphemeral('zoom', { zoom });
}

/**
 * Track pan event (Tier 1 - ephemeral)
 * Note: Only tracks direction, not coordinates (per privacy requirements)
 */
export function trackPan(dx: number, dy: number): void {
  const direction =
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? 'right'
        : 'left'
      : dy > 0
        ? 'down'
        : 'up';
  trackEphemeral('pan', { direction });
}

/**
 * Track rotation event (Tier 1 - ephemeral)
 */
export function trackRotation(degrees: number): void {
  trackEphemeral('rotate', { degrees: Math.round(degrees) });
}

/**
 * Track tool selection (Tier 1 - ephemeral)
 */
export function trackToolSelect(tool: string): void {
  trackEphemeral('tool-select', { tool });
}

/**
 * Track keyboard shortcut usage (Tier 1 - ephemeral)
 */
export function trackShortcut(shortcut: string): void {
  trackEphemeral('shortcut-used', { shortcut });
}

/**
 * Track case opened (Tier 2 - workflow)
 */
export function trackCaseOpened(caseId: string, source?: string): void {
  trackWorkflow('case-opened', caseId, { source });
}

/**
 * Track case closed (Tier 2 - workflow)
 */
export function trackCaseClosed(caseId: string): void {
  trackWorkflow('case-closed', caseId, {});
}

/**
 * Track slide viewed (Tier 2 - workflow)
 */
export function trackSlideViewed(caseId: string, slideId: string): void {
  trackWorkflow('slide-viewed', caseId, { slideId });
}

/**
 * Track annotation created (Tier 2 - workflow)
 */
export function trackAnnotationCreated(
  caseId: string,
  annotationId: string,
  type: string
): void {
  trackWorkflow('annotation-created', caseId, { annotationId, type });
}

/**
 * Track measurement created (Tier 2 - workflow)
 */
export function trackMeasurementCreated(
  caseId: string,
  measurementId: string,
  type: string
): void {
  trackWorkflow('measurement-created', caseId, { measurementId, type });
}

/**
 * Track DX mode change (Tier 2 - workflow)
 */
export function trackDxModeChanged(
  caseId: string,
  enabled: boolean,
  reason: string
): void {
  trackWorkflow('dx-mode-changed', caseId, { enabled, reason });
}

/**
 * Track DX mode opt-out (Tier 3 - audit, per SYS-DXM-005)
 */
export async function trackDxModeOptOut(
  caseId: string,
  reason: string,
  attestation: string
): Promise<void> {
  await trackAudit('dx-mode-opt-out', caseId, { reason, attestation });
}

/**
 * Track case sign-out (Tier 3 - audit)
 */
export async function trackCaseSignOut(caseId: string, action: string): Promise<void> {
  await trackAudit('sign-out', caseId, { action });
}
