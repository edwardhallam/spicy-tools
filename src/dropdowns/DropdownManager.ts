/**
 * DropdownManager - Manage dropdown definitions loading and caching
 *
 * Responsible for:
 * - Loading definitions from _dropdowns.md files
 * - Caching parsed definitions
 * - Watching for file changes to invalidate cache
 * - Providing definitions for a given file via inheritance resolution
 */

import type { App, TFile, EventRef } from 'obsidian';
import { parseDropdownDefinitions, parseGlobalDefinitions, parseTableDropdownDefinitions } from './DefinitionParser';
import {
	resolveDefinitionsForFile,
	getDefinitionFilePath,
	getFolderChain,
	DROPDOWN_DEFINITION_FILENAME,
	ResolvedDefinitions,
} from '../shared/InheritanceResolver';
import { DropdownDefinitions, DropdownManagerEvent } from './types';
import { TableDropdownDefinitions } from '../tables/types';
import { CachedDefinition } from '../shared/types';

/**
 * Configuration for DropdownManager.
 */
export interface DropdownManagerConfig {
	/** Global definitions YAML from plugin settings */
	globalDefinitionsYaml: string;
}

/**
 * Manages dropdown definitions for the plugin.
 */
export class DropdownManager {
	private app: App;
	private cache: Map<string, CachedDefinition<DropdownDefinitions>>;
	private tableCache: Map<string, CachedDefinition<TableDropdownDefinitions>>;
	private globalDefinitions: DropdownDefinitions | null;
	private eventRefs: EventRef[];
	private listeners: Set<(event: DropdownManagerEvent) => void>;

	constructor(app: App) {
		this.app = app;
		this.cache = new Map();
		this.tableCache = new Map();
		this.globalDefinitions = null;
		this.eventRefs = [];
		this.listeners = new Set();
	}

	/**
	 * Initialize the manager with configuration.
	 */
	async initialize(config: DropdownManagerConfig): Promise<void> {
		// Parse global definitions
		const result = parseGlobalDefinitions(config.globalDefinitionsYaml);

		if (result.success) {
			this.globalDefinitions = result.data;
		} else {
			console.error('Spicy Tools: Error parsing global definitions:', result.error);
			this.globalDefinitions = { definitions: new Map(), source: 'global' };
		}

		// Set up file watchers
		this.setupFileWatchers();
	}

	/**
	 * Clean up resources when the plugin is unloaded.
	 */
	destroy(): void {
		// Remove event listeners
		for (const ref of this.eventRefs) {
			this.app.vault.offref(ref);
		}
		this.eventRefs = [];

		// Clear cache
		this.cache.clear();
		this.tableCache.clear();
		this.listeners.clear();
	}

	/**
	 * Get resolved definitions for a file.
	 *
	 * Uses inheritance resolution to find the applicable definitions,
	 * walking up the folder tree and falling back to global definitions.
	 *
	 * @param file - The file to get definitions for
	 * @returns Resolved definitions with inheritance info
	 */
	async getDefinitionsForFile(file: TFile): Promise<ResolvedDefinitions> {
		return resolveDefinitionsForFile(
			file,
			this.app,
			(folderPath) => this.getDefinitionsForFolder(folderPath),
			this.globalDefinitions
		);
	}

	/**
	 * Get definitions for a specific folder (checks for _dropdowns.md).
	 *
	 * @param folderPath - Path to the folder
	 * @returns Definitions or null if no definition file exists
	 */
	async getDefinitionsForFolder(folderPath: string): Promise<DropdownDefinitions | null> {
		const definitionPath = getDefinitionFilePath(folderPath);

		// Check cache first
		const cached = this.cache.get(definitionPath);
		if (cached) {
			return cached.data;
		}

		// Try to load the definition file
		const file = this.app.vault.getAbstractFileByPath(definitionPath) as TFile | null;
		if (!file || !('extension' in file)) {
			return null;
		}

		// Load and parse the file
		try {
			const content = await this.app.vault.read(file);
			const result = parseDropdownDefinitions(content, definitionPath);

			if (!result.success) {
				console.error('Spicy Tools: Error parsing definitions:', result.error);
				this.emit({ type: 'definitions-error', path: definitionPath, error: result.error });
				return null;
			}

			// Cache the result
			this.cache.set(definitionPath, {
				data: result.data,
				mtime: Date.now(),
				sourcePath: definitionPath,
			});

			this.emit({ type: 'definitions-loaded', path: definitionPath });

			return result.data;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error('Spicy Tools: Error loading definitions:', message);
			this.emit({ type: 'definitions-error', path: definitionPath, error: message });
			return null;
		}
	}

