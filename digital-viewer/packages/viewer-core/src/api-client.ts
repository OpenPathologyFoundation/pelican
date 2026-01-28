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

/** Case source - where the case was loaded from (SRS SYS-DXM-001) */
export type CaseSource = 'worklist' | 'search' | 'direct' | 'external';

/** Full case details from /cases/{id} endpoint */
export interface CaseDetails extends CaseSummary {
  patientDob?: string;
  patientSex?: string;
  clinicalHistory?: string;
  slides: SlideInfo[];
  /** Source of case (for DX mode determination) - defaults to 'search' */
  source?: CaseSource;
  /** Whether this case requires clinical/diagnostic mode (SRS SYS-DXM-001) */
  requiresDiagnosticMode?: boolean;
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
  /** JWT token for authentication (SRS SYS-INT-002) */
  accessToken?: string;
  /** Token refresh callback - called when token is expired */
  onTokenExpired?: () => Promise<string | null>;
  /** Callback when auth fails completely */
  onAuthFailed?: () => void;
}

/** JWT token payload (decoded) */
export interface JwtPayload {
  sub: string; // User ID
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  caseId?: string; // Case-scoped token
  scope?: string[]; // Permissions
}

/**
 * Tile Server API Client
 *
 * Includes JWT authentication support per SRS SYS-INT-002
 */
export class TileServerClient {
  private baseUrl: string;
  private timeout: number;
  private accessToken: string | null;
  private onTokenExpired?: () => Promise<string | null>;
  private onAuthFailed?: () => void;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 30000;
    this.accessToken = config.accessToken || null;
    this.onTokenExpired = config.onTokenExpired;
    this.onAuthFailed = config.onAuthFailed;
  }

  /**
   * Set the access token (SRS SYS-INT-002)
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if current token is expired
   */
  isTokenExpired(): boolean {
    if (!this.accessToken) return true;

    try {
      const payload = this.decodeToken(this.accessToken);
      if (!payload || !payload.exp) return true;
      // Consider token expired 30 seconds before actual expiry
      return Date.now() >= (payload.exp * 1000) - 30000;
    } catch {
      return true;
    }
  }

  /**
   * Decode JWT payload (without verification)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Refresh the access token
   */
  private async refreshToken(): Promise<string | null> {
    if (!this.onTokenExpired) return null;

    // Deduplicate concurrent refresh requests
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.onTokenExpired();

    try {
      const newToken = await this.refreshPromise;
      if (newToken) {
        this.accessToken = newToken;
      }
      return newToken;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    // Check and refresh token if needed
    if (this.isTokenExpired() && this.onTokenExpired) {
      const newToken = await this.refreshToken();
      if (!newToken) {
        this.onAuthFailed?.();
        throw new Error('Authentication required');
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build headers with Authorization (SRS SYS-INT-002)
      const headers = new Headers(options?.headers);
      if (this.accessToken) {
        headers.set('Authorization', `Bearer ${this.accessToken}`);
      }
      headers.set('Content-Type', 'application/json');

      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      // Handle 401 Unauthorized (SRS SYS-ERR-003)
      if (response.status === 401) {
        // Try to refresh token once
        if (this.onTokenExpired) {
          const newToken = await this.refreshToken();
          if (newToken) {
            // Retry the request with new token
            headers.set('Authorization', `Bearer ${newToken}`);
            const retryResponse = await fetch(`${this.baseUrl}${path}`, {
              ...options,
              headers,
              signal: controller.signal,
            });
            if (retryResponse.ok) {
              return retryResponse.json();
            }
          }
        }
        this.onAuthFailed?.();
        throw new Error('Authentication failed');
      }

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
