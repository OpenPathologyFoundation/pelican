/**
 * Tile Source Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TileSourceFactory, fetchSlideMetadata } from '../tile-source';
import type { ViewerConfig, SlideMetadata } from '../types';
import { DEFAULT_VIEWER_CONFIG } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('TileSourceFactory', () => {
  let factory: TileSourceFactory;
  const config: ViewerConfig = {
    ...DEFAULT_VIEWER_CONFIG,
    tileServerUrl: 'http://localhost:8000',
  };

  const mockMetadata: SlideMetadata = {
    slideId: 'test-slide',
    width: 50000,
    height: 40000,
    tileWidth: 256,
    tileHeight: 256,
    levels: 10,
    magnification: 40,
    mpp: 0.25,
    format: 'aperio',
    vendor: 'aperio',
  };

  beforeEach(() => {
    factory = new TileSourceFactory(config);
    vi.resetAllMocks();
  });

  describe('createTileSource', () => {
    it('should create large-image tile source', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sizeX: 50000,
          sizeY: 40000,
          tileWidth: 256,
          tileHeight: 256,
          levels: 10,
          magnification: 40,
          mm_x: 0.00025,
        }),
      });

      const { tileSource, metadata } = await factory.createTileSource('test-slide');

      expect(metadata.width).toBe(50000);
      expect(metadata.height).toBe(40000);
      expect(tileSource).toBeDefined();
      expect(typeof (tileSource as any).getTileUrl).toBe('function');
    });

    it('should return DZI URL for dzi type', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sizeX: 50000,
          sizeY: 40000,
          tileWidth: 256,
          tileHeight: 256,
          levels: 10,
        }),
      });

      const { tileSource } = await factory.createTileSource('test-slide', 'dzi');

      expect(typeof tileSource).toBe('string');
      expect(tileSource).toContain('.dzi');
    });

    it('should cache metadata', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sizeX: 50000,
          sizeY: 40000,
          tileWidth: 256,
          tileHeight: 256,
          levels: 10,
        }),
      });

      await factory.createTileSource('test-slide');
      const cached = factory.getMetadata('test-slide');

      expect(cached).toBeDefined();
      expect(cached?.width).toBe(50000);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await factory.createTileSource('test-slide');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(factory.createTileSource('missing-slide')).rejects.toThrow(
        'Failed to fetch metadata'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear metadata cache', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          sizeX: 50000,
          sizeY: 40000,
          tileWidth: 256,
          tileHeight: 256,
          levels: 10,
        }),
      });

      await factory.createTileSource('test-slide');
      expect(factory.getMetadata('test-slide')).toBeDefined();

      factory.clearCache();
      expect(factory.getMetadata('test-slide')).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      factory.updateConfig({ tileServerUrl: 'http://new-server:9000' });

      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe('fetchSlideMetadata', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch and transform metadata', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sizeX: 50000,
        sizeY: 40000,
        tileWidth: 256,
        tileHeight: 256,
        levels: 10,
        magnification: 40,
        mm_x: 0.00025,
        format: 'aperio',
      }),
    });

    const metadata = await fetchSlideMetadata('http://localhost:8000', 'test');

    expect(metadata.slideId).toBe('test');
    expect(metadata.width).toBe(50000);
    expect(metadata.height).toBe(40000);
    expect(metadata.mpp).toBe(0.25); // mm_x * 1000
  });
});
