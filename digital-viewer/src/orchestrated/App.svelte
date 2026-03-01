<script lang="ts">
  /**
   * Orchestrated Viewer App
   *
   * Wrapper around PathologyViewer that integrates with the
   * OrchestratorBridge for two-window operation.
   *
   * Lifecycle:
   * 1. Mount → create bridge → send viewer:ready
   * 2. Wait for orchestrator:init with JWT + case details
   * 3. Mount PathologyViewer with received config
   * 4. Forward token refreshes, case changes, and audit events
   * 5. Show lifecycle overlays on disconnection/loss/logout
   */

  import { onMount, onDestroy } from 'svelte';
  import { PathologyViewer } from '@pathology/viewer-core';
  import { OrchestratorBridge, type BridgeState } from '@pathology/viewer-core';
  import type { InitPayload, ViewerAuditEvent } from '@pathology/viewer-core';
  import { authToken, orchestratorState, authExpired } from '@pathology/viewer-core';

  /** Bridge instance */
  let bridge: OrchestratorBridge | null = null;

  /** Focus state from orchestrator (active = interactive, blurred = dimmed overlay) */
  let viewerFocused = $state<'active' | 'blurred'>('active');

  /** Viewer configuration (populated from orchestrator:init) */
  let viewerConfig = $state<InitPayload | null>(null);

  /** Bridge connection state */
  let bridgeState = $state<BridgeState>('waiting');

  /** Current case ID (may change via orchestrator:case-change) */
  let currentCaseId = $state<string | null>(null);

  /** Current accession number */
  let currentAccession = $state<string | null>(null);

  /** Token expiry timer */
  let tokenExpiryTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Map bridge state to orchestratorState store value */
  function syncOrchestratorState(state: BridgeState): void {
    switch (state) {
      case 'connected':
        orchestratorState.set('connected');
        break;
      case 'disconnected':
        orchestratorState.set('disconnected');
        break;
      case 'lost':
        orchestratorState.set('lost');
        break;
      case 'ended':
        orchestratorState.set('ended');
        break;
      default:
        orchestratorState.set(null);
    }
  }

  /** Schedule auth expiry detection based on JWT exp claim */
  function scheduleTokenExpiryDetection(token: string): void {
    if (tokenExpiryTimeout) {
      clearTimeout(tokenExpiryTimeout);
      tokenExpiryTimeout = null;
    }
    authExpired.set(false);

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return;

      const expiresAt = payload.exp * 1000;
      // Add a small grace period (10 seconds after expiry)
      const delay = expiresAt - Date.now() + 10000;

      if (delay <= 0) {
        authExpired.set(true);
        return;
      }

      tokenExpiryTimeout = setTimeout(() => {
        authExpired.set(true);
      }, delay);
    } catch {
      // Can't parse token — skip expiry detection
    }
  }

  onMount(() => {
    bridge = new OrchestratorBridge();

    // Handle init from orchestrator
    bridge.onInit((payload) => {
      viewerConfig = payload;
      currentCaseId = payload.caseId;
      currentAccession = payload.accession;

      // Set auth token in global store
      authToken.set(payload.token);
      scheduleTokenExpiryDetection(payload.token);
    });

    // Handle token refresh
    bridge.onTokenRefresh((token) => {
      authToken.set(token);
      authExpired.set(false);
      scheduleTokenExpiryDetection(token);
    });

    // Handle case change
    bridge.onCaseChange((caseId, accession) => {
      currentCaseId = caseId;
      currentAccession = accession;
    });

    // Handle logout
    bridge.onLogout(() => {
      // State change is handled by onStateChange
    });

    // Handle focus state
    bridge.onFocus((state) => {
      viewerFocused = state;
    });

    // Handle state changes
    bridge.onStateChange((state) => {
      bridgeState = state;
      syncOrchestratorState(state);
    });

    // Start listening and announce ready
    bridge.initialize();
  });

  onDestroy(() => {
    if (tokenExpiryTimeout) {
      clearTimeout(tokenExpiryTimeout);
    }
    bridge?.destroy();
    orchestratorState.set(null);
  });

  /** Handle case loaded — send confirmation to orchestrator */
  function handleCaseChange(data: { caseId: string; caseDetails: unknown }): void {
    if (!bridge) return;

    // Count slides from the case details
    const details = data.caseDetails as { slides?: unknown[] };
    const slideCount = details?.slides?.length ?? 0;
    bridge.sendCaseLoaded(data.caseId, slideCount);

    // Send audit event
    bridge.sendAuditEvent({
      eventType: 'VIEWER_CASE_OPENED',
      caseId: data.caseId,
      accessionNumber: currentAccession ?? '',
      occurredAt: new Date().toISOString(),
      metadata: { slideCount },
    });
  }

  /** Handle slide change — send audit event to orchestrator */
  function handleSlideChange(data: { slideId: string; slide: unknown }): void {
    if (!bridge || !currentCaseId) return;

    bridge.sendAuditEvent({
      eventType: 'VIEWER_SLIDE_VIEWED',
      caseId: currentCaseId,
      slideId: data.slideId,
      accessionNumber: currentAccession ?? '',
      occurredAt: new Date().toISOString(),
    });
  }

  /** Send close event before unload */
  function handleBeforeUnload(): void {
    if (!bridge || !currentCaseId) return;

    bridge.sendAuditEvent({
      eventType: 'VIEWER_CASE_CLOSED',
      caseId: currentCaseId,
      accessionNumber: currentAccession ?? '',
      occurredAt: new Date().toISOString(),
    });
  }
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<div class="orchestrated-app">
  {#if bridgeState === 'waiting'}
    <!-- Waiting for orchestrator to send init -->
    <div class="waiting-overlay">
      <div class="waiting-spinner"></div>
      <p class="waiting-text">Waiting for workstation...</p>
      <p class="waiting-hint">This window was opened by the Okapi workstation.</p>
    </div>
  {:else if bridgeState === 'ended'}
    <!-- Orchestrator sent logout -->
    <div class="lifecycle-overlay ended">
      <div class="lifecycle-icon">
        <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </div>
      <h2>Session Ended</h2>
      <p>The workstation session has been closed.</p>
      <p class="lifecycle-hint">You can close this window.</p>
    </div>
  {:else if bridgeState === 'lost'}
    <!-- Orchestrator gone for > 60 seconds -->
    <div class="lifecycle-overlay lost">
      <div class="lifecycle-icon">
        <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h2>Connection Lost</h2>
      <p>Unable to reach the workstation. Please return to the worklist.</p>
    </div>
  {:else if viewerConfig}
    <!-- Connected or temporarily disconnected — show viewer -->

    {#if bridgeState === 'disconnected'}
      <div class="reconnecting-banner">
        <span class="reconnecting-dot"></span>
        Reconnecting to workstation...
      </div>
    {/if}

    {#key currentCaseId}
      <PathologyViewer
        tileServerUrl={viewerConfig.tileServerUrl}
        accessToken={viewerConfig.token}
        initialCaseId={currentCaseId}
        initialCaseSource="worklist"
        enableDiagnosticMode="auto"
        sessionServiceUrl={viewerConfig.sessionServiceUrl}
        userId={viewerConfig.userId}
        oncasechange={handleCaseChange}
        onslidechange={handleSlideChange}
      />
    {/key}

    {#if viewerFocused === 'blurred'}
      <div class="blur-overlay">
        <div class="blur-overlay__badge">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
          </svg>
          <span>Viewer paused</span>
          <span class="blur-overlay__hint">Return to the case to continue</span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .orchestrated-app {
    position: relative;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #0f0f1a;
    color: #e0e0e0;
  }

  /* Waiting overlay */
  .waiting-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
  }

  .waiting-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #333;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .waiting-text {
    font-size: 1.1rem;
    font-weight: 500;
    color: #ccc;
  }

  .waiting-hint {
    font-size: 0.8rem;
    color: #666;
  }

  /* Lifecycle overlays */
  .lifecycle-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    text-align: center;
    padding: 24px;
  }

  .lifecycle-icon {
    margin-bottom: 8px;
  }

  .lifecycle-overlay.ended .lifecycle-icon {
    color: #6b7280;
  }

  .lifecycle-overlay.lost .lifecycle-icon {
    color: #ef4444;
  }

  .lifecycle-overlay h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .lifecycle-overlay.ended h2 {
    color: #9ca3af;
  }

  .lifecycle-overlay.lost h2 {
    color: #fca5a5;
  }

  .lifecycle-overlay p {
    font-size: 0.95rem;
    color: #888;
    margin: 0;
  }

  .lifecycle-hint {
    font-size: 0.8rem !important;
    color: #555 !important;
    margin-top: 8px !important;
  }

  /* Reconnecting banner */
  .reconnecting-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(234, 179, 8, 0.15);
    border-bottom: 1px solid rgba(234, 179, 8, 0.3);
    color: #eab308;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .reconnecting-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #eab308;
    animation: pulse-dot 1.5s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Blur overlay — dims viewer when orchestrator navigates away from the case */
  .blur-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
    animation: fadeIn 300ms ease-out;
  }

  .blur-overlay__badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 32px;
    background: rgba(15, 15, 26, 0.85);
    border: 1px solid #333;
    border-radius: 12px;
    color: #888;
    font-size: 0.95rem;
  }

  .blur-overlay__hint {
    font-size: 0.75rem;
    color: #555;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
