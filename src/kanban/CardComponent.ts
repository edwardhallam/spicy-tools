/**
 * CardComponent - Renders a single card in the Kanban board
 *
 * Displays card title, preview text, and labels.
 * Handles click to open file and drag events.
 */

import type { App, TFile } from 'obsidian';
import { Card, BoardConfig } from './types';

/**
 * Configuration for creating a card component.
 */
export interface CardComponentConfig {
	card: Card;
	boardConfig: BoardConfig;
	app: App;
	onDragStart?: (card: Card) => void;
	onDragEnd?: () => void;
	onClick?: (card: Card) => void;
	onArchive?: (card: Card) => void;
}

/**
 * Creates and manages a card UI element.
 */
export class CardComponent {
	private config: CardComponentConfig;
	private element: HTMLElement | null = null;

	// Touch drag state
	private touchStartPos: { x: number; y: number } | null = null;
	private touchTimer: ReturnType<typeof setTimeout> | null = null;
	private isTouchDragging = false;
	private touchClone: HTMLElement | null = null;

	constructor(config: CardComponentConfig) {
		this.config = config;
	}

	/**
	 * Render the card into a container.
	 */
	render(container: HTMLElement): HTMLElement {
		const { card, boardConfig } = this.config;

		// Create card element
		this.element = container.createDiv({
			cls: 'spicy-kanban-card',
			attr: {
				'data-filename': card.filename,
				draggable: 'true',
			},
		});

		// Title
		const titleEl = this.element.createDiv({ cls: 'spicy-kanban-card-title' });
		titleEl.textContent = card.title;

		// Preview text (if configured)
		if (boardConfig.cardPreview && card.preview) {
			const previewEl = this.element.createDiv({ cls: 'spicy-kanban-card-preview' });
			const lines = boardConfig.cardPreviewLines || 2;
			const previewText = this.truncateLines(card.preview, lines);
			previewEl.textContent = previewText;
		}

		// Labels
		if (card.labels.length > 0) {
			this.renderLabels(this.element, card.labels);
		}

		// Attach event listeners
		this.attachEventListeners();

		return this.element;
	}

	/**
	 * Render labels based on display mode.
	 */
	private renderLabels(container: HTMLElement, labels: string[]): void {
		const { boardConfig } = this.config;
		const displayMode = boardConfig.labelDisplay || 'chips';

		if (displayMode === 'stripe') {
			// Stripe mode: colored bar on left edge
			const stripeContainer = container.createDiv({ cls: 'spicy-kanban-card-stripes' });
			for (const label of labels) {
				const stripe = stripeContainer.createDiv({ cls: 'spicy-kanban-card-stripe' });
				const color = boardConfig.labelColors?.[label] || 'default';
				stripe.style.backgroundColor = this.resolveColor(color);
				stripe.setAttribute('title', label);
			}
		} else {
			// Chips mode: colored pill badges
			const chipsContainer = container.createDiv({ cls: 'spicy-kanban-card-labels' });
			for (const label of labels) {
				const chip = chipsContainer.createDiv({ cls: 'spicy-kanban-card-label' });
				chip.textContent = label;
				const color = boardConfig.labelColors?.[label];
				if (color) {
					chip.style.backgroundColor = this.resolveColor(color);
					chip.addClass(`spicy-label-${color}`);
				}
			}
		}
	}

	/**
	 * Resolve a color name to a CSS color value.
	 */
	private resolveColor(color: string): string {
		// Map common color names to CSS values
		const colorMap: Record<string, string> = {
			red: 'var(--color-red)',
			orange: 'var(--color-orange)',
			yellow: 'var(--color-yellow)',
			green: 'var(--color-green)',
			blue: 'var(--color-blue)',
			purple: 'var(--color-purple)',
			pink: 'var(--color-pink)',
			gray: 'var(--color-base-40)',
			default: 'var(--color-base-30)',
		};

		return colorMap[color] || color;
	}

	/**
	 * Truncate text to a number of lines.
	 */
	private truncateLines(text: string, maxLines: number): string {
		const lines = text.split('\n').slice(0, maxLines);
		let result = lines.join('\n');

		// Also limit character count
		const maxChars = 150;
		if (result.length > maxChars) {
			result = result.substring(0, maxChars) + '...';
		}

		return result;
	}

