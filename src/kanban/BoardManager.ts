/**
 * BoardManager - Manage Kanban board state
 *
 * Responsible for:
 * - Loading board configuration from _board.md
 * - Tracking cards (files) in the board folder
 * - Watching for file changes
 * - Building board state from config + files
 */

import type { App, TFile, TFolder, TAbstractFile, EventRef } from 'obsidian';
import { parseBoardConfig, updateCollapsedSwimlanesInContent, BOARD_CONFIG_FILENAME } from './BoardParser';
import { CardOrderManager } from './CardOrderManager';
import { BoardConfig, BoardState, Card, Column, Swimlane, BoardManagerEvent } from './types';
import { ParseResult } from '../shared/types';

/**
 * Manages state for a single Kanban board.
 */
export class BoardManager {
	private app: App;
	private folderPath: string;
	private config: BoardConfig | null;
	private cardOrderManager: CardOrderManager | null;
	private collapsedSwimlanes: Set<string>;
	private eventRefs: EventRef[];
	private listeners: Set<(event: BoardManagerEvent) => void>;

	constructor(app: App, folderPath: string) {
		this.app = app;
		this.folderPath = folderPath;
		this.config = null;
		this.cardOrderManager = null;
		this.collapsedSwimlanes = new Set();
		this.eventRefs = [];
		this.listeners = new Set();
	}

	/**
	 * Initialize the board by loading configuration.
	 */
	async initialize(): Promise<ParseResult<BoardState>> {
		// Load board config
		const configPath = this.getConfigPath();
		const configFile = this.app.vault.getAbstractFileByPath(configPath) as TFile | null;

		if (!configFile) {
			return {
				success: false,
				error: `Board configuration not found: ${configPath}`,
			};
		}

		const content = await this.app.vault.read(configFile);
		const configResult = parseBoardConfig(content, configPath);

		if (!configResult.success) {
			return configResult;
		}

		this.config = configResult.data;

		// Initialize card order manager
		this.cardOrderManager = new CardOrderManager(
			this.app,
			configPath,
			this.config.cardOrder
		);

		// Load collapsed swimlanes from config
		if (this.config.collapsedSwimlanes) {
			this.collapsedSwimlanes = new Set(this.config.collapsedSwimlanes);
		}

		// Set up file watchers
		this.setupFileWatchers();

		// Build initial board state
		const state = await this.buildBoardState();

		this.emit({ type: 'board-loaded', path: this.folderPath });

		return { success: true, data: state };
	}

	/**
	 * Clean up resources.
	 */
	destroy(): void {
		for (const ref of this.eventRefs) {
			this.app.vault.offref(ref);
		}
		this.eventRefs = [];

		if (this.cardOrderManager) {
			this.cardOrderManager.destroy();
			this.cardOrderManager = null;
		}

		this.listeners.clear();
	}

	/**
	 * Get the current board state.
	 */
	async getState(): Promise<BoardState | null> {
		if (!this.config) return null;
		return this.buildBoardState();
	}

	/**
	 * Get the board configuration.
	 */
	getConfig(): BoardConfig | null {
		return this.config;
	}

