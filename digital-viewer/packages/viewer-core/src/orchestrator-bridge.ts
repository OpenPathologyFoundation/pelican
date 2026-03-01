/**
 * Orchestrator Bridge — Viewer Side
 *
 * Manages the communication channel from the viewer window
 * back to the Okapi orchestrator via postMessage.
 *
 * Responsibilities:
 * - Listen for orchestrator messages with origin validation
 * - Handle init, token refresh, case change, logout, heartbeat
 * - Send ready, case-loaded, error, and audit events back
 * - Detect orchestrator gone (heartbeat timeout) → lifecycle overlays
 *
 * Usage:
 *   const bridge = new OrchestratorBridge();
 *   bridge.onInit((payload) => { ... });
 *   bridge.onTokenRefresh((token) => { ... });
 *   bridge.onCaseChange((caseId, accession) => { ... });
 *   bridge.onLogout(() => { ... });
 *   bridge.initialize(); // Start listening
 */

import type {
	OrchestratorMessage,
	ViewerMessage,
	InitPayload,
	ViewerAuditEvent,
} from './types/orchestrator-messages';

export type BridgeState = 'waiting' | 'connected' | 'disconnected' | 'lost' | 'ended';

export class OrchestratorBridge {
	private orchestratorOrigin: string | null = null;
	private state: BridgeState = 'waiting';

	// Heartbeat tracking
	private lastHeartbeat: number = 0;
	private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;
	private readonly HEARTBEAT_TIMEOUT_MS = 15000; // 15 seconds
	private readonly HEARTBEAT_LOST_MS = 60000; // 60 seconds → permanent loss

	// Message handler
	private messageHandler: ((event: MessageEvent) => void) | null = null;

	// Event callbacks
	private initHandlers: Set<(payload: InitPayload) => void> = new Set();
	private tokenRefreshHandlers: Set<(token: string) => void> = new Set();
	private caseChangeHandlers: Set<(caseId: string, accession: string) => void> = new Set();
	private logoutHandlers: Set<() => void> = new Set();
	private stateChangeHandlers: Set<(state: BridgeState) => void> = new Set();
	private focusHandlers: Set<(state: 'active' | 'blurred') => void> = new Set();

	/** Start listening for orchestrator messages and announce readiness */
	initialize(): void {
		this.messageHandler = (event: MessageEvent) => this.handleMessage(event);
		window.addEventListener('message', this.messageHandler);

		// Announce readiness to the parent/opener window
		this.sendToOrchestrator({ type: 'viewer:ready', payload: {} });
	}

	/** Register callback for init message */
	onInit(handler: (payload: InitPayload) => void): () => void {
		this.initHandlers.add(handler);
		return () => this.initHandlers.delete(handler);
	}

	/** Register callback for token refresh */
	onTokenRefresh(handler: (token: string) => void): () => void {
		this.tokenRefreshHandlers.add(handler);
		return () => this.tokenRefreshHandlers.delete(handler);
	}

	/** Register callback for case change */
	onCaseChange(handler: (caseId: string, accession: string) => void): () => void {
		this.caseChangeHandlers.add(handler);
		return () => this.caseChangeHandlers.delete(handler);
	}

	/** Register callback for logout */
	onLogout(handler: () => void): () => void {
		this.logoutHandlers.add(handler);
		return () => this.logoutHandlers.delete(handler);
	}

	/** Register callback for state changes */
	onStateChange(handler: (state: BridgeState) => void): () => void {
		this.stateChangeHandlers.add(handler);
		return () => this.stateChangeHandlers.delete(handler);
	}

	/** Register callback for focus state changes */
	onFocus(handler: (state: 'active' | 'blurred') => void): () => void {
		this.focusHandlers.add(handler);
		return () => this.focusHandlers.delete(handler);
	}

	/** Send case-loaded confirmation to orchestrator */
	sendCaseLoaded(caseId: string, slideCount: number): void {
		this.sendToOrchestrator({
			type: 'viewer:case-loaded',
			payload: { caseId, slideCount },
		});
	}

	/** Send error to orchestrator */
	sendError(code: string, message: string): void {
		this.sendToOrchestrator({
			type: 'viewer:error',
			payload: { code, message },
		});
	}

	/** Send audit event to orchestrator (proxied to backend) */
	sendAuditEvent(event: ViewerAuditEvent): void {
		this.sendToOrchestrator({
			type: 'viewer:audit-event',
			payload: event,
		});
	}

