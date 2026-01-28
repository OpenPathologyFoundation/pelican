<script lang="ts">
  /**
   * CaseBanner Component - Focus Declaration Protocol Announcement
   *
   * Displays a prominent banner when the window receives focus,
   * showing case and patient identification per FDP Layer 1 spec.
   *
   * Requirements (Section 5.2.2.2):
   * - Position: Top of viewport, spanning full width
   * - Minimum height: 48 pixels
   * - Minimum duration: 1.5 seconds
   * - Contrast ratio: >= 4.5:1 (WCAG AA)
   * - Animation: Slide down, not jarring
   */

  import { onMount, onDestroy } from 'svelte';
  import { caseContext, currentSlideId, diagnosticMode } from '../stores';
  import type { CaseContext } from '../types';

  /** Props */
  interface Props {
    /** Base display duration in milliseconds */
    baseDuration?: number;
    /** Maximum display duration in milliseconds */
    maxDuration?: number;
    /** Enable time-decay extended duration */
    timeDecayEnabled?: boolean;
    /** Enable privacy mode (show initials only) */
    privacyMode?: boolean;
    /** Callback when banner is shown */
    onshow?: () => void;
    /** Callback when banner is hidden */
    onhide?: () => void;
  }

  let {
    baseDuration = 2000,
    maxDuration = 5000,
    timeDecayEnabled = true,
    privacyMode = false,
    onshow,
    onhide,
  }: Props = $props();

  /** State */
  let visible = $state(false);
  let lastFocusTime = $state(Date.now());
  let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Computed: formatted patient name */
  let displayName = $derived(
    privacyMode && $caseContext
      ? formatPrivacyName($caseContext.patientName)
      : $caseContext?.patientName ?? ''
  );

  /** Computed: formatted DOB */
  let displayDob = $derived(
    privacyMode && $caseContext?.patientDob
      ? formatPrivacyDob($caseContext.patientDob)
      : $caseContext?.patientDob ?? ''
  );

  /** Format name for privacy mode */
  function formatPrivacyName(name: string): string {
    const parts = name.split(/[,\s]+/).filter(Boolean);
    return parts.map((p) => p[0].toUpperCase() + '.').join(' ');
  }

  /** Format DOB for privacy mode */
  function formatPrivacyDob(dob: string): string {
    const match = dob.match(/\d{4}/);
    return match ? match[0] : dob;
  }

  /** Calculate announcement duration with time decay */
  function calculateDuration(): number {
    if (!timeDecayEnabled) return baseDuration;

    const minutesSinceLastFocus = (Date.now() - lastFocusTime) / 60000;
    const extendedDuration = baseDuration + (minutesSinceLastFocus / 5) * 500;
    return Math.min(extendedDuration, maxDuration);
  }

  /** Show the banner */
  function showBanner(): void {
    if (!$caseContext) return;

    // Clear any existing timeout
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
    }

    visible = true;
    onshow?.();

    // Schedule hide
    const duration = calculateDuration();
    hideTimeoutId = setTimeout(() => {
      hideBanner();
    }, duration);
  }

  /** Hide the banner */
  function hideBanner(): void {
    visible = false;
    lastFocusTime = Date.now();
    onhide?.();
  }

  /** Handle window focus event */
  function handleWindowFocus(): void {
    showBanner();
  }

  /** Lifecycle */
  onMount(() => {
    window.addEventListener('focus', handleWindowFocus);

    // Show banner on initial mount if we have a case
    if ($caseContext) {
      showBanner();
    }
  });

  onDestroy(() => {
    window.removeEventListener('focus', handleWindowFocus);
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
    }
  });

  /** Effect: Show banner when case changes */
  $effect(() => {
    if ($caseContext) {
      showBanner();
    }
  });
</script>

{#if $caseContext}
  <div
    class="case-banner"
    class:visible
    class:diagnostic-mode={$diagnosticMode}
    role="alert"
    aria-live="assertive"
  >
    <div class="case-banner__content">
      <span class="case-banner__case-id">{$caseContext.caseId}</span>
      <span class="case-banner__separator"></span>
      <span class="case-banner__patient">{displayName}</span>
      {#if displayDob}
        <span class="case-banner__separator"></span>
        <span class="case-banner__dob">DOB: {displayDob}</span>
      {/if}
      {#if $currentSlideId}
        <span class="case-banner__separator"></span>
        <span class="case-banner__slide">{$currentSlideId}</span>
      {/if}
    </div>
    {#if $diagnosticMode}
      <div class="case-banner__dx-badge">DX MODE</div>
    {/if}
  </div>
{/if}

<style>
  .case-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10000;
    min-height: 36px;
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 6px 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transform: translateY(-100%);
    opacity: 0;
    transition: transform 300ms ease-out, opacity 300ms ease-out;
  }

  .case-banner.visible {
    transform: translateY(0);
    opacity: 1;
  }

  .case-banner.diagnostic-mode {
    background: linear-gradient(135deg, #744210 0%, #975a16 100%);
    border-bottom: 2px solid #f6e05e;
  }

  .case-banner__content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .case-banner__case-id {
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .case-banner__separator {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.4);
  }

  .case-banner__patient {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .case-banner__dob {
    font-size: 0.8rem;
    opacity: 0.9;
  }

  .case-banner__slide {
    font-size: 0.8rem;
    opacity: 0.85;
    font-family: monospace;
  }

  .case-banner__dx-badge {
    background: #f6e05e;
    color: #744210;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 3px;
    letter-spacing: 1px;
  }
</style>
