/**
 * Multi-Frame Tile Source Tests
 *
 * Tests the full pipeline for multi-page OME-TIFF / Z-stack images:
 * - Metadata parsing (frame extraction, dimension ranges)
 * - Tile URL generation with ?frame=N parameter
 * - Source type auto-switching (DZI → large-image for multi-frame)
 * - Frame getter integration
 * - Level inversion (OSD vs large_image numbering)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TileSourceFactory,
  fetchSlideMetadata,
  createLargeImageTileSource,
} from '../tile-source';
import type { ViewerConfig, SlideMetadata } from '../types';
import { DEFAULT_VIEWER_CONFIG } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

/** Simulated server response matching KID-MED-034.ome.tif */
const MULTI_FRAME_SERVER_RESPONSE = {
  levels: 8,
  sizeX: 35840,
  sizeY: 10112,
  tileWidth: 512,
  tileHeight: 512,
  magnification: 40.0,
  mm_x: 0.00025,
  mm_y: 0.00025,
  frames: Array.from({ length: 18 }, (_, i) => ({
    Frame: i,
    IndexT: i,
    Index: i,
  })),
  IndexRange: { IndexT: 18 },
  IndexStride: { IndexT: 1 },
  channels: null,
  dtype: 'uint8',
  bandCount: 3,
};

/** Single-frame server response (normal SVS slide) */
const SINGLE_FRAME_SERVER_RESPONSE = {
  levels: 10,
  sizeX: 50000,
  sizeY: 40000,
  tileWidth: 256,
  tileHeight: 256,
  magnification: 40,
  mm_x: 0.00025,
  format: 'aperio',
  vendor: 'aperio',
};

const config: ViewerConfig = {
  ...DEFAULT_VIEWER_CONFIG,
  tileServerUrl: 'http://localhost:8000',
};

function mockFetchResponse(data: unknown) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
}

describe('fetchSlideMetadata – multi-frame', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should extract frame info from multi-frame response', async () => {
    mockFetchResponse(MULTI_FRAME_SERVER_RESPONSE);

    const metadata = await fetchSlideMetadata(
      'http://localhost:8000',
      'KID-MED-034.ome.tif'
    );

    expect(metadata.frameCount).toBe(18);
    expect(metadata.frames).toHaveLength(18);
    expect(metadata.frameIndexRange).toEqual({ IndexT: 18 });
  });

  it('should map frame fields correctly', async () => {
    mockFetchResponse(MULTI_FRAME_SERVER_RESPONSE);

    const metadata = await fetchSlideMetadata(
      'http://localhost:8000',
      'KID-MED-034.ome.tif'
    );

    const frame0 = metadata.frames![0];
    expect(frame0.index).toBe(0);
    expect(frame0.indexT).toBe(0);

    const frame17 = metadata.frames![17];
    expect(frame17.index).toBe(17);
    expect(frame17.indexT).toBe(17);
  });

  it('should set frameCount=1 for single-frame slides', async () => {
    mockFetchResponse(SINGLE_FRAME_SERVER_RESPONSE);

    const metadata = await fetchSlideMetadata(
      'http://localhost:8000',
      'normal-slide.svs'
    );

    expect(metadata.frameCount).toBe(1);
    expect(metadata.frames).toBeUndefined();
    expect(metadata.frameIndexRange).toBeUndefined();
  });

  it('should parse Z-stack frames with IndexZ', async () => {
    const zStackResponse = {
      ...SINGLE_FRAME_SERVER_RESPONSE,
      frames: Array.from({ length: 5 }, (_, i) => ({
        Frame: i,
        IndexZ: i,
        Index: i,
      })),
      IndexRange: { IndexZ: 5 },
    };
    mockFetchResponse(zStackResponse);

    const metadata = await fetchSlideMetadata(
      'http://localhost:8000',
      'z-stack.ome.tif'
    );

    expect(metadata.frameCount).toBe(5);
    expect(metadata.frames![0].indexZ).toBe(0);
    expect(metadata.frames![4].indexZ).toBe(4);
    expect(metadata.frameIndexRange).toEqual({ IndexZ: 5 });
  });

  it('should parse multi-channel frames with Channel names', async () => {
    const channelResponse = {
      ...SINGLE_FRAME_SERVER_RESPONSE,
      frames: [
        { Frame: 0, IndexC: 0, Channel: 'DAPI', Index: 0 },
        { Frame: 1, IndexC: 1, Channel: 'GFP', Index: 1 },
        { Frame: 2, IndexC: 2, Channel: 'Cy3', Index: 2 },
      ],
      IndexRange: { IndexC: 3 },
      channels: ['DAPI', 'GFP', 'Cy3'],
    };
    mockFetchResponse(channelResponse);

    const metadata = await fetchSlideMetadata(
      'http://localhost:8000',
      'fluorescence.ome.tif'
    );

    expect(metadata.frameCount).toBe(3);
    expect(metadata.channels).toEqual(['DAPI', 'GFP', 'Cy3']);
    expect(metadata.frames![0].channel).toBe('DAPI');
    expect(metadata.frames![1].channel).toBe('GFP');
    expect(metadata.frames![2].indexC).toBe(2);
  });

  it('should preserve dimension metadata', async () => {
    mockFetchResponse(MULTI_FRAME_SERVER_RESPONSE);

    const metadata = await fetchSlideMetadata(
      'http://localhost:8000',
      'KID-MED-034.ome.tif'
    );

    expect(metadata.width).toBe(35840);
    expect(metadata.height).toBe(10112);
    expect(metadata.tileWidth).toBe(512);
    expect(metadata.tileHeight).toBe(512);
    expect(metadata.levels).toBe(8);
    expect(metadata.magnification).toBe(40);
    expect(metadata.mpp).toBe(0.25); // 0.00025 * 1000
  });

  it('should URL-encode slideId in metadata fetch', async () => {
    mockFetchResponse(SINGLE_FRAME_SERVER_RESPONSE);

    await fetchSlideMetadata(
      'http://localhost:8000',
      'path/with/slashes.svs'
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/metadata/path%2Fwith%2Fslashes.svs',
      expect.any(Object)
    );
  });

  it('should pass Authorization header when token provided', async () => {
    mockFetchResponse(SINGLE_FRAME_SERVER_RESPONSE);

    await fetchSlideMetadata(
      'http://localhost:8000',
      'slide.svs',
      'my-jwt-token'
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      { headers: { Authorization: 'Bearer my-jwt-token' } }
    );
  });
});

