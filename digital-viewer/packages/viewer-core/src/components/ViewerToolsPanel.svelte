<script lang="ts">
  /**
   * ViewerToolsPanel Component
   *
   * Collapsible tools panel with measurement, annotation, zoom, and review controls
   * Per SRS-001 SYS-MSR-*, SYS-UI-001, SYS-UI-002, SYS-RVW-001
   */

  import {
    slideMetadata,
    viewportState,
    osdViewer,
    diagnosticMode,
    textAnnotationMode,
    textAnnotations,
    pendingTextPosition,
    type TextAnnotation,
  } from '../stores';
  import {
    activeMeasurementTool,
    measurementDisplayUnit,
    currentCalibrationState,
    currentMpp,
    currentMppSource,
    isMeasurementBlocked,
    measurementBlockReason,
    canMeasure,
    startMeasurement,
    cancelMeasurement,
    measurements,
    clearMeasurements,
  } from '../stores/measurement';
  import {
    MEASUREMENT_TOOLS,
    CALIBRATION_DISPLAY,
    type MeasurementType,
  } from '../types/measurement';
  import {
    reviewSession,
    currentSlide,
    currentCase,
    USER_DECLARED_STATES,
    type UserDeclaredReviewState,
  } from '@pathology/review-state';
  import {
    sortedBookmarks,
    bookmarkCount,
    canCreateBookmark,
    createBookmark,
    goToBookmark,
    deleteBookmark,
    clearCurrentSlideBookmarks,
  } from '../stores/bookmark';
  import type { Bookmark } from '../types/bookmark';
  import SlideLabel from './SlideLabel.svelte';

  /** Props */
  interface Props {
    initiallyOpen?: boolean;
    open?: boolean;
    position?: 'left' | 'right';
    onzoom?: (magnification: number) => void;
    ontextannotation?: (data: { text: string; position: { x: number; y: number } }) => void;
    onreviewstate?: (state: UserDeclaredReviewState) => void;
    onbookmarkcreate?: (bookmark: Bookmark) => void;
    onbookmarknavigate?: (bookmark: Bookmark) => void;
    onopenchange?: (open: boolean) => void;
  }

  let {
    initiallyOpen = false,
    open = undefined,
    position = 'right',
    onzoom,
    ontextannotation,
    onreviewstate,
    onbookmarkcreate,
    onbookmarknavigate,
    onopenchange,
  }: Props = $props();

  /** State */
  let isOpen = $state(initiallyOpen);
  let activeTab = $state<'measure' | 'annotate' | 'zoom' | 'review' | 'bookmarks'>('zoom');
  let textAnnotationInput = $state('');
  let textAnnotationColor = $state('#ffff00');
  let newBookmarkLabel = $state('');
  let showNewBookmarkForm = $state(false);

  /** Sync with controlled open prop */
  $effect(() => {
    if (open !== undefined) {
      isOpen = open;
    }
  });

  /** Watch for pending text position (user clicked on canvas in text mode) */
  $effect(() => {
    const pos = $pendingTextPosition;
    if (pos && $textAnnotationMode) {
      // Focus will be handled by the input appearing
    }
  });

  /** Zoom presets based on native magnification */
  const ZOOM_PRESETS = [
    { label: '1x', magnification: 1 },
    { label: '2x', magnification: 2 },
    { label: '5x', magnification: 5 },
    { label: '10x', magnification: 10 },
    { label: '20x', magnification: 20 },
    { label: '40x', magnification: 40 },
  ];

  /** Derived: calibration display info */
  let calibrationInfo = $derived(CALIBRATION_DISPLAY[$currentCalibrationState]);

  /** Derived: current approximate magnification */
  let currentMagnification = $derived.by(() => {
    if (!$slideMetadata?.magnification) return null;
    return $slideMetadata.magnification * ($viewportState?.zoom || 1);
  });

  /** Toggle panel */
  function togglePanel(): void {
    isOpen = !isOpen;
    onopenchange?.(isOpen);
  }

  /** Select measurement tool */
  function selectMeasurementTool(type: MeasurementType): void {
    if ($isMeasurementBlocked) return;

    if ($activeMeasurementTool === type) {
      cancelMeasurement();
    } else {
      startMeasurement(type);
    }
  }

  /** Toggle display unit */
  function toggleUnit(): void {
    measurementDisplayUnit.update((current) => {
      if (current === 'um') return 'mm';
      if (current === 'mm') return 'px';
      return 'um';
    });
  }

  /** Format MPP for display */
  function formatMpp(mpp: number | null): string {
    if (mpp === null) return '—';
    if (mpp < 0.1) return mpp.toFixed(4);
    if (mpp < 1) return mpp.toFixed(3);
    return mpp.toFixed(2);
  }

  /** Zoom to specific magnification */
  function zoomToMagnification(targetMag: number): void {
    const viewer = $osdViewer;
    if (!viewer || !$slideMetadata?.magnification) return;

    // Calculate the zoom level needed to achieve target magnification
    // zoom = targetMag / nativeMag
    const nativeMag = $slideMetadata.magnification;
    const zoomLevel = targetMag / nativeMag;

    viewer.viewport.zoomTo(zoomLevel);
    onzoom?.(targetMag);
  }

  /** Fit to screen */
  function fitToScreen(): void {
    const viewer = $osdViewer;
    if (!viewer) return;
    viewer.viewport.goHome();
  }

  /** Enable text annotation mode */
  function enableTextAnnotation(): void {
    textAnnotationMode.set(true);
    cancelMeasurement();
  }

  /** Submit text annotation */
  function submitTextAnnotation(): void {
    const pos = $pendingTextPosition;
    if (pos && textAnnotationInput.trim()) {
      const annotation: TextAnnotation = {
        id: `txt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: textAnnotationInput.trim(),
        position: pos,
        color: textAnnotationColor,
        createdAt: new Date().toISOString(),
      };
      textAnnotations.update((list) => [...list, annotation]);
      cancelTextAnnotation();
    }
  }

  /** Cancel text annotation */
  function cancelTextAnnotation(): void {
    textAnnotationMode.set(false);
    pendingTextPosition.set(null);
    textAnnotationInput = '';
  }

  /** Derived: Current slide's user-declared review state */
  let currentReviewState = $derived($currentSlide?.userDeclaredState ?? null);

  /** Derived: Whether we have an active session to declare review states */
  let canDeclareReviewState = $derived(
    $reviewSession !== null && $currentSlide !== null
  );

  /** Review state options for display */
  const REVIEW_STATE_OPTIONS: {
    state: UserDeclaredReviewState;
    label: string;
    icon: string;
    color: string;
    description: string;
  }[] = [
    USER_DECLARED_STATES.reviewed,
    USER_DECLARED_STATES.flagged,
    USER_DECLARED_STATES.needs_attending,
  ].map((config, idx) => ({
    state: (['reviewed', 'flagged', 'needs_attending'] as const)[idx],
    ...config,
  }));

  /** Declare review state for current slide (SRS SYS-RVW-001) */
  function declareReviewState(state: UserDeclaredReviewState): void {
    if (!canDeclareReviewState) return;

    // Update the slide's review state in the session
    reviewSession.update((session) => {
      if (!session || !session.currentCaseId || !session.currentSlideId) {
        return session;
      }

      const now = new Date().toISOString();

      const updatedCases = session.cases.map((c) => {
        if (c.caseId !== session.currentCaseId) return c;

        const updatedSlides = c.slides.map((s) => {
          if (s.slideId !== session.currentSlideId) return s;
          return {
            ...s,
            userDeclaredState: state,
            userDeclaredAt: now,
            userDeclaredBy: session.userId,
          };
        });

        return { ...c, slides: updatedSlides };
      });

      return { ...session, cases: updatedCases };
    });

    // Emit callback for parent component / telemetry
    onreviewstate?.(state);
  }

  /** Clear review state for current slide */
  function clearReviewState(): void {
    if (!canDeclareReviewState) return;

    reviewSession.update((session) => {
      if (!session || !session.currentCaseId || !session.currentSlideId) {
        return session;
      }

      const updatedCases = session.cases.map((c) => {
        if (c.caseId !== session.currentCaseId) return c;

        const updatedSlides = c.slides.map((s) => {
          if (s.slideId !== session.currentSlideId) return s;
          return {
            ...s,
            userDeclaredState: undefined,
            userDeclaredAt: undefined,
            userDeclaredBy: undefined,
          };
        });

        return { ...c, slides: updatedSlides };
      });

      return { ...session, cases: updatedCases };
    });
  }

  /** Show new bookmark form */
  function showAddBookmark(): void {
    showNewBookmarkForm = true;
    newBookmarkLabel = `Bookmark ${$bookmarkCount + 1}`;
  }

  /** Create new bookmark at current position */
  function handleCreateBookmark(): void {
    if (!$canCreateBookmark) return;

    const bookmark = createBookmark(
      newBookmarkLabel.trim() || `Bookmark ${$bookmarkCount + 1}`
    );

    if (bookmark) {
      onbookmarkcreate?.(bookmark);
    }

    showNewBookmarkForm = false;
    newBookmarkLabel = '';
  }

  /** Cancel new bookmark */
  function cancelNewBookmark(): void {
    showNewBookmarkForm = false;
    newBookmarkLabel = '';
  }

  /** Navigate to bookmark */
  function handleGoToBookmark(bookmark: Bookmark): void {
    goToBookmark(bookmark.id);
    onbookmarknavigate?.(bookmark);
  }

  /** Delete a bookmark */
  function handleDeleteBookmark(id: string): void {
    deleteBookmark(id);
  }

  /** Handle bookmark keydown */
  function handleBookmarkKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      handleCreateBookmark();
    } else if (event.key === 'Escape') {
      cancelNewBookmark();
    }
  }

  /** Format zoom for display */
  function formatBookmarkZoom(zoom: number): string {
    return `${zoom.toFixed(1)}x`;
  }
</script>

<!-- Toggle Button -->
<button
  class="tools-toggle"
  class:open={isOpen}
  class:left={position === 'left'}
  class:right={position === 'right'}
  onclick={togglePanel}
  title={isOpen ? 'Hide tools' : 'Show tools'}
  aria-label={isOpen ? 'Hide tools panel' : 'Show tools panel'}
  aria-expanded={isOpen}
>
  <span class="toggle-icon">{isOpen ? (position === 'right' ? '›' : '‹') : (position === 'right' ? '‹' : '›')}</span>
  {#if !isOpen}
    <span class="toggle-label">Tools</span>
  {/if}
</button>

<!-- Tools Panel -->
{#if isOpen}
  <div
    class="tools-panel"
    class:left={position === 'left'}
    class:right={position === 'right'}
  >
    <!-- Tab Headers -->
    <div class="tools-panel__tabs">
      <button
        class="tab-btn"
        class:active={activeTab === 'zoom'}
        onclick={() => activeTab = 'zoom'}
      >
        Zoom
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'measure'}
        onclick={() => activeTab = 'measure'}
      >
        Measure
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'annotate'}
        onclick={() => activeTab = 'annotate'}
      >
        Annotate
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'review'}
        onclick={() => activeTab = 'review'}
      >
        Review
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'bookmarks'}
        onclick={() => activeTab = 'bookmarks'}
      >
        ROI
        {#if $bookmarkCount > 0}
          <span class="tab-badge">{$bookmarkCount}</span>
        {/if}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tools-panel__content">
      <!-- Zoom Tab -->
      {#if activeTab === 'zoom'}
        <div class="tab-content">
          <div class="section-label">Zoom Presets</div>
          <div class="zoom-presets">
            {#each ZOOM_PRESETS as preset}
              <button
                class="zoom-btn"
                class:active={currentMagnification && Math.abs(currentMagnification - preset.magnification) < 0.5}
                onclick={() => zoomToMagnification(preset.magnification)}
                disabled={!$slideMetadata}
              >
                {preset.label}
              </button>
            {/each}
          </div>
          <button
            class="action-btn"
            onclick={fitToScreen}
            disabled={!$slideMetadata}
          >
            Fit to Screen
          </button>

          {#if currentMagnification}
            <div class="current-mag">
              Current: {currentMagnification.toFixed(1)}x
            </div>
          {/if}

          <!-- Slide Label/Barcode (SRS UN-SAF-006) -->
          <div class="section-label">Slide Info</div>
          <SlideLabel mode="compact" />
        </div>
      {/if}

      <!-- Measure Tab -->
      {#if activeTab === 'measure'}
        <div class="tab-content">
          {#if $isMeasurementBlocked}
            <div class="block-warning">
              <span class="warning-icon">⚠️</span>
              <span>Measurements blocked in DX mode (unknown scale)</span>
            </div>
          {/if}

          <div class="section-label">Tools</div>
          <div class="tool-buttons">
            {#each MEASUREMENT_TOOLS as tool}
              <button
                class="tool-btn"
                class:active={$activeMeasurementTool === tool.type}
                class:disabled={!$canMeasure}
                onclick={() => selectMeasurementTool(tool.type)}
                title={tool.description}
                disabled={!$canMeasure}
              >
                <span class="tool-icon">{tool.icon}</span>
                <span class="tool-name">{tool.label}</span>
              </button>
            {/each}
          </div>

          <div class="section-label">Display Unit</div>
          <button class="unit-btn" onclick={toggleUnit}>
            {$measurementDisplayUnit === 'um' ? 'μm' : $measurementDisplayUnit}
          </button>

          <!-- Calibration Info -->
          <div class="calibration-info" style="--cal-color: {calibrationInfo.color}">
            <span class="cal-icon">{calibrationInfo.icon}</span>
            <div class="cal-details">
              <span class="cal-label">{calibrationInfo.label}</span>
              {#if $currentMpp}
                <span class="cal-mpp">{formatMpp($currentMpp)} μm/px</span>
              {/if}
            </div>
          </div>

          {#if $measurements.length > 0}
            <div class="section-label">Measurements ({$measurements.length})</div>
            <button class="action-btn danger" onclick={clearMeasurements}>
              Clear All
            </button>
          {/if}
        </div>
      {/if}

      <!-- Annotate Tab -->
      {#if activeTab === 'annotate'}
        <div class="tab-content">
          <div class="section-label">Text</div>
          <button
            class="tool-btn"
            class:active={$textAnnotationMode}
            onclick={enableTextAnnotation}
            disabled={!$slideMetadata}
          >
            <span class="tool-icon">T</span>
            <span class="tool-name">Add Text Label</span>
          </button>

          {#if $textAnnotationMode && !$pendingTextPosition}
            <div class="annotation-hint">
              Click on the slide to place text annotation
            </div>
          {/if}

          {#if $pendingTextPosition}
            <div class="text-input-container">
              <input
                type="text"
                class="text-input"
                placeholder="Enter annotation text..."
                bind:value={textAnnotationInput}
                onkeydown={(e) => e.key === 'Enter' && submitTextAnnotation()}
              />
              <div class="color-row">
                <span class="color-label">Color:</span>
                <input type="color" bind:value={textAnnotationColor} class="color-input" aria-label="Text color" />
              </div>
              <div class="text-input-actions">
                <button class="action-btn small" onclick={submitTextAnnotation}>Add</button>
                <button class="action-btn small secondary" onclick={cancelTextAnnotation}>Cancel</button>
              </div>
            </div>
          {/if}

          {#if $textAnnotations.length > 0}
            <div class="section-label">Labels ({$textAnnotations.length})</div>
            <button class="action-btn danger" onclick={() => textAnnotations.set([])}>
              Clear All Labels
            </button>
          {/if}

          <div class="section-label">Shapes</div>
          <div class="tool-buttons">
            {#each MEASUREMENT_TOOLS as tool}
              <button
                class="tool-btn"
                class:active={$activeMeasurementTool === tool.type}
                onclick={() => selectMeasurementTool(tool.type)}
                disabled={!$slideMetadata}
              >
                <span class="tool-icon">{tool.icon}</span>
                <span class="tool-name">{tool.label}</span>
              </button>
            {/each}
          </div>

          <!-- Calibration Info (for measurements) -->
          <div class="calibration-info" style="--cal-color: {calibrationInfo.color}">
            <span class="cal-icon">{calibrationInfo.icon}</span>
            <div class="cal-details">
              <span class="cal-label">{calibrationInfo.label}</span>
              {#if $currentMpp}
                <span class="cal-mpp">{formatMpp($currentMpp)} μm/px</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Review Tab (SRS SYS-RVW-001) -->
      {#if activeTab === 'review'}
        <div class="tab-content">
          {#if !canDeclareReviewState}
            <div class="block-warning">
              <span class="warning-icon">ℹ️</span>
              <span>Open a slide to declare review state</span>
            </div>
          {:else}
            <!-- Current State Indicator -->
            {#if currentReviewState}
              {@const stateConfig = USER_DECLARED_STATES[currentReviewState]}
              <div class="current-review-state" style="--state-color: {stateConfig.color}">
                <span class="state-icon">{stateConfig.icon}</span>
                <div class="state-details">
                  <span class="state-label">{stateConfig.label}</span>
                  <span class="state-desc">{stateConfig.description}</span>
                </div>
              </div>
            {/if}

            <div class="section-label">Declare State</div>
            <div class="review-buttons">
              <!-- Mark Reviewed Button -->
              <button
                class="review-btn reviewed"
                class:active={currentReviewState === 'reviewed'}
                onclick={() => declareReviewState('reviewed')}
              >
                <span class="review-icon">{USER_DECLARED_STATES.reviewed.icon}</span>
                <span class="review-label">Mark Reviewed</span>
              </button>

              <!-- Flag for Attention Button -->
              <button
                class="review-btn flagged"
                class:active={currentReviewState === 'flagged'}
                onclick={() => declareReviewState('flagged')}
              >
                <span class="review-icon">{USER_DECLARED_STATES.flagged.icon}</span>
                <span class="review-label">Flag for Attention</span>
              </button>

              <!-- Needs Attending Button -->
              <button
                class="review-btn needs-attending"
                class:active={currentReviewState === 'needs_attending'}
                onclick={() => declareReviewState('needs_attending')}
              >
                <span class="review-icon">{USER_DECLARED_STATES.needs_attending.icon}</span>
                <span class="review-label">Needs Attending</span>
              </button>
            </div>

            {#if currentReviewState}
              <button class="action-btn secondary" onclick={clearReviewState}>
                Clear State
              </button>
            {/if}

            <!-- Case Info -->
            {#if $currentCase}
              <div class="section-label">Case Info</div>
              <div class="case-info">
                <div class="case-info__row">
                  <span class="case-info__label">Case ID:</span>
                  <span class="case-info__value">{$currentCase.caseId}</span>
                </div>
                <div class="case-info__row">
                  <span class="case-info__label">Status:</span>
                  <span class="case-info__value">{$currentCase.status}</span>
                </div>
                <div class="case-info__row">
                  <span class="case-info__label">Slides:</span>
                  <span class="case-info__value">
                    {$currentCase.slides.filter(s => s.userDeclaredState === 'reviewed').length} / {$currentCase.slides.length} reviewed
                  </span>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Bookmarks/ROI Tab (SRS UN-WFL-001) -->
      {#if activeTab === 'bookmarks'}
        <div class="tab-content">
          <div class="section-label">Saved Positions</div>

          <!-- Add Bookmark Button / Form -->
          {#if showNewBookmarkForm}
            <div class="new-bookmark-form">
              <input
                type="text"
                class="text-input"
                placeholder="Bookmark name"
                bind:value={newBookmarkLabel}
                onkeydown={handleBookmarkKeydown}
              />
              <div class="text-input-actions">
                <button class="action-btn small" onclick={handleCreateBookmark}>
                  Save
                </button>
                <button class="action-btn small secondary" onclick={cancelNewBookmark}>
                  Cancel
                </button>
              </div>
            </div>
          {:else}
            <button
              class="action-btn"
              onclick={showAddBookmark}
              disabled={!$canCreateBookmark}
            >
              + Save Current Position
            </button>
          {/if}

          <!-- Bookmark List -->
          {#if $sortedBookmarks.length === 0}
            <div class="bookmark-empty">
              <span class="bookmark-empty-icon">&#128278;</span>
              <p>No bookmarks yet</p>
              <p class="bookmark-empty-hint">
                {#if $canCreateBookmark}
                  Save your current view to quickly return later
                {:else}
                  Open a slide to create bookmarks
                {/if}
              </p>
            </div>
          {:else}
            <div class="bookmark-list">
              {#each $sortedBookmarks as bookmark (bookmark.id)}
                <div
                  class="bookmark-item"
                  onclick={() => handleGoToBookmark(bookmark)}
                  onkeydown={(e) => e.key === 'Enter' && handleGoToBookmark(bookmark)}
                  role="button"
                  tabindex="0"
                  style="--bookmark-color: {bookmark.color || '#3b82f6'}"
                >
                  <div class="bookmark-item__indicator"></div>
                  <div class="bookmark-item__content">
                    <span class="bookmark-item__label">{bookmark.label}</span>
                    <span class="bookmark-item__zoom">{formatBookmarkZoom(bookmark.viewport.zoom)}</span>
                  </div>
                  <button
                    class="bookmark-item__delete"
                    onclick={(e) => { e.stopPropagation(); handleDeleteBookmark(bookmark.id); }}
                    title="Delete bookmark"
                    aria-label="Delete bookmark"
                  >
                    &times;
                  </button>
                </div>
              {/each}
            </div>

            <button
              class="action-btn danger"
              onclick={clearCurrentSlideBookmarks}
            >
              Clear All Bookmarks
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .tools-toggle {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 150;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: rgba(31, 41, 55, 0.95);
    border: 1px solid #374151;
    color: #d1d5db;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .tools-toggle.right {
    right: 0;
    border-radius: 8px 0 0 8px;
    border-right: none;
  }

  .tools-toggle.left {
    left: 0;
    border-radius: 0 8px 8px 0;
    border-left: none;
  }

  .tools-toggle.open.right {
    right: 240px;
  }

  .tools-toggle.open.left {
    left: 240px;
  }

  .tools-toggle:hover {
    background: rgba(55, 65, 81, 0.95);
    color: #fff;
  }

  .toggle-icon {
    font-size: 16px;
    font-weight: bold;
  }

  .toggle-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 12px;
    font-weight: 500;
  }

  .tools-panel {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 240px;
    background: rgba(31, 41, 55, 0.98);
    border: 1px solid #374151;
    z-index: 140;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tools-panel.right {
    right: 0;
    border-right: none;
    border-radius: 8px 0 0 8px;
  }

  .tools-panel.left {
    left: 0;
    border-left: none;
    border-radius: 0 8px 8px 0;
  }

  .tools-panel__tabs {
    display: flex;
    border-bottom: 1px solid #374151;
    background: rgba(0, 0, 0, 0.3);
  }

  .tab-btn {
    flex: 1;
    padding: 10px 8px;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    color: #d1d5db;
    background: rgba(255, 255, 255, 0.05);
  }

  .tab-btn.active {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    border-bottom: 2px solid #3b82f6;
  }

  .tools-panel__content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: #6b7280;
    margin-top: 8px;
  }

  .section-label:first-child {
    margin-top: 0;
  }

  .zoom-presets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .zoom-btn {
    padding: 8px 4px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid #374151;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .zoom-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: #4b5563;
  }

  .zoom-btn.active {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #60a5fa;
  }

  .zoom-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .current-mag {
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }

  .tool-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid #374151;
    border-radius: 6px;
    color: #d1d5db;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .tool-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: #4b5563;
  }

  .tool-btn.active {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #60a5fa;
  }

  .tool-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tool-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }

  .tool-name {
    font-size: 13px;
    font-weight: 500;
  }

  .unit-btn {
    width: 100%;
    padding: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid #374151;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .unit-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .calibration-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-left: 3px solid var(--cal-color);
    border-radius: 4px;
  }

  .cal-icon {
    font-size: 16px;
    color: var(--cal-color);
  }

  .cal-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cal-label {
    font-size: 12px;
    font-weight: 500;
    color: #d1d5db;
  }

  .cal-mpp {
    font-size: 11px;
    color: #9ca3af;
    font-family: monospace;
  }

  .action-btn {
    width: 100%;
    padding: 10px;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid #3b82f6;
    border-radius: 6px;
    color: #60a5fa;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.3);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.danger {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #fca5a5;
  }

  .action-btn.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
  }

  .action-btn.small {
    padding: 6px 12px;
    width: auto;
  }

  .action-btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    border-color: #4b5563;
    color: #9ca3af;
  }

  .block-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid #f59e0b;
    border-radius: 6px;
    font-size: 11px;
    color: #fcd34d;
  }

  .warning-icon {
    font-size: 14px;
  }

  .annotation-hint {
    padding: 10px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 4px;
    font-size: 12px;
    color: #93c5fd;
    text-align: center;
  }

  .text-input-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .text-input {
    width: 100%;
    padding: 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #374151;
    border-radius: 4px;
    color: #f9fafb;
    font-size: 13px;
  }

  .text-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .text-input-actions {
    display: flex;
    gap: 8px;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-label {
    font-size: 12px;
    color: #9ca3af;
  }

  .color-input {
    width: 32px;
    height: 24px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: transparent;
  }

  .color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-input::-webkit-color-swatch {
    border: 1px solid #374151;
    border-radius: 4px;
  }

  /* Review Tab Styles (SRS SYS-RVW-001) */
  .current-review-state {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border-left: 3px solid var(--state-color);
    border-radius: 4px;
    margin-bottom: 12px;
  }

  .state-icon {
    font-size: 20px;
    color: var(--state-color);
  }

  .state-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .state-label {
    font-size: 13px;
    font-weight: 600;
    color: #f9fafb;
  }

  .state-desc {
    font-size: 11px;
    color: #9ca3af;
  }

  .review-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .review-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid #374151;
    border-radius: 6px;
    color: #d1d5db;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .review-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: #4b5563;
  }

  .review-btn.reviewed:hover,
  .review-btn.reviewed.active {
    background: rgba(34, 197, 94, 0.2);
    border-color: #22c55e;
    color: #86efac;
  }

  .review-btn.flagged:hover,
  .review-btn.flagged.active {
    background: rgba(245, 158, 11, 0.2);
    border-color: #f59e0b;
    color: #fcd34d;
  }

  .review-btn.needs-attending:hover,
  .review-btn.needs-attending.active {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #fca5a5;
  }

  .review-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }

  .review-label {
    font-size: 13px;
    font-weight: 500;
  }

  .case-info {
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }

  .case-info__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 12px;
  }

  .case-info__row:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .case-info__label {
    color: #9ca3af;
  }

  .case-info__value {
    color: #d1d5db;
    font-weight: 500;
  }

  /* Tab Badge */
  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    margin-left: 4px;
    background: #3b82f6;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
    color: #fff;
  }

  /* Bookmarks Tab Styles (SRS UN-WFL-001) */
  .new-bookmark-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 6px;
  }

  .bookmark-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    text-align: center;
    color: #6b7280;
  }

  .bookmark-empty-icon {
    font-size: 28px;
    opacity: 0.5;
    margin-bottom: 8px;
  }

  .bookmark-empty p {
    margin: 0;
    font-size: 12px;
  }

  .bookmark-empty-hint {
    margin-top: 4px;
    font-size: 11px;
    color: #4b5563;
  }

  .bookmark-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .bookmark-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #374151;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .bookmark-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: #4b5563;
  }

  .bookmark-item:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .bookmark-item__indicator {
    width: 4px;
    height: 100%;
    min-height: 24px;
    background: var(--bookmark-color);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .bookmark-item__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bookmark-item__label {
    font-size: 12px;
    font-weight: 500;
    color: #e5e7eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bookmark-item__zoom {
    font-size: 10px;
    color: #6b7280;
    font-family: monospace;
  }

  .bookmark-item__delete {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #6b7280;
    font-size: 16px;
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s;
  }

  .bookmark-item:hover .bookmark-item__delete {
    opacity: 1;
  }

  .bookmark-item__delete:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

</style>
