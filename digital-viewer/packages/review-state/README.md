# @pathology/review-state

**Review State Management**

Manages diagnostic mode, review workflow, and case state for digital pathology sign-out. Provides reactive stores for tracking session progress, slide coverage, and workflow declarations.

Based on Pathology Portal Platform Specification v2.1, Section 3.

## Features

- **Session Management**: Track pathologist review sessions
- **Case Workflow**: Open, review, and sign-out cases
- **Slide Tracking**: Monitor which slides have been viewed and coverage percentage
- **Diagnostic Mode**: Enforce clinical sign-out constraints
- **Workflow Declarations**: Record significant actions for audit
- **Event System**: Subscribe to review events for telemetry

## Installation

```bash
npm install @pathology/review-state
```

## Quick Start

```typescript
import {
  startReviewSession,
  openCase,
  openSlide,
  updateSlideCoverage,
  signOutCase,
  isDiagnosticMode,
} from '@pathology/review-state';

// Start a diagnostic review session
startReviewSession('user-123', true);

// Open a case with its slides
openCase('CASE-001', 'routine', ['SLIDE-001', 'SLIDE-002', 'SLIDE-003']);

// Open a slide for review
openSlide('SLIDE-001');

// Update slide coverage as pathologist navigates
updateSlideCoverage('SLIDE-001', 45.5);

// Sign out the case when review is complete
signOutCase('CASE-001');
```

## Stores

### reviewSession

Current review session state:

```typescript
import { reviewSession } from '@pathology/review-state';

reviewSession.subscribe((session) => {
  if (session) {
    console.log('User:', session.userId);
    console.log('Diagnostic mode:', session.diagnosticMode);
    console.log('Started:', session.startTime);
    console.log('Open cases:', session.openCases.size);
  }
});
```

### diagnosticSettings

Diagnostic mode configuration:

```typescript
import { diagnosticSettings, updateDiagnosticSettings } from '@pathology/review-state';

diagnosticSettings.subscribe((settings) => {
  console.log('Min coverage required:', settings.minimumCoverage);
  console.log('Require all slides:', settings.requireAllSlides);
});

// Update settings
updateDiagnosticSettings({
  minimumCoverage: 80,
  requireAllSlides: true,
});
```

### workflowDeclarations

Audit trail of significant actions:

```typescript
import { workflowDeclarations, clearWorkflowDeclarations } from '@pathology/review-state';

workflowDeclarations.subscribe((declarations) => {
  declarations.forEach((decl) => {
    console.log(`[${decl.timestamp}] ${decl.type}: ${decl.description}`);
  });
});
```

## Derived Stores

### isDiagnosticMode

Check if diagnostic mode is currently active:

```typescript
import { isDiagnosticMode } from '@pathology/review-state';

$: if ($isDiagnosticMode) {
  // Enforce clinical constraints
  showDiagnosticHeader();
}
```

### currentCase

Get the currently active case:

```typescript
import { currentCase } from '@pathology/review-state';

$: if ($currentCase) {
  console.log('Viewing case:', $currentCase.caseId);
  console.log('Status:', $currentCase.status);
  console.log('Slides:', $currentCase.slides.size);
}
```

### currentSlide

Get the currently open slide:

```typescript
import { currentSlide } from '@pathology/review-state';

$: if ($currentSlide) {
  console.log('Viewing slide:', $currentSlide.slideId);
  console.log('Coverage:', $currentSlide.coverage, '%');
  console.log('Regions reviewed:', $currentSlide.regionsReviewed.length);
}
```

### sessionDuration

Reactive session duration in milliseconds:

```typescript
import { sessionDuration } from '@pathology/review-state';

$: minutes = Math.floor($sessionDuration / 60000);
$: seconds = Math.floor(($sessionDuration % 60000) / 1000);
```

### casesReadyForSignOut

Cases that meet sign-out criteria:

```typescript
import { casesReadyForSignOut } from '@pathology/review-state';

$: readyCases = $casesReadyForSignOut;
// Returns cases where all required slides have been reviewed
```

## API Reference

### Session Management

```typescript
// Start a new review session
startReviewSession(userId: string, diagnosticMode?: boolean): void;

// End the current session
endReviewSession(): void;

// Toggle diagnostic mode
toggleDiagnosticMode(): void;

// Reset all state
resetReviewState(): void;
```

### Case Workflow

```typescript
// Open a case for review
openCase(
  caseId: string,
  priority: CasePriority,
  slideIds: string[]
): void;

// Close a case
closeCase(caseId: string): void;

// Set case status
setCaseStatus(
  caseId: string,
  status: ReviewStatus
): void;

// Enter diagnosis mode for a case
enterDiagnosis(caseId: string): void;

// Sign out a case
signOutCase(caseId: string): void;
```

### Slide Workflow

