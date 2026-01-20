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
  import type { CaseDetails, SlideInfo, SlideWithContext } from '../api-client';
  import {
    caseContext,
    currentSlideId,
    diagnosticMode,
    privacyMode,
    resetViewerState,
  } from '../stores';
  import type { CaseContext } from '../types';

  import CaseBanner from './CaseBanner.svelte';
  import CaseIndicator from './CaseIndicator.svelte';
  import CaseSearch from './CaseSearch.svelte';
  import CaseSwitchDialog from './CaseSwitchDialog.svelte';
  import SlideGallery from './SlideGallery.svelte';
  import Viewer from './Viewer.svelte';

  /** Props */
  interface Props {
    /** Tile server URL */
    tileServerUrl?: string;
    /** Initial case ID to load */
    initialCaseId?: string | null;
    /** Initial slide ID to load */
    initialSlideId?: string | null;
    /** Enable diagnostic mode */
    enableDiagnosticMode?: boolean;
    /** Enable privacy mode */
    enablePrivacyMode?: boolean;
    /** Callback when case changes */
    oncasechange?: (data: { caseId: string; caseDetails: CaseDetails }) => void;
    /** Callback when slide changes */
    onslidechange?: (data: { slideId: string; slide: SlideInfo }) => void;
  }

  let {
    tileServerUrl = 'http://localhost:8000',
    initialCaseId = null,
    initialSlideId = null,
    enableDiagnosticMode = false,
    enablePrivacyMode = false,
    oncasechange,
    onslidechange,
  }: Props = $props();

  /** State */
  let currentCase = $state<CaseDetails | null>(null);
  let slides = $state<SlideInfo[]>([]);
  let selectedSlideId = $state<string | null>(null);
  let leftPanelCollapsed = $state(false);
  let showSettings = $state(false);

  /** Case switch dialog state */
  let showSwitchDialog = $state(false);
  let pendingCaseId = $state<string | null>(null);
  let pendingCasePatient = $state<string>('');

  /** Configure API client - use getter to capture prop value */
  let client = $derived(configureApiClient({ baseUrl: tileServerUrl }));

  /** Update diagnostic/privacy mode stores */
  $effect(() => {
    diagnosticMode.set(enableDiagnosticMode);
  });

  $effect(() => {
    privacyMode.set(enablePrivacyMode);
  });

  /** Load case by ID */
  async function loadCase(caseId: string): Promise<void> {
    try {
      const caseDetails = await client.getCase(caseId);
      currentCase = caseDetails;
      slides = caseDetails.slides;

      // Update case context store for FDP components
      const context: CaseContext = {
        caseId: caseDetails.caseId,
        patientName: caseDetails.patientName,
        patientDob: caseDetails.patientDob,
      };
      caseContext.set(context);

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
  function handleCaseSelect(data: { caseId: string }): void {
    const newCaseId = data.caseId;

    // If we have a current case, show confirmation dialog
    if (currentCase && currentCase.caseId !== newCaseId) {
      pendingCaseId = newCaseId;
      // Fetch the patient name for the pending case
      client.getCase(newCaseId).then((details) => {
        pendingCasePatient = details.patientName;
        showSwitchDialog = true;
      });
    } else {
      loadCase(newCaseId);
    }
  }

  /** Confirm case switch */
  function confirmCaseSwitch(): void {
    if (pendingCaseId) {
      resetViewerState();
      selectedSlideId = null;
      loadCase(pendingCaseId);
    }
    showSwitchDialog = false;
    pendingCaseId = null;
    pendingCasePatient = '';
  }

  /** Cancel case switch */
  function cancelCaseSwitch(): void {
    showSwitchDialog = false;
    pendingCaseId = null;
    pendingCasePatient = '';
  }

  /** Select a slide */
  function selectSlide(slide: SlideInfo): void {
    selectedSlideId = slide.slideId;
    currentSlideId.set(slide.slideId);
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

  /** Lifecycle */
  onMount(() => {
    // Load initial case if provided
    if (initialCaseId) {
      loadCase(initialCaseId).then(() => {
        if (initialSlideId) {
          const slide = slides.find((s) => s.slideId === initialSlideId);
          if (slide) {
            selectSlide(slide);
          }
        }
      });
    }
  });

  /** Computed: Get slide file path for viewer (format: caseId/filename) */
  let currentSlidePath = $derived.by(() => {
    if (!currentCase || !selectedSlideId) return null;
    const slide = slides.find((s) => s.slideId === selectedSlideId);
    if (!slide) return null;
    return `${currentCase.caseId}/${slide.filename}`;
  });
</script>

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
        <Viewer
          slideId={currentSlidePath}
          config={{ tileServerUrl }}
        />
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
</style>
