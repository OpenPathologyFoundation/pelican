/**
 * Annotation Persistence Provider Interface
 *
 * Defines the contract for saving and loading annotations from different
 * storage backends. The viewer uses this abstraction so that the same
 * annotation UI can work in standalone mode (localStorage) and in
 * orchestrated mode (proxied through the orchestrator to Okapi backend).
 *
 * Implementations:
 * - LocalAnnotationProvider   — localStorage (standalone / offline)
 * - OrchestratorAnnotationProvider — postMessage → orchestrator → Okapi API (future)
 */

import type { AnnotationProperties, Annotation, AnnotationLayer } from './types';

/** Result of a save operation */
export interface SaveResult {
	/** Server-assigned ID (may differ from the local ID) */
	id: string;
	/** Server timestamp */
	savedAt: string;
}

/** Query parameters for loading annotations */
export interface AnnotationQuery {
	/** Filter by slide ID */
	slideId?: string;
	/** Filter by scan ID */
	scanId?: string;
	/** Include soft-deleted annotations */
	includeDeleted?: boolean;
	/** Filter by visibility level */
	visibility?: AnnotationProperties['visibility'];
	/** Filter by creator */
	createdBy?: string;
}

/**
 * Annotation persistence provider interface.
 *
 * All methods are async to support both local and remote backends.
 */
export interface AnnotationPersistenceProvider {
	/** Save a new annotation, returning the persisted ID */
	save(caseId: string, slideId: string, annotation: Annotation): Promise<SaveResult>;

	/** Load annotations matching the given query */
	load(caseId: string, query?: AnnotationQuery): Promise<Annotation[]>;

	/** Update an existing annotation (partial update) */
	update(id: string, changes: Partial<AnnotationProperties>): Promise<void>;

	/** Soft-delete an annotation (tombstone) */
	delete(id: string): Promise<void>;

	/** Save/restore entire layer state (for bulk sync) */
	saveLayers?(caseId: string, layers: AnnotationLayer[]): Promise<void>;
	loadLayers?(caseId: string): Promise<AnnotationLayer[]>;
}

// ─── Local Storage Provider ──────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'okapi:annotations:';

/**
 * LocalAnnotationProvider — stores annotations in localStorage.
 *
 * Used in standalone viewer mode and as an offline cache.
 * Annotations are keyed by caseId.
 */
export class LocalAnnotationProvider implements AnnotationPersistenceProvider {
	private storageKey(caseId: string): string {
		return `${STORAGE_KEY_PREFIX}${caseId}`;
	}

	async save(caseId: string, _slideId: string, annotation: Annotation): Promise<SaveResult> {
		const existing = await this.load(caseId);
		existing.push(annotation);
		this.persist(caseId, existing);
		return {
			id: annotation.properties.id,
			savedAt: new Date().toISOString(),
		};
	}

	async load(caseId: string, query?: AnnotationQuery): Promise<Annotation[]> {
		const raw = localStorage.getItem(this.storageKey(caseId));
		if (!raw) return [];

		try {
			let annotations: Annotation[] = JSON.parse(raw);

			if (query) {
				if (query.slideId) {
					annotations = annotations.filter((a) => a.properties.slideId === query.slideId);
				}
				if (query.scanId) {
					annotations = annotations.filter((a) => a.properties.scanId === query.scanId);
				}
				if (!query.includeDeleted) {
					annotations = annotations.filter((a) => !a.properties.isDeleted);
				}
				if (query.visibility) {
					annotations = annotations.filter((a) => a.properties.visibility === query.visibility);
				}
				if (query.createdBy) {
					annotations = annotations.filter((a) => a.properties.createdBy === query.createdBy);
				}
			} else {
				// Default: exclude deleted
				annotations = annotations.filter((a) => !a.properties.isDeleted);
			}

			return annotations;
		} catch {
			return [];
		}
	}

	async update(id: string, changes: Partial<AnnotationProperties>): Promise<void> {
		// Scan all cases — in practice the caller should know the caseId
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith(STORAGE_KEY_PREFIX)) continue;

			const raw = localStorage.getItem(key);
			if (!raw) continue;

			try {
				const annotations: Annotation[] = JSON.parse(raw);
				const idx = annotations.findIndex((a) => a.properties.id === id);
				if (idx !== -1) {
					annotations[idx] = {
						...annotations[idx],
						properties: {
							...annotations[idx].properties,
							...changes,
							updatedAt: new Date().toISOString(),
						},
					};
					localStorage.setItem(key, JSON.stringify(annotations));
					return;
				}
			} catch {
				// Skip corrupted entries
			}
		}
	}

	async delete(id: string): Promise<void> {
		await this.update(id, {
			isDeleted: true,
			deletedAt: new Date().toISOString(),
		});
	}

	async saveLayers(caseId: string, layers: AnnotationLayer[]): Promise<void> {
		const key = `${STORAGE_KEY_PREFIX}layers:${caseId}`;
		localStorage.setItem(key, JSON.stringify(layers));
	}

	async loadLayers(caseId: string): Promise<AnnotationLayer[]> {
		const key = `${STORAGE_KEY_PREFIX}layers:${caseId}`;
		const raw = localStorage.getItem(key);
		if (!raw) return [];
		try {
			return JSON.parse(raw);
		} catch {
			return [];
		}
	}

	private persist(caseId: string, annotations: Annotation[]): void {
		localStorage.setItem(this.storageKey(caseId), JSON.stringify(annotations));
	}
}

// ─── Orchestrator Provider (Stub) ────────────────────────────────────

/**
 * OrchestratorAnnotationProvider — proxies through the orchestrator postMessage bridge.
 *
 * In orchestrated mode, annotations are sent to the orchestrator window via
 * postMessage, which proxies them to the Okapi backend API:
 *   POST   /api/cases/{accession}/annotations
 *   GET    /api/cases/{accession}/annotations
 *   PUT    /api/cases/{accession}/annotations/{id}
 *   DELETE /api/cases/{accession}/annotations/{id}
 *
 * The backend returns 501 until annotation persistence is fully implemented.
 *
 * This class is a stub — it currently falls back to LocalAnnotationProvider
 * and logs a warning. Once the backend is ready, it will use the bridge.
 */
export class OrchestratorAnnotationProvider implements AnnotationPersistenceProvider {
	private fallback = new LocalAnnotationProvider();

	async save(caseId: string, slideId: string, annotation: Annotation): Promise<SaveResult> {
		console.warn(
			'[OrchestratorAnnotationProvider] Server persistence not yet implemented — using local storage fallback',
		);
		return this.fallback.save(caseId, slideId, annotation);
	}

	async load(caseId: string, query?: AnnotationQuery): Promise<Annotation[]> {
		console.warn(
			'[OrchestratorAnnotationProvider] Server persistence not yet implemented — using local storage fallback',
		);
		return this.fallback.load(caseId, query);
	}

	async update(id: string, changes: Partial<AnnotationProperties>): Promise<void> {
		console.warn(
			'[OrchestratorAnnotationProvider] Server persistence not yet implemented — using local storage fallback',
		);
		return this.fallback.update(id, changes);
	}

	async delete(id: string): Promise<void> {
		console.warn(
			'[OrchestratorAnnotationProvider] Server persistence not yet implemented — using local storage fallback',
		);
		return this.fallback.delete(id);
	}

	async saveLayers(caseId: string, layers: AnnotationLayer[]): Promise<void> {
		return this.fallback.saveLayers(caseId, layers);
	}

	async loadLayers(caseId: string): Promise<AnnotationLayer[]> {
		return this.fallback.loadLayers(caseId);
	}
}
