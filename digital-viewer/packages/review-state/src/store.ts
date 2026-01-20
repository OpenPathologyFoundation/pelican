/**
 * Review State Management - Svelte Stores
 *
 * Reactive state management for review workflow
 */

import { writable, derived, type Readable, type Writable } from 'svelte/store';
import type {
  CaseReviewState,
  DiagnosticModeSettings,
  ReviewEvent,
  ReviewEventListener,
  ReviewSession,
  ReviewStatus,
  SlideReviewState,
  WorkflowDeclaration,
} from './types';
import { DEFAULT_DIAGNOSTIC_SETTINGS } from './types';

/** Generate unique session ID */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Current review session */
export const reviewSession: Writable<ReviewSession | null> = writable(null);

/** Diagnostic mode settings */
export const diagnosticSettings: Writable<DiagnosticModeSettings> = writable({
  ...DEFAULT_DIAGNOSTIC_SETTINGS,
});

/** Workflow declarations queue (for telemetry) */
export const workflowDeclarations: Writable<WorkflowDeclaration[]> = writable([]);

/** Event listeners */
const eventListeners: Set<ReviewEventListener> = new Set();

/** Emit review event */
function emitEvent(event: ReviewEvent): void {
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[ReviewState] Event listener error:', error);
    }
  }
}

/** Add event listener */
export function addReviewEventListener(listener: ReviewEventListener): void {
  eventListeners.add(listener);
}

/** Remove event listener */
export function removeReviewEventListener(listener: ReviewEventListener): void {
  eventListeners.delete(listener);
}

/** Derived: Is in diagnostic mode */
export const isDiagnosticMode: Readable<boolean> = derived(
  [reviewSession, diagnosticSettings],
  ([$session, $settings]) => $session?.diagnosticMode ?? $settings.enabled
);

/** Derived: Current case */
export const currentCase: Readable<CaseReviewState | null> = derived(
  reviewSession,
  ($session) => {
    if (!$session?.currentCaseId) return null;
    return $session.cases.find((c) => c.caseId === $session.currentCaseId) || null;
  }
);

/** Derived: Current slide */
export const currentSlide: Readable<SlideReviewState | null> = derived(
  [reviewSession, currentCase],
  ([$session, $case]) => {
    if (!$session?.currentSlideId || !$case) return null;
    return $case.slides.find((s) => s.slideId === $session.currentSlideId) || null;
  }
);

/** Derived: Session duration in seconds */
export const sessionDuration: Readable<number> = derived(
  reviewSession,
  ($session) => {
    if (!$session) return 0;
    const start = new Date($session.startedAt).getTime();
    const end = $session.endedAt
      ? new Date($session.endedAt).getTime()
      : Date.now();
    return Math.floor((end - start) / 1000);
  }
);

/** Derived: Cases ready for sign-out */
export const casesReadyForSignOut: Readable<CaseReviewState[]> = derived(
  reviewSession,
  ($session) => {
    if (!$session) return [];
    return $session.cases.filter((c) => c.status === 'reviewed');
  }
);

/** Actions: Start review session */
export function startReviewSession(
  userId: string,
  diagnosticMode = false
): ReviewSession {
  const session: ReviewSession = {
    sessionId: generateSessionId(),
    userId,
    startedAt: new Date().toISOString(),
    diagnosticMode,
    cases: [],
  };

  reviewSession.set(session);

  emitEvent({
    type: 'session-start',
    timestamp: new Date(),
    data: { sessionId: session.sessionId, diagnosticMode },
  });

  return session;
}

/** Actions: End review session */
export function endReviewSession(): void {
  reviewSession.update((session) => {
    if (!session) return null;

    emitEvent({
      type: 'session-end',
      timestamp: new Date(),
      data: { sessionId: session.sessionId },
    });

    return {
      ...session,
      endedAt: new Date().toISOString(),
    };
  });
}

/** Actions: Open case */
export function openCase(
  caseId: string,
  priority: 'routine' | 'urgent' | 'stat' = 'routine',
  slides: string[] = []
): void {
  reviewSession.update((session) => {
    if (!session) return session;

    // Check if case already exists
    const existingCase = session.cases.find((c) => c.caseId === caseId);

    if (existingCase) {
      return {
        ...session,
        currentCaseId: caseId,
      };
    }

    // Create new case
    const newCase: CaseReviewState = {
      caseId,
      status: 'not-started',
      priority,
      slides: slides.map((slideId) => ({
        slideId,
        status: 'not-started',
      })),
      startedAt: new Date().toISOString(),
    };

    // Add workflow declaration
    addWorkflowDeclaration({
      type: 'case-opened',
      timestamp: new Date().toISOString(),
      userId: session.userId,
      caseId,
    });

    emitEvent({
      type: 'case-opened',
      timestamp: new Date(),
      caseId,
    });

    return {
      ...session,
      cases: [...session.cases, newCase],
      currentCaseId: caseId,
    };
  });
}

/** Actions: Close case */
export function closeCase(caseId: string): void {
  reviewSession.update((session) => {
    if (!session) return session;

    emitEvent({
      type: 'case-closed',
      timestamp: new Date(),
      caseId,
    });

    return {
      ...session,
      currentCaseId:
        session.currentCaseId === caseId ? undefined : session.currentCaseId,
    };
  });
}

