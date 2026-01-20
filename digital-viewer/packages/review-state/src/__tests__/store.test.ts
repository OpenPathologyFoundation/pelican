/**
 * Review State Store Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  reviewSession,
  diagnosticSettings,
  workflowDeclarations,
  isDiagnosticMode,
  currentCase,
  currentSlide,
  startReviewSession,
  endReviewSession,
  openCase,
  closeCase,
  openSlide,
  closeSlide,
  updateSlideCoverage,
  setCaseStatus,
  enterDiagnosis,
  signOutCase,
  clearWorkflowDeclarations,
  toggleDiagnosticMode,
  resetReviewState,
} from '../store';

describe('Review State Store', () => {
  beforeEach(() => {
    resetReviewState();
  });

  afterEach(() => {
    resetReviewState();
  });

  describe('startReviewSession', () => {
    it('should start a new review session', () => {
      const session = startReviewSession('user-123', false);

      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.diagnosticMode).toBe(false);
      expect(session.cases).toHaveLength(0);
    });

    it('should start session in diagnostic mode', () => {
      const session = startReviewSession('user-123', true);

      expect(session.diagnosticMode).toBe(true);
      expect(get(isDiagnosticMode)).toBe(true);
    });
  });

  describe('openCase', () => {
    it('should open a case with slides', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', ['SLIDE-001', 'SLIDE-002']);

      const session = get(reviewSession);
      expect(session?.cases).toHaveLength(1);
      expect(session?.currentCaseId).toBe('CASE-001');

      const caseState = get(currentCase);
      expect(caseState?.caseId).toBe('CASE-001');
      expect(caseState?.slides).toHaveLength(2);
      expect(caseState?.status).toBe('not-started');
    });

    it('should set case priority', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'urgent', []);

      const caseState = get(currentCase);
      expect(caseState?.priority).toBe('urgent');
    });

    it('should add workflow declaration', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', []);

      const declarations = get(workflowDeclarations);
      expect(declarations.some((d) => d.type === 'case-opened')).toBe(true);
    });
  });

  describe('openSlide', () => {
    it('should open a slide and update status', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', ['SLIDE-001', 'SLIDE-002']);
      openSlide('SLIDE-001');

      const session = get(reviewSession);
      expect(session?.currentSlideId).toBe('SLIDE-001');

      const slide = get(currentSlide);
      expect(slide?.slideId).toBe('SLIDE-001');
      expect(slide?.status).toBe('in-progress');
      expect(slide?.viewedAt).toBeDefined();

      // Case should also be in-progress
      const caseState = get(currentCase);
      expect(caseState?.status).toBe('in-progress');
    });

    it('should add slide-viewed workflow declaration', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', ['SLIDE-001']);
      openSlide('SLIDE-001');

      const declarations = get(workflowDeclarations);
      expect(declarations.some((d) => d.type === 'slide-viewed')).toBe(true);
    });
  });

  describe('closeSlide', () => {
    it('should close slide and track view duration', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', ['SLIDE-001']);
      openSlide('SLIDE-001');
      closeSlide('SLIDE-001', 120); // 2 minutes

      const session = get(reviewSession);
      expect(session?.currentSlideId).toBeUndefined();

      const caseState = session?.cases.find((c) => c.caseId === 'CASE-001');
      const slide = caseState?.slides.find((s) => s.slideId === 'SLIDE-001');
      expect(slide?.viewDuration).toBe(120);
    });
  });

  describe('updateSlideCoverage', () => {
    it('should update slide coverage percentage', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', ['SLIDE-001']);
      openSlide('SLIDE-001');
      updateSlideCoverage('SLIDE-001', 75);

      const slide = get(currentSlide);
      expect(slide?.coverage).toBe(75);
    });

    it('should only increase coverage, not decrease', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', ['SLIDE-001']);
      openSlide('SLIDE-001');
      updateSlideCoverage('SLIDE-001', 75);
      updateSlideCoverage('SLIDE-001', 50);

      const slide = get(currentSlide);
      expect(slide?.coverage).toBe(75); // Should keep higher value
    });
  });

  describe('setCaseStatus', () => {
    it('should update case status', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', []);
      setCaseStatus('CASE-001', 'reviewed');

      const caseState = get(currentCase);
      expect(caseState?.status).toBe('reviewed');
      expect(caseState?.completedAt).toBeDefined();
    });
  });

  describe('enterDiagnosis', () => {
    it('should enter diagnosis and update status', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', []);
      enterDiagnosis('CASE-001', 'Invasive ductal carcinoma');

      const caseState = get(currentCase);
      expect(caseState?.diagnosis).toBe('Invasive ductal carcinoma');
      expect(caseState?.status).toBe('pending-review');
    });

    it('should add workflow declaration', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', []);
      enterDiagnosis('CASE-001', 'Test diagnosis');

      const declarations = get(workflowDeclarations);
      expect(declarations.some((d) => d.type === 'diagnosis-entered')).toBe(true);
    });
  });

  describe('signOutCase', () => {
    it('should sign out case', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', []);
      enterDiagnosis('CASE-001', 'Test');
      signOutCase('CASE-001');

      const caseState = get(currentCase);
      expect(caseState?.status).toBe('signed-out');
      expect(caseState?.signedOutAt).toBeDefined();
      expect(caseState?.signedOutBy).toBe('user-123');
    });
  });

  describe('toggleDiagnosticMode', () => {
    it('should toggle diagnostic mode', () => {
      startReviewSession('user-123', false);

      expect(get(isDiagnosticMode)).toBe(false);
      toggleDiagnosticMode();
      expect(get(isDiagnosticMode)).toBe(true);
      toggleDiagnosticMode();
      expect(get(isDiagnosticMode)).toBe(false);
    });
  });

  describe('clearWorkflowDeclarations', () => {
    it('should clear and return declarations', () => {
      startReviewSession('user-123', false);
      openCase('CASE-001', 'routine', ['SLIDE-001']);
      openSlide('SLIDE-001');

      const declarations = clearWorkflowDeclarations();
      expect(declarations.length).toBeGreaterThan(0);
      expect(get(workflowDeclarations)).toHaveLength(0);
    });
  });

  describe('endReviewSession', () => {
    it('should end the session', () => {
      startReviewSession('user-123', false);
      endReviewSession();

      const session = get(reviewSession);
      expect(session?.endedAt).toBeDefined();
    });
  });
});
