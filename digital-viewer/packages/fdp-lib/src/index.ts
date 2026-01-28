/**
 * Focus Declaration Protocol (FDP) Library
 *
 * A safety mechanism ensuring pathologists always know which case they are examining.
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 5
 *
 * @example
 * ```typescript
 * import { FocusDeclarationProtocol } from '@pathology/fdp-lib';
 *
 * const fdp = new FocusDeclarationProtocol({
 *   diagnosticMode: true,
 *   sessionServiceUrl: 'wss://portal.example.com/session',
 *   userId: 'user-12345',
 * });
 *
 * fdp.initialize({
 *   caseId: 'UPMC:S26-12345',
 *   patientName: 'SMITH, JOHN',
 *   patientDob: '01/15/1960',
 * });
 *
 * // Listen for events
 * fdp.on('warning', (event) => {
 *   console.log('Warning:', event.warning);
 * });
 * ```
 */

import { AnnouncementController, calculateDuration } from './announcement';
import { AudioController } from './audio';
import { DEFAULT_CONFIG, FDP_STYLES } from './config';
import { IndicatorController } from './indicator';
import { ModalController } from './modal';
import { SessionClient } from './session';
import type {
  CaseContext,
  FDPConfig,
  FDPEvent,
  FDPEventListener,
  FDPEventType,
  SessionWarning,
} from './types';

// Re-export types
export type {
  CaseContext,
  FDPConfig,
  FDPEvent,
  FDPEventType,
  SessionWarning,
} from './types';

/** Focus Declaration Protocol main class */
export class FocusDeclarationProtocol {
  private config: FDPConfig;
  private container: HTMLElement | null = null;
  private caseContext: CaseContext | null = null;
  private lastFocusTime: number = Date.now();
  private initialized: boolean = false;

  // Controllers
  private announcement: AnnouncementController | null = null;
  private indicator: IndicatorController | null = null;
  private modal: ModalController | null = null;
  private audio: AudioController | null = null;
  private session: SessionClient | null = null;

  // Event listeners
  private listeners: Map<FDPEventType, Set<FDPEventListener>> = new Map();

  // Bound handlers for cleanup
  private handleFocus: () => void;
  private handleBlur: () => void;
  private handleBeforeUnload: () => void;

  constructor(config: Partial<FDPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Bind event handlers
    this.handleFocus = this.onFocus.bind(this);
    this.handleBlur = this.onBlur.bind(this);
    this.handleBeforeUnload = this.onBeforeUnload.bind(this);
  }

  /** Initialize FDP with a case context */
  async initialize(caseContext: CaseContext): Promise<void> {
    if (this.initialized) {
      // Update existing context
      this.updateCaseContext(caseContext);
      return;
    }

    this.caseContext = caseContext;
    this.lastFocusTime = Date.now();

    // Inject styles
    this.injectStyles();

    // Create container
    this.container = document.createElement('div');
    this.container.className = `${this.config.cssPrefix}-container`;
    this.container.style.setProperty('--fdp-z-index', String(this.config.zIndex));
    document.body.appendChild(this.container);

    // Initialize controllers
    this.announcement = new AnnouncementController(this.container, this.config);
    this.indicator = new IndicatorController(this.container, this.config);
    this.modal = new ModalController(this.config);
    this.audio = new AudioController(this.config);

    // Set up indicator event handlers
    this.indicator.setEventHandlers({
      onWarningClick: () => this.showWarningDetails(),
      onSettingsClick: () => this.emit({ type: 'blur', timestamp: new Date() }),
    });

    // Initialize Layer 2 if configured
    if (this.config.sessionServiceUrl && this.config.userId) {
      this.session = new SessionClient(this.config);
      this.session.setEventHandlers({
        onWarning: (warning) => this.handleSessionWarning(warning),
        onConnected: () =>
          this.emit({ type: 'session-connected', timestamp: new Date() }),
        onDisconnected: () =>
          this.emit({ type: 'session-disconnected', timestamp: new Date() }),
      });

      try {
        await this.session.connect();
        this.session.register(caseContext);
      } catch (error) {
        console.warn('[FDP] Failed to connect to session service:', error);
      }
    }

    // Set up window event listeners
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // Show initial announcement and indicator
    this.showAnnouncement();
    this.indicator.show(caseContext);

    this.initialized = true;
  }

  /** Update case context */
  updateCaseContext(caseContext: CaseContext): void {
    this.caseContext = caseContext;

    if (this.indicator) {
      this.indicator.update(caseContext);
    }

    if (this.session) {
      this.session.register(caseContext);
    }
  }

  /** Handle window focus event */
  private onFocus(): void {
    if (!this.caseContext) return;

    this.emit({
      type: 'focus',
      timestamp: new Date(),
      caseContext: this.caseContext,
    });

    this.showAnnouncement();
  }

  /** Handle window blur event */
  private onBlur(): void {
    this.emit({ type: 'blur', timestamp: new Date() });
  }

  /** Handle beforeunload event */
  private onBeforeUnload(): void {
    if (this.session) {
      this.session.deregister();
    }
  }

