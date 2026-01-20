/**
 * Voice Interface
 *
 * Hands-free voice control with intent classification for digital pathology.
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 8
 *
 * @example
 * ```typescript
 * import { VoiceRecognitionManager } from '@pathology/voice';
 *
 * const voice = new VoiceRecognitionManager({
 *   language: 'en-US',
 *   continuous: true,
 *   wakeWordEnabled: false,
 * });
 *
 * // Initialize (requires browser support)
 * if (voice.initialize()) {
 *   // Register command handlers
 *   voice.onCommand('zoom-in', (intent) => {
 *     viewer.zoomIn();
 *   });
 *
 *   voice.onCommand('zoom-to', (intent) => {
 *     const level = intent.entities.find(e => e.type === 'level');
 *     if (level) viewer.zoomTo(parseInt(level.value));
 *   });
 *
 *   // Start listening
 *   voice.start();
 *
 *   // Listen for events
 *   voice.on((event) => {
 *     console.log('Voice event:', event);
 *   });
 * }
 * ```
 */

// Voice Recognition
export { VoiceRecognitionManager } from './voice-recognition';

// Intent Classifier
export { IntentClassifier } from './intent-classifier';

// Stores
export {
  voiceConfig,
  voiceState,
  voiceEnabled,
  currentTranscript,
  lastIntent,
  commandHistory,
  isListening,
  hasError,
  recentCommands,
  updateVoiceState,
  updateTranscript,
  setLastIntent,
  addToHistory,
  clearHistory,
  toggleVoice,
  updateVoiceConfig,
  resetVoiceState,
} from './store';

// Types
export type {
  VoiceCommand,
  VoiceConfig,
  VoiceEntity,
  VoiceEvent,
  VoiceEventListener,
  VoiceEventType,
  VoiceIntent,
  VoiceIntentCategory,
  VoiceState,
} from './types';

export { DEFAULT_VOICE_CONFIG, PATHOLOGY_VOICE_COMMANDS } from './types';
