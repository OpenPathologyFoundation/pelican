/**
 * Review State Management
 *
 * Manages diagnostic mode, review workflow, and case state.
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 3
 *
 * @example
 * ```typescript
 * import {
 *   startReviewSession,
 *   openCase,
 *   openSlide,
 *   signOutCase,
 *   isDiagnosticMode,
 * } from '@pathology/review-state';
 *
 * // Start a diagnostic session
 * const session = startReviewSession('user-123', true);
 *
 * // Open a case with slides
 * openCase('CASE-001', 'routine', ['SLIDE-001', 'SLIDE-002']);
 *
 * // Open a slide for review
 * openSlide('SLIDE-001');
 *
 * // Sign out the case
 * signOutCase('CASE-001');
 * ```
 */

// Store and actions
export {
  reviewSession,
  diagnosticSettings,
  workflowDeclarations,
  isDiagnosticMode,
  currentCase,
  currentSlide,
  sessionDuration,
  casesReadyForSignOut,
  addReviewEventListener,
  removeReviewEventListener,
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
  updateDiagnosticSettings,
  resetReviewState,
} from './store';

// Types
export type {
  Amendment,
  CasePriority,
  CaseReviewState,
  DiagnosticModeSettings,
  RegionReview,
  ReviewEvent,
  ReviewEventListener,
  ReviewEventType,
  ReviewSession,
  ReviewStatus,
  SlideReviewState,
  WorkflowDeclaration,
} from './types';

export { DEFAULT_DIAGNOSTIC_SETTINGS } from './types';
