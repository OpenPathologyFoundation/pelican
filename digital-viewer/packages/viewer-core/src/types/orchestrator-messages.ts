/**
 * Orchestrator Bridge Message Protocol
 *
 * Defines the typed postMessage protocol between the orchestrator
 * (Okapi web-client) and the viewer (digital-viewer) windows.
 *
 * NOTE: This file is kept in sync with the orchestrator's copy at:
 *   Okapi/web-client/src/lib/types/viewer-bridge.ts
 *
 * Security: All messages are validated by origin before processing.
 */

// ============ Orchestrator → Viewer Messages ============

/** Viewer mode — determines DX features, case source, and visual context */
export type ViewerMode = 'clinical' | 'educational';

/** Initialization payload sent after viewer signals ready */
export interface InitPayload {
	/** JWT access token for tile server authentication */
	token: string;
	/** Case identifier to load */
	caseId: string;
	/** Accession number */
	accession: string;
	/** Tile server base URL (e.g., '/tiles' behind proxy, or full URL) */
	tileServerUrl: string;
	/** Session awareness WebSocket URL (e.g., '/ws' behind proxy) */
	sessionServiceUrl: string;
	/** Authenticated user identifier */
	userId: string;
	/** Orchestrator's origin for reply validation */
	orchestratorOrigin: string;
	/** Viewer mode — clinical enables DX mode, educational disables it */
	mode?: ViewerMode;
}

/** Audit event reported by the viewer */
export interface ViewerAuditEvent {
	/** Event type */
	eventType:
		| 'VIEWER_CASE_OPENED'
		| 'VIEWER_SLIDE_VIEWED'
		| 'VIEWER_CASE_CLOSED'
		| 'VIEWER_ANNOTATION_CREATED';
	/** Case identifier */
	caseId: string;
	/** Slide identifier (null for case-level events) */
	slideId?: string;
	/** Accession number */
	accessionNumber: string;
	/** When the event occurred (ISO 8601) */
	occurredAt: string;
	/** Additional event-specific metadata */
	metadata?: Record<string, unknown>;
}

/** Messages sent from orchestrator to viewer */
export type OrchestratorMessage =
	| { type: 'orchestrator:init'; payload: InitPayload }
	| { type: 'orchestrator:token-refresh'; payload: { token: string } }
	| { type: 'orchestrator:case-change'; payload: { caseId: string; accession: string } }
	| { type: 'orchestrator:focus'; payload: { state: 'active' | 'blurred' } }
	| { type: 'orchestrator:logout'; payload: Record<string, never> }
	| { type: 'orchestrator:heartbeat'; payload: { timestamp: number } };

/** Messages sent from viewer to orchestrator */
export type ViewerMessage =
	| { type: 'viewer:ready'; payload: Record<string, never> }
	| { type: 'viewer:heartbeat-ack'; payload: { timestamp: number } }
	| { type: 'viewer:case-loaded'; payload: { caseId: string; slideCount: number } }
	| { type: 'viewer:error'; payload: { code: string; message: string } }
	| { type: 'viewer:audit-event'; payload: ViewerAuditEvent };

// ============ Future Extensions (not yet handled) ============

/** Future orchestrator messages for collaboration and search */
// | { type: 'orchestrator:search-results'; payload: { cases: unknown[] } }
// | { type: 'orchestrator:collaboration-join'; payload: { sessionId: string; peers: string[] } }

/** Future viewer messages for annotations and viewport sync */
// | { type: 'viewer:annotation-saved'; payload: { annotationId: string } }
// | { type: 'viewer:viewport-sync'; payload: { center: { x: number; y: number }; zoom: number; rotation: number } }