/** Actions: Open slide */
export function openSlide(slideId: string): void {
  reviewSession.update((session) => {
    if (!session || !session.currentCaseId) return session;

    const now = new Date().toISOString();

    // Update slide status
    const updatedCases = session.cases.map((c) => {
      if (c.caseId !== session.currentCaseId) return c;

      const updatedSlides = c.slides.map((s) => {
        if (s.slideId !== slideId) return s;

        return {
          ...s,
          status: s.status === 'not-started' ? 'in-progress' : s.status,
          viewedAt: s.viewedAt || now,
        } as SlideReviewState;
      });

      return {
        ...c,
        slides: updatedSlides,
        status: c.status === 'not-started' ? 'in-progress' : c.status,
      } as CaseReviewState;
    });

    // Add workflow declaration
    addWorkflowDeclaration({
      type: 'slide-viewed',
      timestamp: now,
      userId: session.userId,
      caseId: session.currentCaseId,
      slideId,
    });

    emitEvent({
      type: 'slide-opened',
      timestamp: new Date(),
      caseId: session.currentCaseId,
      slideId,
    });

    return {
      ...session,
      cases: updatedCases,
      currentSlideId: slideId,
    };
  });
}

/** Actions: Close slide */
export function closeSlide(slideId: string, viewDuration?: number): void {
  reviewSession.update((session) => {
    if (!session || !session.currentCaseId) return session;

    // Update slide view duration
    const updatedCases = session.cases.map((c) => {
      if (c.caseId !== session.currentCaseId) return c;

      const updatedSlides = c.slides.map((s) => {
        if (s.slideId !== slideId) return s;

        return {
          ...s,
          viewDuration: (s.viewDuration || 0) + (viewDuration || 0),
        };
      });

      return { ...c, slides: updatedSlides };
    });

    emitEvent({
      type: 'slide-closed',
      timestamp: new Date(),
      caseId: session.currentCaseId,
      slideId,
    });

    return {
      ...session,
      cases: updatedCases,
      currentSlideId:
        session.currentSlideId === slideId ? undefined : session.currentSlideId,
    };
  });
}

/** Actions: Update slide coverage */
export function updateSlideCoverage(slideId: string, coverage: number): void {
  reviewSession.update((session) => {
    if (!session || !session.currentCaseId) return session;

    const updatedCases = session.cases.map((c) => {
      if (c.caseId !== session.currentCaseId) return c;

      const updatedSlides = c.slides.map((s) => {
        if (s.slideId !== slideId) return s;
        return { ...s, coverage: Math.max(s.coverage || 0, coverage) };
      });

      return { ...c, slides: updatedSlides };
    });

    return { ...session, cases: updatedCases };
  });
}

/** Actions: Set case status */
export function setCaseStatus(caseId: string, status: ReviewStatus): void {
  reviewSession.update((session) => {
    if (!session) return session;

    const updatedCases = session.cases.map((c) => {
      if (c.caseId !== caseId) return c;

      return {
        ...c,
        status,
        completedAt:
          status === 'reviewed' || status === 'signed-out'
            ? new Date().toISOString()
            : c.completedAt,
      };
    });

    emitEvent({
      type: 'status-changed',
      timestamp: new Date(),
      caseId,
      data: { status },
    });

    return { ...session, cases: updatedCases };
  });
}

/** Actions: Enter diagnosis */
export function enterDiagnosis(caseId: string, diagnosis: string): void {
  reviewSession.update((session) => {
    if (!session) return session;

    const updatedCases = session.cases.map((c) => {
      if (c.caseId !== caseId) return c;
      return { ...c, diagnosis, status: 'pending-review' as ReviewStatus };
    });

    // Add workflow declaration
    addWorkflowDeclaration({
      type: 'diagnosis-entered',
      timestamp: new Date().toISOString(),
      userId: session.userId,
      caseId,
    });

    emitEvent({
      type: 'diagnosis-entered',
      timestamp: new Date(),
      caseId,
      data: { diagnosis },
    });

    return { ...session, cases: updatedCases };
  });
}

/** Actions: Sign out case */
export function signOutCase(caseId: string): void {
  reviewSession.update((session) => {
    if (!session) return session;

    const now = new Date().toISOString();

    const updatedCases = session.cases.map((c) => {
      if (c.caseId !== caseId) return c;

      return {
        ...c,
        status: 'signed-out' as ReviewStatus,
        signedOutAt: now,
        signedOutBy: session.userId,
      };
    });

    // Add workflow declaration
    addWorkflowDeclaration({
      type: 'case-signed-out',
      timestamp: now,
      userId: session.userId,
      caseId,
    });

    emitEvent({
      type: 'sign-out',
      timestamp: new Date(),
      caseId,
    });

    return { ...session, cases: updatedCases };
  });
}

/** Actions: Add workflow declaration */
function addWorkflowDeclaration(declaration: WorkflowDeclaration): void {
  workflowDeclarations.update((declarations) => [...declarations, declaration]);
}

/** Actions: Clear workflow declarations */
export function clearWorkflowDeclarations(): WorkflowDeclaration[] {
  let declarations: WorkflowDeclaration[] = [];
  workflowDeclarations.update((d) => {
    declarations = d;
    return [];
  });
  return declarations;
}

/** Actions: Toggle diagnostic mode */
export function toggleDiagnosticMode(): void {
  reviewSession.update((session) => {
    if (!session) return session;
    return { ...session, diagnosticMode: !session.diagnosticMode };
  });
}

/** Actions: Update diagnostic settings */
export function updateDiagnosticSettings(
  settings: Partial<DiagnosticModeSettings>
): void {
  diagnosticSettings.update((s) => ({ ...s, ...settings }));
}

/** Actions: Reset review state */
export function resetReviewState(): void {
  reviewSession.set(null);
  workflowDeclarations.set([]);
  diagnosticSettings.set({ ...DEFAULT_DIAGNOSTIC_SETTINGS });
}
