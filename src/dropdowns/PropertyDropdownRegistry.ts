/**
 * PropertyDropdownRegistry - Lifecycle and Discovery Management
 *
 * Top-level coordinator for the dropdown system.
 * Key design decisions:
 * - Scoped MutationObserver on .metadata-properties (not document.body)
 * - String-keyed adapters: "filepath:propertyName"
 * - Interaction lock prevents re-render during user interaction
 * - Scan on file change for clean slate approach
 */

import type { App, TFile, EventRef } from 'obsidian';
import { DropdownManager } from './DropdownManager';
import { PropertyDropdownAdapter } from './PropertyDropdownAdapter';
import { DropdownDefinition } from './types';

/**
 * Generate a stable key for an adapter.
 */
function makeAdapterKey(filePath: string, propertyName: string): string {
	return `${filePath}:${propertyName}`;
}

/**
 * Manages the lifecycle of dropdown adapters for the property panel.
 */
export class PropertyDropdownRegistry {
	private app: App;
	private dropdownManager: DropdownManager;

	// Adapters keyed by "filepath:propertyName"
	private adapters: Map<string, PropertyDropdownAdapter> = new Map();

	// MutationObserver for property panel
	private observer: MutationObserver | null = null;
	private observedContainer: HTMLElement | null = null;

	// Current file context
	private currentFile: TFile | null = null;
	private definitions: Map<string, DropdownDefinition> = new Map();

	// Interaction coordination
	private interactionLockCount = 0;

	// Event refs for cleanup
	private eventRefs: EventRef[] = [];

	// Debouncing
	private scanDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	private static readonly SCAN_DEBOUNCE_MS = 50;

	constructor(app: App, dropdownManager: DropdownManager) {
		this.app = app;
		this.dropdownManager = dropdownManager;
	}

	/**
	 * Start watching for property elements.
	 */
	start(): void {
		// Initial render for active file
		this.handleFileChange();

		// Watch for file changes
		const fileOpenRef = this.app.workspace.on('file-open', () => {
			this.handleFileChange();
		});
		this.eventRefs.push(fileOpenRef);

		// Watch for active leaf changes
		const leafChangeRef = this.app.workspace.on('active-leaf-change', () => {
			this.handleFileChange();
		});
		this.eventRefs.push(leafChangeRef);

		// Watch for metadata changes (external edits)
		const metadataChangeRef = this.app.metadataCache.on('changed', (file) => {
			if (file === this.currentFile) {
				this.handleMetadataChange();
			}
		});
		this.eventRefs.push(metadataChangeRef);

		// Set up MutationObserver
		this.setupObserver();
	}

	/**
	 * Stop watching and clean up.
	 */
	stop(): void {
		// Clear debounce timer
		if (this.scanDebounceTimer) {
			clearTimeout(this.scanDebounceTimer);
			this.scanDebounceTimer = null;
		}

		// Disconnect observer
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		this.observedContainer = null;

		// Remove event listeners
		for (const ref of this.eventRefs) {
			this.app.workspace.offref(ref);
		}
		this.eventRefs = [];

		// Destroy all adapters
		for (const adapter of this.adapters.values()) {
			adapter.destroy();
		}
		this.adapters.clear();

		this.currentFile = null;
		this.definitions.clear();
	}

	/**
	 * Force refresh all dropdowns.
	 */
	async refresh(): Promise<void> {
		// Destroy all adapters
		for (const adapter of this.adapters.values()) {
			adapter.destroy();
		}
		this.adapters.clear();

		// Reload definitions
		if (this.currentFile) {
			const resolved = await this.dropdownManager.getDefinitionsForFile(this.currentFile);
			this.definitions = resolved.definitions;
		}

		// Re-scan properties
		this.scanProperties();
	}

	/**
	 * Handle file change - load definitions for new file.
	 */
	private async handleFileChange(): Promise<void> {
		const file = this.app.workspace.getActiveFile();

		if (!file || file === this.currentFile) {
			return;
		}

		// Clean slate: destroy all existing adapters
		for (const adapter of this.adapters.values()) {
			adapter.destroy();
		}
		this.adapters.clear();

		this.currentFile = file;

		// Load definitions for this file
		const resolved = await this.dropdownManager.getDefinitionsForFile(file);
		this.definitions = resolved.definitions;

		// Re-setup observer for new context
		this.setupObserver();

		// Scan for properties
		this.scanProperties();
	}

