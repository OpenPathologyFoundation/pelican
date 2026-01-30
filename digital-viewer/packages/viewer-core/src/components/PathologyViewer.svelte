<script lang="ts">
  /**
   * PathologyViewer Component - Main Application Shell
   *
   * Integrates all viewer components into a cohesive pathology
   * review interface with FDP (Focus Declaration Protocol) support.
   *
   * Layout:
   * - CaseBanner: Focus announcement overlay (shows on window focus)
   * - CaseIndicator: Persistent header with case identification
   * - Left Panel: CaseSearch + SlideGallery
   * - Center: Viewer (OpenSeadragon)
   * - Right Panel: Reserved for annotations/tools (future)
   */

  import { onMount, onDestroy } from 'svelte';
  import { getApiClient, configureApiClient } from '../api-client';
  import type { CaseDetails, SlideInfo, SlideWithContext, CaseSource } from '../api-client';
  import {
    caseContext,
    currentSlideId,
    diagnosticMode,
    privacyMode,
    resetViewerState,
  } from '../stores';
  import {
    trackCaseOpened,
    trackCaseClosed,
    trackSlideViewed,
    trackDxModeChanged,
  } from '../stores/telemetry-integration';
  import {
    configureSession,
    connectSession,
    registerCase,
    deregisterCase,
    destroySession,
    onSessionWarning,
    createWebSocketSessionHandler,
    type SessionWarning,
  } from '../stores/session-integration';
  import {
    startReviewSession,
    endReviewSession,
    openCase as openReviewCase,
    closeCase as closeReviewCase,
    openSlide as openReviewSlide,
    closeSlide as closeReviewSlide,
    addReviewEventListener,
    removeReviewEventListener,
    type ReviewEvent,
    type UserDeclaredReviewState,
  } from '@pathology/review-state';
  import type { CaseContext } from '../types';

  import CaseBanner from './CaseBanner.svelte';
  import CaseIndicator from './CaseIndicator.svelte';
  import CaseSearch from './CaseSearch.svelte';
  import CaseSwitchDialog from './CaseSwitchDialog.svelte';
  import SlideGallery from './SlideGallery.svelte';
  import Viewer from './Viewer.svelte';
  import MeasurementOverlay from './MeasurementOverlay.svelte';
  import ViewerToolsPanel from './ViewerToolsPanel.svelte';
  import ShortcutsHelp from './ShortcutsHelp.svelte';
  import BookmarkPanel from './BookmarkPanel.svelte';
  import { handleKeydown, showShortcutsHelp } from '../stores/shortcuts';
  import type { ShortcutAction } from '../types/shortcuts';
  import { createBookmark, toggleBookmarkPanel, bookmarkPanelVisible, goToNextBookmark, goToPreviousBookmark } from '../stores/bookmark';
  import { undo, redo, pushNavigation } from '../stores/navigation-history';
  import { startMeasurement, cancelMeasurement } from '../stores/measurement';
  import { osdViewer, viewportState } from '../stores';

  /** Tools panel visibility store */
  let toolsPanelOpen = $state(false);

  /** Props */
  interface Props {
    /** Tile server URL */
    tileServerUrl?: string;
    /** Initial case ID to load */
    initialCaseId?: string | null;
    /** Initial slide ID to load */
    initialSlideId?: string | null;
    /** Enable diagnostic mode (defaults to auto based on case source per SRS SYS-DXM-001) */
    enableDiagnosticMode?: boolean | 'auto';
    /** Enable privacy mode */
    enablePrivacyMode?: boolean;
    /** Initial case source (worklist, search, direct, external) */
    initialCaseSource?: CaseSource;
    /** Session service WebSocket URL (optional, enables SYS-SES-* features) */
    sessionServiceUrl?: string | null;
    /** User ID for session service */
    userId?: string | null;
    /** Callback when case changes */
    oncasechange?: (data: { caseId: string; caseDetails: CaseDetails }) => void;
    /** Callback when slide changes */
    onslidechange?: (data: { slideId: string; slide: SlideInfo }) => void;
    /** Callback when DX mode changes */
    ondxmodechange?: (data: { enabled: boolean; reason: string }) => void;
    /** Callback when session warning occurs (SYS-SES-004) */
    onsessionwarning?: (data: { warning: SessionWarning }) => void;
    /** Callback when review state is declared (SYS-RVW-001) */
    onreviewstate?: (data: { slideId: string; caseId: string; state: UserDeclaredReviewState }) => void;
  }

  let {
    tileServerUrl = 'http://localhost:8000',
    initialCaseId = null,
    initialSlideId = null,
    enableDiagnosticMode = 'auto',
    enablePrivacyMode = false,
    initialCaseSource = 'search',
    sessionServiceUrl = null,
    userId = null,
    oncasechange,
    onslidechange,
    ondxmodechange,
    onsessionwarning,
    onreviewstate,
  }: Props = $props();

  /** State */
  let currentCase = $state<CaseDetails | null>(null);
  let slides = $state<SlideInfo[]>([]);
  let selectedSlideId = $state<string | null>(null);
  let leftPanelCollapsed = $state(false);
  let showSettings = $state(false);
  let currentCaseSource = $state<CaseSource>((() => initialCaseSource)());

  /** Case switch dialog state */
  let showSwitchDialog = $state(false);
  let pendingCaseId = $state<string | null>(null);
  let pendingCasePatient = $state<string>('');
  let pendingCaseSource = $state<CaseSource>('search');

  /** Session state */
  let sessionInitialized = $state(false);
  let sessionWarningUnsubscribe: (() => void) | null = null;

  /** Review state (SYS-RVW-*) */
  let reviewSessionStarted = $state(false);
  let reviewEventUnsubscribe: (() => void) | null = null;

  /** Configure API client - use getter to capture prop value */
  let client = $derived(configureApiClient({ baseUrl: tileServerUrl }));

  /**
   * Determine if diagnostic mode should be enabled (SRS SYS-DXM-001)
   * Clinical worklist cases default to DX mode enabled
   */
  function shouldEnableDiagnosticMode(source: CaseSource, caseDetails?: CaseDetails | null): boolean {
    // If explicitly set (not 'auto'), use that value
    if (enableDiagnosticMode !== 'auto') {
      return enableDiagnosticMode;
    }

    // Case explicitly requires DX mode
    if (caseDetails?.requiresDiagnosticMode) {
      return true;
    }

    // Auto mode: enable for clinical worklist cases (SRS SYS-DXM-001)
    // Worklist = clinical cases that require DX safety features
    return source === 'worklist';
  }

  /** Update diagnostic/privacy mode stores */
  $effect(() => {
    const shouldEnable = shouldEnableDiagnosticMode(currentCaseSource, currentCase);
    diagnosticMode.set(shouldEnable);
  });

  $effect(() => {
    privacyMode.set(enablePrivacyMode);
  });

  /** Load case by ID with source tracking (SRS SYS-DXM-001) */
  async function loadCase(caseId: string, source: CaseSource = 'search'): Promise<void> {
    try {
      const caseDetails = await client.getCase(caseId);

      // Track case source for DX mode determination
      currentCaseSource = source;
      caseDetails.source = source;

      currentCase = caseDetails;
      slides = caseDetails.slides;

      // Update case context store for FDP components
      const context: CaseContext = {
        caseId: caseDetails.caseId,
        patientName: caseDetails.patientName,
        patientDob: caseDetails.patientDob,
      };
      caseContext.set(context);

      // Determine and notify DX mode state (SRS SYS-DXM-001)
      const dxEnabled = shouldEnableDiagnosticMode(source, caseDetails);
      const reason = source === 'worklist'
        ? 'Case loaded from clinical worklist'
        : caseDetails.requiresDiagnosticMode
          ? 'Case requires diagnostic mode'
          : enableDiagnosticMode === true
            ? 'Diagnostic mode explicitly enabled'
            : 'Diagnostic mode not required';
      ondxmodechange?.({ enabled: dxEnabled, reason });

      // Track telemetry events (Tier 2 workflow)
      trackCaseOpened(caseId, source);
      trackDxModeChanged(caseId, dxEnabled, reason);

      // Register with session service (SYS-SES-001)
      if (sessionInitialized) {
        registerCase(caseId, caseDetails.patientName, userId ?? undefined);
      }

      // Open case in review session (SYS-RVW-001)
      if (reviewSessionStarted) {
        const slideIds = caseDetails.slides.map((s) => s.slideId);
        const priority = caseDetails.priority === 'stat' ? 'stat' :
                        caseDetails.priority === 'urgent' ? 'urgent' : 'routine';
        openReviewCase(caseId, priority, slideIds);
      }

      oncasechange?.({ caseId, caseDetails });

      // Auto-select first slide if none selected
      if (slides.length > 0 && !selectedSlideId) {
        selectSlide(slides[0]);
      }
    } catch (error) {
      console.error('Failed to load case:', error);
    }
  }

  /** Handle case selection from search */
  function handleCaseSelect(data: { caseId: string; source?: CaseSource }): void {
    const newCaseId = data.caseId;
    const source = data.source ?? 'search';

    // If we have a current case, show confirmation dialog
    if (currentCase && currentCase.caseId !== newCaseId) {
      pendingCaseId = newCaseId;
      pendingCaseSource = source;
      // Fetch the patient name for the pending case
      client.getCase(newCaseId).then((details) => {
        pendingCasePatient = details.patientName;
        showSwitchDialog = true;
      });
    } else {
      loadCase(newCaseId, source);
    }
  }

  /** Confirm case switch (SYS-SES-005) */
  function confirmCaseSwitch(): void {
    if (pendingCaseId) {
      // Track closing the current case (Tier 2 workflow telemetry)
      if (currentCase) {
        trackCaseClosed(currentCase.caseId);

        // Close case in review session (SYS-RVW-001)
        if (reviewSessionStarted) {
          closeReviewCase(currentCase.caseId);
        }
      }

      // Deregister from session before switching
      if (sessionInitialized) {
        deregisterCase();
      }

      resetViewerState();
      selectedSlideId = null;
      loadCase(pendingCaseId, pendingCaseSource);
    }
    showSwitchDialog = false;
    pendingCaseId = null;
    pendingCasePatient = '';
    pendingCaseSource = 'search';
  }

  /** Cancel case switch */
  function cancelCaseSwitch(): void {
    showSwitchDialog = false;
    pendingCaseId = null;
    pendingCasePatient = '';
    pendingCaseSource = 'search';
  }

  /** Select a slide */
  function selectSlide(slide: SlideInfo): void {
    selectedSlideId = slide.slideId;
    currentSlideId.set(slide.slideId);

    // Track slide view (Tier 2 workflow telemetry)
    if (currentCase) {
      trackSlideViewed(currentCase.caseId, slide.slideId);
    }

    // Open slide in review session (SYS-RVW-001)
    if (reviewSessionStarted) {
      openReviewSlide(slide.slideId);
    }

    onslidechange?.({ slideId: slide.slideId, slide });
  }

  /** Handle slide selection from gallery */
  function handleSlideSelect(data: { slide: SlideInfo }): void {
    selectSlide(data.slide);
  }

  /** Toggle left panel */
  function toggleLeftPanel(): void {
    leftPanelCollapsed = !leftPanelCollapsed;
  }

  /** Handle settings click */
  function handleSettings(): void {
    showSettings = !showSettings;
  }

  /** Initialize review session (SYS-RVW-001) */
  function initializeReviewSession(): void {
    if (reviewSessionStarted) return;

    // Start the review session with the user ID
    const reviewUserId = userId ?? 'anonymous';
    const isDxMode = shouldEnableDiagnosticMode(currentCaseSource, currentCase);
    startReviewSession(reviewUserId, isDxMode);
    reviewSessionStarted = true;

    // Subscribe to review events for Tier 2 persistence and callbacks
    reviewEventUnsubscribe = (() => {
      const listener = (event: ReviewEvent) => {
        // When a review state is declared, notify parent component
        if (event.type === 'status-changed' && event.caseId && event.slideId) {
          const state = event.data as { status?: UserDeclaredReviewState };
          if (state?.status) {
            onreviewstate?.({
              caseId: event.caseId,
              slideId: event.slideId,
              state: state.status,
            });
          }
        }
      };
      addReviewEventListener(listener);
      return () => removeReviewEventListener(listener);
    })();
  }

  /** Initialize session service if configured (SYS-SES-001, SYS-SES-002) */
  async function initializeSession(): Promise<void> {
    if (!sessionServiceUrl || !userId) return;

    try {
      // Configure session handler
      const handler = createWebSocketSessionHandler({
        url: sessionServiceUrl,
        userId,
        heartbeatInterval: 30000, // 30s per SYS-SES-002
        onWarning: (warning) => {
          onsessionwarning?.({ warning });
        },
      });
      configureSession(handler);

      // Connect to session service
      await connectSession();
      sessionInitialized = true;

      // Subscribe to warnings (SYS-SES-004)
      sessionWarningUnsubscribe = onSessionWarning((warning) => {
        onsessionwarning?.({ warning });
      });
    } catch (error) {
      console.warn('[PathologyViewer] Failed to initialize session service:', error);
    }
  }

  /** Lifecycle */
  onMount(() => {
    // Initialize review session (SYS-RVW-001) - this enables the Review tab
    initializeReviewSession();

    // Initialize session service if configured
    initializeSession().then(() => {
      // Load initial case if provided (using initial source for DX mode determination)
      if (initialCaseId) {
        loadCase(initialCaseId, initialCaseSource).then(() => {
          if (initialSlideId) {
            const slide = slides.find((s) => s.slideId === initialSlideId);
            if (slide) {
              selectSlide(slide);
            }
          }
        });
      }
    });
  });

  onDestroy(() => {
    // Track case closed when component is destroyed (Tier 2 workflow telemetry)
    if (currentCase) {
      trackCaseClosed(currentCase.caseId);
    }

    // End review session (SYS-RVW-005 - purge session-only state)
    if (reviewSessionStarted) {
      endReviewSession();
      reviewEventUnsubscribe?.();
    }

    // Deregister and cleanup session (SYS-SES-003)
    if (sessionInitialized) {
      deregisterCase();
      destroySession();
      sessionWarningUnsubscribe?.();
    }
  });

  /** Computed: Get slide file path for viewer (format: caseId/filename) */
  let currentSlidePath = $derived.by(() => {
    if (!currentCase || !selectedSlideId) return null;
    const slide = slides.find((s) => s.slideId === selectedSlideId);
    if (!slide) return null;
    return `${currentCase.caseId}/${slide.filename}`;
  });

  /** Handle global keyboard shortcuts (SRS UN-WFL-002) */
  function handleGlobalShortcuts(event: KeyboardEvent): void {
    const action = handleKeydown(event);
    if (!action) return;

    const viewer = $osdViewer;

    switch (action) {
      case 'navigation.undo':
        undo();
        break;
      case 'navigation.redo':
        redo();
        break;
      case 'navigation.home':
        viewer?.viewport?.goHome();
        break;
      case 'zoom.in':
        if (viewer) {
          const currentZoom = viewer.viewport.getZoom();
          viewer.viewport.zoomTo(currentZoom * 1.5);
        }
        break;
      case 'zoom.out':
        if (viewer) {
          const currentZoom = viewer.viewport.getZoom();
          viewer.viewport.zoomTo(currentZoom / 1.5);
        }
        break;
      case 'zoom.fit':
        viewer?.viewport?.goHome();
        break;
      case 'bookmark.create':
        createBookmark(`Bookmark`);
        break;
      case 'bookmark.panel.toggle':
        toggleBookmarkPanel();
        break;
      case 'bookmark.next':
        goToNextBookmark();
        break;
      case 'bookmark.previous':
        goToPreviousBookmark();
        break;
      case 'tools.measure.line':
        startMeasurement('line');
        break;
      case 'tools.measure.area':
        startMeasurement('rectangle');
        break;
      case 'tools.panel.toggle':
        toolsPanelOpen = !toolsPanelOpen;
        break;
      case 'slide.next':
        if (currentCase && selectedSlideId) {
          const currentIndex = slides.findIndex(s => s.slideId === selectedSlideId);
          if (currentIndex < slides.length - 1) {
            selectSlide(slides[currentIndex + 1]);
          }
        }
        break;
      case 'slide.previous':
        if (currentCase && selectedSlideId) {
          const currentIndex = slides.findIndex(s => s.slideId === selectedSlideId);
          if (currentIndex > 0) {
            selectSlide(slides[currentIndex - 1]);
          }
        }
        break;
      case 'help.shortcuts':
        showShortcutsHelp();
        break;
    }
  }

  /** Record viewport changes to navigation history */
  $effect(() => {
    const viewport = $viewportState;
    if (viewport && selectedSlideId) {
      pushNavigation(viewport);
    }
  });
