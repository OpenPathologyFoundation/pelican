/**
 * Focus Declaration Protocol - Audio Announcement
 *
 * Implements Section 5.2.2.4 of the specification
 */

import type { CaseContext, FDPConfig } from './types';

/** Audio context for playing chimes */
let audioContext: AudioContext | null = null;

/** Get or create audio context */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
  }
  return audioContext;
}

/** Play a simple chime sound */
function playChime(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Two-tone chime
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.1); // C6

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (error) {
    console.warn('[FDP] Failed to play chime:', error);
  }
}

/** Speak text using Web Speech API */
function speak(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(event.error);

    window.speechSynthesis.speak(utterance);
  });
}

/** Audio announcement controller */
export class AudioController {
  private config: FDPConfig;
  private enabled: boolean = true;

  constructor(config: FDPConfig) {
    this.config = config;
  }

  /** Announce case context */
  async announce(caseContext: CaseContext): Promise<void> {
    if (!this.enabled || this.config.audioMode === 'off') {
      return;
    }

    try {
      switch (this.config.audioMode) {
        case 'chime':
          playChime();
          break;

        case 'brief':
          await speak(`Case ${caseContext.caseId}`);
          break;

        case 'full':
          await speak(
            `Case ${caseContext.caseId}, patient ${caseContext.patientName}`
          );
          break;
      }
    } catch (error) {
      console.warn('[FDP] Audio announcement failed:', error);
    }
  }

  /** Enable audio */
  enable(): void {
    this.enabled = true;
  }

  /** Disable audio */
  disable(): void {
    this.enabled = false;
  }

  /** Toggle audio */
  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /** Check if enabled */
  isEnabled(): boolean {
    return this.enabled && this.config.audioMode !== 'off';
  }

  /** Update configuration */
  updateConfig(config: Partial<FDPConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Destroy controller */
  destroy(): void {
    this.enabled = false;
    // Cancel any pending speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
