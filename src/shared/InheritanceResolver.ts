/**
 * InheritanceResolver - Resolve dropdown definitions via folder inheritance
 *
 * Walks up the folder tree from a file's location to find the applicable
 * dropdown definitions. Child definitions fully replace parent definitions
 * (no merging of options).
 */

import type { App, TFile, TFolder, TAbstractFile } from 'obsidian';
import { DropdownDefinition, DropdownDefinitions } from '../dropdowns/types';

/**
 * Definition file name.
 */
export const DROPDOWN_DEFINITION_FILENAME = '_dropdowns.md';

/**
 * Result of resolving definitions for a file.
 */
export interface ResolvedDefinitions {
	/** The final merged definitions to apply */
	definitions: Map<string, DropdownDefinition>;

	/** Path to the definition file that provided these definitions (or 'global') */
	source: string;

	/** All sources consulted in order (for debugging) */
	inheritanceChain: string[];
}

/**
 * Callback to get definitions for a specific path.
 * This allows the InheritanceResolver to be decoupled from the DropdownManager.
 */
export type DefinitionProvider = (
	folderPath: string
) => Promise<DropdownDefinitions | null>;

/**
 * Resolve dropdown definitions for a given file.
 *
 * Walks up the folder tree from the file's location, checking each folder
 * for a _dropdowns.md file. The first definition file found wins (child
 * definitions fully replace parent definitions). If no folder definitions
 * are found, falls back to global definitions.
 *
 * @param file - The file to resolve definitions for
 * @param app - Obsidian App instance (for folder navigation)
 * @param getDefinitions - Callback to get definitions for a folder path
 * @param globalDefinitions - Global definitions from plugin settings
 * @returns Resolved definitions with inheritance chain
 */
export async function resolveDefinitionsForFile(
	file: TFile,
	app: App,
	getDefinitions: DefinitionProvider,
	globalDefinitions: DropdownDefinitions | null
): Promise<ResolvedDefinitions> {
	const inheritanceChain: string[] = [];
	const folderPath = file.parent?.path ?? '';

	// Walk up the folder tree
	const folders = getFolderChain(folderPath, app);

	for (const folder of folders) {
		inheritanceChain.push(folder);

		const definitions = await getDefinitions(folder);

		if (definitions !== null && definitions.definitions.size > 0) {
			// Found definitions - apply them (child fully replaces parent)
			return {
				definitions: applyDisabledProperties(
					definitions.definitions,
					globalDefinitions?.definitions ?? new Map()
				),
				source: definitions.source,
				inheritanceChain,
			};
		}
	}

	// No folder definitions found - use global
	inheritanceChain.push('global');

	if (globalDefinitions !== null && globalDefinitions.definitions.size > 0) {
		return {
			definitions: new Map(globalDefinitions.definitions),
			source: 'global',
			inheritanceChain,
		};
	}

	// No definitions at all
	return {
		definitions: new Map(),
		source: 'none',
		inheritanceChain,
	};
}

/**
 * Get the chain of folder paths from a starting path to the vault root.
 *
 * @param startPath - Starting folder path
 * @param app - Obsidian App instance
 * @returns Array of folder paths from most specific to root
 *
 * @example
 * getFolderChain('Health/Tracking/HealthLog/2026', app)
 * // Returns: [
 * //   'Health/Tracking/HealthLog/2026',
 * //   'Health/Tracking/HealthLog',
 * //   'Health/Tracking',
 * //   'Health',
 * //   ''  (vault root)
 * // ]
 */
export function getFolderChain(startPath: string, app: App): string[] {
	const chain: string[] = [];
	let currentPath = startPath;

	// Add the starting path
	if (currentPath !== '') {
		chain.push(currentPath);
	}

	// Walk up to root
	while (currentPath.includes('/')) {
		const lastSlash = currentPath.lastIndexOf('/');
		currentPath = currentPath.substring(0, lastSlash);
		chain.push(currentPath);
	}

	// Add root (empty string) if we haven't already
	if (currentPath !== '' && !chain.includes('')) {
		chain.push('');
	} else if (startPath !== '' && !chain.includes('')) {
		chain.push('');
	}

	// Also add root for the case where startPath is empty
	if (startPath === '' && !chain.includes('')) {
		chain.push('');
	}

	return chain;
}

/**
 * Apply 'disabled: true' properties to filter out inherited definitions.
 *
 * When a child definition has `disabled: true` for a property, that property
 * should be removed from the final definitions (falling back to native input).
 *
 * @param definitions - Current level's definitions
 * @param parentDefinitions - Parent level's definitions (for context)
 * @returns Filtered definitions with disabled properties removed
 */
function applyDisabledProperties(
	definitions: Map<string, DropdownDefinition>,
	parentDefinitions: Map<string, DropdownDefinition>
): Map<string, DropdownDefinition> {
	const result = new Map<string, DropdownDefinition>();

	for (const [property, definition] of definitions) {
		// Skip disabled properties
		if (definition.disabled) {
			continue;
		}

		result.set(property, definition);
	}

	return result;
}

/**
 * Merge definitions from multiple sources.
 *
 * NOTE: Per SPEC.md, child definitions FULLY REPLACE parent definitions.
 * This function is provided for edge cases where explicit merging is needed.
 * The standard inheritance resolver does NOT merge - it uses the first
 * definition file found in the folder chain.
 *
 * @param sources - Array of definition sources, in priority order (first wins)
 * @returns Merged definitions
 */
export function mergeDefinitions(
	...sources: (DropdownDefinitions | null)[]
): Map<string, DropdownDefinition> {
	const merged = new Map<string, DropdownDefinition>();

	// Process sources in reverse order so higher priority overwrites lower
	for (let i = sources.length - 1; i >= 0; i--) {
		const source = sources[i];
		if (source === null) continue;

		for (const [property, definition] of source.definitions) {
			if (definition.disabled) {
				// Remove from merged
				merged.delete(property);
			} else {
				merged.set(property, definition);
			}
		}
	}

	return merged;
}

/**
 * Check if a folder contains a dropdown definition file.
 *
 * @param folderPath - Path to the folder
 * @param app - Obsidian App instance
 * @returns True if _dropdowns.md exists in the folder
 */
export function hasDefinitionFile(folderPath: string, app: App): boolean {
	const definitionPath = folderPath
		? `${folderPath}/${DROPDOWN_DEFINITION_FILENAME}`
		: DROPDOWN_DEFINITION_FILENAME;

	const file = app.vault.getAbstractFileByPath(definitionPath);
	return file !== null;
}

/**
 * Get the path to a definition file in a folder.
 *
 * @param folderPath - Path to the folder
 * @returns Path to _dropdowns.md in that folder
 */
export function getDefinitionFilePath(folderPath: string): string {
	return folderPath
		? `${folderPath}/${DROPDOWN_DEFINITION_FILENAME}`
		: DROPDOWN_DEFINITION_FILENAME;
}
