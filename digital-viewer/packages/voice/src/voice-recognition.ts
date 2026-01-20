/**
 * Voice Interface - Speech Recognition Manager
 *
 * Web Speech API wrapper with intent classification
 */

import { IntentClassifier } from './intent-classifier';
import type {
  VoiceConfig,
  VoiceEvent,
  VoiceEventListener,
  VoiceIntent,
  VoiceState,
} from './types';
import { DEFAULT_VOICE_CONFIG } from './types';

/** Speech Recognition interface (Web Speech API) */
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

/** Voice Recognition Manager */
export class VoiceRecognitionManager {
  private config: VoiceConfig;
  private recognition: SpeechRecognition | null = null;
  private classifier: IntentClassifier;
  private state: VoiceState = 'idle';
  private listeners: Set<VoiceEventListener> = new Set();
  private wakeWordActive = false;
  private commandHandlers: Map<string, (intent: VoiceIntent) => void> = new Map();

  constructor(config: Partial<VoiceConfig> = {}) {
    this.config = { ...DEFAULT_VOICE_CONFIG, ...config };
    this.classifier = new IntentClassifier();
  }

  /** Check if speech recognition is supported */
  isSupported(): boolean {
    return typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  /** Initialize speech recognition */
  initialize(): boolean {
    if (!this.isSupported()) {
      console.warn('[Voice] Speech recognition not supported');
      return false;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.config.language;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    this.setupEventHandlers();

    return true;
  }

  /** Setup event handlers */
  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.addEventListener('start', () => {
      this.state = 'listening';
      this.emit({ type: 'start', timestamp: new Date() });
    });

    this.recognition.addEventListener('end', () => {
      this.state = 'idle';
      this.emit({ type: 'stop', timestamp: new Date() });

      // Auto-restart if continuous mode
      if (this.config.continuous && this.config.enabled) {
        setTimeout(() => {
          if (this.config.enabled) {
            this.start();
          }
        }, 100);
      }
    });

    this.recognition.addEventListener('error', (event: Event) => {
      const errorEvent = event as SpeechRecognitionEvent & { error: string };
      this.state = 'error';
      this.emit({
        type: 'error',
        timestamp: new Date(),
        error: errorEvent.error,
      });
    });

    this.recognition.addEventListener('result', (event: Event) => {
      const resultEvent = event as SpeechRecognitionEvent;
      this.handleResult(resultEvent);
    });
  }

  /** Handle recognition result */
  private handleResult(event: SpeechRecognitionEvent): void {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();
      const confidence = result[0].confidence;

      if (result.isFinal) {
        this.processFinalResult(transcript, confidence);
      } else {
        this.emit({
          type: 'interim',
          timestamp: new Date(),
          transcript,
          confidence,
        });
      }
    }
  }

  /** Process final recognition result */
  private processFinalResult(transcript: string, confidence: number): void {
    // Check for wake word if enabled
    if (this.config.wakeWordEnabled && !this.wakeWordActive) {
      if (this.matchesWakeWord(transcript)) {
        this.wakeWordActive = true;
        this.emit({
          type: 'result',
          timestamp: new Date(),
          transcript: 'Wake word detected',
          confidence: 1.0,
        });
        return;
      }
      return; // Ignore if no wake word
    }

    // Emit raw result
    this.emit({
      type: 'result',
      timestamp: new Date(),
      transcript,
      confidence,
    });

    // Skip classification if confidence too low
    if (confidence < this.config.confidenceThreshold) {
      return;
    }

    // Classify intent
    const intent = this.classifier.classify(transcript);

    if (intent) {
      this.emit({
        type: 'command-recognized',
        timestamp: new Date(),
        transcript,
        confidence: intent.confidence,
        intent,
      });

      // Execute command handler if registered
      const handler = this.commandHandlers.get(intent.action);
      if (handler) {
        try {
          handler(intent);
          this.emit({
            type: 'command-executed',
            timestamp: new Date(),
            intent,
          });
        } catch (error) {
          console.error('[Voice] Command handler error:', error);
        }
      }

      // Reset wake word after command
      if (this.config.wakeWordEnabled) {
        this.wakeWordActive = false;
      }
    } else {
      this.emit({
        type: 'no-match',
        timestamp: new Date(),
        transcript,
        confidence,
      });
    }
  }

  /** Check if transcript matches wake word */
  private matchesWakeWord(transcript: string): boolean {
    if (!this.config.wakeWord) return false;

    const normalized = transcript.toLowerCase().trim();
    const wakeWord = this.config.wakeWord.toLowerCase();

    return normalized.includes(wakeWord);
  }

  /** Start listening */
  start(): void {
    if (!this.recognition || !this.config.enabled) return;

    if (this.state === 'listening') return;

    try {
      this.recognition.start();
    } catch (error) {
      // May already be running
      console.warn('[Voice] Start error:', error);
    }
  }

  /** Stop listening */
  stop(): void {
    if (!this.recognition) return;

    this.config.enabled = false;
    this.recognition.stop();
  }

  /** Pause listening temporarily */
  pause(): void {
    if (!this.recognition) return;
    this.recognition.abort();
  }

  /** Resume listening */
  resume(): void {
    this.config.enabled = true;
    this.start();
  }

  /** Get current state */
  getState(): VoiceState {
    return this.state;
  }

  /** Get current config */
  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /** Update configuration */
  updateConfig(config: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.recognition) {
      this.recognition.lang = this.config.language;
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
    }
  }

  /** Register command handler */
  onCommand(action: string, handler: (intent: VoiceIntent) => void): void {
    this.commandHandlers.set(action, handler);
  }

  /** Unregister command handler */
  offCommand(action: string): void {
    this.commandHandlers.delete(action);
  }

  /** Add event listener */
  on(listener: VoiceEventListener): void {
    this.listeners.add(listener);
  }

  /** Remove event listener */
  off(listener: VoiceEventListener): void {
    this.listeners.delete(listener);
  }

  /** Emit event */
  private emit(event: VoiceEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[Voice] Listener error:', error);
      }
    }
  }

  /** Get intent classifier */
  getClassifier(): IntentClassifier {
    return this.classifier;
  }

  /** Toggle dictation mode */
  setDictationMode(enabled: boolean): void {
    this.config.dictationMode = enabled;
  }

  /** Destroy manager */
  destroy(): void {
    if (this.recognition) {
      this.recognition.abort();
    }
    this.listeners.clear();
    this.commandHandlers.clear();
    this.state = 'idle';
  }
}
