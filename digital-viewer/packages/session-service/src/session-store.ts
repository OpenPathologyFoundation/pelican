/**
 * Session Awareness Service - Session Store
 *
 * In-memory storage for tracking window registrations per user
 */

import type { CaseInfo, StoredRegistration } from './types';

/** Session store for tracking registrations */
export class SessionStore {
  // Map: userId -> Map: windowId -> StoredRegistration
  private registrations: Map<string, Map<string, StoredRegistration>> =
    new Map();

  // Map: connectionId -> { userId, windowId }
  private connectionMap: Map<string, { userId: string; windowId: string }> =
    new Map();

  /** Register a window for a user */
  register(
    connectionId: string,
    userId: string,
    windowId: string,
    caseId: string,
    patientIdentifier: string,
    viewerType: string,
    openedAt: string
  ): StoredRegistration {
    // Get or create user's registration map
    let userRegistrations = this.registrations.get(userId);
    if (!userRegistrations) {
      userRegistrations = new Map();
      this.registrations.set(userId, userRegistrations);
    }

    const caseInfo: CaseInfo = {
      caseId,
      patientName: patientIdentifier,
      location: viewerType,
    };

    const registration: StoredRegistration = {
      connectionId,
      userId,
      caseId,
      patientIdentifier,
      viewerType,
      windowId,
      openedAt,
      lastHeartbeat: Date.now(),
      caseInfo,
    };

    userRegistrations.set(windowId, registration);
    this.connectionMap.set(connectionId, { userId, windowId });

    return registration;
  }

  /** Deregister a window */
  deregister(windowId: string, userId?: string): boolean {
    if (userId) {
      const userRegistrations = this.registrations.get(userId);
      if (userRegistrations) {
        const registration = userRegistrations.get(windowId);
        if (registration) {
          this.connectionMap.delete(registration.connectionId);
          userRegistrations.delete(windowId);
          return true;
        }
      }
    } else {
      // Search all users
      for (const [uid, userRegs] of this.registrations) {
        if (userRegs.has(windowId)) {
          const registration = userRegs.get(windowId)!;
          this.connectionMap.delete(registration.connectionId);
          userRegs.delete(windowId);
          return true;
        }
      }
    }
    return false;
  }

  /** Deregister by connection ID */
  deregisterByConnection(connectionId: string): StoredRegistration | null {
    const info = this.connectionMap.get(connectionId);
    if (!info) return null;

    const userRegistrations = this.registrations.get(info.userId);
    if (!userRegistrations) return null;

    const registration = userRegistrations.get(info.windowId);
    if (registration) {
      userRegistrations.delete(info.windowId);
      this.connectionMap.delete(connectionId);
      return registration;
    }

    return null;
  }

  /** Update heartbeat for a window */
  updateHeartbeat(windowId: string, userId?: string): boolean {
    if (userId) {
      const userRegistrations = this.registrations.get(userId);
      const registration = userRegistrations?.get(windowId);
      if (registration) {
        registration.lastHeartbeat = Date.now();
        return true;
      }
    } else {
      // Search all users
      for (const [, userRegs] of this.registrations) {
        const registration = userRegs.get(windowId);
        if (registration) {
          registration.lastHeartbeat = Date.now();
          return true;
        }
      }
    }
    return false;
  }

  /** Get all registrations for a user */
  getUserRegistrations(userId: string): StoredRegistration[] {
    const userRegistrations = this.registrations.get(userId);
    return userRegistrations ? Array.from(userRegistrations.values()) : [];
  }

  /** Get registration by window ID */
  getRegistration(windowId: string, userId?: string): StoredRegistration | null {
    if (userId) {
      return this.registrations.get(userId)?.get(windowId) || null;
    }

    // Search all users
    for (const [, userRegs] of this.registrations) {
      if (userRegs.has(windowId)) {
        return userRegs.get(windowId)!;
      }
    }
    return null;
  }

  /** Get registration by connection ID */
  getRegistrationByConnection(connectionId: string): StoredRegistration | null {
    const info = this.connectionMap.get(connectionId);
    if (!info) return null;

    return this.registrations.get(info.userId)?.get(info.windowId) || null;
  }

  /** Get all unique case IDs for a user */
  getUserCases(userId: string): CaseInfo[] {
    const registrations = this.getUserRegistrations(userId);
    const caseMap = new Map<string, CaseInfo>();

    for (const reg of registrations) {
      if (!caseMap.has(reg.caseId)) {
        caseMap.set(reg.caseId, reg.caseInfo);
      }
    }

    return Array.from(caseMap.values());
  }

  /** Get stale registrations (no heartbeat within timeout) */
  getStaleRegistrations(timeoutMs: number): StoredRegistration[] {
    const stale: StoredRegistration[] = [];
    const cutoff = Date.now() - timeoutMs;

    for (const [, userRegs] of this.registrations) {
      for (const [, reg] of userRegs) {
        if (reg.lastHeartbeat < cutoff) {
          stale.push(reg);
        }
      }
    }

    return stale;
  }

  /** Remove stale registrations and return them */
  cleanupStale(timeoutMs: number): StoredRegistration[] {
    const stale = this.getStaleRegistrations(timeoutMs);

    for (const reg of stale) {
      this.deregister(reg.windowId, reg.userId);
    }

    return stale;
  }

  /** Get total registration count */
  getTotalCount(): number {
    let count = 0;
    for (const [, userRegs] of this.registrations) {
      count += userRegs.size;
    }
    return count;
  }

  /** Get user count */
  getUserCount(): number {
    let count = 0;
    for (const [, userRegs] of this.registrations) {
      if (userRegs.size > 0) {
        count++;
      }
    }
    return count;
  }

  /** Get all connection IDs for a user */
  getUserConnectionIds(userId: string): string[] {
    const registrations = this.getUserRegistrations(userId);
    return registrations.map((r) => r.connectionId);
  }

  /** Clear all registrations */
  clear(): void {
    this.registrations.clear();
    this.connectionMap.clear();
  }
}
