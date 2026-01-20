/**
 * Session Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../session-store';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  describe('register', () => {
    it('should register a new window', () => {
      const registration = store.register(
        'conn-1',
        'user-1',
        'win-1',
        'CASE-001',
        'DOE, JOHN',
        'pathology-viewer',
        new Date().toISOString()
      );

      expect(registration.userId).toBe('user-1');
      expect(registration.windowId).toBe('win-1');
      expect(registration.caseId).toBe('CASE-001');
    });

    it('should track multiple registrations for same user', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE, JOHN', 'viewer', '2024-01-01');
      store.register('conn-2', 'user-1', 'win-2', 'CASE-002', 'SMITH, JANE', 'viewer', '2024-01-01');

      const registrations = store.getUserRegistrations('user-1');
      expect(registrations).toHaveLength(2);
    });

    it('should track registrations from different users', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');
      store.register('conn-2', 'user-2', 'win-2', 'CASE-002', 'SMITH', 'viewer', '2024-01-01');

      expect(store.getUserCount()).toBe(2);
      expect(store.getTotalCount()).toBe(2);
    });
  });

  describe('deregister', () => {
    it('should deregister a window by windowId and userId', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');

      const result = store.deregister('win-1', 'user-1');
      expect(result).toBe(true);

      const registrations = store.getUserRegistrations('user-1');
      expect(registrations).toHaveLength(0);
    });

    it('should deregister by windowId without userId', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');

      const result = store.deregister('win-1');
      expect(result).toBe(true);
    });

    it('should return false for non-existent window', () => {
      const result = store.deregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('deregisterByConnection', () => {
    it('should deregister by connection ID', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');

      const removed = store.deregisterByConnection('conn-1');
      expect(removed).not.toBeNull();
      expect(removed?.windowId).toBe('win-1');
    });

    it('should return null for unknown connection', () => {
      const removed = store.deregisterByConnection('unknown');
      expect(removed).toBeNull();
    });
  });

  describe('heartbeat', () => {
    it('should update heartbeat timestamp', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');

      const initialReg = store.getRegistration('win-1', 'user-1');
      const initialHeartbeat = initialReg?.lastHeartbeat;

      // Wait a bit
      const later = Date.now() + 100;
      store.updateHeartbeat('win-1', 'user-1');

      const updatedReg = store.getRegistration('win-1', 'user-1');
      expect(updatedReg?.lastHeartbeat).toBeGreaterThanOrEqual(initialHeartbeat!);
    });
  });

  describe('getUserCases', () => {
    it('should return unique cases for a user', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');
      store.register('conn-2', 'user-1', 'win-2', 'CASE-001', 'DOE', 'viewer', '2024-01-01'); // Same case
      store.register('conn-3', 'user-1', 'win-3', 'CASE-002', 'SMITH', 'viewer', '2024-01-01');

      const cases = store.getUserCases('user-1');
      expect(cases).toHaveLength(2);
    });
  });

  describe('stale cleanup', () => {
    it('should identify stale registrations', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');

      // Get the registration and manually set old heartbeat
      const reg = store.getRegistration('win-1', 'user-1');
      if (reg) {
        reg.lastHeartbeat = Date.now() - 120000; // 2 minutes ago
      }

      const stale = store.getStaleRegistrations(60000); // 1 minute timeout
      expect(stale).toHaveLength(1);
    });

    it('should cleanup stale registrations', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');

      const reg = store.getRegistration('win-1', 'user-1');
      if (reg) {
        reg.lastHeartbeat = Date.now() - 120000;
      }

      const removed = store.cleanupStale(60000);
      expect(removed).toHaveLength(1);
      expect(store.getTotalCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      store.register('conn-1', 'user-1', 'win-1', 'CASE-001', 'DOE', 'viewer', '2024-01-01');
      store.register('conn-2', 'user-2', 'win-2', 'CASE-002', 'SMITH', 'viewer', '2024-01-01');

      store.clear();

      expect(store.getTotalCount()).toBe(0);
      expect(store.getUserCount()).toBe(0);
    });
  });
});
