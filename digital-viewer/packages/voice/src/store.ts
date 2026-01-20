/**
 * Voice Interface - Svelte Stores
 *
 * Reactive state management for voice recognition
 */

import { writable, derived, type Readable, type Writable } from 'svelte/store';
import type { VoiceConfig, VoiceEvent, VoiceIntent, VoiceState } from './types';
import { DEFAULT_VOICE_CONFIG } from './types';

/** Voice configuration store */
export const voiceConfig: Writable<VoiceConfig> = writable({
  ...DEFAULT_VOICE_CONFIG,
});

/** Voice state store */
export const voiceState: Writable<VoiceState> = writable('idle');

/** Is voice enabled */
export const voiceEnabled: Writable<boolean> = writable(false);

/** Current transcript (interim) */
export const currentTranscript: Writable<string> = writable('');

/** Last recognized intent */
export const lastIntent: Writable<VoiceIntent | null> = writable(null);

/** Voice command history */
export const commandHistory: Writable<VoiceEvent[]> = writable([]);

/** Max history size */
const MAX_HISTORY_SIZE = 50;

/** Derived: Is listening */
export const isListening: Readable<boolean> = derived(
  voiceState,
  ($state) => $state === 'listening'
);

/** Derived: Has error */
export const hasError: Readable<boolean> = derived(
  voiceState,
  ($state) => $state === 'error'
);

/** Derived: Recent commands */
export const recentCommands: Readable<VoiceEvent[]> = derived(
  commandHistory,
  ($history) => $history.slice(-10)
);

/** Actions: Update voice state */
export function updateVoiceState(state: VoiceState): void {
  voiceState.set(state);
}

/** Actions: Update transcript */
export function updateTranscript(transcript: string): void {
  currentTranscript.set(transcript);
}

/** Actions: Set last intent */
export function setLastIntent(intent: VoiceIntent | null): void {
  lastIntent.set(intent);
}

/** Actions: Add to command history */
export function addToHistory(event: VoiceEvent): void {
  commandHistory.update((history) => {
    const updated = [...history, event];
    if (updated.length > MAX_HISTORY_SIZE) {
      return updated.slice(-MAX_HISTORY_SIZE);
    }
    return updated;
  });
}

/** Actions: Clear history */
export function clearHistory(): void {
  commandHistory.set([]);
}

/** Actions: Toggle voice */
export function toggleVoice(): void {
  voiceEnabled.update((enabled) => !enabled);
}

/** Actions: Update config */
export function updateVoiceConfig(config: Partial<VoiceConfig>): void {
  voiceConfig.update((c) => ({ ...c, ...config }));
}

/** Actions: Reset voice state */
export function resetVoiceState(): void {
  voiceState.set('idle');
  voiceEnabled.set(false);
  currentTranscript.set('');
  lastIntent.set(null);
  commandHistory.set([]);
  voiceConfig.set({ ...DEFAULT_VOICE_CONFIG });
}
