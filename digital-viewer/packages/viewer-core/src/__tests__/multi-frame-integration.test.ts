/**
 * Multi-Frame Integration Tests
 *
 * Hits the live tile server at http://localhost:8000 to verify
 * the full pipeline: metadata → tile URLs → actual tile responses.
 *
 * Requires:  large_image_server --image-dir ../slides/research --port 8000
 * Skip:      Tests skip individually when the tile server is not running.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fetchSlideMetadata, createLargeImageTileSource } from '../tile-source';
import type { SlideMetadata, ViewerConfig } from '../types';
import { DEFAULT_VIEWER_CONFIG } from '../types';

const TILE_SERVER = 'http://localhost:8000';
const SLIDE_ID = 'KID-MED-034.ome.tif';

const config: ViewerConfig = {
  ...DEFAULT_VIEWER_CONFIG,
  tileServerUrl: TILE_SERVER,
};

let serverAvailable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${TILE_SERVER}/health`, { signal: AbortSignal.timeout(2000) });
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
  }
  if (!serverAvailable) {
    console.log('Tile server not running – integration tests will be skipped.');
    console.log('Start with: large_image_server --image-dir ../slides/research --port 8000');
  }
});

describe('Live tile server – multi-frame', () => {
  let metadata: SlideMetadata;

  async function ensureMetadata(): Promise<SlideMetadata> {
    if (!metadata) {
      metadata = await fetchSlideMetadata(TILE_SERVER, SLIDE_ID);
    }
    return metadata;
  }

  it('should fetch metadata for multi-frame OME-TIFF', async ({ skip }) => {
    if (!serverAvailable) skip();

    metadata = await fetchSlideMetadata(TILE_SERVER, SLIDE_ID);

    expect(metadata.slideId).toBe(SLIDE_ID);
    expect(metadata.width).toBe(35840);
    expect(metadata.height).toBe(10112);
    expect(metadata.levels).toBe(8);
    expect(metadata.tileWidth).toBe(512);
    expect(metadata.frameCount).toBe(18);
    expect(metadata.frames).toHaveLength(18);
    expect(metadata.frameIndexRange).toEqual({ IndexT: 18 });
    expect(metadata.magnification).toBe(40);
    expect(metadata.mpp).toBeCloseTo(0.25, 2);
  });

  it('should generate tile URLs that return HTTP 200', async ({ skip }) => {
    if (!serverAvailable) skip();
    const md = await ensureMetadata();

    const ts = createLargeImageTileSource(config, SLIDE_ID, md, () => 0);

    // Test low-res tile (OSD level 0 → liLevel 7)
    const url = (ts as any).getTileUrl(0, 0, 0);
    expect(url).toContain('/tiles/');
    expect(url).toContain('.png');

    const res = await fetch(url);
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toContain('image');
  });

  it('should serve tiles for different frames', async ({ skip }) => {
    if (!serverAvailable) skip();
    const md = await ensureMetadata();

    for (const frame of [0, 10, 17]) {
      const ts = createLargeImageTileSource(config, SLIDE_ID, md, () => frame);
      const url = (ts as any).getTileUrl(0, 0, 0);
      if (frame > 0) expect(url).toContain(`?frame=${frame}`);

      const res = await fetch(url);
      expect(res.ok, `Frame ${frame} failed: ${url}`).toBe(true);
    }
  });

  it('should serve tiles at all pyramid levels', async ({ skip }) => {
    if (!serverAvailable) skip();
    const md = await ensureMetadata();

    const ts = createLargeImageTileSource(config, SLIDE_ID, md, () => 0);

    for (let osdLevel = 0; osdLevel < md.levels; osdLevel++) {
      const url = (ts as any).getTileUrl(osdLevel, 0, 0);
      const res = await fetch(url);
      expect(res.ok, `OSD level ${osdLevel} failed: ${url}`).toBe(true);
    }
  });

  it('should produce different image data for different frames', async ({ skip }) => {
    if (!serverAvailable) skip();
    const md = await ensureMetadata();

    // Use the overview tile (z=0) which contains the entire image — maximizes
    // visual difference between focal planes
    const url0 = `${TILE_SERVER}/tiles/${SLIDE_ID}/0/0/0.png?frame=0`;
    const url5 = `${TILE_SERVER}/tiles/${SLIDE_ID}/0/0/0.png?frame=5`;

    const [data0, data5] = await Promise.all([
      fetch(url0).then(r => r.arrayBuffer()),
      fetch(url5).then(r => r.arrayBuffer()),
    ]);

    expect(data0.byteLength).toBeGreaterThan(100);
    expect(data5.byteLength).toBeGreaterThan(100);

    // At minimum, sizes or bytes should differ between focal planes
    const bytes0 = new Uint8Array(data0);
    const bytes5 = new Uint8Array(data5);
    let diffCount = 0;
    const len = Math.min(bytes0.length, bytes5.length);
    for (let i = 0; i < len; i++) {
      if (bytes0[i] !== bytes5[i]) diffCount++;
    }
    const sizeDiffers = data0.byteLength !== data5.byteLength;
    expect(diffCount > 0 || sizeDiffers).toBe(true);
  });

  it('should return valid DZI XML', async ({ skip }) => {
    if (!serverAvailable) skip();

    const res = await fetch(`${TILE_SERVER}/deepzoom/${SLIDE_ID}.dzi`);
    expect(res.ok).toBe(true);
    const text = await res.text();
    expect(text).toContain('xmlns="http://schemas.microsoft.com/deepzoom/2008"');
    expect(text).toContain('Width="35840"');
  });
});
