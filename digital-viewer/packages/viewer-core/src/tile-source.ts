/**
 * Viewer Core - Tile Source Factory
 *
 * Creates OpenSeadragon tile sources for different backends
 */

import type OpenSeadragon from 'openseadragon';
import type { FrameInfo, FrameIndexRange, SlideMetadata, TileSourceConfig, ViewerConfig } from './types';

/** Fetch slide metadata from large_image server */
export async function fetchSlideMetadata(
  tileServerUrl: string,
  slideId: string,
  accessToken?: string | null
): Promise<SlideMetadata> {
  // URL-encode the slideId to handle paths with slashes
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${tileServerUrl}/metadata/${encodeURIComponent(slideId)}`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.statusText}`);
  }

  const data = await response.json();

  // Determine MPP and calibration state from metadata
  // mm_x from server is in millimeters, convert to microns (μm)
  const mpp = data.mm_x ? data.mm_x * 1000 : undefined;

  // Determine calibration state based on available data
  // If mm_x is present from the scanner, it's factory calibrated
  // SVS files store MPP in TIFF tags from the scanner
  let calibrationState: 'site_calibrated' | 'factory' | 'unvalidated' | 'unknown' = 'unknown';
  let mppSource: 'scanner' | 'manual' | undefined;

  if (mpp !== undefined) {
    // MPP present - from scanner metadata
    calibrationState = 'factory';
    mppSource = 'scanner';
  }

  // Extract multi-frame info (e.g. Z-stack OME-TIFF)
  const serverFrames: Array<Record<string, unknown>> | undefined = data.frames;
  const frameCount = serverFrames?.length ?? 1;

  let frames: FrameInfo[] | undefined;
  let frameIndexRange: FrameIndexRange | undefined;
  let channels: string[] | undefined;

  if (frameCount > 1 && serverFrames) {
    frames = serverFrames.map((f) => ({
      index: f.Frame as number,
      indexC: f.IndexC as number | undefined,
      indexZ: f.IndexZ as number | undefined,
      indexT: f.IndexT as number | undefined,
      channel: f.Channel as string | undefined,
    }));
    frameIndexRange = data.IndexRange as FrameIndexRange | undefined;
    channels = data.channels as string[] | undefined;
  }

  return {
    slideId,
    width: data.sizeX,
    height: data.sizeY,
    tileWidth: data.tileWidth,
    tileHeight: data.tileHeight,
    levels: data.levels,
    magnification: data.magnification,
    mpp,
    mppSource,
    calibrationState,
    format: data.format,
    vendor: data.vendor,
    frameCount,
    frames,
    frameIndexRange,
    channels,
    properties: data,
  };
}

/** Create tile source for large_image server */
export function createLargeImageTileSource(
  config: ViewerConfig,
  slideId: string,
  metadata: SlideMetadata,
  getFrame?: () => number
): OpenSeadragon.TileSource {
  return {
    width: metadata.width,
    height: metadata.height,
    tileSize: metadata.tileWidth,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: metadata.levels - 1,

    getTileUrl(level: number, x: number, y: number): string {
      // The /tiles/ endpoint uses the same convention as OSD: z=0 is lowest resolution
      const frame = getFrame?.() ?? 0;
      const frameParam = frame > 0 ? `?frame=${frame}` : '';
      return `${config.tileServerUrl}/tiles/${slideId}/${level}/${x}/${y}.png${frameParam}`;
    },
  } as OpenSeadragon.TileSource;
}

/** Create tile source from DZI XML */
export function createDZITileSource(
  config: ViewerConfig,
  slideId: string,
  frame?: number
): string {
  // URL-encode the slideId to handle paths with slashes (e.g., S26-0001/S26-0001_A1_S1.svs)
  const frameParam = frame && frame > 0 ? `?frame=${frame}` : '';
  return `${config.tileServerUrl}/deepzoom/${encodeURIComponent(slideId)}.dzi${frameParam}`;
}

/** Create XYZ tile source */
export function createXYZTileSource(
  config: ViewerConfig,
  slideId: string,
  metadata: SlideMetadata
): OpenSeadragon.TileSource {
  return {
    width: metadata.width,
    height: metadata.height,
    tileSize: metadata.tileWidth,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: metadata.levels - 1,

    getTileUrl(level: number, x: number, y: number): string {
      return `${config.tileServerUrl}/xyz/${slideId}/${level}/${x}/${y}.jpg`;
    },
  } as OpenSeadragon.TileSource;
}

/** Create IIIF tile source */
export function createIIIFTileSource(baseUrl: string): string {
  // Return the IIIF info.json URL
  return `${baseUrl}/info.json`;
}

/** Tile source factory */
export class TileSourceFactory {
  private config: ViewerConfig;
  private accessToken: string | null = null;
  private frameGetter: (() => number) | undefined;
  private metadataCache: Map<string, SlideMetadata> = new Map();

  constructor(config: ViewerConfig) {
    this.config = config;
  }

  /** Set the access token for authenticated requests (SRS SYS-INT-002) */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /** Get the current access token */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** Set the frame getter for multi-frame tile URL construction */
  setFrameGetter(getter: () => number): void {
    this.frameGetter = getter;
  }

  /** Create tile source for a slide */
  async createTileSource(
    slideId: string,
    type: TileSourceConfig['type'] = 'dzi'
  ): Promise<{ tileSource: OpenSeadragon.TileSource | string; metadata: SlideMetadata }> {
    // Fetch metadata if not cached
    let metadata = this.metadataCache.get(slideId);
    if (!metadata) {
      metadata = await fetchSlideMetadata(this.config.tileServerUrl, slideId, this.accessToken);
      this.metadataCache.set(slideId, metadata);
    }

    const frame = this.frameGetter?.() ?? 0;

    let tileSource: OpenSeadragon.TileSource | string;

    switch (type) {
      case 'dzi':
        tileSource = createDZITileSource(this.config, slideId, frame);
        break;

      case 'xyz':
        tileSource = createXYZTileSource(this.config, slideId, metadata);
        break;

      case 'iiif':
        tileSource = createIIIFTileSource(
          `${this.config.tileServerUrl}/iiif/${slideId}`
        );
        break;

      case 'large-image':
      default:
        tileSource = createLargeImageTileSource(
          this.config, slideId, metadata, this.frameGetter
        );
        break;
    }

    return { tileSource, metadata };
  }

  /** Create DZI tile source synchronously using cached metadata (for frame switching) */
  createTileSourceSync(
    slideId: string,
    frame: number
  ): { tileSource: OpenSeadragon.TileSource | string } {
    const tileSource = createDZITileSource(this.config, slideId, frame);
    return { tileSource };
  }

  /** Get cached metadata */
  getMetadata(slideId: string): SlideMetadata | undefined {
    return this.metadataCache.get(slideId);
  }

  /** Clear metadata cache */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /** Update configuration */
  updateConfig(config: Partial<ViewerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
