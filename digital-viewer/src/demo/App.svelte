<script lang="ts">
  /**
   * Demo App - Digital Pathology Viewer
   *
   * Demonstrates the PathologyViewer component with FDP integration
   * Updated for Svelte 5 with runes
   */

  import { PathologyViewer } from '@pathology/viewer-core';

  // Configuration - use /api proxy in dev to avoid CORS issues
  const TILE_SERVER_URL = import.meta.env.VITE_TILE_SERVER_URL || '/api';

  /** State */
  let diagnosticMode = $state(false);
  let privacyMode = $state(false);

  /** Toggle diagnostic mode */
  function toggleDiagnosticMode(): void {
    diagnosticMode = !diagnosticMode;
  }

  /** Toggle privacy mode */
  function togglePrivacyMode(): void {
    privacyMode = !privacyMode;
  }

  /** Handle case change */
  function handleCaseChange(data: { caseId: string; caseDetails: unknown }): void {
    console.log('Case changed:', data.caseId);
  }

  /** Handle slide change */
  function handleSlideChange(data: { slideId: string; slide: unknown }): void {
    console.log('Slide changed:', data.slideId);
  }
</script>

<div class="demo-app">
  <!-- Mode toggles in corner -->
  <div class="demo-controls">
    <button
      class="demo-toggle"
      class:active={diagnosticMode}
      onclick={toggleDiagnosticMode}
      title="Toggle Diagnostic Mode"
    >
      DX
    </button>
    <button
      class="demo-toggle"
      class:active={privacyMode}
      onclick={togglePrivacyMode}
      title="Toggle Privacy Mode"
    >
      Privacy
    </button>
    <a class="demo-link" href="/basic" title="Basic Viewer Demo">
      Basic
    </a>
  </div>

  <PathologyViewer
    tileServerUrl={TILE_SERVER_URL}
    enableDiagnosticMode={diagnosticMode}
    enablePrivacyMode={privacyMode}
    oncasechange={handleCaseChange}
    onslidechange={handleSlideChange}
  />
</div>

<style>
  .demo-app {
    position: relative;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .demo-controls {
    position: fixed;
    bottom: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 100;
  }

  .demo-toggle {
    padding: 8px 12px;
    background: rgba(26, 26, 46, 0.9);
    border: 1px solid #333;
    border-radius: 6px;
    color: #888;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms;
  }

  .demo-toggle:hover {
    background: rgba(26, 26, 46, 1);
    color: #ccc;
  }

  .demo-toggle.active {
    background: rgba(59, 130, 246, 0.3);
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .demo-link {
    padding: 8px 12px;
    background: rgba(26, 26, 46, 0.9);
    border: 1px solid #333;
    border-radius: 6px;
    color: #888;
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 150ms;
  }

  .demo-link:hover {
    background: rgba(26, 26, 46, 1);
    color: #ccc;
  }
</style>
