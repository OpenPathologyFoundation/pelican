/**
 * Focus Declaration Protocol - Configuration
 */

import type { FDPConfig } from './types';

/** Default FDP configuration */
export const DEFAULT_CONFIG: FDPConfig = {
  baseDuration: 2000,
  maxDuration: 5000,
  timeDecayEnabled: true,
  privacyMode: false,
  audioMode: 'off',
  diagnosticMode: true,
  cssPrefix: 'fdp',
  zIndex: 10000,
  heartbeatInterval: 30000,
};

/** CSS styles for FDP elements */
export const FDP_STYLES = `
  .fdp-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--fdp-z-index, 10000);
  }

  /* Announcement Banner */
  .fdp-announcement {
    background: var(--fdp-announcement-bg, #1a365d);
    color: var(--fdp-announcement-color, #ffffff);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 64px;
    transform: translateY(-100%);
    transition: transform 200ms ease-out;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .fdp-announcement.fdp-visible {
    transform: translateY(0);
  }

  .fdp-announcement__case-id {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .fdp-announcement__separator {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.3);
  }

  .fdp-announcement__patient {
    font-size: 1.1rem;
  }

  .fdp-announcement__dob {
    font-size: 0.9rem;
    opacity: 0.8;
  }

  /* Persistent Indicator */
  .fdp-indicator {
    background: var(--fdp-indicator-bg, rgba(26, 54, 93, 0.95));
    color: var(--fdp-indicator-color, #ffffff);
    padding: 4px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 28px;
    font-size: 0.875rem;
    transition: transform 200ms ease-out, opacity 200ms ease-out;
  }

  .fdp-indicator.fdp-collapsed {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .fdp-indicator.fdp-diagnostic-mode .fdp-indicator__collapse {
    display: none;
  }

  .fdp-indicator__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .fdp-indicator__case-id {
    font-weight: 600;
  }

  .fdp-indicator__patient {
    opacity: 0.9;
  }

  .fdp-indicator__slide {
    opacity: 0.7;
    font-size: 0.8rem;
  }

  .fdp-indicator__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .fdp-indicator__dx-badge {
    background: var(--fdp-dx-active, #48bb78);
    color: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .fdp-indicator__dx-badge.fdp-inactive {
    background: var(--fdp-dx-inactive, #718096);
  }

  .fdp-indicator__warning {
    background: var(--fdp-warning-bg, #ed8936);
    color: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  .fdp-indicator__warning.fdp-mismatch {
    background: var(--fdp-error-bg, #e53e3e);
  }

  .fdp-indicator__btn {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 4px;
    opacity: 0.7;
    transition: opacity 150ms;
  }

  .fdp-indicator__btn:hover {
    opacity: 1;
  }

  /* Warning Modal */
  .fdp-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: calc(var(--fdp-z-index, 10000) + 1);
  }

  .fdp-modal {
    background: #fff;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .fdp-modal__title {
    color: #c53030;
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .fdp-modal__content {
    color: #2d3748;
    line-height: 1.6;
  }

  .fdp-modal__case-list {
    background: #f7fafc;
    border-radius: 4px;
    padding: 12px;
    margin: 12px 0;
  }

  .fdp-modal__case-item {
    padding: 8px 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .fdp-modal__case-item:last-child {
    border-bottom: none;
  }

  .fdp-modal__actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
    justify-content: flex-end;
  }

  .fdp-modal__btn {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms;
  }

  .fdp-modal__btn--primary {
    background: #3182ce;
    color: #fff;
    border: none;
  }

  .fdp-modal__btn--primary:hover {
    background: #2c5aa0;
  }

  .fdp-modal__btn--secondary {
    background: #fff;
    color: #4a5568;
    border: 1px solid #e2e8f0;
  }

  .fdp-modal__btn--secondary:hover {
    background: #f7fafc;
  }
`;
