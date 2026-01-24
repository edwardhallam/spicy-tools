/**
 * BoardEmbed - Embeddable Kanban board for markdown code blocks
 *
 * Renders a Kanban board inline within a markdown note using the syntax:
 * ```kanban
 * folder: path/to/board
 * height: 400
 * ```
 */

import type { App, TFile } from 'obsidian';
import { Notice } from 'obsidian';
import { BoardManager, BoardManagerFactory } from './BoardManager';
import { BoardState, Card, Column } from './types';
import { ColumnComponent } from './ColumnComponent';

/**
 * Default height for embedded boards in pixels.
 */
export const DEFAULT_EMBED_HEIGHT = 300;

/**
 * Counter for generating unique embed IDs.
 */
let embedIdCounter = 0;

/**
 * Reset the embed ID counter (useful for testing).
 */
export function resetEmbedIdCounter(): void {
	embedIdCounter = 0;
}

/**
 * Generate a unique ID for an embed instance.
 * IDs are suitable for use as DOM attributes.
 */
export function generateEmbedId(): string {
	embedIdCounter++;
	return `spicy-board-embed-${embedIdCounter}`;
}

export interface BoardEmbedOptions {
	/** Height in pixels (default: 300px) */
	height?: number;
	/** Maximum height before scrolling (deprecated, use height) */
	maxHeight?: number;
	/** Show/hide the board title (default: true) */
	showTitle?: boolean;
	/** Compact mode with smaller cards (default: false) */
	compact?: boolean;
}

/**
 * Result of parsing embed source.
 */
export interface ParseSourceResult {
	folderPath: string;
	options: BoardEmbedOptions;
	error?: string;
}

/**
 * Parse the code block source to extract folder path and options.
 * Exported for testing.
 */
export function parseSource(source: string): ParseSourceResult {
	// Handle empty source
	if (!source || !source.trim()) {
		return {
			folderPath: '',
			options: { height: DEFAULT_EMBED_HEIGHT },
			error: 'Empty source: specify at least "folder: path/to/folder"',
		};
	}

	const lines = source.trim().split('\n');
	let folderPath = '';
	const options: BoardEmbedOptions = {
		height: DEFAULT_EMBED_HEIGHT,
	};

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		if (trimmed.startsWith('folder:')) {
			folderPath = trimmed.slice(7).trim();
		} else if (trimmed.startsWith('height:')) {
			const heightNum = parseInt(trimmed.slice(7).trim(), 10);
			if (!isNaN(heightNum) && heightNum > 0) {
				options.height = heightNum;
			}
		} else if (trimmed.startsWith('maxHeight:')) {
			// Support legacy maxHeight option
			const heightNum = parseInt(trimmed.slice(10).trim(), 10);
			if (!isNaN(heightNum) && heightNum > 0) {
				options.maxHeight = heightNum;
			}
		} else if (trimmed.startsWith('showTitle:')) {
			options.showTitle = trimmed.slice(10).trim().toLowerCase() === 'true';
		} else if (trimmed.startsWith('compact:')) {
			options.compact = trimmed.slice(8).trim().toLowerCase() === 'true';
		}
	}

	// Build result
	const result: ParseSourceResult = { folderPath, options };

	// Check for missing folder
	if (!folderPath) {
		result.error = 'Missing folder path';
	}

	return result;
}

/**
 * Embedded Kanban board component for markdown code blocks.
 */
export class BoardEmbed {
	private app: App;
	private boardManagerFactory: BoardManagerFactory;
	private containerEl: HTMLElement;
	private source: string;
	private boardManager: BoardManager | null = null;
	private boardState: BoardState | null = null;
	private columnComponents: Map<string, ColumnComponent> = new Map();
	private unsubscribe: (() => void) | null = null;
	private folderPath: string = '';
	private options: BoardEmbedOptions = {};

	/** Unique ID for this embed instance, suitable for DOM attributes */
	readonly embedId: string;

	constructor(
		app: App,
		boardManagerFactory: BoardManagerFactory,
		containerEl: HTMLElement,
		source: string
	) {
		this.app = app;
		this.boardManagerFactory = boardManagerFactory;
		this.containerEl = containerEl;
		this.source = source;
		this.embedId = generateEmbedId();
	}

	/**
	 * Render the embedded board.
	 */
	async render(): Promise<void> {
		// Parse source
		const { folderPath, options } = parseSource(this.source);
		this.folderPath = folderPath;
		this.options = options;

		// Set up container with embed class and scoped ID
		this.containerEl.empty();
		this.containerEl.addClass('spicy-kanban-embed');
		this.containerEl.setAttribute('data-embed-id', this.embedId);

		// Apply height (prefer height over maxHeight)
		const effectiveHeight = options.height || options.maxHeight || DEFAULT_EMBED_HEIGHT;
		this.containerEl.style.height = `${effectiveHeight}px`;

		if (options.compact) {
			this.containerEl.addClass('spicy-kanban-embed-compact');
		}

		// Validate folder path
		if (!folderPath) {
			this.renderError('No folder specified. Use: folder: path/to/board');
			return;
		}

		// Get board manager
		try {
			this.boardManager = await this.boardManagerFactory.getManager(folderPath);
			if (!this.boardManager) {
				this.renderError(`No board found in: ${folderPath}`);
				return;
			}

			// Subscribe to board events
			this.unsubscribe = this.boardManager.on((event) => {
				this.handleBoardEvent(event);
			});

			// Get initial state
			this.boardState = await this.boardManager.getState();
			if (!this.boardState) {
				this.renderError('Failed to load board state');
				return;
			}

			this.renderBoard();
		} catch (error) {
			this.renderError(`Error loading board: ${error}`);
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
			this.renderBoard();
		}
	}

