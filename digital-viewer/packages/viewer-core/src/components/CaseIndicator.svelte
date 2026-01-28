<script lang="ts">
  /**
   * CaseIndicator Component - Persistent Case Header
   *
   * Always-visible header showing current case identification per FDP Layer 1 spec.
   *
   * Requirements (Section 5.2.2.3):
   * - Position: Top of viewport
   * - Minimum height: 24 pixels
   * - Visibility: MUST be visible at all times during case viewing
   * - Collapsibility: MAY be collapsible in non-Diagnostic Mode
   *                   MUST NOT be collapsible in Diagnostic Mode
   *                   MUST auto-reveal on warnings
   */

  import { caseContext, currentSlideId, diagnosticMode } from '../stores';

  /** Props */
  interface Props {
    /** Enable privacy mode (show initials only) */
    privacyMode?: boolean;
    /** Warning: multiple cases open */
    multiCaseWarning?: boolean;
    /** Number of cases open (for warning) */
    openCaseCount?: number;
    /** Warning: case mismatch detected */
    mismatchWarning?: boolean;
    /** Callback when settings button clicked */
    onsettings?: () => void;
    /** Callback when warning clicked */
    onwarningclick?: () => void;
  }

  let {
    privacyMode = false,
    multiCaseWarning = false,
    openCaseCount = 0,
    mismatchWarning = false,
    onsettings,
    onwarningclick,
  }: Props = $props();

  /** State */
  let collapsed = $state(false);

  /** Computed: formatted patient name */
  let displayName = $derived(
    privacyMode && $caseContext
      ? formatPrivacyName($caseContext.patientName)
      : $caseContext?.patientName ?? ''
  );

  /** Computed: has any warning */
  let hasWarning = $derived(multiCaseWarning || mismatchWarning);

  /** Format name for privacy mode */
  function formatPrivacyName(name: string): string {
    const parts = name.split(/[,\s]+/).filter(Boolean);
    return parts.map((p) => p[0].toUpperCase() + '.').join(' ');
  }

  /** Toggle collapse state */
  function toggleCollapse(): void {
    // Cannot collapse in Diagnostic Mode
    if ($diagnosticMode) return;

    collapsed = !collapsed;
  }

  /** Effect: Auto-expand on warning */
  $effect(() => {
    if (hasWarning && collapsed) {
      collapsed = false;
    }
  });
</script>

{#if $caseContext}
  <div
    class="case-indicator"
    class:collapsed={collapsed && !$diagnosticMode}
    class:diagnostic-mode={$diagnosticMode}
    class:has-warning={hasWarning}
  >
    <div class="case-indicator__left">
      <span class="case-indicator__case-id">{$caseContext.caseId}</span>
      <span class="case-indicator__separator">|</span>
      <span class="case-indicator__patient">{displayName}</span>
      {#if $currentSlideId}
        <span class="case-indicator__separator">|</span>
        <span class="case-indicator__slide">{$currentSlideId}</span>
      {/if}
    </div>

    <div class="case-indicator__right">
      {#if $diagnosticMode}
        <span class="case-indicator__dx-badge">DX</span>
      {/if}

      {#if multiCaseWarning}
        <button
          class="case-indicator__warning"
          onclick={() => onwarningclick?.()}
          aria-label="{openCaseCount} cases open"
        >
          <span class="case-indicator__warning-icon">⚠</span>
          <span>{openCaseCount} cases open</span>
        </button>
      {/if}

      {#if mismatchWarning}
        <button
          class="case-indicator__warning case-indicator__warning--mismatch"
          onclick={() => onwarningclick?.()}
          aria-label="Case mismatch detected"
        >
          <span class="case-indicator__warning-icon">⚠</span>
          <span>Case mismatch</span>
        </button>
      {/if}

      {#if !$diagnosticMode}
        <button
          class="case-indicator__btn"
          onclick={toggleCollapse}
          title={collapsed ? 'Show header' : 'Hide header'}
          aria-label={collapsed ? 'Show header' : 'Hide header'}
        >
          {collapsed ? '▼' : '▲'}
        </button>
      {/if}

      <button
        class="case-indicator__btn"
        onclick={() => onsettings?.()}
        title="Settings"
        aria-label="Settings"
      >
        ⚙
      </button>
    </div>
  </div>
{/if}

<style>
  .case-indicator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
    padding: 2px 10px;
    background: linear-gradient(135deg, rgba(26, 54, 93, 0.95) 0%, rgba(44, 82, 130, 0.95) 100%);
    color: #fff;
    font-size: 0.75rem;
    transition: transform 200ms ease-out, opacity 200ms ease-out;
  }

  .case-indicator.collapsed {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .case-indicator.diagnostic-mode {
    background: linear-gradient(135deg, rgba(116, 66, 16, 0.95) 0%, rgba(151, 90, 22, 0.95) 100%);
    border-bottom: 2px solid #f6e05e;
  }

  .case-indicator.has-warning {
    background: linear-gradient(135deg, rgba(116, 66, 16, 0.95) 0%, rgba(151, 90, 22, 0.95) 100%);
  }

  .case-indicator__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .case-indicator__case-id {
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .case-indicator__separator {
    opacity: 0.5;
  }

  .case-indicator__patient {
    opacity: 0.95;
  }

  .case-indicator__slide {
    opacity: 0.8;
    font-size: 0.8rem;
  }

  .case-indicator__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .case-indicator__dx-badge {
    background: #f6e05e;
    color: #744210;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 2px;
    letter-spacing: 0.5px;
  }

  .case-indicator__warning {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #ed8936;
    color: #fff;
    border: none;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms;
  }

  .case-indicator__warning:hover {
    background: #dd6b20;
  }

  .case-indicator__warning--mismatch {
    background: #e53e3e;
  }

  .case-indicator__warning--mismatch:hover {
    background: #c53030;
  }

  .case-indicator__warning-icon {
    font-size: 0.7rem;
  }

  .case-indicator__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    border-radius: 3px;
    font-size: 0.7rem;
    transition: background 150ms, color 150ms;
  }

  .case-indicator__btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }
</style>
