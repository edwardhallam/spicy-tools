/**
 * BoardView - Custom Obsidian view for Kanban boards
 *
 * Registers as a custom view type and renders the full board.
 * Supports both flat column layout and swimlane layout when swimlaneProperty is configured.
 */

import { ItemView, WorkspaceLeaf, TFile, Menu, Notice } from 'obsidian';
import { BoardManager } from './BoardManager';
import { BoardState, Card, Column, Swimlane } from './types';
import { ColumnComponent } from './ColumnComponent';
import { SwimlaneComponent } from './SwimlaneComponent';

export const KANBAN_VIEW_TYPE = 'spicy-kanban-board';

/**
 * Custom view for displaying Kanban boards.
 */
export class BoardView extends ItemView {
	private boardManager: BoardManager | null = null;
	private boardState: BoardState | null = null;
	private columnComponents: Map<string, ColumnComponent> = new Map();
	private swimlaneComponents: Map<string, SwimlaneComponent> = new Map();
	private boardContentEl: HTMLElement | null = null;
	private folderPath: string = '';
	private unsubscribe: (() => void) | null = null;
	private collapsedSwimlanes: Set<string> = new Set();

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return KANBAN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.boardState?.config.title || 'Kanban Board';
	}

	getIcon(): string {
		return 'layout-dashboard';
	}

	/**
	 * Get the folder path this view is displaying.
	 * Used to detect if a board is already open for a folder.
	 */
	getFolderPath(): string {
		return this.folderPath;
	}

	/**
	 * Initialize the view with a board manager.
	 */
	async setBoard(boardManager: BoardManager, folderPath: string): Promise<void> {
		// Clean up previous board
		if (this.unsubscribe) {
			this.unsubscribe();
		}

		this.boardManager = boardManager;
		this.folderPath = folderPath;

		// Load persisted swimlane collapse state
		this.loadSwimlaneCollapseState();

		// Subscribe to board events
		this.unsubscribe = boardManager.on((event) => {
			this.handleBoardEvent(event);
		});

		// Get initial state and render
		const state = await boardManager.getState();
		if (state) {
			this.boardState = state;
			this.render();
		}
	}

	/**
	 * Handle board events.
	 */
	private handleBoardEvent(event: { type: string; [key: string]: unknown }): void {
		switch (event.type) {
			case 'file-changed':
			case 'card-moved':
			case 'card-created':
			case 'card-archived':
			case 'card-reordered':
				// Refresh the board
				this.refresh();
				break;
		}
	}

	/**
	 * Refresh the board state.
	 */
	async refresh(): Promise<void> {
		if (!this.boardManager) return;

		const state = await this.boardManager.getState();
		if (state) {
			this.boardState = state;
			this.render();
		}
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('spicy-kanban-view');

		this.boardContentEl = container.createDiv({ cls: 'spicy-kanban-container' });

		// If we already have state, render
		if (this.boardState) {
			this.render();
		} else {
			// Show placeholder
			this.boardContentEl.createDiv({
				cls: 'spicy-kanban-empty',
				text: 'Select a board to view',
			});
		}
	}

	async onClose(): Promise<void> {
		// Clean up
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		this.destroyColumns();
		this.destroySwimlanes();
	}

	/**
	 * Render the full board.
	 */
	private render(): void {
		if (!this.boardContentEl || !this.boardState) return;

		// Clear previous content
		this.boardContentEl.empty();
		this.destroyColumns();
		this.destroySwimlanes();

		const { columns, swimlanes, uncategorized, config } = this.boardState;

		// Board header
		const header = this.boardContentEl.createDiv({ cls: 'spicy-kanban-header' });

		const titleEl = header.createDiv({ cls: 'spicy-kanban-title' });
		titleEl.textContent = config.title || 'Kanban Board';

		// Header buttons container (right side)
		const headerButtons = header.createDiv({ cls: 'spicy-kanban-header-buttons' });

		// Config button - opens _board.md in source mode
		const configBtn = headerButtons.createDiv({ cls: 'spicy-kanban-config' });
		configBtn.innerHTML = '&#9881;'; // Gear icon
		configBtn.setAttribute('title', 'Edit board configuration');
		configBtn.addEventListener('click', () => this.openBoardConfig());

		// Refresh button
		const refreshBtn = headerButtons.createDiv({ cls: 'spicy-kanban-refresh' });
		refreshBtn.innerHTML = '&#8635;';
		refreshBtn.setAttribute('title', 'Refresh board');
		refreshBtn.addEventListener('click', () => this.refresh());

		// Check if swimlanes are configured and available
		if (config.swimlaneProperty && swimlanes && swimlanes.length > 0) {
			// Render swimlane layout
			this.renderSwimlanes(swimlanes, columns, config);
		} else {
			// Render flat column layout (original behavior)
			this.renderColumns(columns);

			// Uncategorized column (if any)
			if (uncategorized.length > 0) {
				const uncatColumn: Column = {
					id: '__uncategorized__',
					name: 'Uncategorized',
					cards: uncategorized,
				};
				this.renderColumn(
					this.boardContentEl.querySelector('.spicy-kanban-columns') as HTMLElement,
					uncatColumn
				);
			}
		}
	}

	/**
	 * Open the board configuration file in source/markdown mode.
	 */
	private openBoardConfig(): void {
		const configPath = `${this.folderPath}/_board.md`;
		const configFile = this.app.vault.getAbstractFileByPath(configPath);

		if (configFile && configFile instanceof TFile) {
			// Open in a new tab with source mode
			const leaf = this.app.workspace.getLeaf('tab');
			leaf.openFile(configFile, { state: { mode: 'source' } });
		}
	}

	/**
	 * Render columns in flat layout (no swimlanes).
	 */
	private renderColumns(columns: Column[]): void {
		if (!this.boardContentEl) return;

		// Columns container
		const columnsContainer = this.boardContentEl.createDiv({ cls: 'spicy-kanban-columns' });

		// Render columns
		for (const column of columns) {
			this.renderColumn(columnsContainer, column);
		}
	}

	/**
	 * Render swimlanes layout.
	 */
	private renderSwimlanes(
		swimlanes: Swimlane[],
		columns: Column[],
		config: BoardState['config']
	): void {
		if (!this.boardContentEl || !this.boardState) return;

		// Swimlanes container
		const swimlanesContainer = this.boardContentEl.createDiv({
			cls: 'spicy-kanban-swimlanes',
		});

		// Render column headers row (sticky)
		this.renderColumnHeaders(swimlanesContainer, columns);

		// Render each swimlane
		for (const swimlane of swimlanes) {
			// Apply persisted collapse state
			const isCollapsed = this.collapsedSwimlanes.has(swimlane.id);

			const swimlaneComponent = new SwimlaneComponent({
				swimlane: {
					...swimlane,
					collapsed: isCollapsed,
				},
				columns,
				boardConfig: config,
				app: this.app,
				isCollapsed,
				onCollapse: (id, collapsed) => this.handleSwimlaneCollapse(id, collapsed),
				onCardMove: (card, fromColumn, toColumn, index) => this.handleCardMove(card, toColumn, index),
				onCardReorder: (col, filename, index) =>
					this.handleCardReorder(col, filename, index),
				onCardClick: (card) => this.handleCardClick(card),
				onCardArchive: (card) => this.handleCardArchive(card),
				onAddCard: (col) => this.handleAddCard(col),
			});

			swimlaneComponent.render(swimlanesContainer);
			this.swimlaneComponents.set(swimlane.id, swimlaneComponent);
		}
	}

	/**
	 * Render column headers row for swimlane layout.
	 * These headers stay visible as the user scrolls through swimlanes.
	 */
	private renderColumnHeaders(container: HTMLElement, columns: Column[]): void {
		const headersRow = container.createDiv({ cls: 'spicy-kanban-column-headers' });

		// Empty cell for swimlane name column
		headersRow.createDiv({ cls: 'spicy-kanban-column-header-spacer' });

		// Column headers
		for (const column of columns) {
			const headerCell = headersRow.createDiv({
				cls: 'spicy-kanban-column-header-cell',
				attr: { 'data-column-id': column.id },
			});
			headerCell.textContent = column.name;
		}
	}

	/**
	 * Render a single column.
	 */
	private renderColumn(container: HTMLElement, column: Column): void {
		if (!this.boardState) return;

		const columnComponent = new ColumnComponent({
			column,
			boardConfig: this.boardState.config,
			app: this.app,
			onCardMove: (card, fromColumn, toColumn, index) => this.handleCardMove(card, toColumn, index),
			onCardReorder: (col, filename, index) => this.handleCardReorder(col, filename, index),
			onCardClick: (card) => this.handleCardClick(card),
			onCardArchive: (card) => this.handleCardArchive(card),
			onAddCard: (col) => this.handleAddCard(col),
		});

		columnComponent.render(container);
		this.columnComponents.set(column.id, columnComponent);
	}

	/**
	 * Handle swimlane collapse toggle.
	 * Persists the collapse state for the current board.
	 */
	private handleSwimlaneCollapse(swimlaneId: string, collapsed: boolean): void {
		if (collapsed) {
			this.collapsedSwimlanes.add(swimlaneId);
		} else {
			this.collapsedSwimlanes.delete(swimlaneId);
		}

		// Persist collapse state
		this.saveSwimlaneCollapseState();

		// Update the component if it exists
		const component = this.swimlaneComponents.get(swimlaneId);
		if (component) {
			component.setCollapsed(collapsed);
		}
	}

	/**
	 * Load persisted swimlane collapse state from localStorage.
	 */
	private loadSwimlaneCollapseState(): void {
		if (!this.folderPath) return;

		try {
			const key = `spicy-kanban-collapsed-swimlanes:${this.folderPath}`;
			const stored = localStorage.getItem(key);
			if (stored) {
				const collapsed = JSON.parse(stored) as string[];
				this.collapsedSwimlanes = new Set(collapsed);
			} else {
				this.collapsedSwimlanes = new Set();
			}
		} catch (error) {
			console.error('Spicy Tools: Error loading swimlane collapse state:', error);
			this.collapsedSwimlanes = new Set();
		}
	}

	/**
	 * Save swimlane collapse state to localStorage.
	 */
	private saveSwimlaneCollapseState(): void {
		if (!this.folderPath) return;

		try {
			const key = `spicy-kanban-collapsed-swimlanes:${this.folderPath}`;
			const collapsed = Array.from(this.collapsedSwimlanes);
			localStorage.setItem(key, JSON.stringify(collapsed));
		} catch (error) {
			console.error('Spicy Tools: Error saving swimlane collapse state:', error);
		}
	}

	/**
	 * Handle card move between columns.
	 */
	private async handleCardMove(card: Card, toColumn: string, index?: number): Promise<void> {
		if (!this.boardManager) return;

		await this.boardManager.moveCardToColumn(card.filename + '.md', toColumn, index);
	}

	/**
	 * Handle card reorder within a column.
	 */
	private async handleCardReorder(
		column: string,
		filename: string,
		newIndex: number
	): Promise<void> {
		if (!this.boardManager) return;

		await this.boardManager.reorderCard(column, filename, newIndex);
	}

	/**
	 * Handle card click (open file).
	 */
	private handleCardClick(card: Card): void {
		const file = this.app.vault.getAbstractFileByPath(card.filePath) as TFile | null;
		if (file) {
			this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	/**
	 * Handle card archive.
	 */
	private async handleCardArchive(card: Card): Promise<void> {
		if (!this.boardManager) return;

		await this.boardManager.archiveCard(card.filename + '.md');
		new Notice(`Archived: ${card.title}`);
	}

	/**
	 * Handle add new card.
	 */
	private async handleAddCard(column: string): Promise<void> {
		if (!this.boardManager) return;

		// Prompt for title
		const title = await this.promptForTitle();
		if (!title) return;

		const file = await this.boardManager.createCard(column, title);
		if (file) {
			// Open the new file
			await this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	/**
	 * Prompt user for card title.
	 */
	private promptForTitle(): Promise<string | null> {
		return new Promise((resolve) => {
			// Create a simple prompt modal
			const modal = document.createElement('div');
			modal.className = 'spicy-kanban-prompt-modal';

			const backdrop = document.createElement('div');
			backdrop.className = 'spicy-kanban-prompt-backdrop';

			const content = document.createElement('div');
			content.className = 'spicy-kanban-prompt-content';

			const label = document.createElement('div');
			label.textContent = 'Card title:';

			const input = document.createElement('input');
			input.type = 'text';
			input.className = 'spicy-kanban-prompt-input';
			input.placeholder = 'Enter card title...';

			const buttons = document.createElement('div');
			buttons.className = 'spicy-kanban-prompt-buttons';

			const cancelBtn = document.createElement('button');
			cancelBtn.textContent = 'Cancel';
			cancelBtn.addEventListener('click', () => {
				cleanup();
				resolve(null);
			});

			const createBtn = document.createElement('button');
			createBtn.textContent = 'Create';
			createBtn.className = 'mod-cta';
			createBtn.addEventListener('click', () => {
				const value = input.value.trim();
				cleanup();
				resolve(value || null);
			});

			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					const value = input.value.trim();
					cleanup();
					resolve(value || null);
				} else if (e.key === 'Escape') {
					cleanup();
					resolve(null);
				}
			});

			backdrop.addEventListener('click', () => {
				cleanup();
				resolve(null);
			});

			const cleanup = () => {
				modal.remove();
			};

			buttons.appendChild(cancelBtn);
			buttons.appendChild(createBtn);
			content.appendChild(label);
			content.appendChild(input);
			content.appendChild(buttons);
			modal.appendChild(backdrop);
			modal.appendChild(content);
			document.body.appendChild(modal);

			input.focus();
		});
	}

	/**
	 * Clean up column components.
	 */
	private destroyColumns(): void {
		for (const component of this.columnComponents.values()) {
			component.destroy();
		}
		this.columnComponents.clear();
	}

	/**
	 * Clean up swimlane components.
	 */
	private destroySwimlanes(): void {
		for (const component of this.swimlaneComponents.values()) {
			component.destroy();
		}
		this.swimlaneComponents.clear();
	}
}
