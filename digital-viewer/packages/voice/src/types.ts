/**
 * Voice Interface - Type Definitions
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 8
 */

/** Voice command intent categories */
export type VoiceIntentCategory =
  | 'navigation'
  | 'annotation'
  | 'workflow'
  | 'query'
  | 'dictation'
  | 'system';

/** Voice command intent */
export interface VoiceIntent {
  category: VoiceIntentCategory;
  action: string;
  confidence: number;
  entities: VoiceEntity[];
  rawTranscript: string;
}

/** Extracted entity from voice command */
export interface VoiceEntity {
  type: string;
  value: string;
  confidence: number;
  start: number;
  end: number;
}

/** Voice command definition */
export interface VoiceCommand {
  id: string;
  patterns: string[];
  intent: {
    category: VoiceIntentCategory;
    action: string;
  };
  entities?: {
    name: string;
    type: 'number' | 'string' | 'enum';
    required?: boolean;
    values?: string[];
  }[];
  examples: string[];
  handler?: (intent: VoiceIntent) => void;
}

/** Predefined voice commands for pathology */
export const PATHOLOGY_VOICE_COMMANDS: VoiceCommand[] = [
  // Navigation commands
  {
    id: 'zoom-in',
    patterns: ['zoom in', 'magnify', 'closer', 'increase magnification'],
    intent: { category: 'navigation', action: 'zoom-in' },
    examples: ['zoom in', 'zoom in more', 'magnify'],
  },
  {
    id: 'zoom-out',
    patterns: ['zoom out', 'zoom back', 'wider view', 'decrease magnification'],
    intent: { category: 'navigation', action: 'zoom-out' },
    examples: ['zoom out', 'zoom back out', 'show wider view'],
  },
  {
    id: 'zoom-to',
    patterns: ['zoom to (?<level>\\d+)x?', 'set magnification (?<level>\\d+)', '(?<level>\\d+)x magnification'],
    intent: { category: 'navigation', action: 'zoom-to' },
    entities: [{ name: 'level', type: 'number', required: true }],
    examples: ['zoom to 20x', 'set magnification 40', '10x magnification'],
  },
  {
    id: 'pan',
    patterns: ['go (?<direction>left|right|up|down)', 'move (?<direction>left|right|up|down)', 'pan (?<direction>left|right|up|down)'],
    intent: { category: 'navigation', action: 'pan' },
    entities: [{ name: 'direction', type: 'enum', values: ['left', 'right', 'up', 'down'] }],
    examples: ['go left', 'move right', 'pan up'],
  },
  {
    id: 'go-home',
    patterns: ['go home', 'reset view', 'overview', 'show whole slide'],
    intent: { category: 'navigation', action: 'go-home' },
    examples: ['go home', 'reset view', 'show overview'],
  },
  {
    id: 'next-slide',
    patterns: ['next slide', 'next', 'forward'],
    intent: { category: 'navigation', action: 'next-slide' },
    examples: ['next slide', 'go to next', 'forward'],
  },
  {
    id: 'previous-slide',
    patterns: ['previous slide', 'previous', 'back', 'go back'],
    intent: { category: 'navigation', action: 'previous-slide' },
    examples: ['previous slide', 'go back', 'previous'],
  },

  // Annotation commands
  {
    id: 'start-annotation',
    patterns: ['annotate', 'mark', 'draw (?<type>\\w+)?', 'create (?<type>\\w+)?'],
    intent: { category: 'annotation', action: 'start' },
    entities: [{ name: 'type', type: 'enum', values: ['point', 'rectangle', 'circle', 'polygon', 'freehand'] }],
    examples: ['annotate this', 'draw rectangle', 'mark this area'],
  },
  {
    id: 'finish-annotation',
    patterns: ['done', 'finish', 'complete', 'end annotation'],
    intent: { category: 'annotation', action: 'finish' },
    examples: ['done', 'finish annotation', 'complete'],
  },
  {
    id: 'delete-annotation',
    patterns: ['delete', 'remove', 'clear annotation'],
    intent: { category: 'annotation', action: 'delete' },
    examples: ['delete this', 'remove annotation', 'clear'],
  },
  {
    id: 'classify-annotation',
    patterns: ['classify as (?<classification>\\w+)', 'mark as (?<classification>\\w+)', 'label (?<classification>\\w+)'],
    intent: { category: 'annotation', action: 'classify' },
    entities: [{ name: 'classification', type: 'string', required: true }],
    examples: ['classify as tumor', 'mark as necrosis', 'label inflammation'],
  },

  // Workflow commands
  {
    id: 'sign-out',
    patterns: ['sign out', 'complete case', 'finalize'],
    intent: { category: 'workflow', action: 'sign-out' },
    examples: ['sign out case', 'complete this case', 'finalize'],
  },
  {
    id: 'save',
    patterns: ['save', 'save progress', 'save changes'],
    intent: { category: 'workflow', action: 'save' },
    examples: ['save', 'save my progress', 'save changes'],
  },
  {
    id: 'add-note',
    patterns: ['add note', 'note', 'comment'],
    intent: { category: 'workflow', action: 'add-note' },
    examples: ['add note', 'make a note', 'add comment'],
  },

  // Query commands
  {
    id: 'what-is',
    patterns: ['what is this', 'identify', 'what do you see'],
    intent: { category: 'query', action: 'identify' },
    examples: ['what is this', 'identify this structure', 'what do you see here'],
  },
  {
    id: 'measure',
    patterns: ['measure', 'how big', 'what size', 'dimensions'],
    intent: { category: 'query', action: 'measure' },
    examples: ['measure this', 'how big is this', 'what are the dimensions'],
  },

  // System commands
  {
    id: 'help',
    patterns: ['help', 'what can I say', 'commands'],
    intent: { category: 'system', action: 'help' },
    examples: ['help', 'what can I say', 'show commands'],
  },
  {
    id: 'stop-listening',
    patterns: ['stop listening', 'pause', 'mute'],
    intent: { category: 'system', action: 'stop-listening' },
    examples: ['stop listening', 'pause voice', 'mute'],
  },
];

/** Voice recognition state */
export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

/** Voice configuration */
export interface VoiceConfig {
  enabled: boolean;
  language: string;
  continuous: boolean;
  interimResults: boolean;
  wakeWord?: string;
  wakeWordEnabled: boolean;
  confidenceThreshold: number;
  maxAlternatives: number;
  dictationMode: boolean;
}

/** Default voice configuration */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  enabled: true,
  language: 'en-US',
  continuous: true,
  interimResults: true,
  wakeWord: 'hey pathology',
  wakeWordEnabled: false,
  confidenceThreshold: 0.7,
  maxAlternatives: 3,
  dictationMode: false,
};

/** Voice event types */
export type VoiceEventType =
  | 'start'
  | 'stop'
  | 'result'
  | 'interim'
  | 'error'
  | 'no-match'
  | 'command-recognized'
  | 'command-executed';

/** Voice event */
export interface VoiceEvent {
  type: VoiceEventType;
  timestamp: Date;
  transcript?: string;
  confidence?: number;
  intent?: VoiceIntent;
  error?: string;
}

/** Voice event listener */
export type VoiceEventListener = (event: VoiceEvent) => void;