	/**
	 * Move a card to a different column.
	 * Updates frontmatter and card order.
	 *
	 * @param filename - Filename of the card
	 * @param newColumn - Target column value
	 * @param index - Position in target column (default: end)
	 */
	async moveCardToColumn(filename: string, newColumn: string, index?: number): Promise<void> {
		if (!this.config) return;

		const filePath = `${this.folderPath}/${filename}`;
		const file = this.app.vault.getAbstractFileByPath(filePath) as TFile | null;

		if (!file) {
			console.error('Spicy Tools: Card file not found:', filePath);
			return;
		}

		// Get current column for event
		const oldColumn = await this.getCardColumn(file);

		// Update frontmatter
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm[this.config!.columnProperty] = newColumn;
		});

		// Update card order
		if (this.cardOrderManager && oldColumn) {
			this.cardOrderManager.moveCard(filename, oldColumn, newColumn, index);
		}

		// Build card for event
		const card = await this.buildCard(file);
		if (card) {
			this.emit({
				type: 'card-moved',
				card,
				fromColumn: oldColumn || '',
				toColumn: newColumn,
			});
		}
	}

	/**
	 * Reorder a card within a column.
	 *
	 * @param column - Column identifier
	 * @param filename - Filename of the card
	 * @param newIndex - New position in the column
	 */
	async reorderCard(column: string, filename: string, newIndex: number): Promise<void> {
		if (!this.cardOrderManager) return;

		this.cardOrderManager.reorderCard(column, filename, newIndex);

		this.emit({
			type: 'card-reordered',
			column,
			order: this.cardOrderManager.getColumnOrder(column),
		});
	}

	/**
	 * Toggle swimlane collapsed state.
	 *
	 * @param swimlaneId - ID of the swimlane to toggle
	 */
	async toggleSwimlane(swimlaneId: string): Promise<void> {
		const wasCollapsed = this.collapsedSwimlanes.has(swimlaneId);

		if (wasCollapsed) {
			this.collapsedSwimlanes.delete(swimlaneId);
		} else {
			this.collapsedSwimlanes.add(swimlaneId);
		}

		// Persist to _board.md
		await this.saveCollapsedSwimlanes();

		this.emit({
			type: 'swimlane-toggled',
			swimlaneId,
			collapsed: !wasCollapsed,
		});
	}

	/**
	 * Check if a swimlane is collapsed.
	 *
	 * @param swimlaneId - ID of the swimlane
	 * @returns true if the swimlane is collapsed
	 */
	isSwimlaneCollapsed(swimlaneId: string): boolean {
		return this.collapsedSwimlanes.has(swimlaneId);
	}

	/**
	 * Save collapsed swimlanes to _board.md.
	 */
	private async saveCollapsedSwimlanes(): Promise<void> {
		const configPath = this.getConfigPath();
		const configFile = this.app.vault.getAbstractFileByPath(configPath) as TFile | null;

		if (!configFile) {
			console.error('Spicy Tools: Board config file not found:', configPath);
			return;
		}

		const content = await this.app.vault.read(configFile);
		const collapsedArray = Array.from(this.collapsedSwimlanes);
		const updatedContent = updateCollapsedSwimlanesInContent(content, collapsedArray);

		if (updatedContent !== content) {
			await this.app.vault.modify(configFile, updatedContent);
		}
	}

	/**
	 * Archive a card (set archived: true in frontmatter).
	 *
	 * @param filename - Filename of the card
	 */
	async archiveCard(filename: string): Promise<void> {
		const filePath = `${this.folderPath}/${filename}`;
		const file = this.app.vault.getAbstractFileByPath(filePath) as TFile | null;

		if (!file) {
			console.error('Spicy Tools: Card file not found:', filePath);
			return;
		}

		// Update frontmatter
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.archived = true;
		});

		const card = await this.buildCard(file);
		if (card) {
			this.emit({ type: 'card-archived', card });
		}
	}

	/**
	 * Create a new card from template.
	 *
	 * @param column - Target column for the new card
	 * @param title - Title for the new card (becomes filename)
	 * @returns The created file, or null on error
	 */
	async createCard(column: string, title: string): Promise<TFile | null> {
		if (!this.config) return null;

		const filename = this.sanitizeFilename(title) + '.md';
		const filePath = `${this.folderPath}/${filename}`;

		// Check if file already exists
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			console.error('Spicy Tools: File already exists:', filePath);
			return null;
		}

		// Get template content
		let content = '';
		const templatePath = this.config.newCardTemplate;

		if (templatePath) {
			const templateFile = this.app.vault.getAbstractFileByPath(templatePath) as TFile | null;
			if (templateFile) {
				content = await this.app.vault.read(templateFile);
			}
		}

		// Ensure frontmatter with column property
		if (!content.startsWith('---')) {
			content = `---\n${this.config.columnProperty}: ${column}\n---\n\n${content}`;
		} else {
			// Insert column property into existing frontmatter
			const endOfFrontmatter = content.indexOf('---', 3);
			if (endOfFrontmatter !== -1) {
				const beforeEnd = content.substring(0, endOfFrontmatter);
				const afterEnd = content.substring(endOfFrontmatter);
				content = `${beforeEnd}${this.config.columnProperty}: ${column}\n${afterEnd}`;
			}
		}

		// Create the file
		const file = await this.app.vault.create(filePath, content);

		// Add to card order
		if (this.cardOrderManager) {
			this.cardOrderManager.addCard(column, filename);
		}

		const card = await this.buildCard(file);
		if (card) {
			this.emit({ type: 'card-created', card });
		}

		return file;
	}

	/**
	 * Subscribe to board events.
	 */
	on(callback: (event: BoardManagerEvent) => void): () => void {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	/**
	 * Emit an event to listeners.
	 */
	private emit(event: BoardManagerEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (error) {
				console.error('Spicy Tools: Error in board event listener:', error);
			}
		}
	}

	/**
	 * Build the complete board state from current files.
	 */
	private async buildBoardState(): Promise<BoardState> {
		if (!this.config) {
			throw new Error('Board not initialized');
		}

		// Get all markdown files in the folder
		const folder = this.app.vault.getAbstractFileByPath(this.folderPath) as TFolder | null;
		const files: TFile[] = [];

		if (folder && 'children' in folder) {
			for (const child of folder.children) {
				// Check if it's a file (has extension property) and is markdown
				if ('extension' in child &&
					(child as TFile).extension === 'md' &&
					child.name !== BOARD_CONFIG_FILENAME) {
					files.push(child as TFile);
				}
			}
		}

		// Build cards
		const cards: Card[] = [];
		const uncategorized: Card[] = [];
		const columnMap = new Map<string, Card[]>();

		// Initialize columns
		for (const col of this.config.columns) {
			columnMap.set(col, []);
		}

		for (const file of files) {
			const card = await this.buildCard(file);
			if (!card) continue;

			// Skip archived cards
			if (card.archived) continue;

			if (card.columnValue && columnMap.has(card.columnValue)) {
				columnMap.get(card.columnValue)!.push(card);
			} else {
				uncategorized.push(card);
			}
		}

		// Sort cards within columns using card order
		const columns: Column[] = this.config.columns.map((colId) => {
			const colCards = columnMap.get(colId) || [];
			const filenames = colCards.map((c) => c.filename + '.md');
			const sortedFilenames = this.cardOrderManager
				? this.cardOrderManager.getSortedCards(colId, filenames)
				: filenames;

			const sortedCards = sortedFilenames
				.map((fn) => colCards.find((c) => c.filename + '.md' === fn))
				.filter((c): c is Card => c !== undefined);

			return {
				id: colId,
				name: colId,
				cards: sortedCards,
			};
		});

		// Build base state
		const state: BoardState = {
			config: this.config,
			columns,
			uncategorized,
			folderPath: this.folderPath,
		};

		// Build swimlanes if swimlaneProperty is configured
		if (this.config.swimlaneProperty) {
			// Collect all cards from columns
			const allCards: Card[] = [];
			for (const column of columns) {
				allCards.push(...column.cards);
			}

			// Group cards by swimlaneValue
			const swimlaneGroups = new Map<string, Card[]>();

			for (const card of allCards) {
				const swimlaneValue = card.swimlaneValue || 'Uncategorized';
				if (!swimlaneGroups.has(swimlaneValue)) {
					swimlaneGroups.set(swimlaneValue, []);
				}
				swimlaneGroups.get(swimlaneValue)!.push(card);
			}

			// Build swimlanes array with columns structure
			const swimlanes: Swimlane[] = [];

			for (const [name, swimlaneCards] of swimlaneGroups) {
				const swimlaneId = name.toLowerCase().replace(/\s+/g, '-');

				// Build columns for this swimlane (filter cards by swimlane)
				const swimlaneColumns: Column[] = this.config.columns.map((colId) => {
					const columnCards = swimlaneCards.filter((card) => card.columnValue === colId);

					// Sort cards within this swimlane's column
					const filenames = columnCards.map((c) => c.filename + '.md');
					const sortedFilenames = this.cardOrderManager
						? this.cardOrderManager.getSortedCards(colId, filenames)
						: filenames;

					const sortedCards = sortedFilenames
						.map((fn) => columnCards.find((c) => c.filename + '.md' === fn))
						.filter((c): c is Card => c !== undefined);

					return {
						id: colId,
						name: colId,
						cards: sortedCards,
					};
				});

				swimlanes.push({
					id: swimlaneId,
					name,
					collapsed: this.collapsedSwimlanes.has(swimlaneId),
					columns: swimlaneColumns,
				});
			}

			// Sort swimlanes: put "Uncategorized" last
			swimlanes.sort((a, b) => {
				if (a.name === 'Uncategorized') return 1;
				if (b.name === 'Uncategorized') return -1;
				return a.name.localeCompare(b.name);
			});

			state.swimlanes = swimlanes;
		}

		return state;
	}

	/**
	 * Build a Card object from a file.
	 */
	private async buildCard(file: TFile): Promise<Card | null> {
		if (!this.config) return null;

		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter ?? {};

		const title = this.config.cardTitle
			? (frontmatter[this.config.cardTitle] as string) ?? file.basename
			: file.basename;

		const preview = this.config.cardPreview
			? (frontmatter[this.config.cardPreview] as string) ?? undefined
			: undefined;

		const columnValue = frontmatter[this.config.columnProperty] as string | undefined;

		const labels: string[] = [];
		if (this.config.labelProperty) {
			const labelValue = frontmatter[this.config.labelProperty];
			if (Array.isArray(labelValue)) {
				labels.push(...labelValue.map(String));
			} else if (typeof labelValue === 'string') {
				labels.push(labelValue);
			}
		}

		const swimlaneValue = this.config.swimlaneProperty
			? (frontmatter[this.config.swimlaneProperty] as string) ?? null
			: null;

		const archived = frontmatter.archived === true;

		return {
			filePath: file.path,
			filename: file.basename,
			title,
			preview,
			labels,
			columnValue: columnValue ?? null,
			swimlaneValue,
			archived,
		};
	}

	/**
	 * Get the column value for a card.
	 */
	private async getCardColumn(file: TFile): Promise<string | null> {
		if (!this.config) return null;

		const cache = this.app.metadataCache.getFileCache(file);
		return (cache?.frontmatter?.[this.config.columnProperty] as string) ?? null;
	}

	/**
	 * Set up file watchers for the board folder.
	 */
	private setupFileWatchers(): void {
		// Watch for file modifications (frontmatter changes)
		const modifyRef = this.app.vault.on('modify', (file) => {
			if (this.isInBoardFolder(file)) {
				this.emit({ type: 'file-changed', filePath: file.path });
			}
		});
		this.eventRefs.push(modifyRef);

		// Watch for file deletions
		const deleteRef = this.app.vault.on('delete', (file) => {
			if (this.isInBoardFolder(file)) {
				// Remove from card order
				if (this.cardOrderManager) {
					this.cardOrderManager.removeCardFromAll(file.name);
				}
				this.emit({ type: 'file-changed', filePath: file.path });
			}
		});
		this.eventRefs.push(deleteRef);

		// Watch for file renames
		const renameRef = this.app.vault.on('rename', (file, oldPath) => {
			const wasInFolder = oldPath.startsWith(this.folderPath + '/');
			const isInFolder = this.isInBoardFolder(file);

			if (wasInFolder || isInFolder) {
				// Update card order
				if (this.cardOrderManager && wasInFolder && isInFolder) {
					const oldName = oldPath.split('/').pop() || '';
					this.cardOrderManager.handleRename(oldName, file.name);
				}
				this.emit({ type: 'file-changed', filePath: file.path });
			}
		});
		this.eventRefs.push(renameRef);

		// Watch for new files
		const createRef = this.app.vault.on('create', (file) => {
			if (this.isInBoardFolder(file) && file.name !== BOARD_CONFIG_FILENAME) {
				this.emit({ type: 'file-changed', filePath: file.path });
			}
		});
		this.eventRefs.push(createRef);
	}

	/**
	 * Check if a file is in this board's folder.
	 */
	private isInBoardFolder(file: TAbstractFile): boolean {
		return file.path.startsWith(this.folderPath + '/') &&
			!file.path.substring(this.folderPath.length + 1).includes('/');
	}

	/**
	 * Get the path to the board config file.
	 */
	private getConfigPath(): string {
		return `${this.folderPath}/${BOARD_CONFIG_FILENAME}`;
	}

	/**
	 * Sanitize a string to be used as a filename.
	 */
	private sanitizeFilename(name: string): string {
		return name
			.replace(/[\\/:*?"<>|]/g, '-')  // Only truly invalid filesystem chars
			.replace(/\s+/g, ' ')            // Collapse multiple spaces (don't convert to dash)
			.trim()                          // Remove leading/trailing spaces
			.substring(0, 100);
	}

}

/**
 * Factory to create board managers.
 */
export class BoardManagerFactory {
	private app: App;
	private managers: Map<string, BoardManager>;

	constructor(app: App) {
		this.app = app;
		this.managers = new Map();
	}

	/**
	 * Get or create a board manager for a folder.
	 */
	async getManager(folderPath: string): Promise<BoardManager | null> {
		// Check if manager already exists
		if (this.managers.has(folderPath)) {
			return this.managers.get(folderPath)!;
		}

		// Check if folder has a _board.md
		const configPath = `${folderPath}/${BOARD_CONFIG_FILENAME}`;
		const configFile = this.app.vault.getAbstractFileByPath(configPath);

		if (!configFile) {
			return null;
		}

		// Create and initialize manager
		const manager = new BoardManager(this.app, folderPath);
		const result = await manager.initialize();

		if (!result.success) {
			console.error('Spicy Tools: Failed to initialize board:', result.error);
			return null;
		}

		this.managers.set(folderPath, manager);
		return manager;
	}

	/**
	 * Clean up all managers.
	 */
	destroyAll(): void {
		for (const manager of this.managers.values()) {
			manager.destroy();
		}
		this.managers.clear();
	}
}