	/**
	 * Get table dropdown definitions for a file, walking up the folder tree.
	 * Returns definitions from the first _dropdowns.md with a tables section, or null.
	 *
	 * @param filePath - Path to the file
	 * @returns Table dropdown definitions or null if none found
	 */
	async getTableDefinitionsForFile(filePath: string): Promise<TableDropdownDefinitions | null> {
		// Extract folder path from file path
		const lastSlash = filePath.lastIndexOf('/');
		const folderPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : '';

		// Walk up the folder tree
		const folders = getFolderChain(folderPath, this.app);

		for (const folder of folders) {
			const definitions = await this.getTableDefinitionsForFolder(folder);

			if (definitions !== null && definitions.definitions.size > 0) {
				return definitions;
			}
		}

		// No table definitions found
		return null;
	}

	/**
	 * Get table definitions for a specific folder (checks for _dropdowns.md).
	 *
	 * @param folderPath - Path to the folder
	 * @returns Table definitions or null if no definition file exists or no tables section
	 */
	async getTableDefinitionsForFolder(folderPath: string): Promise<TableDropdownDefinitions | null> {
		const definitionPath = getDefinitionFilePath(folderPath);

		// Check cache first
		const cached = this.tableCache.get(definitionPath);
		if (cached) {
			return cached.data;
		}

		// Try to load the definition file
		const file = this.app.vault.getAbstractFileByPath(definitionPath) as TFile | null;
		if (!file || !('extension' in file)) {
			return null;
		}

		// Load and parse the file
		try {
			const content = await this.app.vault.read(file);
			const result = parseTableDropdownDefinitions(content, definitionPath);

			if (!result.success) {
				console.error('Spicy Tools: Error parsing table definitions:', result.error);
				this.emit({ type: 'definitions-error', path: definitionPath, error: result.error });
				return null;
			}

			// Cache the result
			this.tableCache.set(definitionPath, {
				data: result.data,
				mtime: Date.now(),
				sourcePath: definitionPath,
			});

			return result.data;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error('Spicy Tools: Error loading table definitions:', message);
			this.emit({ type: 'definitions-error', path: definitionPath, error: message });
			return null;
		}
	}

	/**
	 * Force reload all definitions (clears cache).
	 */
	async reloadAll(): Promise<void> {
		this.cache.clear();
		this.tableCache.clear();
		this.emit({ type: 'definitions-cleared' });
	}

	/**
	 * Update global definitions from plugin settings.
	 *
	 * @param yaml - New global definitions YAML
	 */
	updateGlobalDefinitions(yaml: string): void {
		const result = parseGlobalDefinitions(yaml);

		if (result.success) {
			this.globalDefinitions = result.data;
		} else {
			console.error('Spicy Tools: Error parsing global definitions:', result.error);
		}
	}

	/**
	 * Subscribe to manager events.
	 *
	 * @param callback - Event handler
	 * @returns Unsubscribe function
	 */
	on(callback: (event: DropdownManagerEvent) => void): () => void {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	/**
	 * Emit an event to all listeners.
	 */
	private emit(event: DropdownManagerEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (error) {
				console.error('Spicy Tools: Error in event listener:', error);
			}
		}
	}

	/**
	 * Set up file watchers to invalidate cache on changes.
	 */
	private setupFileWatchers(): void {
		// Watch for file modifications
		const modifyRef = this.app.vault.on('modify', (file) => {
			if (file.name === DROPDOWN_DEFINITION_FILENAME) {
				this.invalidateCache(file.path);
			}
		});
		this.eventRefs.push(modifyRef);

		// Watch for file deletions
		const deleteRef = this.app.vault.on('delete', (file) => {
			if (file.name === DROPDOWN_DEFINITION_FILENAME) {
				this.invalidateCache(file.path);
			}
		});
		this.eventRefs.push(deleteRef);

		// Watch for file renames
		const renameRef = this.app.vault.on('rename', (file, oldPath) => {
			if (file.name === DROPDOWN_DEFINITION_FILENAME || oldPath.endsWith(DROPDOWN_DEFINITION_FILENAME)) {
				this.invalidateCache(oldPath);
				this.invalidateCache(file.path);
			}
		});
		this.eventRefs.push(renameRef);

		// Watch for new files
		const createRef = this.app.vault.on('create', (file) => {
			if (file.name === DROPDOWN_DEFINITION_FILENAME) {
				// New definition file - no cache to invalidate, but might want to notify
				this.emit({ type: 'definitions-loaded', path: file.path });
			}
		});
		this.eventRefs.push(createRef);
	}

	/**
	 * Invalidate cached definitions for a path.
	 */
	private invalidateCache(path: string): void {
		let invalidated = false;

		if (this.cache.has(path)) {
			this.cache.delete(path);
			invalidated = true;
		}

		if (this.tableCache.has(path)) {
			this.tableCache.delete(path);
			invalidated = true;
		}

		if (invalidated) {
			this.emit({ type: 'definitions-cleared' });
		}
	}
}
