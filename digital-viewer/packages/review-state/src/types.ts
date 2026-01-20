/**
 * Review State Management - Type Definitions
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 3
 */

/** Review status values */
export type ReviewStatus =
  | 'not-started'
  | 'in-progress'
  | 'pending-review'
  | 'reviewed'
  | 'signed-out'
  | 'amended';

/** Case priority levels */
export type CasePriority = 'routine' | 'urgent' | 'stat';

/** Slide review state */
export interface SlideReviewState {
  slideId: string;
  status: ReviewStatus;
  viewedAt?: string;
  viewDuration?: number; // seconds
  coverage?: number; // 0-100 percentage of slide viewed
  regions?: RegionReview[];
  notes?: string;
}

/** Region review state (for large slides) */
export interface RegionReview {
  regionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  viewed: boolean;
  viewedAt?: string;
}

/** Case review state */
export interface CaseReviewState {
  caseId: string;
  status: ReviewStatus;
  priority: CasePriority;
  slides: SlideReviewState[];
  startedAt?: string;
  completedAt?: string;
  signedOutAt?: string;
  signedOutBy?: string;
  diagnosis?: string;
  synopticReport?: Record<string, unknown>;
  amendments?: Amendment[];
}

/** Amendment record */
export interface Amendment {
  id: string;
  reason: string;
  changes: string;
  createdAt: string;
  createdBy: string;
}

/** Diagnostic mode settings */
export interface DiagnosticModeSettings {
  enabled: boolean;
  enforceFocusProtocol: boolean;
  requireSlideCompletion: boolean;
  minimumViewDuration?: number; // seconds
  minimumCoverage?: number; // percentage
  autoSaveInterval?: number; // ms
}

/** Default diagnostic mode settings */
export const DEFAULT_DIAGNOSTIC_SETTINGS: DiagnosticModeSettings = {
  enabled: false,
  enforceFocusProtocol: true,
  requireSlideCompletion: true,
  minimumViewDuration: 30,
  minimumCoverage: 80,
  autoSaveInterval: 30000,
};

/** Workflow declaration (for telemetry) */
export interface WorkflowDeclaration {
  type: 'case-opened' | 'slide-viewed' | 'diagnosis-entered' | 'case-signed-out';
  timestamp: string;
  userId: string;
  caseId: string;
  slideId?: string;
  metadata?: Record<string, unknown>;
}

/** Review session */
export interface ReviewSession {
  sessionId: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  diagnosticMode: boolean;
  cases: CaseReviewState[];
  currentCaseId?: string;
  currentSlideId?: string;
}

/** Review event types */
export type ReviewEventType =
  | 'session-start'
  | 'session-end'
  | 'case-opened'
  | 'case-closed'
  | 'slide-opened'
  | 'slide-closed'
  | 'status-changed'
  | 'diagnosis-entered'
  | 'sign-out'
  | 'amendment';

/** Review event */
export interface ReviewEvent {
  type: ReviewEventType;
  timestamp: Date;
  caseId?: string;
  slideId?: string;
  data?: unknown;
}

/** Review event listener */
export type ReviewEventListener = (event: ReviewEvent) => void;
