/**
 * Voice Interface - Intent Classifier
 *
 * Pattern-based intent classification for voice commands
 */

import type {
  VoiceCommand,
  VoiceEntity,
  VoiceIntent,
  VoiceIntentCategory,
} from './types';
import { PATHOLOGY_VOICE_COMMANDS } from './types';

/** Intent classifier */
export class IntentClassifier {
  private commands: VoiceCommand[];
  private patterns: Map<string, { regex: RegExp; command: VoiceCommand }[]> =
    new Map();

  constructor(commands: VoiceCommand[] = PATHOLOGY_VOICE_COMMANDS) {
    this.commands = commands;
    this.compilePatterns();
  }

  /** Compile patterns to regex */
  private compilePatterns(): void {
    for (const command of this.commands) {
      const category = command.intent.category;

      if (!this.patterns.has(category)) {
        this.patterns.set(category, []);
      }

      for (const pattern of command.patterns) {
        try {
          // Convert pattern to regex with word boundaries
          const regex = new RegExp(`^${pattern}$`, 'i');
          this.patterns.get(category)!.push({ regex, command });
        } catch (error) {
          console.warn(`[IntentClassifier] Invalid pattern: ${pattern}`, error);
        }
      }
    }
  }

  /** Classify a transcript into an intent */
  classify(transcript: string): VoiceIntent | null {
    const normalized = this.normalizeText(transcript);

    // Try exact matches first
    for (const [category, patterns] of this.patterns) {
      for (const { regex, command } of patterns) {
        const match = normalized.match(regex);
        if (match) {
          return this.createIntent(
            command,
            transcript,
            match,
            1.0 // High confidence for exact match
          );
        }
      }
    }

    // Try fuzzy matching
    const fuzzyResult = this.fuzzyMatch(normalized);
    if (fuzzyResult) {
      return fuzzyResult;
    }

    // Check for dictation mode
    if (this.isDictation(normalized)) {
      return {
        category: 'dictation',
        action: 'transcribe',
        confidence: 0.9,
        entities: [],
        rawTranscript: transcript,
      };
    }

    return null;
  }

  /** Normalize text for matching */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /** Create intent from match */
  private createIntent(
    command: VoiceCommand,
    transcript: string,
    match: RegExpMatchArray,
    confidence: number
  ): VoiceIntent {
    const entities: VoiceEntity[] = [];

    // Extract named groups as entities
    if (match.groups) {
      for (const [name, value] of Object.entries(match.groups)) {
        if (value !== undefined) {
          entities.push({
            type: name,
            value,
            confidence,
            start: match.index || 0,
            end: (match.index || 0) + value.length,
          });
        }
      }
    }

    return {
      category: command.intent.category,
      action: command.intent.action,
      confidence,
      entities,
      rawTranscript: transcript,
    };
  }

  /** Fuzzy match using Levenshtein distance */
  private fuzzyMatch(normalized: string): VoiceIntent | null {
    let bestMatch: { command: VoiceCommand; distance: number; pattern: string } | null =
      null;
    const threshold = 3; // Max edit distance

    for (const command of this.commands) {
      for (const pattern of command.patterns) {
        // Skip patterns with regex special chars
        if (/[\\()?*+]/.test(pattern)) continue;

        const distance = this.levenshteinDistance(normalized, pattern.toLowerCase());
        if (distance <= threshold) {
          if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = { command, distance, pattern };
          }
        }
      }

      // Also check examples
      for (const example of command.examples) {
        const distance = this.levenshteinDistance(normalized, example.toLowerCase());
        if (distance <= threshold) {
          if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = { command, distance, pattern: example };
          }
        }
      }
    }

    if (bestMatch) {
      // Confidence decreases with edit distance
      const confidence = Math.max(0.5, 1 - bestMatch.distance * 0.15);

      return {
        category: bestMatch.command.intent.category,
        action: bestMatch.command.intent.action,
        confidence,
        entities: [],
        rawTranscript: normalized,
      };
    }

    return null;
  }

  /** Calculate Levenshtein distance between two strings */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /** Check if text is likely dictation (not a command) */
  private isDictation(text: string): boolean {
    // If text is long or doesn't match any command patterns, it's likely dictation
    const wordCount = text.split(' ').length;
    return wordCount > 5;
  }

  /** Add custom command */
  addCommand(command: VoiceCommand): void {
    this.commands.push(command);

    const category = command.intent.category;
    if (!this.patterns.has(category)) {
      this.patterns.set(category, []);
    }

    for (const pattern of command.patterns) {
      try {
        const regex = new RegExp(`^${pattern}$`, 'i');
        this.patterns.get(category)!.push({ regex, command });
      } catch (error) {
        console.warn(`[IntentClassifier] Invalid pattern: ${pattern}`, error);
      }
    }
  }

  /** Remove command by ID */
  removeCommand(commandId: string): void {
    this.commands = this.commands.filter((c) => c.id !== commandId);
    this.patterns.clear();
    this.compilePatterns();
  }

  /** Get all registered commands */
  getCommands(): VoiceCommand[] {
    return [...this.commands];
  }

  /** Get commands by category */
  getCommandsByCategory(category: VoiceIntentCategory): VoiceCommand[] {
    return this.commands.filter((c) => c.intent.category === category);
  }
}
