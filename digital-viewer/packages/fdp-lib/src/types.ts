/**
 * Focus Declaration Protocol - Type Definitions
 *
 * Based on Pathology Portal Platform Specification v2.1, Section 5
 */

/** Case context information for focus declaration */
export interface CaseContext {
  /** Lab-qualified accession number (e.g., "UPMC:S26-12345") */
  caseId: string;
  /** Patient name or identifier */
  patientName: string;
  /** Patient date of birth (optional) */
  patientDob?: string;
  /** Current specimen/part designation (optional) */
  specimen?: string;
  /** Institution identifier (optional) */
  institution?: string;
  /** Current slide barcode (optional) */
  slideId?: string;
}

/** FDP configuration options */
export interface FDPConfig {
  /** Base announcement duration in milliseconds (default: 2000) */
  baseDuration: number;
  /** Maximum announcement duration in milliseconds (default: 5000) */
  maxDuration: number;
  /** Enable time-decay extended announcement (default: true) */
  timeDecayEnabled: boolean;
  /** Enable privacy mode (abbreviated identifiers) (default: false) */
  privacyMode: boolean;
  /** Audio announcement mode */
  audioMode: 'off' | 'chime' | 'brief' | 'full';
  /** Diagnostic mode (prevents header collapse) */
  diagnosticMode: boolean;
  /** Custom CSS class prefix (default: 'fdp') */
  cssPrefix: string;
  /** Z-index for FDP elements (default: 10000) */
  zIndex: number;
  /** Session Awareness Service URL (Layer 2, optional) */
  sessionServiceUrl?: string;
  /** User ID for session registration (Layer 2, optional) */
  userId?: string;
  /** Heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval: number;
}

/** Session registration payload for Layer 2 */
export interface SessionRegistration {
  userId: string;
  caseId: string;
  patientIdentifier: string;
  viewerType: string;
  windowId: string;
  openedAt: string;
}

/** Warning types from Session Awareness Service */
export type WarningType = 'multi-case' | 'case-mismatch' | 'session-expired';

/** Warning payload from Session Awareness Service */
export interface SessionWarning {
  type: WarningType;
  cases?: Array<{
    caseId: string;
    patientName: string;
    location: string;
  }>;
  message?: string;
}

/** FDP event types */
export type FDPEventType =
  | 'focus'
  | 'blur'
  | 'announcement-start'
  | 'announcement-end'
  | 'warning'
  | 'session-connected'
  | 'session-disconnected';

/** FDP event payload */
export interface FDPEvent {
  type: FDPEventType;
  timestamp: Date;
  caseContext?: CaseContext;
  warning?: SessionWarning;
}

/** FDP event listener */
export type FDPEventListener = (event: FDPEvent) => void;

/** Announcement display state */
export interface AnnouncementState {
  visible: boolean;
  startTime: number;
  duration: number;
  caseContext: CaseContext;
}

/** Persistent indicator state */
export interface IndicatorState {
  collapsed: boolean;
  warningActive: boolean;
  warningType?: WarningType;
  multiCaseCount?: number;
}
