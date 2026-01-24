/**
 * PropertyDropdownAdapter - Bridge between DropdownUI and Obsidian
 *
 * Bridges UI events to frontmatter updates.
 * Key design decisions:
 * - Always reads from metadata cache (single source of truth)
 * - Debounced frontmatter updates to prevent rapid successive writes
 * - Queues external updates if UI is open
 */

import type { App, TFile } from 'obsidian';
import { DropdownUI, DropdownUIConfig, DropdownUIEvents, DropdownValue } from './DropdownUI';
import { DropdownDefinition } from './types';

/**
 * Value types that can be stored in frontmatter properties.
 * Re-exported from DropdownUI for convenience.
 */
export type PropertyValue = DropdownValue;

/**
 * Callback invoked when the adapter's interaction state changes.
 */
export type InteractionCallback = (isInteracting: boolean) => void;

/**
 * Adapts the DropdownUI component to work with Obsidian's frontmatter.
 */
export class PropertyDropdownAdapter {
	private app: App;
	private file: TFile;
	private propertyName: string;
	private definition: DropdownDefinition;
	private ui: DropdownUI | null = null;
	private container: HTMLElement | null = null;
	private isDestroyed = false;

	// Callbacks
	private onInteractionChange: InteractionCallback | null = null;

	// Update handling
	private pendingRefresh = false;
	private pendingValue: DropdownValue = null;
	private hasPendingValue = false;
	private updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	private static readonly UPDATE_DEBOUNCE_MS = 50;

	constructor(
		app: App,
		file: TFile,
		propertyName: string,
		definition: DropdownDefinition
	) {
		this.app = app;
		this.file = file;
		this.propertyName = propertyName;
		this.definition = definition;
	}

	/**
	 * Mount the dropdown UI into a container element.
	 */
	mount(container: HTMLElement): void {
		if (this.isDestroyed) return;

		this.container = container;
		this.container.empty();

		const config: DropdownUIConfig = {
			options: this.definition.options,
			value: this.getCurrentValue(),
			multi: this.definition.multi ?? false,
			placeholder: this.definition.multi ? 'Select options...' : 'Select...',
		};

		const events: DropdownUIEvents = {
			onOpen: () => this.handleOpen(),
			onClose: () => this.handleClose(),
			onChange: (value) => this.handleChange(value),
		};

		this.ui = new DropdownUI(container, config, events);
	}

	/**
	 * Set a callback for when interaction state changes.
	 */
	setInteractionCallback(callback: InteractionCallback | null): void {
		this.onInteractionChange = callback;
	}

	/**
	 * Get the property name this adapter manages.
	 */
	getPropertyName(): string {
		return this.propertyName;
	}

	/**
	 * Get the file this adapter is bound to.
	 */
	getFile(): TFile {
		return this.file;
	}

	/**
	 * Check if the dropdown is currently being interacted with.
	 */
	isInteracting(): boolean {
		return this.ui?.isInteracting() ?? false;
	}

	/**
	 * Read current value from Obsidian's metadata cache.
	 * This is the single source of truth.
	 */
	private getCurrentValue(): PropertyValue {
		const cache = this.app.metadataCache.getFileCache(this.file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter || !(this.propertyName in frontmatter)) {
			return null;
		}

		const value = frontmatter[this.propertyName];

		// Handle various types
		if (value === null || value === undefined) {
			return null;
		}

		if (Array.isArray(value)) {
			// Filter to valid types
			return value.filter(
				(v): v is string | number => typeof v === 'string' || typeof v === 'number'
			);
		}

		if (typeof value === 'string' || typeof value === 'number') {
			return value;
		}

		// Unknown type - return null
		return null;
	}

	/**
	 * Handle dropdown open event.
	 */
	private handleOpen(): void {
		this.onInteractionChange?.(true);
	}

	/**
	 * Handle dropdown close event.
	 */
	private handleClose(): void {
		this.onInteractionChange?.(false);

		// Flush any pending multi-select value
		if (this.hasPendingValue) {
			this.hasPendingValue = false;
			this.writeFrontmatter(this.pendingValue);
			this.pendingValue = null;
		}

		// Process any pending refresh
		if (this.pendingRefresh) {
			this.pendingRefresh = false;
			this.refresh();
		}
	}

	/**
	 * Handle value change from the UI.
	 * For multi-select, defers write until dropdown closes to prevent
	 * Obsidian's re-render from destroying the dropdown mid-interaction.
	 */
	private handleChange(newValue: DropdownValue): void {
		if (this.isDestroyed) return;

		// For multi-select, defer the write until dropdown closes
		if (this.definition.multi) {
			this.pendingValue = newValue;
			this.hasPendingValue = true;
			return;
		}

		// For single-select, write immediately (dropdown will close anyway)
		// Debounce frontmatter updates
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
		}

		this.updateDebounceTimer = setTimeout(() => {
			this.updateDebounceTimer = null;
			this.writeFrontmatter(newValue);
		}, PropertyDropdownAdapter.UPDATE_DEBOUNCE_MS);
	}

	/**
	 * Write value to frontmatter.
	 */
	private async writeFrontmatter(newValue: PropertyValue): Promise<void> {
		if (this.isDestroyed) return;

		try {
			await this.app.fileManager.processFrontMatter(this.file, (fm) => {
				// Handle empty array case
				if (Array.isArray(newValue) && newValue.length === 0) {
					// Delete the property or set to empty array based on preference
					// Using empty array to preserve the property
					fm[this.propertyName] = [];
				} else {
					fm[this.propertyName] = newValue;
				}
			});
		} catch (error) {
			console.error('Spicy Tools: Error updating frontmatter:', error);
		}
	}

	/**
	 * Refresh the UI from the metadata cache.
	 * Called when external changes are detected.
	 */
	refresh(): void {
		if (this.isDestroyed || !this.ui) return;

		// If UI is open, queue the refresh for later
		if (this.ui.isInteracting()) {
			this.pendingRefresh = true;
			return;
		}

		// Update UI with current value from cache
		const currentValue = this.getCurrentValue();
		this.ui.setValue(currentValue);
	}

	/**
	 * Update the file reference (for file renames).
	 */
	updateFile(newFile: TFile): void {
		this.file = newFile;
	}

	/**
	 * Clean up resources.
	 */
	destroy(): void {
		if (this.isDestroyed) return;
		this.isDestroyed = true;

		// Flush any pending multi-select value before destroying
		if (this.hasPendingValue) {
			this.hasPendingValue = false;
			// Fire and forget - we're being destroyed anyway
			this.writeFrontmatter(this.pendingValue);
			this.pendingValue = null;
		}

		// Clear any pending debounce
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
			this.updateDebounceTimer = null;
		}

		// Destroy UI
		if (this.ui) {
			this.ui.destroy();
			this.ui = null;
		}

		// Clear container
		if (this.container) {
			this.container.empty();
			this.container = null;
		}

		this.onInteractionChange = null;
	}
}
