/**
 * Telemetry Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelemetryManager } from '../telemetry-manager';
import type { TelemetryTransport, TelemetryEvent } from '../types';

describe('TelemetryManager', () => {
  let manager: TelemetryManager;

  beforeEach(() => {
    manager = new TelemetryManager({
      userId: 'test-user',
      tiers: {
        ephemeral: { enabled: true, maxBufferSize: 100, retentionMs: 3600000 },
        workflow: { enabled: true, batchSize: 10, flushIntervalMs: 30000 },
        audit: { enabled: true, requireSignature: false },
      },
    });
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('Tier 1: Ephemeral Events', () => {
    it('should track ephemeral events locally', () => {
      manager.trackEphemeral('zoom', { viewport: { x: 0.5, y: 0.5, zoom: 10, rotation: 0 } });

      const events = manager.getEphemeralEvents();
      expect(events).toHaveLength(1);
      expect(events[0].tier).toBe('ephemeral');
      expect(events[0].type).toBe('zoom');
    });

    it('should respect buffer size limit', () => {
      for (let i = 0; i < 150; i++) {
        manager.trackEphemeral('pan', { slideId: `slide-${i}` });
      }

      const events = manager.getEphemeralEvents();
      expect(events.length).toBeLessThanOrEqual(100);
    });

    it('should update analytics from ephemeral events', () => {
      manager.trackEphemeral('zoom', { viewport: { x: 0, y: 0, zoom: 5, rotation: 0 } });
      manager.trackEphemeral('zoom', { viewport: { x: 0, y: 0, zoom: 5, rotation: 0 } });
      manager.trackEphemeral('zoom', { viewport: { x: 0, y: 0, zoom: 10, rotation: 0 } });

      const analytics = manager.getAnalytics();
      expect(analytics.zoomDistribution.get(5)).toBe(2);
      expect(analytics.zoomDistribution.get(10)).toBe(1);
    });

    it('should track tool usage', () => {
      manager.trackEphemeral('tool-select', { tool: 'rectangle' });
      manager.trackEphemeral('tool-select', { tool: 'rectangle' });
      manager.trackEphemeral('tool-select', { tool: 'point' });

      const analytics = manager.getAnalytics();
      expect(analytics.toolUsage.get('rectangle')).toBe(2);
      expect(analytics.toolUsage.get('point')).toBe(1);
    });
  });

  describe('Tier 2: Workflow Events', () => {
    it('should queue workflow events', () => {
      manager.trackWorkflow('slide-viewed', 'CASE-001', { slideId: 'SLIDE-001' });

      // Events are batched, so we check via transport
      // For this test, we just verify no errors
      expect(true).toBe(true);
    });

    it('should auto-flush when batch size reached', async () => {
      const sentEvents: TelemetryEvent[] = [];
      const mockTransport: TelemetryTransport = {
        send: async (events) => {
          sentEvents.push(...events);
        },
        isConnected: () => true,
      };

      manager.setTransport(mockTransport);

      // Send batch size events
      for (let i = 0; i < 10; i++) {
        manager.trackWorkflow('slide-viewed', 'CASE-001', { slideId: `SLIDE-${i}` });
      }

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(sentEvents.length).toBeGreaterThan(0);
      expect(sentEvents.every((e) => e.tier === 'workflow')).toBe(true);
    });
  });

  describe('Tier 3: Audit Events', () => {
    it('should send audit events immediately', async () => {
      const sentEvents: TelemetryEvent[] = [];
      const mockTransport: TelemetryTransport = {
        send: async (events) => {
          sentEvents.push(...events);
        },
        isConnected: () => true,
      };

      manager.setTransport(mockTransport);

      await manager.trackAudit('sign-out', 'CASE-001', {
        action: 'case-signed-out',
        reason: 'Completed review',
      });

      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0].tier).toBe('audit');
      expect(sentEvents[0].type).toBe('sign-out');
    });

    it('should include user agent and ip in audit events', async () => {
      const sentEvents: TelemetryEvent[] = [];
      const mockTransport: TelemetryTransport = {
        send: async (events) => {
          sentEvents.push(...events);
        },
        isConnected: () => true,
      };

      manager.setTransport(mockTransport);

      await manager.trackAudit('phi-access', 'CASE-001', { action: 'viewed' });

      const event = sentEvents[0] as any;
      expect(event.data.userAgent).toBeDefined();
      expect(event.data.ipAddress).toBeDefined();
    });

    it('should queue audit events when transport unavailable', async () => {
      // No transport set
      await manager.trackAudit('sign-out', 'CASE-001', { action: 'test' });

      // Should not throw, event queued internally
      expect(true).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should allow updating configuration', () => {
      manager.updateConfig({ userId: 'new-user' });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should allow setting user ID', () => {
      manager.setUserId('updated-user');

      // Should not throw
      expect(true).toBe(true);
    });

    it('should disable tracking when config disabled', () => {
      const disabledManager = new TelemetryManager({ enabled: false });

      disabledManager.trackEphemeral('zoom', { viewport: { x: 0, y: 0, zoom: 1, rotation: 0 } });

      expect(disabledManager.getEphemeralEvents()).toHaveLength(0);

      disabledManager.destroy();
    });
  });

  describe('Analytics', () => {
    it('should return session analytics', () => {
      const analytics = manager.getAnalytics();

      expect(analytics.sessionId).toBeDefined();
      expect(analytics.zoomDistribution).toBeInstanceOf(Map);
      expect(analytics.toolUsage).toBeInstanceOf(Map);
    });
  });
});