	/**
	 * Attach event listeners to the card element.
	 */
	private attachEventListeners(): void {
		if (!this.element) return;

		const { card, onDragStart, onDragEnd, onClick, onArchive, app } = this.config;

		// Click to open file
		this.element.addEventListener('click', (e) => {
			// Don't open if clicking on action buttons
			if ((e.target as HTMLElement).closest('.spicy-kanban-card-actions')) {
				return;
			}

			if (onClick) {
				onClick(card);
			} else {
				// Default: open the file
				const file = app.vault.getAbstractFileByPath(card.filePath) as TFile | null;
				if (file) {
					app.workspace.getLeaf().openFile(file);
				}
			}
		});

		// Drag start
		this.element.addEventListener('dragstart', (e) => {
			if (!e.dataTransfer) return;

			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', card.filename);
			this.element?.addClass('dragging');

			if (onDragStart) {
				onDragStart(card);
			}
		});

		// Drag end
		this.element.addEventListener('dragend', () => {
			this.element?.removeClass('dragging');

			if (onDragEnd) {
				onDragEnd();
			}
		});

		// Context menu for archive
		this.element.addEventListener('contextmenu', (e) => {
			if (onArchive) {
				e.preventDefault();
				// Could show a context menu here
				// For now, we'll add an archive button
			}
		});

		// Touch events for mobile drag-and-drop
		this.element.addEventListener('touchstart', this.handleTouchStart, { passive: true });
		this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
		this.element.addEventListener('touchend', this.handleTouchEnd);
		this.element.addEventListener('touchcancel', this.handleTouchCancel);
	}

	/**
	 * Handle touch start - begin long-press timer.
	 */
	private handleTouchStart = (e: TouchEvent): void => {
		const touch = e.touches[0];
		this.touchStartPos = { x: touch.clientX, y: touch.clientY };

		this.touchTimer = setTimeout(() => {
			this.isTouchDragging = true;
			this.element?.addClass('touch-dragging');

			// Create a visual clone for drag feedback
			this.createTouchClone(touch.clientX, touch.clientY);

			// Haptic feedback if available
			if (navigator.vibrate) {
				navigator.vibrate(50);
			}

			// Notify drag start
			const { card, onDragStart } = this.config;
			if (onDragStart) {
				onDragStart(card);
			}
		}, 350);
	};

	/**
	 * Handle touch move - check for cancel or update drag position.
	 */
	private handleTouchMove = (e: TouchEvent): void => {
		const touch = e.touches[0];

		if (!this.isTouchDragging && this.touchStartPos) {
			// Check if moved too much during long-press (cancel threshold: 10px)
			const dx = touch.clientX - this.touchStartPos.x;
			const dy = touch.clientY - this.touchStartPos.y;
			if (Math.sqrt(dx * dx + dy * dy) > 10) {
				this.cancelTouchDrag();
				return;
			}
		}

		if (this.isTouchDragging) {
			e.preventDefault(); // Only prevent scrolling when actively dragging

			// Update clone position
			this.updateTouchClone(touch.clientX, touch.clientY);

			// Find and highlight drop target
			const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
			this.updateDropTargetHighlight(dropTarget);
		}
	};

