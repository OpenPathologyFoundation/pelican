/**
 * Viewer Core - Tile Source Factory
 *
 * Creates OpenSeadragon tile sources for different backends
 */

import type OpenSeadragon from 'openseadragon';
import type { SlideMetadata, TileSourceConfig, ViewerConfig } from './types';

/** Fetch slide metadata from large_image server */
export async function fetchSlideMetadata(
  tileServerUrl: string,
  slideId: string
): Promise<SlideMetadata> {
  // URL-encode the slideId to handle paths with slashes
  const response = await fetch(`${tileServerUrl}/metadata/${encodeURIComponent(slideId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    slideId,
    width: data.sizeX,
    height: data.sizeY,
    tileWidth: data.tileWidth,
    tileHeight: data.tileHeight,
    levels: data.levels,
    magnification: data.magnification,
    mpp: data.mm_x ? data.mm_x * 1000 : undefined,
    format: data.format,
    vendor: data.vendor,
    properties: data,
  };
}

/** Create tile source for large_image server */
export function createLargeImageTileSource(
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
      // large_image uses inverse level numbering (0 = highest resolution)
      // OpenSeadragon uses 0 = lowest resolution
      // Calculate the correct level for large_image
      const liLevel = metadata.levels - 1 - level;
      return `${config.tileServerUrl}/tile/${slideId}/${liLevel}/${x}/${y}`;
    },
  } as OpenSeadragon.TileSource;
}

/** Create tile source from DZI XML */
export function createDZITileSource(
  config: ViewerConfig,
  slideId: string
): string {
  // URL-encode the slideId to handle paths with slashes (e.g., S26-0001/S26-0001_A1_S1.svs)
  return `${config.tileServerUrl}/deepzoom/${encodeURIComponent(slideId)}.dzi`;
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
  private metadataCache: Map<string, SlideMetadata> = new Map();

  constructor(config: ViewerConfig) {
    this.config = config;
  }

  /** Create tile source for a slide */
  async createTileSource(
    slideId: string,
    type: TileSourceConfig['type'] = 'dzi'
  ): Promise<{ tileSource: OpenSeadragon.TileSource | string; metadata: SlideMetadata }> {
    // Fetch metadata if not cached
    let metadata = this.metadataCache.get(slideId);
    if (!metadata) {
      metadata = await fetchSlideMetadata(this.config.tileServerUrl, slideId);
      this.metadataCache.set(slideId, metadata);
    }

    let tileSource: OpenSeadragon.TileSource | string;

    switch (type) {
      case 'dzi':
        tileSource = createDZITileSource(this.config, slideId);
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
        tileSource = createLargeImageTileSource(this.config, slideId, metadata);
        break;
    }

    return { tileSource, metadata };
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
