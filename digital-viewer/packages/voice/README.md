# @pathology/voice

**Voice Interface**

Hands-free voice control with intent classification for digital pathology viewers. Uses the Web Speech API for speech recognition with pathology-specific command vocabulary.

Based on Pathology Portal Platform Specification v2.1, Section 8.

## Features

- **Web Speech API Integration**: Browser-native speech recognition
- **Intent Classification**: Map spoken phrases to viewer actions
- **Pathology Vocabulary**: Domain-specific command recognition
- **Fuzzy Matching**: Handle variations in speech
- **Entity Extraction**: Parse numbers, levels, directions from speech
- **Command History**: Track and replay recent commands
- **Svelte Stores**: Reactive state management

## Installation

```bash
npm install @pathology/voice
```

## Quick Start

```typescript
import { VoiceRecognitionManager } from '@pathology/voice';

const voice = new VoiceRecognitionManager({
  language: 'en-US',
  continuous: true,
  interimResults: true,
});

// Check browser support
if (!voice.initialize()) {
  console.log('Speech recognition not supported');
  return;
}

// Register command handlers
voice.onCommand('zoom-in', () => {
  viewer.zoomIn();
});

voice.onCommand('zoom-to', (intent) => {
  const level = intent.entities.find(e => e.type === 'level');
  if (level) {
    viewer.zoomTo(parseInt(level.value));
  }
});

voice.onCommand('next-slide', () => {
  slideNavigator.next();
});

// Start listening
voice.start();

// Listen for all events
voice.on((event) => {
  console.log('Voice event:', event.type, event);
});
```

## Supported Commands

### Navigation

| Command | Intent | Description |
|---------|--------|-------------|
| "zoom in" | `zoom-in` | Zoom in one level |
| "zoom out" | `zoom-out` | Zoom out one level |
| "zoom to 10x" | `zoom-to` | Zoom to specific magnification |
| "pan left/right/up/down" | `pan` | Pan viewport |
| "go home" | `home` | Reset to overview |
| "rotate" | `rotate` | Rotate 90 degrees |
| "next slide" | `next-slide` | Navigate to next slide |
| "previous slide" | `previous-slide` | Navigate to previous slide |

### Annotations

| Command | Intent | Description |
|---------|--------|-------------|
| "add marker" | `add-annotation` | Add point annotation |
| "draw rectangle" | `draw-rectangle` | Start rectangle drawing |
| "draw circle" | `draw-circle` | Start circle drawing |
| "measure" | `measure` | Start ruler tool |
| "delete annotation" | `delete-annotation` | Delete selected annotation |
| "clear annotations" | `clear-annotations` | Clear all annotations |

### Workflow

| Command | Intent | Description |
|---------|--------|-------------|
| "sign out" | `sign-out` | Sign out current case |
| "add note" | `add-note` | Add case note |
| "mark as reviewed" | `mark-reviewed` | Mark slide as reviewed |

### System

| Command | Intent | Description |
|---------|--------|-------------|
| "help" | `help` | Show voice help |
| "stop listening" | `stop` | Pause voice recognition |

## Configuration

```typescript
interface VoiceConfig {
  /** Recognition language */
  language: string;

  /** Continuous listening mode */
  continuous: boolean;

  /** Show interim (partial) results */
  interimResults: boolean;

  /** Enable wake word detection */
  wakeWordEnabled: boolean;

  /** Wake word phrase */
  wakeWord: string;

  /** Minimum confidence threshold (0-1) */
  confidenceThreshold: number;

  /** Command timeout (ms) */
  commandTimeout: number;
}
```

### Default Configuration

```typescript
const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  language: 'en-US',
  continuous: true,
  interimResults: true,
  wakeWordEnabled: false,
  wakeWord: 'hey pathology',
  confidenceThreshold: 0.7,
  commandTimeout: 5000,
};
```

## API Reference

### VoiceRecognitionManager

#### Constructor

```typescript
const voice = new VoiceRecognitionManager(config?: Partial<VoiceConfig>);
```

#### Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize speech recognition, returns `false` if unsupported |
| `start()` | Start listening |
| `stop()` | Stop listening |
| `isListening()` | Check if currently listening |
| `onCommand(intent, handler)` | Register command handler |
| `offCommand(intent, handler)` | Remove command handler |
| `on(listener)` | Add event listener |
| `off(listener)` | Remove event listener |
| `getHistory()` | Get command history |
| `destroy()` | Clean up resources |

### IntentClassifier

Classify transcripts into intents:

```typescript
import { IntentClassifier } from '@pathology/voice';

const classifier = new IntentClassifier();

const result = classifier.classify('zoom to twenty times magnification');

console.log(result.intent);     // 'zoom-to'
console.log(result.confidence); // 0.95
console.log(result.entities);   // [{ type: 'level', value: '20', raw: 'twenty' }]
```

