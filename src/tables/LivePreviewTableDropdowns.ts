/**
 * LivePreviewTableDropdowns - DOM-based table dropdowns for Live Preview
 *
 * In Live Preview, Obsidian renders tables as HTML <table> elements using
 * its own CM6 decorations. This means we can't use CM6 text decorations
 * to replace cell content - those positions are inside Obsidian's table widget.
 *
 * Instead, we use a ViewPlugin that:
 * 1. Observes the rendered DOM for table elements
 * 2. Finds cells in columns matching dropdown definitions
 * 3. Replaces cell content with dropdown widgets
 * 4. On value change, updates the document via CM6 transactions
 *
 * This is similar to Reading View but integrated with CM6's update lifecycle.
 */

import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import type { Plugin } from 'obsidian';
import { DropdownManager } from '@dropdowns/DropdownManager';
import { TableDropdownWidget, TableDropdownWidgetConfig } from './TableDropdownWidget';
import { parseTablesFromMarkdown } from './TableParser';
import { TableDropdownDefinitions } from './types';

/**
 * Track mounted widgets for cleanup.
 */
interface MountedWidget {
	widget: TableDropdownWidget;
	cell: HTMLTableCellElement;
	columnName: string;
	rowIndex: number;
	cellMousedownHandler: (e: Event) => void;
}

/**
 * Create the ViewPlugin for Live Preview table dropdowns.
 *
 * Uses DOM observation to find rendered tables and inject dropdowns.
 */
function createLivePreviewTablePlugin(
	getDefinitions: () => TableDropdownDefinitions | null,
	getEditorView: () => EditorView | null
) {
	return ViewPlugin.fromClass(
		class {
			private mountedWidgets: MountedWidget[] = [];
			private observer: MutationObserver | null = null;
			private view: EditorView;
			private pendingUpdate: number | null = null;

			constructor(view: EditorView) {
				this.view = view;
				this.setupObserver();
				// Initial render with delay to let Obsidian render tables first
				this.scheduleUpdate();
			}

			/**
			 * Set up MutationObserver to watch for table changes.
			 */
			private setupObserver(): void {
				this.observer = new MutationObserver((mutations) => {
					// Check if any mutations affect tables
					const hasTableChanges = mutations.some((m) => {
						if (m.type === 'childList') {
							const hasTable = (nodes: NodeList) =>
								Array.from(nodes).some(
									(n) =>
										n instanceof HTMLElement &&
										(n.tagName === 'TABLE' || n.querySelector?.('table'))
								);
							return hasTable(m.addedNodes) || hasTable(m.removedNodes);
						}
						return false;
					});

					if (hasTableChanges) {
						this.scheduleUpdate();
					}
				});

				// Observe the editor's content DOM
				this.observer.observe(this.view.contentDOM, {
					childList: true,
					subtree: true,
				});
			}

			/**
			 * Schedule an update to process tables.
			 * Debounces rapid changes.
			 */
			private scheduleUpdate(): void {
				if (this.pendingUpdate !== null) {
					cancelAnimationFrame(this.pendingUpdate);
				}
				this.pendingUpdate = requestAnimationFrame(() => {
					this.pendingUpdate = null;
					this.processTables();
				});
			}

			/**
			 * Process all tables in the editor and mount dropdowns.
			 */
			private processTables(): void {
				const definitions = getDefinitions();
				if (!definitions || definitions.definitions.size === 0) {
					this.clearWidgets();
					return;
				}

				// Find all tables in the editor DOM
				const tables = this.view.contentDOM.querySelectorAll('table');
				if (tables.length === 0) {
					this.clearWidgets();
					return;
				}

				// Parse the document to get table structure
				const docContent = this.view.state.doc.toString();
				const parsedTables = parseTablesFromMarkdown(docContent);

				// Clear existing widgets
				this.clearWidgets();

				// Process each table
				tables.forEach((tableEl, tableIndex) => {
					const parsed = parsedTables[tableIndex];
					if (!parsed) return;

					// Find header row to determine column mapping
					const headerRow = tableEl.querySelector('thead tr, tr:first-child');
					if (!headerRow) return;

					const headers = Array.from(headerRow.querySelectorAll('th, td')).map(
						(cell) => cell.textContent?.trim() || ''
					);

					// Build column index -> definition map
					const columnDefinitions = new Map<number, { name: string; def: { options: (string | number)[]; multi?: boolean } }>();
					headers.forEach((header, colIndex) => {
						const def = definitions.definitions.get(header);
						if (def) {
							columnDefinitions.set(colIndex, { name: header, def });
						}
					});

					if (columnDefinitions.size === 0) return;

					// Process body rows
					const bodyRows = tableEl.querySelectorAll('tbody tr, tr:not(:first-child)');
					bodyRows.forEach((row, rowIndex) => {
						// Skip separator row (the --- row)
						if (rowIndex === 0 && parsed.cells.length > 0) {
							// In rendered HTML, separator row is not present
							// So rowIndex 0 in DOM = row 0 in parsed.cells
						}

						const cells = row.querySelectorAll('td');
						cells.forEach((cell, colIndex) => {
							const colInfo = columnDefinitions.get(colIndex);
							if (!colInfo) return;

							// Get parsed cell data for position information
							const parsedRow = parsed.cells[rowIndex];
							if (!parsedRow) return;

							const parsedCell = parsedRow[colIndex];
							if (!parsedCell) return;

							// Mount dropdown widget
							this.mountDropdown(
								cell as HTMLTableCellElement,
								colInfo.name,
								colInfo.def,
								parsedCell,
								rowIndex
							);
						});
					});
				});
			}

			/**
			 * Mount a dropdown widget in a table cell.
			 */
			private mountDropdown(
				cell: HTMLTableCellElement,
				columnName: string,
				definition: { options: (string | number)[]; multi?: boolean },
				parsedCell: { content: string; line: number; startChar: number; endChar: number },
				rowIndex: number
			): void {
				// Calculate document position for this cell
				const doc = this.view.state.doc;
				const lineInfo = doc.line(parsedCell.line + 1);
				const from = lineInfo.from + parsedCell.startChar;
				const to = lineInfo.from + parsedCell.endChar;

				const config: TableDropdownWidgetConfig = {
					options: definition.options,
					currentValue: parsedCell.content,
					multi: definition.multi,
					onChange: (newValue: string) => {
						this.handleValueChange(from, to, newValue);
					},
				};

				// CRITICAL: Add event handlers to cell itself to prevent Obsidian's
				// table cell editor from activating. Use capture phase and
				// stopImmediatePropagation to ensure we intercept before Obsidian.
				// Handle both mousedown and pointerdown since Obsidian may use either.
				const cellMousedownHandler = (e: Event) => {
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();
				};
				cell.addEventListener('mousedown', cellMousedownHandler, { capture: true });
				cell.addEventListener('pointerdown', cellMousedownHandler, { capture: true });

				// Clear cell content and mount widget
				cell.textContent = '';
				const widget = new TableDropdownWidget(cell, config);
				widget.render();

				this.mountedWidgets.push({
					widget,
					cell,
					columnName,
					rowIndex,
					cellMousedownHandler, // Store for cleanup
				});
			}

			/**
			 * Handle value change by updating the document.
			 */
			private handleValueChange(from: number, to: number, newValue: string): void {
				// Format value with padding
				const paddedValue = newValue.length > 0 ? ` ${newValue} ` : ' ';

				// Dispatch transaction to update document
				this.view.dispatch({
					changes: {
						from,
						to,
						insert: paddedValue,
					},
				});
			}

			/**
			 * Clear all mounted widgets.
			 */
			private clearWidgets(): void {
				for (const mounted of this.mountedWidgets) {
					// Remove cell event handlers (must use same capture option as when adding)
					mounted.cell.removeEventListener('mousedown', mounted.cellMousedownHandler, { capture: true });
					mounted.cell.removeEventListener('pointerdown', mounted.cellMousedownHandler, { capture: true });
					mounted.widget.destroy();
				}
				this.mountedWidgets = [];
			}

			/**
			 * Called on editor updates.
			 */
			update(update: ViewUpdate): void {
				// Re-process tables when document changes or viewport changes
				if (update.docChanged || update.viewportChanged) {
					this.scheduleUpdate();
				}
			}

			/**
			 * Clean up on destroy.
			 */
			destroy(): void {
				if (this.pendingUpdate !== null) {
					cancelAnimationFrame(this.pendingUpdate);
				}
				if (this.observer) {
					this.observer.disconnect();
					this.observer = null;
				}
				this.clearWidgets();
			}
		}
	);
}