```typescript
// Open a slide
openSlide(slideId: string): void;

// Close current slide
closeSlide(slideId: string): void;

// Update slide coverage percentage
updateSlideCoverage(slideId: string, coverage: number): void;
```

### Event System

```typescript
import {
  addReviewEventListener,
  removeReviewEventListener,
} from '@pathology/review-state';

// Listen for review events
const listener = (event) => {
  switch (event.type) {
    case 'session-started':
      console.log('Session started:', event.userId);
      break;
    case 'case-opened':
      console.log('Case opened:', event.caseId);
      break;
    case 'slide-opened':
      console.log('Slide opened:', event.slideId);
      break;
    case 'case-signed-out':
      console.log('Case signed out:', event.caseId);
      break;
  }
};

addReviewEventListener(listener);

// Clean up
removeReviewEventListener(listener);
```

## Types

### ReviewSession

```typescript
interface ReviewSession {
  userId: string;
  startTime: Date;
  diagnosticMode: boolean;
  openCases: Map<string, CaseReviewState>;
  currentCaseId: string | null;
  currentSlideId: string | null;
}
```

### CaseReviewState

```typescript
interface CaseReviewState {
  caseId: string;
  priority: CasePriority;
  status: ReviewStatus;
  openedAt: Date;
  slides: Map<string, SlideReviewState>;
  diagnosis?: string;
  amendments: Amendment[];
}

type CasePriority = 'stat' | 'urgent' | 'routine';
type ReviewStatus = 'pending' | 'in-review' | 'diagnosis' | 'signed-out' | 'amended';
```

### SlideReviewState

```typescript
interface SlideReviewState {
  slideId: string;
  openedAt: Date;
  closedAt?: Date;
  coverage: number;  // 0-100 percentage
  regionsReviewed: RegionReview[];
  viewTime: number;  // milliseconds
}
```

### DiagnosticModeSettings

```typescript
interface DiagnosticModeSettings {
  enabled: boolean;
  minimumCoverage: number;      // Required slide coverage %
  requireAllSlides: boolean;    // Must view all slides before sign-out
  requireCalibration: boolean;  // Scale bar must be calibrated
  headerCollapsible: boolean;   // Can collapse header (false in diagnostic)
}
```

### Default Settings

```typescript
const DEFAULT_DIAGNOSTIC_SETTINGS: DiagnosticModeSettings = {
  enabled: false,
  minimumCoverage: 0,
  requireAllSlides: false,
  requireCalibration: false,
  headerCollapsible: true,
};
```

## Diagnostic Mode

Diagnostic mode enforces clinical sign-out requirements:

```typescript
import {
  startReviewSession,
  updateDiagnosticSettings,
} from '@pathology/review-state';

// Start in diagnostic mode
startReviewSession('pathologist-123', true);

// Configure requirements
updateDiagnosticSettings({
  minimumCoverage: 75,          // 75% slide coverage required
  requireAllSlides: true,       // All slides must be viewed
  requireCalibration: true,     // Scale bar must be calibrated
  headerCollapsible: false,     // Header stays visible
});
```

In diagnostic mode:
- Case header cannot be collapsed
- Sign-out is blocked until requirements are met
- All actions are logged to workflow declarations

## Integration with Telemetry

Connect review events to telemetry:

```typescript
import { addReviewEventListener } from '@pathology/review-state';
import { TelemetryManager } from '@pathology/telemetry';

const telemetry = new TelemetryManager(config);

addReviewEventListener((event) => {
  // Tier 2: Workflow events
  if (['case-opened', 'slide-opened', 'case-signed-out'].includes(event.type)) {
    telemetry.trackWorkflow(event.type, event.caseId, event);
  }

  // Tier 3: Audit events (sign-out only)
  if (event.type === 'case-signed-out') {
    telemetry.trackAudit('sign-out', event.caseId, {
      userId: event.userId,
      timestamp: event.timestamp,
    });
  }
});
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Example: Complete Workflow

```typescript
import {
  startReviewSession,
  openCase,
  openSlide,
  updateSlideCoverage,
  enterDiagnosis,
  signOutCase,
  endReviewSession,
  reviewSession,
} from '@pathology/review-state';

// Start session
startReviewSession('dr-smith', true);

// Open case
openCase('S26-12345', 'routine', ['A1', 'A2', 'B1']);

// Review slides
openSlide('A1');
updateSlideCoverage('A1', 100);

openSlide('A2');
updateSlideCoverage('A2', 85);

openSlide('B1');
updateSlideCoverage('B1', 90);

// Enter diagnosis
enterDiagnosis('S26-12345');

// Sign out
signOutCase('S26-12345');

// Check final state
reviewSession.subscribe((session) => {
  const case = session?.openCases.get('S26-12345');
  console.log('Status:', case?.status); // 'signed-out'
});

// End session
endReviewSession();
```

## License

Apache-2.0