	/**
	 * Render error message.
	 */
	private renderError(message: string): void {
		this.containerEl.empty();
		const errorEl = this.containerEl.createDiv({ cls: 'spicy-kanban-embed-error' });
		errorEl.textContent = message;
	}

	/**
	 * Render the board content.
	 */
	private renderBoard(): void {
		if (!this.boardState) return;

		this.containerEl.empty();
		this.destroyColumns();

		const { columns, uncategorized, config } = this.boardState;

		// Board header
		const header = this.containerEl.createDiv({ cls: 'spicy-kanban-header' });

		if (this.options.showTitle !== false) {
			const titleEl = header.createDiv({ cls: 'spicy-kanban-title' });
			titleEl.textContent = config.title || 'Kanban Board';
		}

		// Refresh button
		const refreshBtn = header.createDiv({ cls: 'spicy-kanban-refresh' });
		refreshBtn.innerHTML = '&#8635;';
		refreshBtn.setAttribute('title', 'Refresh board');
		refreshBtn.addEventListener('click', () => this.refresh());

		// Columns container
		const columnsContainer = this.containerEl.createDiv({ cls: 'spicy-kanban-columns' });

		// Render columns
		for (const column of columns) {
			this.renderColumn(columnsContainer, column);
		}

		// Uncategorized column
		if (uncategorized.length > 0) {
			const uncatColumn: Column = {
				id: '__uncategorized__',
				name: 'Uncategorized',
				cards: uncategorized,
			};
			this.renderColumn(columnsContainer, uncatColumn);
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
			onCardMove: (card, fromColumn, toColumn) => this.handleCardMove(card, toColumn),
			onCardReorder: (col, filename, index) => this.handleCardReorder(col, filename, index),
			onCardClick: (card) => this.handleCardClick(card),
			onCardArchive: (card) => this.handleCardArchive(card),
			onAddCard: (col) => this.handleAddCard(col),
		});

		const columnEl = columnComponent.render(container);

		// Scope drag-and-drop data to this embed
		this.scopeDragData(columnEl);

		this.columnComponents.set(column.id, columnComponent);
	}

	/**
	 * Scope drag data to this embed to prevent conflicts with other embeds.
	 *
	 * When multiple kanban embeds exist on the same page, we need to ensure
	 * that cards can only be dragged within their own board. This is done by
	 * prefixing drag data with the embed ID.
	 */
	private scopeDragData(columnEl: HTMLElement): void {
		// Override dragstart on cards to prefix with embed ID
		const cards = columnEl.querySelectorAll('.spicy-kanban-card');
		cards.forEach((card) => {
			card.addEventListener(
				'dragstart',
				(e) => {
					const event = e as DragEvent;
					if (event.dataTransfer) {
						const filename = card.getAttribute('data-filename');
						if (filename) {
							// Prefix with embed ID for scoping
							event.dataTransfer.setData('text/plain', `${this.embedId}:${filename}`);
						}
					}
				},
				true // Capture phase to run before CardComponent's handler
			);
		});

		// Override drop on cards container to validate embed ID
		const cardsContainer = columnEl.querySelector('.spicy-kanban-column-cards');
		if (cardsContainer) {
			cardsContainer.addEventListener(
				'drop',
				(e) => {
					const event = e as DragEvent;
					const data = event.dataTransfer?.getData('text/plain');

					// Check if data is from this embed
					if (data && !data.startsWith(this.embedId + ':')) {
						// Prevent drop from other embeds or non-scoped sources
						e.stopPropagation();
						e.preventDefault();
					}
				},
				true // Capture phase
			);
		}
	}

	/**
	 * Handle card move between columns.
	 */
	private async handleCardMove(card: Card, toColumn: string): Promise<void> {
		if (!this.boardManager) return;
		await this.boardManager.moveCardToColumn(card.filename + '.md', toColumn);
	}

	/**
	 * Handle card reorder within a column.
	 */
	private async handleCardReorder(column: string, filename: string, newIndex: number): Promise<void> {
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

		const title = await this.promptForTitle();
		if (!title) return;

		const file = await this.boardManager.createCard(column, title);
		if (file) {
			await this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	/**
	 * Prompt user for card title.
	 */
	private promptForTitle(): Promise<string | null> {
		return new Promise((resolve) => {
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
	 * Clean up the embed component.
	 */
	destroy(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.destroyColumns();
		this.containerEl.empty();
	}
}
