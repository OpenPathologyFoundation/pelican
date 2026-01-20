/**
 * Session Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../session-store';
import { SessionManager } from '../session-manager';
import { DEFAULT_SERVER_CONFIG } from '../types';

describe('SessionManager', () => {
  let store: SessionStore;
  let manager: SessionManager;

  beforeEach(() => {
    store = new SessionStore();
    manager = new SessionManager(store, DEFAULT_SERVER_CONFIG);
  });

  describe('register', () => {
    it('should register a window and return result', () => {
      const result = manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE, JOHN',
        viewerType: 'pathology-viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      expect(result.registration.caseId).toBe('CASE-001');
      expect(result.warnings).toHaveLength(0);
    });

    it('should generate multi-case warning when user opens second case', () => {
      manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      const result = manager.register('conn-2', {
        userId: 'user-1',
        caseId: 'CASE-002',
        patientIdentifier: 'SMITH',
        viewerType: 'viewer',
        windowId: 'win-2',
        openedAt: new Date().toISOString(),
      });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('multi-case');
      expect(result.warnings[0].cases).toHaveLength(2);
    });

    it('should return affected connection IDs for warnings', () => {
      manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      const result = manager.register('conn-2', {
        userId: 'user-1',
        caseId: 'CASE-002',
        patientIdentifier: 'SMITH',
        viewerType: 'viewer',
        windowId: 'win-2',
        openedAt: new Date().toISOString(),
      });

      expect(result.affectedConnectionIds).toContain('conn-1');
      expect(result.affectedConnectionIds).toContain('conn-2');
    });

    it('should not warn when same case opened in multiple windows', () => {
      manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      const result = manager.register('conn-2', {
        userId: 'user-1',
        caseId: 'CASE-001', // Same case
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-2',
        openedAt: new Date().toISOString(),
      });

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('deregister', () => {
    it('should deregister and update warnings', () => {
      manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      manager.register('conn-2', {
        userId: 'user-1',
        caseId: 'CASE-002',
        patientIdentifier: 'SMITH',
        viewerType: 'viewer',
        windowId: 'win-2',
        openedAt: new Date().toISOString(),
      });

      const result = manager.deregister('win-1', 'user-1');

      expect(result.removed).not.toBeNull();
      expect(result.removed?.caseId).toBe('CASE-001');
      // Should no longer have multi-case warning after one is removed
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('handleConnectionClose', () => {
    it('should handle connection close gracefully', () => {
      manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      const result = manager.handleConnectionClose('conn-1');

      expect(result.removed).not.toBeNull();
      expect(result.removed?.connectionId).toBe('conn-1');
    });

    it('should return null for unknown connection', () => {
      const result = manager.handleConnectionClose('unknown');
      expect(result.removed).toBeNull();
    });
  });

  describe('updateHeartbeat', () => {
    it('should update heartbeat', () => {
      manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      const result = manager.updateHeartbeat('win-1', 'user-1');
      expect(result).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      manager.register('conn-2', {
        userId: 'user-2',
        caseId: 'CASE-002',
        patientIdentifier: 'SMITH',
        viewerType: 'viewer',
        windowId: 'win-2',
        openedAt: new Date().toISOString(),
      });

      const stats = manager.getStats();
      expect(stats.totalRegistrations).toBe(2);
      expect(stats.activeUsers).toBe(2);
    });
  });

  describe('getUserState', () => {
    it('should return all user registrations', () => {
      manager.register('conn-1', {
        userId: 'user-1',
        caseId: 'CASE-001',
        patientIdentifier: 'DOE',
        viewerType: 'viewer',
        windowId: 'win-1',
        openedAt: new Date().toISOString(),
      });

      manager.register('conn-2', {
        userId: 'user-1',
        caseId: 'CASE-002',
        patientIdentifier: 'SMITH',
        viewerType: 'viewer',
        windowId: 'win-2',
        openedAt: new Date().toISOString(),
      });

      const state = manager.getUserState('user-1');
      expect(state).toHaveLength(2);
    });
  });
});