</script>

<!-- Global keyboard shortcuts (SRS UN-WFL-002) -->
<svelte:window onkeydown={handleGlobalShortcuts} />

<!-- Shortcuts Help Modal -->
<ShortcutsHelp />

<div class="pathology-viewer">
  <!-- FDP Banner (shows on window focus) -->
  <CaseBanner privacyMode={enablePrivacyMode} />

  <!-- Persistent Header -->
  <CaseIndicator
    privacyMode={enablePrivacyMode}
    onsettings={handleSettings}
  />

  <!-- Main Layout -->
  <div class="pathology-viewer__body">
    <!-- Left Panel: Search + Slide Gallery -->
    <aside
      class="pathology-viewer__sidebar"
      class:collapsed={leftPanelCollapsed}
    >
      <div class="pathology-viewer__sidebar-content">
        <div class="pathology-viewer__search">
          <CaseSearch
            oncaseselect={handleCaseSelect}
            currentCaseId={currentCase?.caseId}
          />
        </div>

        {#if currentCase}
          <div class="pathology-viewer__case-info">
            <div class="case-info__header">
              <span class="case-info__label">Case</span>
              <span class="case-info__id">{currentCase.caseId}</span>
            </div>
            {#if currentCase.diagnosis}
              <div class="case-info__diagnosis">{currentCase.diagnosis}</div>
            {/if}
            {#if currentCase.clinicalHistory}
              <div class="case-info__history">
                <span class="case-info__history-label">Clinical History:</span>
                {currentCase.clinicalHistory}
              </div>
            {/if}
          </div>

          <SlideGallery
            caseId={currentCase.caseId}
            {slides}
            onslideselect={handleSlideSelect}
          />
        {:else}
          <div class="pathology-viewer__empty">
            <span class="pathology-viewer__empty-icon">🔬</span>
            <p>Search for a case to begin</p>
          </div>
        {/if}
      </div>

      <button
        class="pathology-viewer__sidebar-toggle"
        onclick={toggleLeftPanel}
        title={leftPanelCollapsed ? 'Show panel' : 'Hide panel'}
        aria-label={leftPanelCollapsed ? 'Show panel' : 'Hide panel'}
      >
        {leftPanelCollapsed ? '▶' : '◀'}
      </button>
    </aside>

    <!-- Center: Viewer -->
    <main class="pathology-viewer__main">
      {#if currentSlidePath}
        <!-- Viewer with measurement overlay -->
        <div class="pathology-viewer__viewer-wrapper">
          <Viewer
            slideId={currentSlidePath}
            config={{ tileServerUrl }}
          />
          <MeasurementOverlay />

          <!-- Bookmark Panel (collapsible on left side) -->
          {#if $bookmarkPanelVisible}
            <BookmarkPanel position="left" />
          {/if}

          <!-- Tools Panel (collapsible on right side) -->
          <ViewerToolsPanel
            position="right"
            open={toolsPanelOpen}
            onopenchange={(open) => toolsPanelOpen = open}
            onreviewstate={(state) => {
              // Bubble up review state changes with case/slide context
              if (currentCase && selectedSlideId) {
                onreviewstate?.({
                  caseId: currentCase.caseId,
                  slideId: selectedSlideId,
                  state,
                });
              }
            }}
          />

          <!-- Help Button -->
          <button
            class="help-button"
            onclick={() => showShortcutsHelp()}
            title="Keyboard shortcuts (?)"
            aria-label="Show keyboard shortcuts"
          >
            ?
          </button>
        </div>
      {:else}
        <div class="pathology-viewer__no-slide">
          {#if currentCase}
            <span class="pathology-viewer__no-slide-icon">📋</span>
            <p>Select a slide from the gallery</p>
          {:else}
            <span class="pathology-viewer__no-slide-icon">🔍</span>
            <p>Search for a case to view slides</p>
          {/if}
        </div>
      {/if}
    </main>
  </div>

  <!-- Case Switch Confirmation Dialog -->
  <CaseSwitchDialog
    open={showSwitchDialog}
    currentCaseId={currentCase?.caseId || ''}
    currentPatient={currentCase?.patientName || ''}
    newCaseId={pendingCaseId || ''}
    newPatient={pendingCasePatient}
    onconfirm={confirmCaseSwitch}
    oncancel={cancelCaseSwitch}
  />
</div>

<style>
  .pathology-viewer {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #0f0f1a;
    color: #fff;
  }

  .pathology-viewer__body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .pathology-viewer__sidebar {
    position: relative;
    width: 320px;
    min-width: 280px;
    background: #1a1a2e;
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
    transition: width 200ms ease-out, min-width 200ms ease-out;
  }

  .pathology-viewer__sidebar.collapsed {
    width: 0;
    min-width: 0;
    border-right: none;
  }

  .pathology-viewer__sidebar.collapsed .pathology-viewer__sidebar-content {
    opacity: 0;
    pointer-events: none;
  }

  .pathology-viewer__sidebar-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: opacity 150ms ease-out;
  }

  .pathology-viewer__search {
    padding: 12px;
    border-bottom: 1px solid #333;
  }

  .pathology-viewer__case-info {
    padding: 12px 16px;
    background: rgba(59, 130, 246, 0.1);
    border-bottom: 1px solid #333;
  }

  .case-info__header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }

  .case-info__label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #888;
  }

  .case-info__id {
    font-size: 1rem;
    font-weight: 600;
    color: #90caf9;
  }

  .case-info__diagnosis {
    font-size: 0.85rem;
    color: #ccc;
    margin-bottom: 4px;
  }

  .case-info__history {
    font-size: 0.75rem;
    color: #888;
    line-height: 1.4;
  }

  .case-info__history-label {
    font-weight: 500;
    color: #999;
  }

  .pathology-viewer__sidebar-toggle {
    position: absolute;
    top: 50%;
    right: -16px;
    transform: translateY(-50%);
    width: 16px;
    height: 48px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-left: none;
    border-radius: 0 4px 4px 0;
    color: #888;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    z-index: 10;
    transition: color 150ms;
  }

  .pathology-viewer__sidebar-toggle:hover {
    color: #fff;
  }

  .pathology-viewer__main {
    flex: 1;
    position: relative;
    background: #000;
  }

  .pathology-viewer__viewer-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .pathology-viewer__empty,
  .pathology-viewer__no-slide {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    text-align: center;
    padding: 24px;
  }

  .pathology-viewer__empty-icon,
  .pathology-viewer__no-slide-icon {
    font-size: 3rem;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .pathology-viewer__empty p,
  .pathology-viewer__no-slide p {
    margin: 0;
    font-size: 1rem;
  }

  /* Help Button */
  .help-button {
    position: absolute;
    bottom: 20px;
    left: 20px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(31, 41, 55, 0.9);
    border: 1px solid #4b5563;
    border-radius: 50%;
    color: #9ca3af;
    font-size: 20px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 100;
  }

  .help-button:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: #3b82f6;
    color: #60a5fa;
    transform: scale(1.1);
  }

  .help-button:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4);
  }
</style>