  /** Show focus announcement */
  private showAnnouncement(): void {
    if (!this.caseContext || !this.announcement) return;

    // Calculate duration with time-decay
    const minutesSinceLastFocus = (Date.now() - this.lastFocusTime) / 60000;
    const duration = calculateDuration(this.config, minutesSinceLastFocus);

    this.lastFocusTime = Date.now();

    this.emit({
      type: 'announcement-start',
      timestamp: new Date(),
      caseContext: this.caseContext,
    });

    this.announcement.show(this.caseContext, duration);

    // Play audio announcement
    this.audio?.announce(this.caseContext);

    // Schedule end event
    setTimeout(() => {
      this.emit({
        type: 'announcement-end',
        timestamp: new Date(),
        caseContext: this.caseContext!,
      });
    }, duration);
  }

  /** Handle session warning */
  private handleSessionWarning(warning: SessionWarning): void {
    this.emit({
      type: 'warning',
      timestamp: new Date(),
      warning,
    });

    // Update indicator
    if (this.indicator) {
      this.indicator.setWarning(
        true,
        warning.type,
        warning.cases?.length
      );
    }

    // Show modal for case mismatch
    if (warning.type === 'case-mismatch' && this.modal) {
      this.modal.show(warning, [
        {
          label: 'View New Case',
          primary: true,
          callback: () => {
            // Emit event for parent to handle navigation
            this.emit({
              type: 'warning',
              timestamp: new Date(),
              warning: { ...warning, type: 'case-mismatch' },
            });
          },
        },
        {
          label: 'Stay on Current',
          callback: () => {
            this.indicator?.setWarning(true, 'multi-case', 2);
          },
        },
      ]);
    }
  }

  /** Show warning details modal */
  private showWarningDetails(): void {
    const state = this.indicator?.getState();
    if (!state?.warningActive || !this.modal) return;

    // Create a synthetic warning for display
    const warning: SessionWarning = {
      type: state.warningType || 'multi-case',
      cases: [], // Would be populated from session state
      message: 'Multiple cases are open in this session.',
    };

    this.modal.show(warning, [
      {
        label: 'Acknowledge',
        primary: true,
        callback: () => {},
      },
    ]);
  }

  /** Inject FDP styles into document */
  private injectStyles(): void {
    const styleId = `${this.config.cssPrefix}-styles`;
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = FDP_STYLES;
    document.head.appendChild(style);
  }

  /** Add event listener */
  on(event: FDPEventType, listener: FDPEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /** Remove event listener */
  off(event: FDPEventType, listener: FDPEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  /** Emit event to listeners */
  private emit(event: FDPEvent): void {
    this.listeners.get(event.type)?.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[FDP] Event listener error:', error);
      }
    });
  }

  /** Update configuration */
  configure(config: Partial<FDPConfig>): void {
    this.config = { ...this.config, ...config };

    this.announcement?.updateConfig(config);
    this.indicator?.updateConfig(config);
    this.modal?.updateConfig(config);
    this.audio?.updateConfig(config);
    this.session?.updateConfig(config);
  }

  /** Get current configuration */
  getConfig(): FDPConfig {
    return { ...this.config };
  }

  /** Get current case context */
  getCaseContext(): CaseContext | null {
    return this.caseContext ? { ...this.caseContext } : null;
  }

  /** Check if in Diagnostic Mode */
  isDiagnosticMode(): boolean {
    return this.config.diagnosticMode;
  }

  /** Set Diagnostic Mode */
  setDiagnosticMode(enabled: boolean): void {
    this.config.diagnosticMode = enabled;
    this.indicator?.updateConfig({ diagnosticMode: enabled });
  }

  /** Set privacy mode */
  setPrivacyMode(enabled: boolean): void {
    this.config.privacyMode = enabled;
    if (this.caseContext) {
      this.indicator?.update(this.caseContext);
    }
  }

  /** Toggle audio */
  toggleAudio(): boolean {
    return this.audio?.toggle() ?? false;
  }

  /** Check if connected to session service */
  isSessionConnected(): boolean {
    return this.session?.isConnected() ?? false;
  }

  /** Destroy FDP instance */
  destroy(): void {
    // Remove event listeners
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    // Destroy controllers
    this.announcement?.destroy();
    this.indicator?.destroy();
    this.modal?.destroy();
    this.audio?.destroy();
    this.session?.destroy();

    // Remove container
    this.container?.remove();

    // Clear state
    this.announcement = null;
    this.indicator = null;
    this.modal = null;
    this.audio = null;
    this.session = null;
    this.container = null;
    this.caseContext = null;
    this.listeners.clear();
    this.initialized = false;
  }
}

// WCAG Contrast Validation (SRS SYS-FDP-005)
export {
  hexToRgb,
  getLuminance,
  getContrastRatio,
  meetsWcagAA,
  meetsWcagAAA,
  getContrastRatioHex,
  suggestAccessibleColor,
  validateFdpColors,
  WCAG_AA_MIN_CONTRAST,
  WCAG_AAA_MIN_CONTRAST,
  WCAG_AA_LARGE_TEXT_MIN_CONTRAST,
  type RGB,
} from './contrast';

// Default export
export default FocusDeclarationProtocol;
