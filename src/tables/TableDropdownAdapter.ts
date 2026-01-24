/**
 * TableDropdownAdapter - Bridge between DropdownUI and Table Persistence
 *
 * Bridges UI events to markdown table cell updates.
 * Key design decisions:
 * - Reads current value from cell element on mount
 * - Uses TablePersistence for writing changes to markdown source
 * - Queues external updates if UI is open
 */

import type { App, TFile } from 'obsidian';
import { DropdownUI, DropdownUIConfig, DropdownUIEvents, DropdownValue } from '@dropdowns/DropdownUI';
import { TableCellContext, TableDropdownDefinition } from './types';
import { updateTableCell, parseMultiValue, formatCellValue } from './TablePersistence';

/**
 * Callback invoked when the adapter's interaction state changes.
 */
export type InteractionCallback = (isInteracting: boolean) => void;

/**
 * Adapts the DropdownUI component to work with markdown table cells.
 */
export class TableDropdownAdapter {
	private app: App;
	private file: TFile;
	private context: TableCellContext;
	private definition: TableDropdownDefinition;
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
		context: TableCellContext,
		definition: TableDropdownDefinition
	) {
		this.app = app;
		this.file = file;
		this.context = context;
		this.definition = definition;
	}

	/**
	 * Mount the dropdown UI into a table cell element.
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
	 * Get the cell context this adapter manages.
	 */
	getContext(): TableCellContext {
		return this.context;
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
	 * Get current value from the cell context.
	 * For multi-select, parses comma-separated values.
	 */
	private getCurrentValue(): DropdownValue {
		const cellContent = this.context.currentValue;

		if (!cellContent || cellContent.trim() === '') {
			return this.definition.multi ? [] : null;
		}

		if (this.definition.multi) {
			// Parse comma-separated values
			return parseMultiValue(cellContent);
		}

		// Single value - check if it's a number
		const numericOption = this.definition.options.find(
			(opt) => typeof opt === 'number' && String(opt) === cellContent
		);
		if (numericOption !== undefined) {
			return numericOption as number;
		}

		return cellContent;
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
			this.writeCell(this.pendingValue);
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
	 * For multi-select, defers write until dropdown closes.
	 */
	private handleChange(newValue: DropdownValue): void {
		if (this.isDestroyed) return;

		// For multi-select, defer the write until dropdown closes
		if (this.definition.multi) {
			this.pendingValue = newValue;
			this.hasPendingValue = true;
			return;
		}

		// For single-select, write immediately
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
		}

		this.updateDebounceTimer = setTimeout(() => {
			this.updateDebounceTimer = null;
			this.writeCell(newValue);
		}, TableDropdownAdapter.UPDATE_DEBOUNCE_MS);
	}

	/**
	 * Write value to the markdown table cell.
	 */
	private async writeCell(newValue: DropdownValue): Promise<void> {
		if (this.isDestroyed) return;

		try {
			// Format the value for the cell
			const formattedValue = formatCellValue(newValue);

			// Update the cell in the markdown source
			const result = await updateTableCell(
				this.app,
				this.file,
				this.context.tableIndex,
				this.context.rowIndex,
				this.context.columnIndex,
				formattedValue
			);

			if (!result.success) {
				console.error('Spicy Tools: Error updating table cell:', result.error);
			}

			// Update context with new value
			this.context.currentValue = formattedValue;
		} catch (error) {
			console.error('Spicy Tools: Error updating table cell:', error);
		}
	}

	/**
	 * Refresh the UI from the current cell value.
	 * Called when external changes are detected.
	 */
	refresh(): void {
		if (this.isDestroyed || !this.ui) return;

		// If UI is open, queue the refresh for later
		if (this.ui.isInteracting()) {
			this.pendingRefresh = true;
			return;
		}

		// Update UI with current value
		const currentValue = this.getCurrentValue();
		this.ui.setValue(currentValue);
	}

	/**
	 * Update the file reference (for file renames).
	 */
	updateFile(newFile: TFile): void {
		this.file = newFile;
		this.context.filePath = newFile.path;
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
			this.writeCell(this.pendingValue);
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

		// Restore the original cell text content before releasing container.
		// During mount(), we called container.empty() which removed the text.
		// If we don't restore it, the cell will be empty during view switches.
		if (this.container) {
			this.container.empty();
			this.container.textContent = this.context.currentValue;
		}
		this.container = null;

		this.onInteractionChange = null;
	}
}
