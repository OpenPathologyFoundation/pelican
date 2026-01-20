/**
 * Focus Declaration Protocol - Warning Modal
 *
 * Implements Section 5.3.3 of the specification
 */

import type { FDPConfig, SessionWarning } from './types';

export interface ModalAction {
  label: string;
  primary?: boolean;
  callback: () => void;
}

/** Create warning modal HTML */
function createModalElement(
  warning: SessionWarning,
  actions: ModalAction[],
  config: FDPConfig
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = `${config.cssPrefix}-modal-overlay`;

  const modal = document.createElement('div');
  modal.className = `${config.cssPrefix}-modal`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  let content = '';

  if (warning.type === 'multi-case') {
    content = `
      <h2 class="${config.cssPrefix}-modal__title">
        <span>&#9888;</span> Multiple Cases Open
      </h2>
      <div class="${config.cssPrefix}-modal__content">
        <p>Your account has the following cases currently open:</p>
        <div class="${config.cssPrefix}-modal__case-list">
          ${warning.cases
            ?.map(
              (c) => `
            <div class="${config.cssPrefix}-modal__case-item">
              <strong>${c.caseId}</strong> (${c.patientName})<br>
              <small>${c.location}</small>
            </div>
          `
            )
            .join('')}
        </div>
        <p>Please verify you are working on the correct case.</p>
      </div>
    `;
  } else if (warning.type === 'case-mismatch') {
    const currentCase = warning.cases?.[0];
    const newCase = warning.cases?.[1];

    content = `
      <h2 class="${config.cssPrefix}-modal__title">
        <span>&#9888;</span> Case Mismatch Detected
      </h2>
      <div class="${config.cssPrefix}-modal__content">
        <p><strong>This viewer is showing:</strong></p>
        <div class="${config.cssPrefix}-modal__case-list">
          <div class="${config.cssPrefix}-modal__case-item">
            ${currentCase?.caseId} (${currentCase?.patientName})
          </div>
        </div>
        <p><strong>Your Case Context is now working on:</strong></p>
        <div class="${config.cssPrefix}-modal__case-list">
          <div class="${config.cssPrefix}-modal__case-item">
            ${newCase?.caseId} (${newCase?.patientName})
          </div>
        </div>
      </div>
    `;
  } else {
    content = `
      <h2 class="${config.cssPrefix}-modal__title">
        <span>&#9888;</span> Warning
      </h2>
      <div class="${config.cssPrefix}-modal__content">
        <p>${warning.message || 'An unexpected condition occurred.'}</p>
      </div>
    `;
  }

  const actionsHtml = actions
    .map(
      (action, index) => `
    <button class="${config.cssPrefix}-modal__btn ${action.primary ? config.cssPrefix + '-modal__btn--primary' : config.cssPrefix + '-modal__btn--secondary'}"
            data-action-index="${index}">
      ${action.label}
    </button>
  `
    )
    .join('');

  modal.innerHTML = `
    ${content}
    <div class="${config.cssPrefix}-modal__actions">
      ${actionsHtml}
    </div>
  `;

  overlay.appendChild(modal);
  return overlay;
}

/** Warning modal controller */
export class ModalController {
  private element: HTMLElement | null = null;
  private config: FDPConfig;

  constructor(config: FDPConfig) {
    this.config = config;
  }

  /** Show a warning modal */
  show(warning: SessionWarning, actions: ModalAction[]): void {
    // Close any existing modal
    this.close();

    this.element = createModalElement(warning, actions, this.config);
    document.body.appendChild(this.element);

    // Bind action buttons
    const buttons = this.element.querySelectorAll(
      `.${this.config.cssPrefix}-modal__btn`
    );
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(
          btn.getAttribute('data-action-index') || '0',
          10
        );
        actions[index]?.callback();
        this.close();
      });
    });

    // Close on overlay click (outside modal)
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        // Only close if there's an "acknowledge" or "cancel" action
        const hasAcknowledge = actions.some(
          (a) =>
            a.label.toLowerCase().includes('acknowledge') ||
            a.label.toLowerCase().includes('cancel') ||
            a.label.toLowerCase().includes('stay')
        );
        if (hasAcknowledge) {
          this.close();
        }
      }
    });

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus first button
    const firstButton = this.element.querySelector('button');
    firstButton?.focus();
  }

  /** Close the modal */
  close(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  /** Check if modal is open */
  isOpen(): boolean {
    return this.element !== null;
  }

  /** Update configuration */
  updateConfig(config: Partial<FDPConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Destroy controller */
  destroy(): void {
    this.close();
  }
}
