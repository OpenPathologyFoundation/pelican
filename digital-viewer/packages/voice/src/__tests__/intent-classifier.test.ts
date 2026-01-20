/**
 * Intent Classifier Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentClassifier } from '../intent-classifier';

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    classifier = new IntentClassifier();
  });

  describe('navigation commands', () => {
    it('should classify "zoom in"', () => {
      const intent = classifier.classify('zoom in');

      expect(intent).not.toBeNull();
      expect(intent?.category).toBe('navigation');
      expect(intent?.action).toBe('zoom-in');
      expect(intent?.confidence).toBeGreaterThan(0.9);
    });

    it('should classify "zoom out"', () => {
      const intent = classifier.classify('zoom out');

      expect(intent?.action).toBe('zoom-out');
    });

    it('should classify "magnify" as zoom-in', () => {
      const intent = classifier.classify('magnify');

      expect(intent?.action).toBe('zoom-in');
    });

    it('should classify "go home"', () => {
      const intent = classifier.classify('go home');

      expect(intent?.action).toBe('go-home');
    });

    it('should classify "reset view"', () => {
      const intent = classifier.classify('reset view');

      expect(intent?.action).toBe('go-home');
    });

    it('should classify "next slide"', () => {
      const intent = classifier.classify('next slide');

      expect(intent?.action).toBe('next-slide');
    });

    it('should classify "previous slide"', () => {
      const intent = classifier.classify('previous slide');

      expect(intent?.action).toBe('previous-slide');
    });

    it('should classify "go back"', () => {
      const intent = classifier.classify('go back');

      expect(intent?.action).toBe('previous-slide');
    });
  });

  describe('annotation commands', () => {
    it('should classify "annotate"', () => {
      const intent = classifier.classify('annotate');

      expect(intent?.category).toBe('annotation');
      expect(intent?.action).toBe('start');
    });

    it('should classify "done"', () => {
      const intent = classifier.classify('done');

      expect(intent?.action).toBe('finish');
    });

    it('should classify "delete"', () => {
      const intent = classifier.classify('delete');

      expect(intent?.action).toBe('delete');
    });
  });

  describe('workflow commands', () => {
    it('should classify "sign out"', () => {
      const intent = classifier.classify('sign out');

      expect(intent?.category).toBe('workflow');
      expect(intent?.action).toBe('sign-out');
    });

    it('should classify "save"', () => {
      const intent = classifier.classify('save');

      expect(intent?.action).toBe('save');
    });
  });

  describe('system commands', () => {
    it('should classify "help"', () => {
      const intent = classifier.classify('help');

      expect(intent?.category).toBe('system');
      expect(intent?.action).toBe('help');
    });

    it('should classify "stop listening"', () => {
      const intent = classifier.classify('stop listening');

      expect(intent?.action).toBe('stop-listening');
    });
  });

  describe('fuzzy matching', () => {
    it('should match with minor typos', () => {
      const intent = classifier.classify('zom in'); // typo

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('zoom-in');
      expect(intent?.confidence).toBeLessThan(1.0);
    });

    it('should match similar phrases within edit threshold', () => {
      // "zoom inn" is within edit distance of 1 from "zoom in"
      const intent = classifier.classify('zoom inn');

      // Should match "zoom in" with fuzzy matching
      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('zoom-in');
    });
  });

  describe('case insensitivity', () => {
    it('should match regardless of case', () => {
      const intent1 = classifier.classify('ZOOM IN');
      const intent2 = classifier.classify('Zoom In');
      const intent3 = classifier.classify('zoom in');

      expect(intent1?.action).toBe('zoom-in');
      expect(intent2?.action).toBe('zoom-in');
      expect(intent3?.action).toBe('zoom-in');
    });
  });

  describe('dictation detection', () => {
    it('should classify long text as dictation', () => {
      const intent = classifier.classify(
        'The tumor shows moderately differentiated adenocarcinoma with glandular formation'
      );

      expect(intent?.category).toBe('dictation');
      expect(intent?.action).toBe('transcribe');
    });
  });

  describe('no match', () => {
    it('should return null for unrecognized short commands', () => {
      const intent = classifier.classify('xyz');

      expect(intent).toBeNull();
    });
  });

  describe('custom commands', () => {
    it('should allow adding custom commands', () => {
      classifier.addCommand({
        id: 'custom-test',
        patterns: ['run test', 'execute test'],
        intent: { category: 'system', action: 'custom-test' },
        examples: ['run test', 'execute test'],
      });

      const intent = classifier.classify('run test');

      expect(intent?.action).toBe('custom-test');
    });

    it('should allow removing commands', () => {
      classifier.removeCommand('zoom-in');

      const intent = classifier.classify('zoom in');

      // Should no longer match exactly (might fuzzy match something else)
      expect(intent?.action).not.toBe('zoom-in');
    });
  });

  describe('getCommands', () => {
    it('should return all registered commands', () => {
      const commands = classifier.getCommands();

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some((c) => c.id === 'zoom-in')).toBe(true);
    });

    it('should filter by category', () => {
      const navCommands = classifier.getCommandsByCategory('navigation');
      const annotCommands = classifier.getCommandsByCategory('annotation');

      expect(navCommands.every((c) => c.intent.category === 'navigation')).toBe(true);
      expect(annotCommands.every((c) => c.intent.category === 'annotation')).toBe(true);
    });
  });
});