#### Classify Result

```typescript
interface VoiceIntent {
  /** Classified intent name */
  intent: string;

  /** Classification confidence (0-1) */
  confidence: number;

  /** Extracted entities */
  entities: VoiceEntity[];

  /** Original transcript */
  transcript: string;

  /** Intent category */
  category: VoiceIntentCategory;
}

interface VoiceEntity {
  type: 'level' | 'direction' | 'number' | 'tool' | 'action';
  value: string;
  raw: string;  // Original text
}

type VoiceIntentCategory =
  | 'navigation'
  | 'annotation'
  | 'workflow'
  | 'system';
```

## Svelte Stores

Reactive stores for voice state:

```typescript
import {
  voiceState,
  voiceEnabled,
  isListening,
  currentTranscript,
  lastIntent,
  commandHistory,
  hasError,
} from '@pathology/voice';

// Subscribe to state changes
voiceState.subscribe((state) => {
  console.log('Listening:', state.isListening);
  console.log('Transcript:', state.transcript);
});

// Check if listening
$: listening = $isListening;

// Show current transcript
$: transcript = $currentTranscript;

// Get last recognized intent
$: if ($lastIntent) {
  console.log('Last command:', $lastIntent.intent);
}

// Show recent commands
$: recent = $commandHistory.slice(-5);
```

### Store Actions

```typescript
import {
  toggleVoice,
  updateVoiceConfig,
  resetVoiceState,
} from '@pathology/voice';

// Toggle voice on/off
toggleVoice();

// Update configuration
updateVoiceConfig({
  language: 'en-GB',
  confidenceThreshold: 0.8,
});

// Reset state
resetVoiceState();
```

## Events

Voice events for monitoring:

```typescript
voice.on((event) => {
  switch (event.type) {
    case 'start':
      console.log('Started listening');
      break;

    case 'stop':
      console.log('Stopped listening');
      break;

    case 'transcript':
      console.log('Heard:', event.transcript);
      console.log('Final:', event.isFinal);
      break;

    case 'intent':
      console.log('Intent:', event.intent);
      console.log('Confidence:', event.confidence);
      break;

    case 'command':
      console.log('Command executed:', event.intent);
      break;

    case 'error':
      console.error('Error:', event.error);
      break;

    case 'no-match':
      console.log('Could not understand:', event.transcript);
      break;
  }
});
```

## Custom Commands

Add custom commands to the classifier:

```typescript
import { IntentClassifier, PATHOLOGY_VOICE_COMMANDS } from '@pathology/voice';

const customCommands = [
  ...PATHOLOGY_VOICE_COMMANDS,
  {
    intent: 'toggle-ai-overlay',
    patterns: ['show ai', 'hide ai', 'toggle ai', 'ai overlay'],
    category: 'annotation',
  },
  {
    intent: 'compare-slides',
    patterns: ['compare', 'side by side', 'split view'],
    category: 'navigation',
  },
];

const classifier = new IntentClassifier(customCommands);
```

## Component Example

```svelte
<script>
  import {
    VoiceRecognitionManager,
    voiceState,
    isListening,
    currentTranscript,
  } from '@pathology/voice';
  import { onMount, onDestroy } from 'svelte';

  let voice;

  onMount(() => {
    voice = new VoiceRecognitionManager();

    if (voice.initialize()) {
      voice.onCommand('zoom-in', () => dispatch('zoom-in'));
      voice.onCommand('zoom-out', () => dispatch('zoom-out'));
    }
  });

  onDestroy(() => {
    voice?.destroy();
  });

  function toggleListening() {
    if ($isListening) {
      voice.stop();
    } else {
      voice.start();
    }
  }
</script>

<div class="voice-indicator">
  <button on:click={toggleListening} class:active={$isListening}>
    {$isListening ? '🎤' : '🔇'}
  </button>

  {#if $currentTranscript}
    <span class="transcript">{$currentTranscript}</span>
  {/if}
</div>

<style>
  .voice-indicator {
    position: fixed;
    bottom: 20px;
    right: 20px;
  }

  button.active {
    background: #ff4444;
    animation: pulse 1s infinite;
  }

  .transcript {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
  }
</style>
```

## Browser Support

Voice recognition requires browser support for the Web Speech API:

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Edge | Full support |
| Safari | Partial (no continuous mode) |
| Firefox | Not supported |

```typescript
// Check support
if (!('webkitSpeechRecognition' in window) &&
    !('SpeechRecognition' in window)) {
  console.log('Speech recognition not supported');
}
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

## Privacy Considerations

Voice data handling:

1. **Browser-based**: Speech recognition happens in the browser
2. **No recording**: Audio is not stored or transmitted
3. **Transcripts only**: Only text transcripts are processed
4. **Local history**: Command history is session-only
5. **User control**: Voice can be disabled at any time

## License

Apache-2.0
