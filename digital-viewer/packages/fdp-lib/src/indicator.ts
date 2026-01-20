/**
 * Focus Declaration Protocol - Persistent Indicator
 *
 * Implements Section 5.2.2.3 and 5.3.2 of the specification
 */

import type { CaseContext, FDPConfig, IndicatorState, WarningType } from './types';

/** Create indicator HTML */
function createIndicatorElement(
  caseContext: CaseContext,
  config: FDPConfig,
  state: IndicatorState
): HTMLElement {
  const el = document.createElement('div');
  el.className = `${config.cssPrefix}-indicator`;

  if (config.diagnosticMode) {
    el.classList.add(`${config.cssPrefix}-diagnostic-mode`);
  }

  if (state.collapsed && !config.diagnosticMode) {
    el.classList.add(`${config.cssPrefix}-collapsed`);
  }

  const patientName = config.privacyMode
    ? caseContext.patientName
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((p) => p[0].toUpperCase() + '.')
        .join('')
    : caseContext.patientName;

  el.innerHTML = `
    <div class="${config.cssPrefix}-indicator__left">
      <span class="${config.cssPrefix}-indicator__case-id">${caseContext.caseId}</span>
      <span class="${config.cssPrefix}-indicator__patient">${patientName}</span>
      ${caseContext.slideId ? `<span class="${config.cssPrefix}-indicator__slide">${caseContext.slideId}</span>` : ''}
    </div>
    <div class="${config.cssPrefix}-indicator__right">
      <span class="${config.cssPrefix}-indicator__dx-badge ${config.diagnosticMode ? '' : config.cssPrefix + '-inactive'}">
        DX
      </span>
      ${state.warningActive ? createWarningBadge(state, config) : ''}
      <button class="${config.cssPrefix}-indicator__btn ${config.cssPrefix}-indicator__collapse"
              title="${state.collapsed ? 'Show header' : 'Hide header'}"
              aria-label="${state.collapsed ? 'Show header' : 'Hide header'}">
        ${state.collapsed ? '&#9660;' : '&#9650;'}
      </button>
      <button class="${config.cssPrefix}-indicator__btn ${config.cssPrefix}-indicator__settings"
              title="Settings" aria-label="Settings">
        &#9881;
      </button>
    </div>
  `;

  return el;
}

/** Create warning badge HTML */
function createWarningBadge(state: IndicatorState, config: FDPConfig): string {
  const isMismatch = state.warningType === 'case-mismatch';
  const text =
    state.warningType === 'multi-case'
      ? `${state.multiCaseCount || 2} cases open`
      : 'Case mismatch';

  return `
    <span class="${config.cssPrefix}-indicator__warning ${isMismatch ? config.cssPrefix + '-mismatch' : ''}"
          role="button" tabindex="0" aria-label="${text}">
      &#9888; ${text}
    </span>
  `;
}

/** Persistent indicator controller */
export class IndicatorController {
  private element: HTMLElement | null = null;
  private state: IndicatorState;
  private config: FDPConfig;
  private container: HTMLElement;
  private caseContext: CaseContext | null = null;

  // Event callbacks
  private onCollapseToggle?: () => void;
  private onSettingsClick?: () => void;
  private onWarningClick?: () => void;

  constructor(container: HTMLElement, config: FDPConfig) {
    this.container = container;
    this.config = config;
    this.state = {
      collapsed: false,
      warningActive: false,
    };
  }

  /** Show the indicator */
  show(caseContext: CaseContext): void {
    this.caseContext = caseContext;
    this.render();
  }

  /** Update the case context */
  update(caseContext: CaseContext): void {
    this.caseContext = caseContext;
    this.render();
  }

  /** Set warning state */
  setWarning(
    active: boolean,
    type?: WarningType,
    multiCaseCount?: number
  ): void {
    this.state.warningActive = active;
    this.state.warningType = type;
    this.state.multiCaseCount = multiCaseCount;

    // Auto-expand on warning
    if (active && this.state.collapsed) {
      this.state.collapsed = false;
    }

    this.render();
  }

  /** Toggle collapse state */
  toggleCollapse(): void {
    // Prevent collapse in Diagnostic Mode
    if (this.config.diagnosticMode) {
      return;
    }

    this.state.collapsed = !this.state.collapsed;
    this.render();
    this.onCollapseToggle?.();
  }

  /** Set event handlers */
  setEventHandlers(handlers: {
    onCollapseToggle?: () => void;
    onSettingsClick?: () => void;
    onWarningClick?: () => void;
  }): void {
    this.onCollapseToggle = handlers.onCollapseToggle;
    this.onSettingsClick = handlers.onSettingsClick;
    this.onWarningClick = handlers.onWarningClick;
  }

  /** Render the indicator */
  private render(): void {
    if (!this.caseContext) return;

    // Remove existing element
    if (this.element) {
      this.element.remove();
    }

    // Create new element
    this.element = createIndicatorElement(
      this.caseContext,
      this.config,
      this.state
    );
    this.container.appendChild(this.element);

    // Bind event listeners
    const collapseBtn = this.element.querySelector(
      `.${this.config.cssPrefix}-indicator__collapse`
    );
    collapseBtn?.addEventListener('click', () => this.toggleCollapse());

    const settingsBtn = this.element.querySelector(
      `.${this.config.cssPrefix}-indicator__settings`
    );
    settingsBtn?.addEventListener('click', () => this.onSettingsClick?.());

    const warningBadge = this.element.querySelector(
      `.${this.config.cssPrefix}-indicator__warning`
    );
    warningBadge?.addEventListener('click', () => this.onWarningClick?.());
  }

  /** Update configuration */
  updateConfig(config: Partial<FDPConfig>): void {
    this.config = { ...this.config, ...config };
    this.render();
  }

  /** Get current state */
  getState(): IndicatorState {
    return { ...this.state };
  }

  /** Check if collapsed */
  isCollapsed(): boolean {
    return this.state.collapsed;
  }

  /** Hide the indicator */
  hide(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  /** Destroy controller */
  destroy(): void {
    this.hide();
    this.caseContext = null;
  }
}
