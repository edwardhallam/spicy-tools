/**
 * Shared types used across dropdown and kanban features.
 */

/**
 * Result of parsing a definition or configuration file.
 * Encapsulates success/failure to avoid throwing exceptions.
 */
export type ParseResult<T> =
	| { success: true; data: T }
	| { success: false; error: string };

/**
 * Helper to create a successful parse result.
 */
export function success<T>(data: T): ParseResult<T> {
	return { success: true, data };
}

/**
 * Helper to create a failed parse result.
 */
export function failure<T>(error: string): ParseResult<T> {
	return { success: false, error };
}

/**
 * Path segments from a file to the vault root.
 * Used for walking up the folder tree to resolve inheritance.
 */
export interface FolderPath {
	/** Full path from vault root (e.g., "Health/Tracking/HealthLog/2026") */
	path: string;
	/** Parent folder path (e.g., "Health/Tracking/HealthLog") */
	parent: string | null;
}

/**
 * Cached definition with metadata for invalidation.
 */
export interface CachedDefinition<T> {
	/** The parsed definition data */
	data: T;
	/** Modification time of the source file */
	mtime: number;
	/** Path to the source file */
	sourcePath: string;
}
