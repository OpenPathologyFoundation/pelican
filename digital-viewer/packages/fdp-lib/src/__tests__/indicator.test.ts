/**
 * FDP Indicator Controller Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndicatorController } from '../indicator';
import { DEFAULT_CONFIG } from '../config';
import type { CaseContext, FDPConfig } from '../types';

describe('IndicatorController', () => {
  let container: HTMLElement;
  let controller: IndicatorController;
  // Use diagnosticMode: false to allow collapse testing
  const config: FDPConfig = { ...DEFAULT_CONFIG, diagnosticMode: false };

  const mockCaseContext: CaseContext = {
    caseId: 'CASE-001',
    patientName: 'SMITH, JANE',
    slideId: 'SLIDE-A',
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    controller = new IndicatorController(container, config);
  });

  afterEach(() => {
    controller.destroy();
    container.remove();
  });

  it('should show indicator with case info', () => {
    controller.show(mockCaseContext);

    const indicator = container.querySelector(`.${config.cssPrefix}-indicator`);
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toContain('CASE-001');
    expect(indicator?.textContent).toContain('SMITH, JANE');
  });

  it('should display slide ID when provided', () => {
    controller.show(mockCaseContext);

    const indicator = container.querySelector(`.${config.cssPrefix}-indicator`);
    expect(indicator?.textContent).toContain('SLIDE-A');
  });

  it('should update case context', () => {
    controller.show(mockCaseContext);
    controller.update({ ...mockCaseContext, caseId: 'CASE-002' });

    const indicator = container.querySelector(`.${config.cssPrefix}-indicator`);
    expect(indicator?.textContent).toContain('CASE-002');
  });

  it('should show warning badge when warning is active', () => {
    controller.show(mockCaseContext);
    controller.setWarning(true, 'multi-case', 3);

    const warning = container.querySelector(`.${config.cssPrefix}-indicator__warning`);
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain('3 cases open');
  });

  it('should show case mismatch warning', () => {
    controller.show(mockCaseContext);
    controller.setWarning(true, 'case-mismatch');

    const warning = container.querySelector(`.${config.cssPrefix}-indicator__warning`);
    expect(warning?.textContent).toContain('Case mismatch');
  });

  it('should toggle collapse state', () => {
    controller.show(mockCaseContext);

    expect(controller.isCollapsed()).toBe(false);
    controller.toggleCollapse();
    expect(controller.isCollapsed()).toBe(true);
    controller.toggleCollapse();
    expect(controller.isCollapsed()).toBe(false);
  });

  it('should not collapse in diagnostic mode', () => {
    const diagConfig = { ...config, diagnosticMode: true };
    const diagController = new IndicatorController(container, diagConfig);

    diagController.show(mockCaseContext);
    diagController.toggleCollapse();

    expect(diagController.isCollapsed()).toBe(false);

    diagController.destroy();
  });

  it('should auto-expand on warning', () => {
    controller.show(mockCaseContext);
    controller.toggleCollapse();
    expect(controller.isCollapsed()).toBe(true);

    controller.setWarning(true, 'multi-case', 2);
    expect(controller.isCollapsed()).toBe(false);
  });

  it('should return correct state', () => {
    controller.show(mockCaseContext);
    controller.setWarning(true, 'multi-case', 2);

    const state = controller.getState();
    expect(state.warningActive).toBe(true);
    expect(state.warningType).toBe('multi-case');
    expect(state.multiCaseCount).toBe(2);
  });

  it('should hide and destroy correctly', () => {
    controller.show(mockCaseContext);
    controller.hide();

    const indicator = container.querySelector(`.${config.cssPrefix}-indicator`);
    expect(indicator).toBeNull();
  });
});
