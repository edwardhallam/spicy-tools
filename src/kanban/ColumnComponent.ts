/**
 * ColumnComponent - Renders a column in the Kanban board
 *
 * Manages a vertical list of cards and handles drag-and-drop.
 * Supports both HTML5 drag-and-drop and touch-based drag-and-drop.
 */

import type { App } from 'obsidian';
import { Card, Column, BoardConfig } from './types';
import { CardComponent } from './CardComponent';

/**
 * Custom event types for touch drag-and-drop coordination.
 * CardComponent dispatches these events, ColumnComponent listens.
 */
export interface TouchDragDetail {
	card: Card;
	clientX: number;
	clientY: number;
}

export interface TouchDropDetail {
	card: Card;
	clientX: number;
	clientY: number;
}

/**
 * Configuration for creating a column component.
 */
export interface ColumnComponentConfig {
	column: Column;
	boardConfig: BoardConfig;
	app: App;
	onCardMove?: (card: Card, fromColumn: string, toColumn: string, index?: number) => void;
	onCardReorder?: (column: string, filename: string, newIndex: number) => void;
	onCardClick?: (card: Card) => void;
	onCardArchive?: (card: Card) => void;
	onAddCard?: (column: string) => void;
}

/**
 * Creates and manages a column UI element.
 */
export class ColumnComponent {
	private config: ColumnComponentConfig;
	private element: HTMLElement | null = null;
	private cardsContainer: HTMLElement | null = null;
	private cardComponents: Map<string, CardComponent> = new Map();
	private dropIndicator: HTMLElement | null = null;
	private isTouchDragOver: boolean = false;
	private boundTouchDragMove: ((e: Event) => void) | null = null;
	private boundTouchDragEnd: ((e: Event) => void) | null = null;

	constructor(config: ColumnComponentConfig) {
		this.config = config;
	}

	/**
	 * Render the column into a container.
	 */
	render(container: HTMLElement): HTMLElement {
		const { column } = this.config;

		// Create column element
		this.element = container.createDiv({
			cls: 'spicy-kanban-column',
			attr: {
				'data-column-id': column.id,
			},
		});

		// Header
		const header = this.element.createDiv({ cls: 'spicy-kanban-column-header' });

		const titleEl = header.createDiv({ cls: 'spicy-kanban-column-title' });
		titleEl.textContent = column.name;

		const countEl = header.createDiv({ cls: 'spicy-kanban-column-count' });
		countEl.textContent = String(column.cards.length);

		// Add card button
		const addBtn = header.createDiv({ cls: 'spicy-kanban-column-add' });
		addBtn.textContent = '+';
		addBtn.setAttribute('title', 'Add new card');
		addBtn.addEventListener('click', () => {
			if (this.config.onAddCard) {
				this.config.onAddCard(column.id);
			}
		});

		// Cards container
		this.cardsContainer = this.element.createDiv({ cls: 'spicy-kanban-column-cards' });

		// Render cards
		this.renderCards();

		// Setup drop zone (HTML5 drag-and-drop)
		this.setupDropZone();

		// Setup touch drop zone (mobile touch drag-and-drop)
		this.setupTouchDropZone();

		return this.element;
	}

	/**
	 * Render all cards in the column.
	 */
	private renderCards(): void {
		if (!this.cardsContainer) return;

		const { column, boardConfig, app, onCardClick, onCardArchive } = this.config;

		// Clear existing cards
		this.cardsContainer.empty();
		this.cardComponents.clear();

		// Create card components
		for (const card of column.cards) {
			const cardComponent = new CardComponent({
				card,
				boardConfig,
				app,
				onDragStart: (c) => this.handleDragStart(c),
				onDragEnd: () => this.handleDragEnd(),
				onClick: onCardClick,
				onArchive: onCardArchive,
			});

			cardComponent.render(this.cardsContainer);
			this.cardComponents.set(card.filename, cardComponent);
		}
	}

	/**
	 * Set up the column as a drop zone.
	 */
	private setupDropZone(): void {
		if (!this.cardsContainer) return;

		this.cardsContainer.addEventListener('dragover', (e) => {
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move';
			}

			// Show drop indicator
			this.showDropIndicator(e);
		});

		this.cardsContainer.addEventListener('dragleave', (e) => {
			// Only hide if leaving the container entirely
			if (!this.cardsContainer?.contains(e.relatedTarget as Node)) {
				this.hideDropIndicator();
			}
		});