	/**
	 * Handle metadata changes from external edits.
	 */
	private handleMetadataChange(): void {
		// Refresh all adapters that aren't currently being interacted with
		for (const adapter of this.adapters.values()) {
			adapter.refresh();
		}
	}

	/**
	 * Set up MutationObserver to watch the property panel.
	 * CRITICAL: Only observe the .metadata-properties container, not document.body.
	 */
	private setupObserver(): void {
		// Disconnect existing observer
		if (this.observer) {
			this.observer.disconnect();
		}

		this.observer = new MutationObserver((mutations) => {
			// Skip if any dropdown is being interacted with
			if (this.isLocked()) {
				return;
			}

			// Check if we need to scan
			let shouldScan = false;
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					const addedNodes = Array.from(mutation.addedNodes);
					const removedNodes = Array.from(mutation.removedNodes);

					for (const node of [...addedNodes, ...removedNodes]) {
						if (node instanceof HTMLElement) {
							// Scan if property rows are added/removed
							if (
								node.classList?.contains('metadata-property') ||
								node.querySelector?.('.metadata-property')
							) {
								shouldScan = true;
								break;
							}

							// CRITICAL: Also scan if Obsidian's native controls appear inside value containers
							// This catches the case where Obsidian overwrites our dropdown with its native UI
							if (
								node.classList?.contains('multi-select-container') ||
								node.classList?.contains('metadata-input-longtext') ||
								node.closest?.('.metadata-property-value')
							) {
								shouldScan = true;
								break;
							}
						}
					}
				}
				if (shouldScan) break;
			}

			if (shouldScan) {
				this.debouncedScan();
			}
		});

		// Find the properties container - this is scoped observation
		// Look for .metadata-properties or .workspace-leaf-content
		this.findAndObserveContainer();
	}

	/**
	 * Find and observe the properties container.
	 * Tries multiple selectors as Obsidian's DOM varies by context.
	 */
	private findAndObserveContainer(): void {
		// First try: active leaf's properties container
		const activeLeaf = this.app.workspace.activeLeaf;
		if (activeLeaf) {
			const leafContent = activeLeaf.view.containerEl;
			const propertiesContainer = leafContent.querySelector('.metadata-properties');
			if (propertiesContainer) {
				this.observeContainer(propertiesContainer as HTMLElement);
				return;
			}
		}

		// Fallback: find any properties container in the document
		const propertiesContainer = document.querySelector('.metadata-properties');
		if (propertiesContainer) {
			this.observeContainer(propertiesContainer as HTMLElement);
			return;
		}

		// Last resort: observe workspace-leaf-content to catch when properties appear
		const workspaceContent = document.querySelector('.workspace-leaf.mod-active .view-content');
		if (workspaceContent) {
			this.observeContainer(workspaceContent as HTMLElement);
		}
	}

	/**
	 * Start observing a container element.
	 */
	private observeContainer(container: HTMLElement): void {
		if (!this.observer) return;

		this.observedContainer = container;
		this.observer.observe(container, {
			childList: true,
			subtree: true,
		});
	}

	/**
	 * Debounced scan for properties.
	 */
	private debouncedScan(): void {
		if (this.scanDebounceTimer) {
			clearTimeout(this.scanDebounceTimer);
		}

		this.scanDebounceTimer = setTimeout(() => {
			this.scanDebounceTimer = null;
			this.scanProperties();
		}, PropertyDropdownRegistry.SCAN_DEBOUNCE_MS);
	}

	/**
	 * Scan for property elements and create/update adapters.
	 */
	private scanProperties(): void {
		if (!this.currentFile) return;

		// Find all property elements
		const propertyElements = document.querySelectorAll('.metadata-property');
		const seenKeys = new Set<string>();

		propertyElements.forEach((propertyEl) => {
			this.processPropertyElement(propertyEl as HTMLElement, seenKeys);
		});

		// Clean up adapters for properties that no longer exist
		for (const [key, adapter] of this.adapters) {
			if (!seenKeys.has(key)) {
				adapter.destroy();
				this.adapters.delete(key);
			}
		}
	}

	/**
	 * Process a single property element.
	 */
	private processPropertyElement(propertyEl: HTMLElement, seenKeys: Set<string>): void {
		if (!this.currentFile) return;

		try {
			const propertyName = this.getPropertyName(propertyEl);
			if (!propertyName) return;

			// Check if we have a definition for this property
			const definition = this.definitions.get(propertyName);
			if (!definition) {
				// No definition - ensure we remove any existing dropdown
				this.removeDropdownFromElement(propertyEl);
				return;
			}

			const key = makeAdapterKey(this.currentFile.path, propertyName);
			seenKeys.add(key);

			// Find the value container
			const valueContainer = propertyEl.querySelector('.metadata-property-value');
			if (!valueContainer) return;

			// Check if we already have an adapter for this property
			if (this.adapters.has(key)) {
				// Adapter exists - verify UI is still in DOM
				const existingDropdown = valueContainer.querySelector('.spicy-dropdown');
				if (existingDropdown) {
					return; // Dropdown exists, skip
				}
				// Dropdown was removed (Obsidian may have overwritten it for list properties)
				// Clean up stale adapter and re-create
				this.adapters.get(key)?.destroy();
				this.adapters.delete(key);
			}

			// Create adapter
			this.createAdapter(key, propertyEl, valueContainer as HTMLElement, definition);
		} catch (error) {
			console.error('Spicy Tools: Error processing property:', error);
		}
	}

	/**
	 * Get the property name from a property element.
	 */
	private getPropertyName(propertyEl: HTMLElement): string | null {
		// Try to get from data attribute
		const dataKey = propertyEl.getAttribute('data-property-key');
		if (dataKey) {
			return dataKey;
		}

		// Try to get from the key element
		const keyEl = propertyEl.querySelector('.metadata-property-key');
		if (keyEl) {
			return keyEl.textContent?.trim() || null;
		}

		return null;
	}

	/**
	 * Create an adapter for a property.
	 * For multi-select properties, delays mounting slightly to let Obsidian's
	 * native rendering finish first (avoids race condition).
	 */
	private createAdapter(
		key: string,
		propertyEl: HTMLElement,
		valueContainer: HTMLElement,
		definition: DropdownDefinition
	): void {
		if (!this.currentFile) return;

		const doMount = () => {
			// Double-check we still need to mount (file might have changed)
			if (!this.currentFile || this.adapters.has(key)) return;

			// Create adapter
			const adapter = new PropertyDropdownAdapter(
				this.app,
				this.currentFile,
				definition.property,
				definition
			);

			// Set up interaction callback for lock coordination
			adapter.setInteractionCallback((isInteracting) => {
				if (isInteracting) {
					this.acquireLock();
				} else {
					this.releaseLock();
				}
			});

			// Mount UI
			adapter.mount(valueContainer);

			// Track adapter
			this.adapters.set(key, adapter);

			// Mark the property element as having a dropdown
			propertyEl.addClass('spicy-dropdown-active');
		};

		// For multi-select properties, delay mount to let Obsidian's native
		// multi-select rendering finish first (prevents race condition)
		if (definition.multi) {
			setTimeout(doMount, 100);
		} else {
			doMount();
		}
	}

	/**
	 * Remove dropdown UI from a property element.
	 */
	private removeDropdownFromElement(propertyEl: HTMLElement): void {
		propertyEl.removeClass('spicy-dropdown-active');
		// The adapter cleanup will handle removing the UI
	}

	// Interaction Lock

	private acquireLock(): void {
		this.interactionLockCount++;
	}

	private releaseLock(): void {
		this.interactionLockCount = Math.max(0, this.interactionLockCount - 1);
	}

	isLocked(): boolean {
		return this.interactionLockCount > 0;
	}
}
