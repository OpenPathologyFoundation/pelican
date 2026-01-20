# @pathology/fdp-lib

**Focus Declaration Protocol Library**

A patient safety mechanism ensuring pathologists always know which case they are examining. FDP provides visual and audio announcements when switching between cases or returning focus to a viewer window.

Based on Pathology Portal Platform Specification v2.1, Section 5.

## Features

- **Layer 1 (Local)**: Visual announcement when window gains focus
- **Layer 2 (Session)**: Cross-window awareness via WebSocket (optional)
- **Time-Decay Duration**: Longer absence = longer announcement display
- **Privacy Mode**: Masks patient identifiable information
- **Diagnostic Mode**: Enhanced constraints for clinical sign-out
- **Audio Announcements**: Text-to-speech case identification
- **Warning System**: Alerts for multi-case and case-mismatch scenarios

## Installation

```bash
npm install @pathology/fdp-lib
```

## Quick Start

```typescript
import { FocusDeclarationProtocol } from '@pathology/fdp-lib';

// Create FDP instance
const fdp = new FocusDeclarationProtocol({
  diagnosticMode: true,
  sessionServiceUrl: 'ws://localhost:8765',
  userId: 'user-12345',
});

// Initialize with case context
await fdp.initialize({
  caseId: 'UPMC:S26-12345',
  patientName: 'SMITH, JOHN',
  patientDob: '01/15/1960',
});

// Listen for events
fdp.on('warning', (event) => {
  console.log('Warning:', event.warning);
});

fdp.on('focus', (event) => {
  console.log('Window focused, case:', event.caseContext?.caseId);
});
```

## Configuration

```typescript
interface FDPConfig {
  /** Enable diagnostic mode constraints */
  diagnosticMode: boolean;

  /** WebSocket URL for Layer 2 session awareness */
  sessionServiceUrl?: string;

  /** User ID for session tracking */
  userId?: string;

  /** Enable privacy mode (masks patient info) */
  privacyMode: boolean;

  /** Enable audio announcements */
  audioEnabled: boolean;

  /** Announcement duration settings */
  minDuration: number;      // Minimum display time (ms)
  maxDuration: number;      // Maximum display time (ms)
  decayRate: number;        // Time-decay rate for duration calculation

  /** CSS class prefix */
  cssPrefix: string;

  /** Z-index for overlay elements */
  zIndex: number;
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG: FDPConfig = {
  diagnosticMode: false,
  privacyMode: false,
  audioEnabled: true,
  minDuration: 2000,
  maxDuration: 5000,
  decayRate: 0.1,
  cssPrefix: 'fdp',
  zIndex: 10000,
};
```

## API Reference

### FocusDeclarationProtocol

#### Constructor

```typescript
const fdp = new FocusDeclarationProtocol(config?: Partial<FDPConfig>);
```

#### Methods

| Method | Description |
|--------|-------------|
| `initialize(context: CaseContext)` | Initialize FDP with case information |
| `updateCaseContext(context: CaseContext)` | Update the current case context |
| `configure(config: Partial<FDPConfig>)` | Update configuration |
| `getConfig()` | Get current configuration |
| `getCaseContext()` | Get current case context |
| `isDiagnosticMode()` | Check if diagnostic mode is enabled |
| `setDiagnosticMode(enabled: boolean)` | Enable/disable diagnostic mode |
| `setPrivacyMode(enabled: boolean)` | Enable/disable privacy mode |
| `toggleAudio()` | Toggle audio announcements |
| `isSessionConnected()` | Check WebSocket connection status |
| `on(event, listener)` | Add event listener |
| `off(event, listener)` | Remove event listener |
| `destroy()` | Clean up and remove FDP |

#### Events

| Event | Description |
|-------|-------------|
| `focus` | Window gained focus |
| `blur` | Window lost focus |
| `announcement-start` | Focus announcement started |
| `announcement-end` | Focus announcement ended |
| `warning` | Session warning received |
| `session-connected` | Connected to session service |
| `session-disconnected` | Disconnected from session service |

### CaseContext

```typescript
interface CaseContext {
  /** Unique case identifier */
  caseId: string;

  /** Patient name (for display) */
  patientName?: string;

  /** Patient date of birth */
  patientDob?: string;

  /** Medical Record Number */
  mrn?: string;

  /** Additional case metadata */
  metadata?: Record<string, unknown>;
}
```

## Layer 2: Session Awareness

FDP Layer 2 connects to a WebSocket session service to track cases open across multiple browser windows. This enables:

- **Multi-Case Warning**: Alert when the same user has multiple cases open
- **Case Mismatch Warning**: Alert when another window opens a different case

### Connecting to Session Service

```typescript
const fdp = new FocusDeclarationProtocol({
  sessionServiceUrl: 'ws://localhost:8765',
  userId: 'user-12345',
});

// Listen for session events
fdp.on('session-connected', () => {
  console.log('Connected to session service');
});

fdp.on('warning', (event) => {
  if (event.warning.type === 'multi-case') {
    console.log('Multiple cases open:', event.warning.cases);
  }
});
```

### Running Session Service

See [@pathology/session-service](../session-service/README.md) for session service setup.

## Privacy Mode

Privacy mode masks patient identifiable information in the UI while maintaining case tracking:

```typescript
// Enable privacy mode
fdp.setPrivacyMode(true);

// Patient name will appear as "S***, J***"
// DOB will be hidden
// Case ID remains visible for workflow
```

## Diagnostic Mode

Diagnostic mode enforces additional constraints required for clinical sign-out:

```typescript
fdp.setDiagnosticMode(true);

// In diagnostic mode:
// - Indicator cannot be collapsed
// - Warning acknowledgment may be required
// - All events are logged for audit trail
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

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  FocusDeclarationProtocol                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│   │ Announcement  │  │   Indicator   │  │     Modal     │  │
│   │  Controller   │  │  Controller   │  │  Controller   │  │
│   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  │
│           │                  │                  │          │
│           └──────────────────┼──────────────────┘          │
│                              │                             │
│   ┌───────────────┐  ┌───────┴───────┐                     │
│   │    Audio      │  │    Session    │  ← WebSocket        │
│   │  Controller   │  │    Client     │                     │
│   └───────────────┘  └───────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## License

Apache-2.0