		this.cardsContainer.addEventListener('drop', (e) => {
			e.preventDefault();
			this.hideDropIndicator();

			const filename = e.dataTransfer?.getData('text/plain');
			if (!filename) return;

			// Calculate drop index
			const dropIndex = this.calculateDropIndex(e);

			// Emit events
			this.handleDrop(filename, dropIndex);
		});
	}

	/**
	 * Set up touch-based drop zone for mobile devices.
	 * Listens for custom events dispatched by CardComponent during touch drag.
	 */
	private setupTouchDropZone(): void {
		if (!this.element) return;

		// Bind event handlers for cleanup
		this.boundTouchDragMove = (e: Event) => this.handleTouchDragMove(e as CustomEvent<TouchDragDetail>);
		this.boundTouchDragEnd = (e: Event) => this.handleTouchDragEnd(e as CustomEvent<TouchDropDetail>);

		// Listen for touch drag events on document (they bubble up from CardComponent)
		document.addEventListener('spicy-touch-drag-move', this.boundTouchDragMove);
		document.addEventListener('spicy-touch-drag-end', this.boundTouchDragEnd);
	}

	/**
	 * Handle touch drag move - check if touch point is over this column.
	 */
	private handleTouchDragMove(e: CustomEvent<TouchDragDetail>): void {
		if (!this.element || !this.cardsContainer) return;

		const { clientX, clientY } = e.detail;
		const rect = this.cardsContainer.getBoundingClientRect();

		// Check if touch point is within this column's cards container
		const isOver =
			clientX >= rect.left &&
			clientX <= rect.right &&
			clientY >= rect.top &&
			clientY <= rect.bottom;

		if (isOver && !this.isTouchDragOver) {
			// Touch entered this column
			this.isTouchDragOver = true;
			this.element.addClass('touch-drag-over');
			this.showTouchDropIndicator(clientX, clientY);
		} else if (!isOver && this.isTouchDragOver) {
			// Touch left this column
			this.isTouchDragOver = false;
			this.element.removeClass('touch-drag-over');
			this.hideDropIndicator();
		} else if (isOver && this.isTouchDragOver) {
			// Touch is moving within this column - update indicator position
			this.showTouchDropIndicator(clientX, clientY);
		}
	}

	/**
	 * Handle touch drag end - process drop if over this column.
	 */
	private handleTouchDragEnd(e: CustomEvent<TouchDropDetail>): void {
		if (!this.element || !this.cardsContainer) return;

		const wasOver = this.isTouchDragOver;
		const { card, clientX, clientY } = e.detail;

		// Reset state
		this.isTouchDragOver = false;
		this.element.removeClass('touch-drag-over');
		this.hideDropIndicator();

		// Only process drop if touch ended over this column
		if (!wasOver) return;

		// Calculate drop index based on touch position
		const dropIndex = this.calculateTouchDropIndex(clientY);

		// Handle the drop
		this.handleDrop(card.filename, dropIndex);
	}

	/**
	 * Show drop indicator at touch position.
	 */
	private showTouchDropIndicator(clientX: number, clientY: number): void {
		if (!this.cardsContainer) return;

		// Create indicator if needed
		if (!this.dropIndicator) {
			this.dropIndicator = document.createElement('div');
			this.dropIndicator.className = 'spicy-kanban-drop-indicator';
		}

		// Calculate position based on touch Y coordinate
		const dropIndex = this.calculateTouchDropIndex(clientY);
		const cards = this.cardsContainer.querySelectorAll('.spicy-kanban-card:not(.touch-dragging)');

		if (cards.length === 0) {
			this.cardsContainer.appendChild(this.dropIndicator);
		} else if (dropIndex >= cards.length) {
			this.cardsContainer.appendChild(this.dropIndicator);
		} else {
			this.cardsContainer.insertBefore(this.dropIndicator, cards[dropIndex]);
		}
	}

	/**
	 * Calculate drop index based on touch Y position.
	 */
	private calculateTouchDropIndex(clientY: number): number {
		if (!this.cardsContainer) return 0;

		const cards = Array.from(
			this.cardsContainer.querySelectorAll('.spicy-kanban-card:not(.touch-dragging)')
		);

		for (let i = 0; i < cards.length; i++) {
			const card = cards[i];
			const rect = card.getBoundingClientRect();
			const midY = rect.top + rect.height / 2;

			if (clientY < midY) {
				return i;
			}
		}

		return cards.length;
	}

	/**
	 * Check if a point is over this column (public method for external use).
	 */
	isPointOver(clientX: number, clientY: number): boolean {
		if (!this.cardsContainer) return false;

		const rect = this.cardsContainer.getBoundingClientRect();
		return (
			clientX >= rect.left &&
			clientX <= rect.right &&
			clientY >= rect.top &&
			clientY <= rect.bottom
		);
	}

	/**
	 * Get the column ID.
	 */
	getColumnId(): string {
		return this.config.column.id;
	}

	/**
	 * Handle drag start.
	 */
	private handleDragStart(card: Card): void {
		// Could emit event or store state
	}

	/**
	 * Handle drag end.
	 */
	private handleDragEnd(): void {
		this.hideDropIndicator();
	}

	/**
	 * Handle card drop.
	 */
	private handleDrop(filename: string, dropIndex: number): void {
		const { column, onCardMove, onCardReorder } = this.config;

		// Find if card is from this column or another
		const isFromThisColumn = column.cards.some((c) => c.filename + '.md' === filename || c.filename === filename);

		// Normalize filename
		const normalizedFilename = filename.endsWith('.md') ? filename : filename + '.md';

		if (isFromThisColumn) {
			// Reorder within column
			if (onCardReorder) {
				onCardReorder(column.id, normalizedFilename, dropIndex);
			}
		} else {
			// Move from another column
			if (onCardMove) {
				// Find the card (it's from another column, so we need to construct it)
				const card: Card = {
					filePath: '', // Will be filled by BoardManager
					filename: normalizedFilename.replace('.md', ''),
					title: normalizedFilename.replace('.md', ''),
					labels: [],
					columnValue: null,
					swimlaneValue: null,
					archived: false,
				};
				onCardMove(card, '', column.id, dropIndex); // fromColumn will be determined by the board
			}
		}
	}

	/**
	 * Show drop indicator at the appropriate position.
	 */
	private showDropIndicator(e: DragEvent): void {
		if (!this.cardsContainer) return;

		// Create indicator if needed
		if (!this.dropIndicator) {
			this.dropIndicator = document.createElement('div');
			this.dropIndicator.className = 'spicy-kanban-drop-indicator';
		}

		// Calculate position
		const dropIndex = this.calculateDropIndex(e);
		const cards = this.cardsContainer.querySelectorAll('.spicy-kanban-card');

		if (cards.length === 0) {
			this.cardsContainer.appendChild(this.dropIndicator);
		} else if (dropIndex >= cards.length) {
			this.cardsContainer.appendChild(this.dropIndicator);
		} else {
			this.cardsContainer.insertBefore(this.dropIndicator, cards[dropIndex]);
		}
	}

	/**
	 * Hide drop indicator.
	 */
	private hideDropIndicator(): void {
		if (this.dropIndicator) {
			this.dropIndicator.remove();
		}
	}

	/**
	 * Calculate the drop index based on mouse position.
	 */
	private calculateDropIndex(e: DragEvent): number {
		if (!this.cardsContainer) return 0;

		const cards = Array.from(this.cardsContainer.querySelectorAll('.spicy-kanban-card:not(.dragging)'));

		for (let i = 0; i < cards.length; i++) {
			const card = cards[i];
			const rect = card.getBoundingClientRect();
			const midY = rect.top + rect.height / 2;

			if (e.clientY < midY) {
				return i;
			}
		}

		return cards.length;
	}

	/**
	 * Update the column's card count.
	 */
	updateCount(): void {
		const countEl = this.element?.querySelector('.spicy-kanban-column-count');
		if (countEl) {
			countEl.textContent = String(this.config.column.cards.length);
		}
	}

	/**
	 * Get the column element.
	 */
	getElement(): HTMLElement | null {
		return this.element;
	}

	/**
	 * Clean up the component.
	 */
	destroy(): void {
		// Remove touch drag event listeners from document
		if (this.boundTouchDragMove) {
			document.removeEventListener('spicy-touch-drag-move', this.boundTouchDragMove);
			this.boundTouchDragMove = null;
		}
		if (this.boundTouchDragEnd) {
			document.removeEventListener('spicy-touch-drag-end', this.boundTouchDragEnd);
			this.boundTouchDragEnd = null;
		}

		// Clean up card components
		for (const component of this.cardComponents.values()) {
			component.destroy();
		}
		this.cardComponents.clear();

		// Remove drop indicator if present
		this.hideDropIndicator();

		if (this.element) {
			this.element.remove();
			this.element = null;
		}
	}
}