	/**
	 * Handle touch end - complete the drop or cancel.
	 */
	private handleTouchEnd = (e: TouchEvent): void => {
		if (this.isTouchDragging) {
			const touch = e.changedTouches[0];
			const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);

			// Find the column from the drop target
			this.handleTouchDrop(dropTarget, touch.clientX, touch.clientY);
		}
		this.cancelTouchDrag();
	};

	/**
	 * Handle touch cancel - clean up drag state.
	 */
	private handleTouchCancel = (): void => {
		this.cancelTouchDrag();
	};

	/**
	 * Cancel touch drag and clean up state.
	 */
	private cancelTouchDrag(): void {
		if (this.touchTimer) {
			clearTimeout(this.touchTimer);
			this.touchTimer = null;
		}

		if (this.isTouchDragging) {
			const { onDragEnd } = this.config;
			if (onDragEnd) {
				onDragEnd();
			}
		}

		this.isTouchDragging = false;
		this.touchStartPos = null;
		this.element?.removeClass('touch-dragging');

		// Remove clone
		if (this.touchClone) {
			this.touchClone.remove();
			this.touchClone = null;
		}

		// Clear any drop target highlights
		document.querySelectorAll('.spicy-kanban-column.touch-drop-target').forEach((el) => {
			el.removeClass('touch-drop-target');
		});
	}

	/**
	 * Create a visual clone of the card for drag feedback.
	 */
	private createTouchClone(x: number, y: number): void {
		if (!this.element) return;

		this.touchClone = this.element.cloneNode(true) as HTMLElement;
		this.touchClone.addClass('spicy-kanban-card-clone');
		this.touchClone.style.position = 'fixed';
		this.touchClone.style.pointerEvents = 'none';
		this.touchClone.style.zIndex = '10000';
		this.touchClone.style.opacity = '0.9';
		this.touchClone.style.width = `${this.element.offsetWidth}px`;
		this.touchClone.style.transform = 'rotate(3deg) scale(1.05)';
		this.touchClone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';

		this.updateTouchClone(x, y);
		document.body.appendChild(this.touchClone);
	}

	/**
	 * Update the clone position during drag.
	 */
	private updateTouchClone(x: number, y: number): void {
		if (!this.touchClone || !this.element) return;

		// Center the clone on the touch point
		const offsetX = this.element.offsetWidth / 2;
		const offsetY = 20; // Slight offset so user can see under finger
		this.touchClone.style.left = `${x - offsetX}px`;
		this.touchClone.style.top = `${y - offsetY}px`;
	}

	/**
	 * Update drop target highlighting during drag.
	 */
	private updateDropTargetHighlight(target: Element | null): void {
		// Clear previous highlights
		document.querySelectorAll('.spicy-kanban-column.touch-drop-target').forEach((el) => {
			el.removeClass('touch-drop-target');
		});

		if (!target) return;

		// Find the column element
		const column = target.closest('.spicy-kanban-column');
		if (column) {
			column.addClass('touch-drop-target');
		}
	}

	/**
	 * Handle the drop action when touch ends on a valid target.
	 */
	private handleTouchDrop(target: Element | null, x: number, y: number): void {
		if (!target) return;

		const column = target.closest('.spicy-kanban-column');
		if (!column) return;

		const columnId = column.getAttribute('data-column-id');
		if (!columnId) return;

		// Find the insertion point within the column
		const cardsContainer = column.querySelector('.spicy-kanban-column-cards');
		if (!cardsContainer) return;

		// Get all cards in the target column
		const cards = Array.from(cardsContainer.querySelectorAll('.spicy-kanban-card'));
		let insertBefore: string | null = null;

		// Find which card we're above/below
		for (const cardEl of cards) {
			const rect = cardEl.getBoundingClientRect();
			const cardMiddle = rect.top + rect.height / 2;
			if (y < cardMiddle) {
				insertBefore = cardEl.getAttribute('data-filename');
				break;
			}
		}

		// Dispatch a custom event that the board can listen for
		const dropEvent = new CustomEvent('spicy-kanban-touch-drop', {
			bubbles: true,
			detail: {
				card: this.config.card,
				targetColumnId: columnId,
				insertBefore: insertBefore,
			},
		});
		this.element?.dispatchEvent(dropEvent);
	}

	/**
	 * Get the card element.
	 */
	getElement(): HTMLElement | null {
		return this.element;
	}

	/**
	 * Update the card's visual state.
	 */
	update(card: Card): void {
		this.config.card = card;
		// Re-render would be needed for full update
	}

	/**
	 * Clean up the component.
	 */
	destroy(): void {
		// Clean up touch drag state
		this.cancelTouchDrag();

		// Remove touch event listeners
		if (this.element) {
			this.element.removeEventListener('touchstart', this.handleTouchStart);
			this.element.removeEventListener('touchmove', this.handleTouchMove);
			this.element.removeEventListener('touchend', this.handleTouchEnd);
			this.element.removeEventListener('touchcancel', this.handleTouchCancel);

			this.element.remove();
			this.element = null;
		}
	}
}