	/** Get current bridge state */
	getState(): BridgeState {
		return this.state;
	}

	/** Clean up all resources */
	destroy(): void {
		if (this.messageHandler) {
			window.removeEventListener('message', this.messageHandler);
			this.messageHandler = null;
		}
		this.stopHeartbeatCheck();
		this.initHandlers.clear();
		this.tokenRefreshHandlers.clear();
		this.caseChangeHandlers.clear();
		this.logoutHandlers.clear();
		this.stateChangeHandlers.clear();
		this.focusHandlers.clear();
	}

	// ============ Private Methods ============

	private setState(state: BridgeState): void {
		if (this.state === state) return;
		this.state = state;
		for (const handler of this.stateChangeHandlers) {
			handler(state);
		}
	}

	private sendToOrchestrator(message: ViewerMessage): void {
		const target = window.opener;
		if (!target) return;

		try {
			target.postMessage(message, this.orchestratorOrigin || '*');
		} catch (error) {
			console.warn('[OrchestratorBridge] Failed to send message:', error);
		}
	}

	private handleMessage(event: MessageEvent): void {
		const message = event.data as OrchestratorMessage;
		if (!message || typeof message.type !== 'string' || !message.type.startsWith('orchestrator:')) {
			return;
		}

		// On first orchestrator message, lock down the expected origin
		if (!this.orchestratorOrigin) {
			this.orchestratorOrigin = event.origin;
		}

		// Validate origin on subsequent messages
		if (event.origin !== this.orchestratorOrigin) {
			console.warn('[OrchestratorBridge] Rejected message from unexpected origin:', event.origin);
			return;
		}

		switch (message.type) {
			case 'orchestrator:init':
				this.handleInit(message.payload);
				break;
			case 'orchestrator:token-refresh':
				this.handleTokenRefresh(message.payload.token);
				break;
			case 'orchestrator:case-change':
				this.handleCaseChange(message.payload.caseId, message.payload.accession);
				break;
			case 'orchestrator:focus':
				for (const handler of this.focusHandlers) {
					handler(message.payload.state);
				}
				break;
			case 'orchestrator:logout':
				this.handleLogout();
				break;
			case 'orchestrator:heartbeat':
				this.handleHeartbeat(message.payload.timestamp);
				break;
		}
	}

	private handleInit(payload: InitPayload): void {
		// Store orchestrator origin from the init payload for extra validation
		if (payload.orchestratorOrigin) {
			this.orchestratorOrigin = payload.orchestratorOrigin;
		}

		this.setState('connected');
		this.startHeartbeatCheck();

		for (const handler of this.initHandlers) {
			handler(payload);
		}
	}

	private handleTokenRefresh(token: string): void {
		for (const handler of this.tokenRefreshHandlers) {
			handler(token);
		}
	}

	private handleCaseChange(caseId: string, accession: string): void {
		for (const handler of this.caseChangeHandlers) {
			handler(caseId, accession);
		}
	}

	private handleLogout(): void {
		this.stopHeartbeatCheck();
		this.setState('ended');

		for (const handler of this.logoutHandlers) {
			handler();
		}
	}

	private handleHeartbeat(timestamp: number): void {
		this.lastHeartbeat = Date.now();

		// If we were disconnected, we've reconnected
		if (this.state === 'disconnected') {
			this.setState('connected');
		}

		// Reply with ack
		this.sendToOrchestrator({
			type: 'viewer:heartbeat-ack',
			payload: { timestamp },
		});
	}

	private startHeartbeatCheck(): void {
		this.stopHeartbeatCheck();
		this.lastHeartbeat = Date.now();

		this.heartbeatCheckInterval = setInterval(() => {
			const elapsed = Date.now() - this.lastHeartbeat;

			if (elapsed > this.HEARTBEAT_LOST_MS && this.state !== 'lost' && this.state !== 'ended') {
				// Permanent loss — orchestrator has been gone too long
				this.setState('lost');
			} else if (elapsed > this.HEARTBEAT_TIMEOUT_MS && this.state === 'connected') {
				// Temporary disconnection
				this.setState('disconnected');
			}
		}, 2000); // Check every 2 seconds
	}

	private stopHeartbeatCheck(): void {
		if (this.heartbeatCheckInterval) {
			clearInterval(this.heartbeatCheckInterval);
			this.heartbeatCheckInterval = null;
		}
	}
}
