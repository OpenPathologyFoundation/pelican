# @pathology/telemetry

**Three-Tier Telemetry Governance**

Privacy-preserving telemetry system for digital pathology with three tiers of data handling: ephemeral (local-only), workflow (batched transmission), and audit (immediate with signatures).

Based on Pathology Portal Platform Specification v2.1, Section 7.

## Features

- **Tier 1 - Ephemeral Wayfinding**: Local-only analytics, never transmitted
- **Tier 2 - Workflow Declarations**: Batched transmission for workflow optimization
- **Tier 3 - Minimal Audit Trail**: Immediate transmission with cryptographic signatures
- **Privacy-First Design**: Minimal data collection, maximum utility
- **Session Analytics**: Aggregated session-level insights
- **Batching & Retry**: Reliable delivery with configurable batching

## Installation

```bash
npm install @pathology/telemetry
```

## Quick Start

```typescript
import { TelemetryManager } from '@pathology/telemetry';

const telemetry = new TelemetryManager({
  userId: 'user-123',
  sessionId: 'session-abc',
  tiers: {
    workflow: {
      endpoint: '/api/telemetry/workflow',
      batchSize: 50,
      flushInterval: 30000,
    },
    audit: {
      endpoint: '/api/telemetry/audit',
    },
  },
});

// Tier 1: Ephemeral (local only, never transmitted)
telemetry.trackEphemeral('zoom', {
  viewport: { x: 0.5, y: 0.5, zoom: 10, rotation: 0 },
});

// Tier 2: Workflow (batched transmission)
telemetry.trackWorkflow('slide-viewed', 'CASE-001', {
  slideId: 'SLIDE-001',
  duration: 45000,
});

// Tier 3: Audit (immediate transmission)
await telemetry.trackAudit('sign-out', 'CASE-001', {
  diagnosis: 'Adenocarcinoma',
  signedBy: 'dr-smith',
});
```

## Three-Tier Model

### Tier 1: Ephemeral Wayfinding

Local-only events for navigation analytics. **Never transmitted to any server.**

**Use cases:**
- Viewport position tracking (zoom, pan)
- Mouse movement heatmaps
- UI interaction patterns
- Performance metrics

```typescript
// Track zoom change
telemetry.trackEphemeral('zoom', {
  viewport: { x: 0.5, y: 0.5, zoom: 20, rotation: 0 },
});

// Track pan
telemetry.trackEphemeral('pan', {
  viewport: { x: 0.6, y: 0.4, zoom: 20, rotation: 0 },
});

// Track UI interaction
telemetry.trackEphemeral('toolbar-click', {
  tool: 'annotation',
  button: 'polygon',
});
```

**Storage:** In-memory ring buffer (last 1000 events)

**Retention:** Session only

### Tier 2: Workflow Declarations

Significant workflow events transmitted for analytics and optimization.

**Use cases:**
- Slide open/close events
- Annotation creation
- Case status changes
- Tool usage patterns

```typescript
// Track slide viewed
telemetry.trackWorkflow('slide-viewed', 'CASE-001', {
  slideId: 'SLIDE-001',
  duration: 120000,
  coverage: 85,
});

// Track annotation created
telemetry.trackWorkflow('annotation-created', 'CASE-001', {
  type: 'polygon',
  classification: 'tumor',
});

// Track case status change
telemetry.trackWorkflow('case-status-changed', 'CASE-001', {
  from: 'in-review',
  to: 'diagnosis',
});
```

**Transmission:** Batched (configurable size and interval)

**Retention:** Case lifecycle

### Tier 3: Minimal Audit Trail

Compliance-required events transmitted immediately with cryptographic signatures.

**Use cases:**
- Case sign-out
- Diagnosis amendments
- Access to restricted cases
- Configuration changes

```typescript
// Sign-out event (immediately transmitted)
await telemetry.trackAudit('sign-out', 'CASE-001', {
  diagnosis: 'Invasive ductal carcinoma, Grade 2',
  signedBy: 'dr-smith',
  timestamp: new Date().toISOString(),
});

// Amendment event
await telemetry.trackAudit('amendment', 'CASE-001', {
  originalDiagnosis: 'Invasive ductal carcinoma, Grade 2',
  amendedDiagnosis: 'Invasive ductal carcinoma, Grade 3',
  reason: 'Re-review of mitotic count',
  signedBy: 'dr-smith',
});
```

**Transmission:** Immediate with retry

**Retention:** 7 years (regulatory requirement)

**Security:** SHA-256 event signatures

## Configuration

```typescript
interface TelemetryConfig {
  /** User identifier */
  userId: string;

  /** Session identifier */
  sessionId?: string;

  /** Tier configurations */
  tiers: {
    /** Ephemeral tier (Tier 1) - local only */
    ephemeral?: {
      maxBufferSize: number;  // Max events in ring buffer
    };

    /** Workflow tier (Tier 2) - batched */
    workflow?: {
      endpoint: string;       // API endpoint
      batchSize: number;      // Events per batch
      flushInterval: number;  // Flush interval (ms)
    };

    /** Audit tier (Tier 3) - immediate */
    audit?: {
      endpoint: string;       // API endpoint
      signEvents: boolean;    // Enable event signatures
    };
  };

  /** Enable debug logging */
  debug?: boolean;
}
```

