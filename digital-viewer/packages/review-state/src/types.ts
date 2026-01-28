/**
 * Review State Management - Type Definitions
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 3
 */

/** Review status values (workflow states) */
export type ReviewStatus =
  | 'not-started'
  | 'in-progress'
  | 'pending-review'
  | 'reviewed'
  | 'signed-out'
  | 'amended';

/**
 * User-declared review states (SRS SYS-RVW-001)
 * These are explicit user declarations, NOT inferred from navigation
 * Persisted as Tier 2 declaration events (SRS SYS-RVW-002)
 */
export type UserDeclaredReviewState =
  | 'reviewed' // User declares slide/case as reviewed
  | 'flagged' // User flags for attention (e.g., second opinion needed)
  | 'needs_attending'; // User marks as requiring attending pathologist review

/**
 * Session-only states (SRS SYS-RVW-004)
 * These are NOT persisted to server - Tier 1 ephemeral only
 * Purged on session close (SRS SYS-RVW-005)
 */
export type SessionOnlyState =
  | 'opened' // Slide has been opened in this session
  | 'in_progress'; // User is currently viewing

/** User-declared state configuration */
export const USER_DECLARED_STATES: Record<
  UserDeclaredReviewState,
  { label: string; icon: string; color: string; description: string }
> = {
  reviewed: {
    label: 'Reviewed',
    icon: '✓',
    color: '#22c55e',
    description: 'Slide has been reviewed',
  },
  flagged: {
    label: 'Flagged',
    icon: '🚩',
    color: '#f59e0b',
    description: 'Flagged for attention or second opinion',
  },
  needs_attending: {
    label: 'Needs Attending',
    icon: '👨‍⚕️',
    color: '#ef4444',
    description: 'Requires attending pathologist review',
  },
};

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
  // SRS SYS-RVW-001: User-declared states (Tier 2)
  userDeclaredState?: UserDeclaredReviewState;
  userDeclaredAt?: string;
  userDeclaredBy?: string;
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
  type:
    | 'case-opened'
    | 'slide-viewed'
    | 'diagnosis-entered'
    | 'case-signed-out'
    | 'review-state-declared' // SRS SYS-RVW-001, SYS-RVW-002
    | 'dx-mode-opt-out'; // SRS SYS-DXM-005
  timestamp: string;
  userId: string;
  caseId: string;
  slideId?: string;
  metadata?: Record<string, unknown>;
}

/** Review state declaration event (Tier 2) */
export interface ReviewStateDeclaration {
  slideId: string;
  caseId: string;
  state: UserDeclaredReviewState;
  previousState?: UserDeclaredReviewState;
  declaredAt: string;
  declaredBy: string;
  notes?: string;
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