describe('createLargeImageTileSource – URL generation', () => {
  const metadata: SlideMetadata = {
    slideId: 'KID-MED-034.ome.tif',
    width: 35840,
    height: 10112,
    tileWidth: 512,
    tileHeight: 512,
    levels: 8,
    frameCount: 18,
  };

  it('should generate correct tile URL without frame param when frame=0', () => {
    const ts = createLargeImageTileSource(config, 'KID-MED-034.ome.tif', metadata);
    const url = (ts as any).getTileUrl(0, 0, 0);

    // OSD level 0 = lowest res, /tiles/ endpoint uses same convention
    expect(url).toBe('http://localhost:8000/tiles/KID-MED-034.ome.tif/0/0/0.png');
  });

  it('should generate correct tile URL with frame param when frame>0', () => {
    let currentFrame = 5;
    const ts = createLargeImageTileSource(
      config, 'KID-MED-034.ome.tif', metadata,
      () => currentFrame
    );
    const url = (ts as any).getTileUrl(0, 0, 0);

    expect(url).toBe('http://localhost:8000/tiles/KID-MED-034.ome.tif/0/0/0.png?frame=5');
  });

  it('should pass OSD level directly to tile URL (same convention)', () => {
    const ts = createLargeImageTileSource(config, 'slide.tif', metadata);

    // OSD level 0 → z=0 (lowest res)
    expect((ts as any).getTileUrl(0, 0, 0)).toContain('/0/');

    // OSD level 7 → z=7 (highest res)
    expect((ts as any).getTileUrl(7, 0, 0)).toContain('/7/');

    // OSD level 3 → z=3
    expect((ts as any).getTileUrl(3, 0, 0)).toContain('/3/');
  });

  it('should include x,y tile coordinates in URL', () => {
    const ts = createLargeImageTileSource(config, 'slide.tif', metadata);
    const url = (ts as any).getTileUrl(5, 12, 8);

    // level passed directly
    expect(url).toBe('http://localhost:8000/tiles/slide.tif/5/12/8.png');
  });

  it('should update frame dynamically via getter', () => {
    let frame = 0;
    const ts = createLargeImageTileSource(
      config, 'slide.tif', metadata,
      () => frame
    );

    // Frame 0 → no param
    expect((ts as any).getTileUrl(0, 0, 0)).not.toContain('frame');

    // Frame 10
    frame = 10;
    expect((ts as any).getTileUrl(0, 0, 0)).toContain('?frame=10');

    // Frame 17
    frame = 17;
    expect((ts as any).getTileUrl(0, 0, 0)).toContain('?frame=17');
  });

  it('should set correct tile source dimensions', () => {
    const ts = createLargeImageTileSource(config, 'slide.tif', metadata);

    expect((ts as any).width).toBe(35840);
    expect((ts as any).height).toBe(10112);
    expect((ts as any).tileSize).toBe(512);
    expect((ts as any).minLevel).toBe(0);
    expect((ts as any).maxLevel).toBe(7); // levels - 1
  });
});

