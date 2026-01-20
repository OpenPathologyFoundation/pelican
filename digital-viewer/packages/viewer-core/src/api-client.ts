/**
 * API Client for Large Image Tile Server
 *
 * Provides typed access to case, slide, and image endpoints
 */

/** Case summary from /cases endpoint */
export interface CaseSummary {
  caseId: string;
  patientName: string;
  patientId: string;
  accessionDate: string;
  diagnosis: string;
  specimenType: string;
  status: string;
  priority: 'stat' | 'rush' | 'routine';
  slideCount: number;
}

/** Full case details from /cases/{id} endpoint */
export interface CaseDetails extends CaseSummary {
  patientDob?: string;
  patientSex?: string;
  clinicalHistory?: string;
  slides: SlideInfo[];
}

/** Slide information */
export interface SlideInfo {
  slideId: string;
  partDescription?: string;
  blockDescription?: string;
  stain: string;
  filename: string;
  originalFile?: string;
  notes?: string;
}

/** Slide with case context from /slides/{id} endpoint */
export interface SlideWithContext extends SlideInfo {
  caseContext: {
    caseId: string;
    patientName: string;
    patientId: string;
    patientDob?: string;
    diagnosis: string;
    status: string;
    priority: string;
  };
}

/** Worklist item */
export interface WorklistItem extends CaseSummary {
  slides: { slideId: string; stain: string }[];
}

/** Slide metadata from /metadata/{path} endpoint */
export interface SlideMetadata {
  levels: number;
  sizeX: number;
  sizeY: number;
  tileWidth: number;
  tileHeight: number;
  magnification?: number;
  mm_x?: number;
  mm_y?: number;
  dtype?: string;
  bandCount?: number;
}

/** API client configuration */
export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * Tile Server API Client
 */
export class TileServerClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 30000;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============ Case Endpoints ============

  /** Get all cases */
  async getCases(): Promise<CaseSummary[]> {
    return this.fetch<CaseSummary[]>('/cases');
  }

  /** Get case details by ID */
  async getCase(caseId: string): Promise<CaseDetails> {
    return this.fetch<CaseDetails>(`/cases/${encodeURIComponent(caseId)}`);
  }

  /** Get slides for a case */
  async getCaseSlides(caseId: string): Promise<SlideInfo[]> {
    return this.fetch<SlideInfo[]>(`/cases/${encodeURIComponent(caseId)}/slides`);
  }

  /** Get worklist (cases sorted by priority) */
  async getWorklist(filters?: { status?: string; priority?: string }): Promise<WorklistItem[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    const query = params.toString();
    return this.fetch<WorklistItem[]>(`/worklist${query ? `?${query}` : ''}`);
  }

  /** Search cases by ID or patient name */
  async searchCases(query: string): Promise<CaseSummary[]> {
    const cases = await this.getCases();
    const lowerQuery = query.toLowerCase();
    return cases.filter(
      (c) =>
        c.caseId.toLowerCase().includes(lowerQuery) ||
        c.patientName.toLowerCase().includes(lowerQuery) ||
        c.patientId.toLowerCase().includes(lowerQuery)
    );
  }

  // ============ Slide Endpoints ============

  /** Get slide details with case context */
  async getSlide(slideId: string): Promise<SlideWithContext> {
    return this.fetch<SlideWithContext>(`/slides/${encodeURIComponent(slideId)}`);
  }

  /** Get associated images list for a slide */
  async getSlideAssociatedImages(slideId: string): Promise<string[]> {
    return this.fetch<string[]>(`/slides/${encodeURIComponent(slideId)}/associated`);
  }

  /** Get slide label image URL */
  getSllideLabelUrl(slideId: string): string {
    return `${this.baseUrl}/slides/${encodeURIComponent(slideId)}/label`;
  }

  /** Get slide macro image URL */
  getSlideMacroUrl(slideId: string): string {
    return `${this.baseUrl}/slides/${encodeURIComponent(slideId)}/macro`;
  }

  // ============ Image/Tile Endpoints ============

  /** Get slide metadata */
  async getSlideMetadata(imagePath: string): Promise<SlideMetadata> {
    return this.fetch<SlideMetadata>(`/metadata/${encodeURIComponent(imagePath)}`);
  }

  /** Get DeepZoom DZI URL for a slide */
  getDeepZoomUrl(imagePath: string): string {
    return `${this.baseUrl}/deepzoom/${encodeURIComponent(imagePath)}.dzi`;
  }

  /** Get thumbnail URL */
  getThumbnailUrl(imagePath: string, width = 256, height = 256): string {
    return `${this.baseUrl}/thumbnail/${encodeURIComponent(imagePath)}?width=${width}&height=${height}`;
  }

  // ============ Health/Status ============

  /** Check server health */
  async checkHealth(): Promise<{ status: string; version: string }> {
    return this.fetch<{ status: string; version: string }>('/health');
  }
}

/** Default client instance */
let defaultClient: TileServerClient | null = null;

/** Configure the default client */
export function configureApiClient(config: ApiClientConfig): TileServerClient {
  defaultClient = new TileServerClient(config);
  return defaultClient;
}

/** Get the default client */
export function getApiClient(): TileServerClient {
  if (!defaultClient) {
    // Default to localhost:8000
    defaultClient = new TileServerClient({
      baseUrl: import.meta.env.VITE_TILE_SERVER_URL || 'http://localhost:8000',
    });
  }
  return defaultClient;
}
