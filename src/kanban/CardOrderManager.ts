/**
 * CardOrderManager - Manage card ordering within columns
 *
 * Handles persisting and retrieving card order in the _board.md file.
 * Card order is stored per-column as arrays of filenames.
 */

import type { App, TFile } from 'obsidian';
import { BoardConfig } from './types';
import { BOARD_CONFIG_FILENAME, updateCardOrderInContent } from './BoardParser';

/**
 * Manages card ordering for a Kanban board.
 */
export class CardOrderManager {
	private app: App;
	private boardPath: string;
	private cardOrder: Record<string, string[]>;
	private isDirty: boolean;
	private saveTimeout: NodeJS.Timeout | null;

	constructor(app: App, boardPath: string, initialOrder?: Record<string, string[]>) {
		this.app = app;
		this.boardPath = boardPath;
		this.cardOrder = initialOrder ?? {};
		this.isDirty = false;
		this.saveTimeout = null;
	}

	/**
	 * Get the order of cards in a column.
	 *
	 * @param column - Column identifier
	 * @returns Array of filenames in order
	 */
	getColumnOrder(column: string): string[] {
		return this.cardOrder[column] ?? [];
	}

	/**
	 * Get all card orders.
	 */
	getAllOrders(): Record<string, string[]> {
		return { ...this.cardOrder };
	}

	/**
	 * Add a card to the end of a column.
	 *
	 * @param column - Target column
	 * @param filename - Filename of the card
	 */
	addCard(column: string, filename: string): void {
		if (!this.cardOrder[column]) {
			this.cardOrder[column] = [];
		}

		// Remove from any existing position
		this.removeCardFromAll(filename);

		// Add to end of column
		this.cardOrder[column].push(filename);
		this.markDirty();
	}

	/**
	 * Move a card to a different column.
	 *
	 * @param filename - Filename of the card
	 * @param fromColumn - Source column
	 * @param toColumn - Target column
	 * @param index - Position in target column (default: end)
	 */
	moveCard(
		filename: string,
		fromColumn: string,
		toColumn: string,
		index?: number
	): void {
		// Defensive: remove from ALL columns to prevent duplicates
		// This handles cases where cardOrder is out of sync with frontmatter
		this.removeCardFromAll(filename);

		// Add to target column
		if (!this.cardOrder[toColumn]) {
			this.cardOrder[toColumn] = [];
		}

		if (index !== undefined && index >= 0 && index < this.cardOrder[toColumn].length) {
			this.cardOrder[toColumn].splice(index, 0, filename);
		} else {
			this.cardOrder[toColumn].push(filename);
		}

		this.markDirty();
	}

	/**
	 * Reorder a card within the same column.
	 *
	 * @param column - Column identifier
	 * @param filename - Filename of the card
	 * @param newIndex - New position in the column
	 */
	reorderCard(column: string, filename: string, newIndex: number): void {
		const order = this.cardOrder[column];
		if (!order) return;

		const currentIndex = order.indexOf(filename);
		if (currentIndex === -1) return;

		// Remove from current position
		order.splice(currentIndex, 1);

		// Insert at new position
		const adjustedIndex = Math.min(Math.max(0, newIndex), order.length);
		order.splice(adjustedIndex, 0, filename);

		this.markDirty();
	}

	/**
	 * Remove a card from a specific column.
	 *
	 * @param filename - Filename of the card
	 * @param column - Column to remove from
	 */
	removeCardFromColumn(filename: string, column: string): void {
		const order = this.cardOrder[column];
		if (!order) return;

		const index = order.indexOf(filename);
		if (index !== -1) {
			order.splice(index, 1);
			this.markDirty();
		}
	}

	/**
	 * Remove a card from all columns.
	 * Used when a card is deleted or moved to a new column.
	 *
	 * @param filename - Filename of the card
	 */
	removeCardFromAll(filename: string): void {
		for (const column of Object.keys(this.cardOrder)) {
			const order = this.cardOrder[column];
			const index = order.indexOf(filename);
			if (index !== -1) {
				order.splice(index, 1);
			}
		}
		// Note: Don't mark dirty here as this is often called before adding elsewhere
	}

	/**
	 * Handle a file rename by updating the order.
	 *
	 * @param oldFilename - Old filename
	 * @param newFilename - New filename
	 */
	handleRename(oldFilename: string, newFilename: string): void {
		for (const column of Object.keys(this.cardOrder)) {
			const order = this.cardOrder[column];
			const index = order.indexOf(oldFilename);
			if (index !== -1) {
				order[index] = newFilename;
				this.markDirty();
			}
		}
	}

	/**
	 * Clean up orders by removing files that no longer exist.
	 *
	 * @param existingFiles - Set of filenames that currently exist
	 */
	cleanupOrders(existingFiles: Set<string>): void {
		let cleaned = false;

		for (const column of Object.keys(this.cardOrder)) {
			const order = this.cardOrder[column];
			const newOrder = order.filter((f) => existingFiles.has(f));

			if (newOrder.length !== order.length) {
				this.cardOrder[column] = newOrder;
				cleaned = true;
			}
		}

		if (cleaned) {
			this.markDirty();
		}
	}

	/**
	 * Get the sorted list of cards for a column.
	 * Cards not in the order are appended at the end.
	 *
	 * @param column - Column identifier
	 * @param allCards - All cards that belong to this column
	 * @returns Sorted array of filenames
	 */
	getSortedCards(column: string, allCards: string[]): string[] {
		const order = this.cardOrder[column] ?? [];
		const orderSet = new Set(order);

		// Start with cards that have explicit order
		const result = order.filter((f) => allCards.includes(f));

		// Append cards not in order
		for (const card of allCards) {
			if (!orderSet.has(card)) {
				result.push(card);
			}
		}

		return result;
	}

	/**
	 * Mark the order as needing to be saved.
	 */
	private markDirty(): void {
		this.isDirty = true;
		this.scheduleSave();
	}

	/**
	 * Schedule a debounced save.
	 */
	private scheduleSave(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}

		// Debounce saves to avoid excessive file writes during drag operations
		this.saveTimeout = setTimeout(() => {
			this.save();
		}, 500);
	}

	/**
	 * Persist the current order to the _board.md file.
	 */
	async save(): Promise<void> {
		if (!this.isDirty) return;

		try {
			const configFile = this.app.vault.getAbstractFileByPath(this.boardPath) as TFile | null;

			if (!configFile) {
				console.error('Spicy Tools: Board config file not found:', this.boardPath);
				return;
			}

			const content = await this.app.vault.read(configFile);
			const newContent = updateCardOrderInContent(content, this.cardOrder);

			await this.app.vault.modify(configFile, newContent);
			this.isDirty = false;
		} catch (error) {
			console.error('Spicy Tools: Error saving card order:', error);
		}
	}

	/**
	 * Force an immediate save.
	 */
	async forceSave(): Promise<void> {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
		await this.save();
	}

	/**
	 * Clean up resources.
	 */
	destroy(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}

		// Force save any pending changes
		if (this.isDirty) {
			this.save();
		}
	}
}