describe('TileSourceFactory – DZI with frames', () => {
  let factory: TileSourceFactory;

  beforeEach(() => {
    factory = new TileSourceFactory(config);
    vi.resetAllMocks();
  });

  it('should use DZI with frame param for multi-frame images', async () => {
    factory.setFrameGetter(() => 5);
    mockFetchResponse(MULTI_FRAME_SERVER_RESPONSE);

    const { tileSource, metadata } = await factory.createTileSource(
      'KID-MED-034.ome.tif',
      'dzi'
    );

    expect(metadata.frameCount).toBe(18);
    // DZI returns a string URL with ?frame=N
    expect(typeof tileSource).toBe('string');
    expect(tileSource).toContain('.dzi?frame=5');
  });

  it('should use DZI without frame param for single-frame images', async () => {
    mockFetchResponse(SINGLE_FRAME_SERVER_RESPONSE);

    const { tileSource } = await factory.createTileSource('normal.svs', 'dzi');

    expect(typeof tileSource).toBe('string');
    expect(tileSource).toContain('.dzi');
    expect(tileSource).not.toContain('frame');
  });

  it('should use DZI without frame param when frame=0', async () => {
    factory.setFrameGetter(() => 0);
    mockFetchResponse(MULTI_FRAME_SERVER_RESPONSE);

    const { tileSource } = await factory.createTileSource('KID-MED-034.ome.tif');

    expect(typeof tileSource).toBe('string');
    expect(tileSource).not.toContain('frame');
  });

  it('should create sync tile source with frame param', () => {
    const { tileSource } = factory.createTileSourceSync('slide.ome.tif', 10);

    expect(typeof tileSource).toBe('string');
    expect(tileSource).toContain('.dzi?frame=10');
  });

  it('should pass access token to metadata fetch', async () => {
    factory.setAccessToken('test-jwt');
    mockFetchResponse(SINGLE_FRAME_SERVER_RESPONSE);

    await factory.createTileSource('slide.svs');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      { headers: { Authorization: 'Bearer test-jwt' } }
    );
  });
});

describe('Tile URL format validation', () => {
  it('should produce URLs matching tile server /tiles/{id}/{z}/{x}/{y}.{format} pattern', () => {
    const metadata: SlideMetadata = {
      slideId: 'test.ome.tif',
      width: 10000,
      height: 10000,
      tileWidth: 512,
      tileHeight: 512,
      levels: 5,
      frameCount: 3,
    };

    const ts = createLargeImageTileSource(
      config, 'test.ome.tif', metadata,
      () => 1
    );

    const url = (ts as any).getTileUrl(2, 3, 4);
    // Level passed directly (no inversion)
    expect(url).toMatch(
      /^http:\/\/localhost:8000\/tiles\/test\.ome\.tif\/\d+\/\d+\/\d+\.png(\?frame=\d+)?$/
    );
    expect(url).toBe('http://localhost:8000/tiles/test.ome.tif/2/3/4.png?frame=1');
  });

  it('should NOT use /tile/ (singular) in URLs', () => {
    const metadata: SlideMetadata = {
      slideId: 'x',
      width: 1000,
      height: 1000,
      tileWidth: 256,
      tileHeight: 256,
      levels: 3,
    };

    const ts = createLargeImageTileSource(config, 'x', metadata);
    const url = (ts as any).getTileUrl(0, 0, 0);

    // Must use /tiles/ (plural) to match server endpoint
    expect(url).toContain('/tiles/');
    expect(url).not.toMatch(/\/tile\//);
  });

  it('should include .png extension in tile URLs', () => {
    const metadata: SlideMetadata = {
      slideId: 'x',
      width: 1000,
      height: 1000,
      tileWidth: 256,
      tileHeight: 256,
      levels: 3,
    };

    const ts = createLargeImageTileSource(config, 'x', metadata);
    const url = (ts as any).getTileUrl(0, 0, 0);

    expect(url).toContain('.png');
  });
});
