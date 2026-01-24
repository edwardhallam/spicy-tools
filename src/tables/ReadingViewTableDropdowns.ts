/**
 * ReadingViewTableDropdowns - Post-processor based table dropdowns for Reading View
 *
 * Uses Obsidian's registerMarkdownPostProcessor API for reliable table dropdown
 * rendering in Reading View. This approach is more reliable than MutationObserver
 * because the post-processor is called directly by Obsidian when rendering markdown.
 *
 * Key features:
 * - Processes tables as they render (no DOM polling)
 * - Tracks table/row/column indices for persistence
 * - Integrates with TableDropdownAdapter for value persistence
 * - Proper cleanup via MarkdownRenderChild lifecycle
 */

import { Plugin, MarkdownRenderChild, TFile } from 'obsidian';
import { DropdownManager } from '@dropdowns/DropdownManager';
import { TableDropdownAdapter } from './TableDropdownAdapter';
import { TableDropdownDefinition, TableDropdownDefinitions, TableCellContext } from './types';

/**
 * Tracks all adapters created by the post-processor for cleanup.
 * Keyed by "filePath:tableIndex:rowIndex:columnIndex" for lookup.
 */
const adapterRegistry = new Map<string, TableDropdownAdapter>();

/**
 * Interaction lock counter - prevents re-renders while user is interacting.
 * This is a module-level counter shared across all instances.
 */
let interactionLockCount = 0;

/**
 * Acquire an interaction lock.
 */
function acquireLock(): void {
	interactionLockCount++;
}

/**
 * Release an interaction lock.
 */
function releaseLock(): void {
	interactionLockCount = Math.max(0, interactionLockCount - 1);
}

/**
 * Check if any dropdown is being interacted with.
 */
function isLocked(): boolean {
	return interactionLockCount > 0;
}

/**
 * Generate a stable key for an adapter.
 * Format: "filepath:tableIndex:rowIndex:columnIndex"
 */
function makeAdapterKey(
	filePath: string,
	tableIndex: number,
	rowIndex: number,
	columnIndex: number
): string {
	return `${filePath}:${tableIndex}:${rowIndex}:${columnIndex}`;
}

/**
 * MarkdownRenderChild that manages cleanup for table dropdown adapters.
 * Created for each table element processed by the post-processor.
 */
class TableDropdownRenderChild extends MarkdownRenderChild {
	private adapters: TableDropdownAdapter[] = [];

	constructor(containerEl: HTMLElement) {
		super(containerEl);
	}

	/**
	 * Register an adapter for cleanup when this render child is unloaded.
	 */
	addAdapter(adapter: TableDropdownAdapter): void {
		this.adapters.push(adapter);
	}

	/**
	 * Called when the element is removed from DOM or view mode changes.
	 */
	onunload(): void {
		for (const adapter of this.adapters) {
			const context = adapter.getContext();
			const key = makeAdapterKey(
				context.filePath,
				context.tableIndex,
				context.rowIndex,
				context.columnIndex
			);
			adapterRegistry.delete(key);
			adapter.destroy();
		}
		this.adapters = [];
	}
}

/**
 * Register the Reading View table dropdown post-processor.
 *
 * This function should be called once during plugin initialization.
 * It registers a markdown post-processor that processes tables and
 * replaces cells with dropdown widgets where definitions exist.
 *
 * @param plugin - The Obsidian plugin instance
 * @param dropdownManager - The DropdownManager for fetching definitions
 */
export function registerReadingViewTableDropdowns(
	plugin: Plugin,
	dropdownManager: DropdownManager
): void {
	plugin.registerMarkdownPostProcessor(async (el, ctx) => {
		// Skip if locked (user is interacting with a dropdown)
		if (isLocked()) {
			return;
		}

		// Find all tables in this rendered element
		const tables = el.querySelectorAll('table');
		if (tables.length === 0) {
			return;
		}

		// Get the source file path
		const sourcePath = ctx.sourcePath;
		if (!sourcePath) {
			return;
		}

		// Get the file object
		const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
		if (!file || !(file instanceof TFile)) {
			return;
		}

		// Get table dropdown definitions for this file
		const definitions = await dropdownManager.getTableDefinitionsForFile(sourcePath);
		if (!definitions || definitions.definitions.size === 0) {
			return;
		}

		// Track table index across multiple post-processor calls for the same file.
		// The post-processor may be called multiple times (once per section),
		// so we need to determine the global table index.
		//
		// Note: This is a simplified approach. In complex documents, the table index
		// may need adjustment. For most use cases, processing in document order works.
		const globalTableOffset = countPreviousTables(el);

		// Process each table
		tables.forEach((tableEl, localTableIndex) => {
			const tableIndex = globalTableOffset + localTableIndex;
			processTable(
				plugin,
				tableEl as HTMLTableElement,
				tableIndex,
				sourcePath,
				file,
				definitions,
				ctx.addChild.bind(ctx)
			);
		});
	});
}

/**
 * Count tables that appear before this element in the document.
 * Used to calculate global table index when post-processor is called per-section.
 *
 * @param el - The current element being processed
 * @returns Number of tables before this element
 */
function countPreviousTables(el: HTMLElement): number {
	// Walk up to find the container and count prior siblings with tables
	let count = 0;
	let sibling = el.previousElementSibling;

	while (sibling) {
		count += sibling.querySelectorAll('table').length;
		sibling = sibling.previousElementSibling;
	}

	return count;
}

