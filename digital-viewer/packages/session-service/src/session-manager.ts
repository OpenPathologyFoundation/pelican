/**
 * Session Awareness Service - Session Manager
 *
 * Business logic for detecting and handling session warnings
 */

import { SessionStore } from './session-store';
import type {
  CaseInfo,
  RegisterPayload,
  ServerConfig,
  SessionWarning,
  StoredRegistration,
} from './types';

/** Result of a registration operation */
export interface RegistrationResult {
  registration: StoredRegistration;
  warnings: SessionWarning[];
  affectedConnectionIds: string[];
}

/** Session manager for handling session logic */
export class SessionManager {
  private store: SessionStore;
  private config: ServerConfig;

  constructor(store: SessionStore, config: ServerConfig) {
    this.store = store;
    this.config = config;
  }

  /** Register a window and check for warnings */
  register(connectionId: string, payload: RegisterPayload): RegistrationResult {
    const registration = this.store.register(
      connectionId,
      payload.userId,
      payload.windowId,
      payload.caseId,
      payload.patientIdentifier,
      payload.viewerType,
      payload.openedAt
    );

    const warnings: SessionWarning[] = [];
    const affectedConnectionIds: string[] = [];

    // Check for multi-case scenario
    const userCases = this.store.getUserCases(payload.userId);
    if (userCases.length > 1) {
      const warning = this.createMultiCaseWarning(userCases);
      warnings.push(warning);

      // All user's connections should be notified
      affectedConnectionIds.push(
        ...this.store.getUserConnectionIds(payload.userId)
      );
    }

    return { registration, warnings, affectedConnectionIds };
  }

  /** Handle focus change and check for case mismatch */
  handleFocusChange(
    userId: string,
    windowId: string,
    newCaseId: string
  ): { warning?: SessionWarning; affectedConnectionIds: string[] } {
    const registration = this.store.getRegistration(windowId, userId);
    if (!registration) {
      return { affectedConnectionIds: [] };
    }

    const oldCaseId = registration.caseId;
    if (oldCaseId === newCaseId) {
      return { affectedConnectionIds: [] };
    }

    // Check if another window has the new case
    const userRegistrations = this.store.getUserRegistrations(userId);
    const otherWindow = userRegistrations.find(
      (r) => r.windowId !== windowId && r.caseId === newCaseId
    );

    if (otherWindow) {
      // Case mismatch: this window's case context changed but viewer still shows old case
      const warning: SessionWarning = {
        type: 'case-mismatch',
        message: `Your case context changed to ${newCaseId}, but this viewer still shows ${oldCaseId}`,
        cases: [
          registration.caseInfo,
          otherWindow.caseInfo,
        ],
        targetWindowId: windowId,
      };

      return {
        warning,
        affectedConnectionIds: [registration.connectionId],
      };
    }

    return { affectedConnectionIds: [] };
  }

  /** Deregister a window and update other windows if needed */
  deregister(windowId: string, userId?: string): {
    removed: StoredRegistration | null;
    warnings: SessionWarning[];
    affectedConnectionIds: string[];
  } {
    const registration = this.store.getRegistration(windowId, userId);
    if (!registration) {
      return { removed: null, warnings: [], affectedConnectionIds: [] };
    }

    const actualUserId = registration.userId;
    this.store.deregister(windowId, actualUserId);

    // Check if user is now down to single case
    const remainingCases = this.store.getUserCases(actualUserId);
    const warnings: SessionWarning[] = [];
    const affectedConnectionIds: string[] = [];

    if (remainingCases.length === 1) {
      // User is now safe - single case only
      // Could send an "all clear" notification
    } else if (remainingCases.length > 1) {
      // Still multi-case, send updated warning
      warnings.push(this.createMultiCaseWarning(remainingCases));
      affectedConnectionIds.push(
        ...this.store.getUserConnectionIds(actualUserId)
      );
    }

    return { removed: registration, warnings, affectedConnectionIds };
  }

  /** Update heartbeat */
  updateHeartbeat(windowId: string, userId?: string): boolean {
    return this.store.updateHeartbeat(windowId, userId);
  }

  /** Handle connection close */
  handleConnectionClose(connectionId: string): {
    removed: StoredRegistration | null;
    warnings: SessionWarning[];
    affectedConnectionIds: string[];
  } {
    const registration = this.store.deregisterByConnection(connectionId);
    if (!registration) {
      return { removed: null, warnings: [], affectedConnectionIds: [] };
    }

    // Check remaining state for user
    const remainingCases = this.store.getUserCases(registration.userId);
    const warnings: SessionWarning[] = [];
    const affectedConnectionIds: string[] = [];

    if (remainingCases.length > 1) {
      warnings.push(this.createMultiCaseWarning(remainingCases));
      affectedConnectionIds.push(
        ...this.store.getUserConnectionIds(registration.userId)
      );
    }

    return { removed: registration, warnings, affectedConnectionIds };
  }

  /** Run cleanup of stale registrations */
  cleanup(): {
    removed: StoredRegistration[];
    affectedUsers: Set<string>;
  } {
    const removed = this.store.cleanupStale(this.config.heartbeatTimeout);
    const affectedUsers = new Set<string>();

    for (const reg of removed) {
      affectedUsers.add(reg.userId);
    }

    return { removed, affectedUsers };
  }

  /** Create multi-case warning */
  private createMultiCaseWarning(cases: CaseInfo[]): SessionWarning {
    return {
      type: 'multi-case',
      message: `You have ${cases.length} cases currently open. Please verify you are working on the correct case.`,
      cases,
    };
  }

  /** Get store statistics */
  getStats(): { totalRegistrations: number; activeUsers: number } {
    return {
      totalRegistrations: this.store.getTotalCount(),
      activeUsers: this.store.getUserCount(),
    };
  }

  /** Get all registrations for a user (for sync) */
  getUserState(userId: string): StoredRegistration[] {
    return this.store.getUserRegistrations(userId);
  }
}
