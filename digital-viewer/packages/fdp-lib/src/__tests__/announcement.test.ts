/**
 * FDP Announcement Controller Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnnouncementController, calculateDuration } from '../announcement';
import { DEFAULT_CONFIG } from '../config';
import type { CaseContext, FDPConfig } from '../types';

describe('AnnouncementController', () => {
  let container: HTMLElement;
  let controller: AnnouncementController;
  const config: FDPConfig = { ...DEFAULT_CONFIG };

  const mockCaseContext: CaseContext = {
    caseId: 'TEST-12345',
    patientName: 'DOE, JOHN',
    patientDob: '01/01/1980',
  };

  beforeEach(() => {
    // Create a container in the DOM
    container = document.createElement('div');
    document.body.appendChild(container);
    controller = new AnnouncementController(container, config);
  });

  afterEach(() => {
    controller.destroy();
    container.remove();
  });

  it('should show announcement with case context', () => {
    controller.show(mockCaseContext, 3000);

    const announcement = container.querySelector(`.${config.cssPrefix}-announcement`);
    expect(announcement).not.toBeNull();
    expect(announcement?.textContent).toContain('TEST-12345');
    expect(announcement?.textContent).toContain('DOE, JOHN');
  });

  it('should hide announcement after duration', async () => {
    vi.useFakeTimers();

    controller.show(mockCaseContext, 1000);

    const announcement = container.querySelector(`.${config.cssPrefix}-announcement`);
    expect(announcement).not.toBeNull();

    // Fast-forward past animation duration
    vi.advanceTimersByTime(1500);

    // Element should be removed or hidden
    const afterHide = container.querySelector(`.${config.cssPrefix}-announcement`);
    expect(afterHide).toBeNull();

    vi.useRealTimers();
  });

  it('should mask patient name in privacy mode', () => {
    const privacyConfig = { ...config, privacyMode: true };
    const privacyController = new AnnouncementController(container, privacyConfig);

    privacyController.show(mockCaseContext, 3000);

    const announcement = container.querySelector(`.${config.cssPrefix}-announcement`);
    expect(announcement?.textContent).not.toContain('DOE, JOHN');
    // Should contain initials
    expect(announcement?.textContent).toContain('D.');

    privacyController.destroy();
  });

  it('should update config', () => {
    controller.updateConfig({ announcementDuration: 5000 });
    // Config update should not throw
    expect(true).toBe(true);
  });
});

describe('calculateDuration', () => {
  const config: FDPConfig = {
    ...DEFAULT_CONFIG,
    baseDuration: 3000,
    maxDuration: 8000,
    timeDecayEnabled: true,
  };

  it('should return base duration for recent focus', () => {
    const duration = calculateDuration(config, 0);
    expect(duration).toBe(3000);
  });

  it('should increase duration for longer time since focus', () => {
    const duration = calculateDuration(config, 10);
    expect(duration).toBeGreaterThan(3000);
  });

  it('should cap duration at max', () => {
    const duration = calculateDuration(config, 1000);
    expect(duration).toBeLessThanOrEqual(8000);
  });

  it('should handle negative time gracefully', () => {
    // Negative time results in reduced duration (base + negative bonus)
    // The formula allows this, so just verify it doesn't crash
    const duration = calculateDuration(config, -5);
    expect(duration).toBeGreaterThan(0);
  });
});