/**
 * Process a single table element, creating dropdown adapters for matching columns.
 *
 * @param plugin - The plugin instance
 * @param tableEl - The table HTML element
 * @param tableIndex - Global index of this table in the file
 * @param sourcePath - Path to the source file
 * @param file - The TFile object
 * @param definitions - Table dropdown definitions
 * @param addChild - Function to register render children for cleanup
 */
function processTable(
	plugin: Plugin,
	tableEl: HTMLTableElement,
	tableIndex: number,
	sourcePath: string,
	file: TFile,
	definitions: TableDropdownDefinitions,
	addChild: (child: MarkdownRenderChild) => void
): void {
	// Create a render child for this table to manage cleanup
	const renderChild = new TableDropdownRenderChild(tableEl);

	// Get column headers from the table
	const headers = getTableHeaders(tableEl);
	if (headers.length === 0) {
		return;
	}

	// Find which columns have dropdown definitions
	const columnDefinitions = new Map<number, TableDropdownDefinition>();
	for (let colIndex = 0; colIndex < headers.length; colIndex++) {
		const header = headers[colIndex];
		const definition = definitions.definitions.get(header);
		if (definition) {
			columnDefinitions.set(colIndex, definition);
		}
	}

	// No dropdown columns in this table
	if (columnDefinitions.size === 0) {
		return;
	}

	// Process data rows (skip header row)
	const tbody = tableEl.querySelector('tbody');
	const rows = tbody
		? tbody.querySelectorAll('tr')
		: tableEl.querySelectorAll('tr:not(:first-child)');

	let hasDropdowns = false;

	rows.forEach((rowEl, rowIndex) => {
		const cells = rowEl.querySelectorAll('td');

		cells.forEach((cellEl, cellIndex) => {
			const definition = columnDefinitions.get(cellIndex);
			if (!definition) return;

			const key = makeAdapterKey(sourcePath, tableIndex, rowIndex, cellIndex);

			// Check if we already have an adapter for this cell
			const existingAdapter = adapterRegistry.get(key);
			if (existingAdapter) {
				// Adapter exists - check if the UI is still in DOM
				const existingDropdown = cellEl.querySelector('.spicy-dropdown');
				if (existingDropdown) {
					return; // Dropdown exists, skip
				}
				// Dropdown was removed - clean up stale adapter
				existingAdapter.destroy();
				adapterRegistry.delete(key);
			}

			// Get current cell value
			const currentValue = cellEl.textContent?.trim() || '';

			// Create adapter for this cell
			const context: TableCellContext = {
				filePath: sourcePath,
				tableIndex,
				rowIndex,
				columnIndex: cellIndex,
				columnName: headers[cellIndex],
				currentValue,
			};

			const adapter = new TableDropdownAdapter(
				plugin.app,
				file,
				context,
				definition
			);

			// Set up interaction callback for lock coordination
			adapter.setInteractionCallback((isInteracting: boolean) => {
				if (isInteracting) {
					acquireLock();
				} else {
					releaseLock();
				}
			});

			// Mount UI into the cell
			adapter.mount(cellEl as HTMLElement);

			// Track adapter
			adapterRegistry.set(key, adapter);
			renderChild.addAdapter(adapter);
			hasDropdowns = true;

			// Mark the cell as having a dropdown
			cellEl.addClass('spicy-dropdown-cell');
		});
	});

	// Only register the render child if we created dropdowns
	if (hasDropdowns) {
		addChild(renderChild);
	}
}

/**
 * Get column headers from a table element.
 *
 * @param tableEl - The table HTML element
 * @returns Array of header text values
 */
function getTableHeaders(tableEl: HTMLTableElement): string[] {
	const headers: string[] = [];

	// Try thead first
	const thead = tableEl.querySelector('thead');
	if (thead) {
		const headerCells = thead.querySelectorAll('th');
		headerCells.forEach((cell) => {
			headers.push(cell.textContent?.trim() || '');
		});
		if (headers.length > 0) return headers;
	}

	// Fallback: first row with th elements
	const firstRow = tableEl.querySelector('tr');
	if (firstRow) {
		const thCells = firstRow.querySelectorAll('th');
		if (thCells.length > 0) {
			thCells.forEach((cell) => {
				headers.push(cell.textContent?.trim() || '');
			});
			return headers;
		}

		// Last resort: first row td elements (some markdown tables render this way)
		const tdCells = firstRow.querySelectorAll('td');
		tdCells.forEach((cell) => {
			headers.push(cell.textContent?.trim() || '');
		});
	}

	return headers;
}

/**
 * Clear all registered adapters.
 * Called during plugin unload or when definitions are reloaded.
 */
export function clearReadingViewAdapters(): void {
	for (const adapter of adapterRegistry.values()) {
		adapter.destroy();
	}
	adapterRegistry.clear();
	interactionLockCount = 0;
}

/**
 * Refresh all reading view dropdowns.
 * Forces re-rendering by clearing adapters; post-processor will re-create them.
 */
export function refreshReadingViewDropdowns(): void {
	clearReadingViewAdapters();
	// Note: The dropdowns will be re-created when the view re-renders.
	// In most cases, Obsidian will automatically re-render when the
	// markdown content changes. For manual refresh, the view can be
	// triggered to re-render via workspace events.
}