/**
 * Manager class for Live Preview table dropdowns.
 */
export class LivePreviewTableDropdownManager {
	private plugin: Plugin;
	private dropdownManager: DropdownManager;
	private extension: Extension | null = null;
	private currentDefinitions: TableDropdownDefinitions | null = null;
	private unsubscribe: (() => void) | null = null;

	constructor(plugin: Plugin, dropdownManager: DropdownManager) {
		this.plugin = plugin;
		this.dropdownManager = dropdownManager;
	}

	/**
	 * Start the manager and register the editor extension.
	 */
	start(): void {
		// Create the ViewPlugin with getters for definitions
		const viewPlugin = createLivePreviewTablePlugin(
			() => this.currentDefinitions,
			() => null // Not needed for this implementation
		);

		this.extension = viewPlugin;

		// Register with Obsidian
		this.plugin.registerEditorExtension(this.extension);

		// Subscribe to definition changes
		this.unsubscribe = this.dropdownManager.on((event) => {
			if (
				event.type === 'definitions-loaded' ||
				event.type === 'definitions-cleared'
			) {
				this.refreshDefinitions();
			}
		});

		// Initial definition load
		this.refreshDefinitions();
	}

	/**
	 * Stop the manager and clean up.
	 */
	stop(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		this.extension = null;
		this.currentDefinitions = null;
	}

	/**
	 * Refresh definitions from the dropdown manager.
	 */
	async refreshDefinitions(): Promise<void> {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile) {
			this.currentDefinitions = null;
			return;
		}

		this.currentDefinitions = await this.dropdownManager.getTableDefinitionsForFile(
			activeFile.path
		);
	}
}

/**
 * Register the Live Preview table dropdown feature.
 */
export function registerLivePreviewTableDropdowns(
	plugin: Plugin,
	dropdownManager: DropdownManager
): LivePreviewTableDropdownManager {
	const manager = new LivePreviewTableDropdownManager(plugin, dropdownManager);
	manager.start();
	return manager;
}