### Default Configuration

```typescript
const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  userId: '',
  tiers: {
    ephemeral: {
      maxBufferSize: 1000,
    },
    workflow: {
      batchSize: 50,
      flushInterval: 30000,
    },
    audit: {
      signEvents: true,
    },
  },
  debug: false,
};
```

## API Reference

### TelemetryManager

#### Constructor

```typescript
const telemetry = new TelemetryManager(config: TelemetryConfig);
```

#### Methods

| Method | Description |
|--------|-------------|
| `trackEphemeral(event, data)` | Track Tier 1 event (local only) |
| `trackWorkflow(event, caseId, data)` | Track Tier 2 event (batched) |
| `trackAudit(event, caseId, data)` | Track Tier 3 event (immediate) |
| `getSessionAnalytics()` | Get aggregated session analytics |
| `getEphemeralEvents()` | Get buffered Tier 1 events |
| `flushWorkflow()` | Force flush Tier 2 batch |
| `destroy()` | Clean up and flush pending events |

### Session Analytics

Get aggregated analytics from ephemeral events:

```typescript
const analytics = telemetry.getSessionAnalytics();

console.log('Session duration:', analytics.duration);
console.log('Total events:', analytics.eventCount);
console.log('Event breakdown:', analytics.eventsByType);
console.log('Viewport coverage:', analytics.viewportCoverage);
```

```typescript
interface SessionAnalytics {
  sessionId: string;
  startTime: Date;
  duration: number;
  eventCount: number;
  eventsByType: Record<string, number>;
  viewportCoverage: number;  // Estimated slide coverage %
  zoomLevelDistribution: Record<number, number>;
}
```

## Event Types

### Ephemeral Events

```typescript
type EphemeralEventType =
  | 'zoom'
  | 'pan'
  | 'rotate'
  | 'mouse-move'
  | 'toolbar-click'
  | 'keyboard-shortcut';
```

### Workflow Events

```typescript
type WorkflowEventType =
  | 'slide-viewed'
  | 'slide-closed'
  | 'annotation-created'
  | 'annotation-modified'
  | 'annotation-deleted'
  | 'case-opened'
  | 'case-closed'
  | 'case-status-changed'
  | 'tool-used';
```

### Audit Events

```typescript
type AuditEventType =
  | 'sign-out'
  | 'amendment'
  | 'access-restricted'
  | 'config-changed'
  | 'emergency-access';
```

## Server Integration

### Workflow Endpoint

Expected request format:

```http
POST /api/telemetry/workflow
Content-Type: application/json

{
  "batch": [
    {
      "id": "evt-123",
      "type": "slide-viewed",
      "caseId": "CASE-001",
      "userId": "user-123",
      "sessionId": "session-abc",
      "timestamp": "2024-01-15T10:30:00Z",
      "data": {
        "slideId": "SLIDE-001",
        "duration": 45000
      }
    }
  ]
}
```

### Audit Endpoint

Expected request format:

```http
POST /api/telemetry/audit
Content-Type: application/json

{
  "id": "aud-456",
  "type": "sign-out",
  "caseId": "CASE-001",
  "userId": "user-123",
  "sessionId": "session-abc",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "diagnosis": "Adenocarcinoma",
    "signedBy": "dr-smith"
  },
  "signature": "sha256:abc123..."
}
```

## Privacy Considerations

This telemetry system is designed with privacy as a core principle:

1. **Ephemeral by default**: Most interaction data stays local
2. **No PHI in telemetry**: Patient information is never included
3. **Case IDs only**: Workflow events reference case IDs, not patient data
4. **Aggregation preferred**: Session analytics over individual events
5. **User control**: Users can disable non-audit telemetry

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Example: Full Integration

```typescript
import { TelemetryManager } from '@pathology/telemetry';
import { addReviewEventListener } from '@pathology/review-state';
import { viewportState } from '@pathology/viewer-core';

const telemetry = new TelemetryManager({
  userId: currentUser.id,
  sessionId: crypto.randomUUID(),
  tiers: {
    workflow: { endpoint: '/api/telemetry/workflow' },
    audit: { endpoint: '/api/telemetry/audit' },
  },
});

// Track viewport changes (Tier 1 - local only)
viewportState.subscribe((viewport) => {
  telemetry.trackEphemeral('zoom', { viewport });
});

// Track review events (Tier 2 & 3)
addReviewEventListener((event) => {
  if (event.type === 'case-signed-out') {
    // Tier 3: Audit
    telemetry.trackAudit('sign-out', event.caseId, event);
  } else {
    // Tier 2: Workflow
    telemetry.trackWorkflow(event.type, event.caseId, event);
  }
});

// Clean up on session end
window.addEventListener('beforeunload', () => {
  telemetry.destroy();
});
```

## License

Apache-2.0
