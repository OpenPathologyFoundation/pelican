/**
 * Focus Declaration Protocol - Announcement Display
 *
 * Implements Section 5.2.2.2 and 5.3.1 of the specification
 */

import type { CaseContext, FDPConfig, AnnouncementState } from './types';

/** Format patient name for privacy mode */
function formatPrivacyName(name: string): string {
  const parts = name.split(/[,\s]+/).filter(Boolean);
  return parts.map((p) => p[0].toUpperCase() + '.').join('');
}

/** Format DOB for privacy mode */
function formatPrivacyDob(dob: string): string {
  // Extract year from various date formats
  const match = dob.match(/\d{4}/);
  return match ? match[0] : dob;
}

/** Create announcement HTML */
export function createAnnouncementElement(
  caseContext: CaseContext,
  config: FDPConfig
): HTMLElement {
  const el = document.createElement('div');
  el.className = `${config.cssPrefix}-announcement`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');

  const patientName = config.privacyMode
    ? formatPrivacyName(caseContext.patientName)
    : caseContext.patientName;

  const patientDob =
    caseContext.patientDob && config.privacyMode
      ? formatPrivacyDob(caseContext.patientDob)
      : caseContext.patientDob;

  el.innerHTML = `
    <span class="${config.cssPrefix}-announcement__case-id">${caseContext.caseId}</span>
    <span class="${config.cssPrefix}-announcement__separator"></span>
    <span class="${config.cssPrefix}-announcement__patient">${patientName}</span>
    ${patientDob ? `<span class="${config.cssPrefix}-announcement__separator"></span><span class="${config.cssPrefix}-announcement__dob">DOB: ${patientDob}</span>` : ''}
  `;

  return el;
}

/** Calculate announcement duration with time-decay */
export function calculateDuration(
  config: FDPConfig,
  minutesSinceLastFocus: number
): number {
  if (!config.timeDecayEnabled) {
    return config.baseDuration;
  }

  // Formula: base_duration + (minutes_since_last_focus / 5) * 500
  const extendedDuration =
    config.baseDuration + (minutesSinceLastFocus / 5) * 500;

  return Math.min(extendedDuration, config.maxDuration);
}

/** Announcement display controller */
export class AnnouncementController {
  private element: HTMLElement | null = null;
  private state: AnnouncementState | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private config: FDPConfig;
  private container: HTMLElement;

  constructor(container: HTMLElement, config: FDPConfig) {
    this.container = container;
    this.config = config;
  }

  /** Show the announcement */
  show(caseContext: CaseContext, duration: number): void {
    // Clear any existing timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Remove existing element
    if (this.element) {
      this.element.remove();
    }

    // Create new element
    this.element = createAnnouncementElement(caseContext, this.config);
    this.container.appendChild(this.element);

    // Trigger animation
    requestAnimationFrame(() => {
      this.element?.classList.add(`${this.config.cssPrefix}-visible`);
    });

    // Update state
    this.state = {
      visible: true,
      startTime: Date.now(),
      duration,
      caseContext,
    };

    // Schedule hide
    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, duration);
  }

  /** Hide the announcement */
  hide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.element) {
      this.element.classList.remove(`${this.config.cssPrefix}-visible`);

      // Remove element after animation
      setTimeout(() => {
        this.element?.remove();
        this.element = null;
      }, 200);
    }

    if (this.state) {
      this.state.visible = false;
    }
  }

  /** Update configuration */
  updateConfig(config: Partial<FDPConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get current state */
  getState(): AnnouncementState | null {
    return this.state;
  }

  /** Destroy controller */
  destroy(): void {
    this.hide();
    this.state = null;
  }
}
