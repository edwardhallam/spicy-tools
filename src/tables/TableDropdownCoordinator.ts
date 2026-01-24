/**
 * TableDropdownCoordinator - Coordination layer for Table Dropdowns
 *
 * Manages both Reading View and Live Preview table dropdown implementations.
 * Uses a dual-implementation approach:
 * - Reading View: registerMarkdownPostProcessor (static HTML)
 * - Live Preview: CodeMirror 6 ViewPlugin with widget decorations
 *
 * Key responsibilities:
 * - Register both implementations on plugin load
 * - Subscribe to DropdownManager events for definition changes
 * - Provide refresh API for manual reloads
 * - Clean up resources on plugin unload
 */

import type { App, Plugin } from 'obsidian';
import { DropdownManager } from '@dropdowns/DropdownManager';
import {
	registerReadingViewTableDropdowns,
	clearReadingViewAdapters,
	refreshReadingViewDropdowns,
} from './ReadingViewTableDropdowns';
import {
	registerLivePreviewTableDropdowns,
	LivePreviewTableDropdownManager,
} from './LivePreviewTableDropdowns';

/**
 * Coordinates table dropdown functionality across view types.
 */
export class TableDropdownCoordinator {
	private plugin: Plugin;
	private app: App;
	private dropdownManager: DropdownManager;

	// Live Preview manager (CM6 ViewPlugin)
	private livePreviewManager: LivePreviewTableDropdownManager | null = null;

	// Unsubscribe function for DropdownManager events
	private unsubscribeFromManager: (() => void) | null = null;

	// Track if initialized
	private initialized = false;

	constructor(
		plugin: Plugin,
		app: App,
		dropdownManager: DropdownManager
	) {
		this.plugin = plugin;
		this.app = app;
		this.dropdownManager = dropdownManager;
	}

	/**
	 * Initialize the table dropdown system.
	 * Registers both implementations:
	 * - Reading View: registerMarkdownPostProcessor
	 * - Live Preview: CodeMirror 6 ViewPlugin
	 */
	initialize(): void {
		if (this.initialized) return;

		// Register Reading View implementation (post-processor)
		registerReadingViewTableDropdowns(this.plugin, this.dropdownManager);

		// Register Live Preview implementation (CM6 ViewPlugin)
		this.livePreviewManager = registerLivePreviewTableDropdowns(
			this.plugin,
			this.dropdownManager
		);

		// Subscribe to DropdownManager events for definition changes
		this.unsubscribeFromManager = this.dropdownManager.on((event) => {
			if (event.type === 'definitions-cleared') {
				// Definitions were reloaded - refresh all table dropdowns
				this.refresh();
			}
		});

		this.initialized = true;
	}

	/**
	 * Clean up all resources.
	 * Called when the plugin is unloaded.
	 */
	destroy(): void {
		// Unsubscribe from manager events
		if (this.unsubscribeFromManager) {
			this.unsubscribeFromManager();
			this.unsubscribeFromManager = null;
		}

		// Clean up Reading View adapters
		clearReadingViewAdapters();

		// Clean up Live Preview manager
		if (this.livePreviewManager) {
			this.livePreviewManager.stop();
			this.livePreviewManager = null;
		}

		this.initialized = false;
	}

	/**
	 * Force refresh all table dropdowns.
	 * Refreshes both Reading View and Live Preview implementations.
	 */
	async refresh(): Promise<void> {
		// Refresh Reading View dropdowns
		refreshReadingViewDropdowns();

		// Refresh Live Preview dropdowns
		if (this.livePreviewManager) {
			await this.livePreviewManager.refreshDefinitions();
		}
	}

	/**
	 * Check if the coordinator is initialized.
	 */
	isInitialized(): boolean {
		return this.initialized;
	}
}
