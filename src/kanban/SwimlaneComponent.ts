/**
 * SwimlaneComponent - Renders a horizontal swimlane grouping in the Kanban board
 *
 * Groups cards horizontally by a frontmatter property value.
 * Contains columns within the swimlane and supports collapse/expand.
 */

import type { App } from 'obsidian';
import { Card, Column, Swimlane, BoardConfig } from './types';
import { ColumnComponent } from './ColumnComponent';

/**
 * Configuration for creating a swimlane component.
 */
export interface SwimlaneComponentConfig {
	swimlane: Swimlane;
	columns: Column[];
	boardConfig: BoardConfig;
	app: App;
	isCollapsed: boolean;
	onCollapse: (swimlaneId: string, collapsed: boolean) => void;
	onCardMove: (card: Card, fromColumn: string, toColumn: string, index?: number) => void;
	onCardReorder: (columnId: string, filename: string, newIndex: number) => void;
	onCardClick: (card: Card) => void;
	onCardArchive: (card: Card) => void;
	onAddCard: (columnId: string) => void;
}

/**
 * Creates and manages a swimlane UI element.
 */
export class SwimlaneComponent {
	private element: HTMLElement | null = null;
	private headerEl: HTMLElement | null = null;
	private contentEl: HTMLElement | null = null;
	private columnComponents: Map<string, ColumnComponent> = new Map();

	constructor(private config: SwimlaneComponentConfig) {}

	/**
	 * Render the swimlane into a container.
	 */
	render(container: HTMLElement): HTMLElement {
		const { swimlane, isCollapsed } = this.config;

		// Create swimlane element
		this.element = container.createDiv({
			cls: 'spicy-kanban-swimlane',
			attr: {
				'data-swimlane-id': swimlane.id,
			},
		});

		// Add collapsed state class if needed
		if (isCollapsed) {
			this.element.addClass('is-collapsed');
		}

		// Render header
		this.renderHeader();

		// Render content (columns container)
		this.renderContent();

		return this.element;
	}

	/**
	 * Render the swimlane header with name, count, and collapse toggle.
	 */
	private renderHeader(): void {
		if (!this.element) return;

		const { swimlane, boardConfig } = this.config;

		this.headerEl = this.element.createDiv({ cls: 'spicy-kanban-swimlane-header' });

		// Collapse toggle icon
		const collapseToggle = this.headerEl.createDiv({ cls: 'spicy-kanban-swimlane-toggle' });
		collapseToggle.innerHTML = this.config.isCollapsed ? '&#9654;' : '&#9660;'; // Right or down arrow
		collapseToggle.setAttribute('title', this.config.isCollapsed ? 'Expand swimlane' : 'Collapse swimlane');

		// Swimlane name
		const titleEl = this.headerEl.createDiv({ cls: 'spicy-kanban-swimlane-title' });
		titleEl.textContent = swimlane.name;

		// Card count
		const cardCount = this.getTotalCardCount();
		const countEl = this.headerEl.createDiv({ cls: 'spicy-kanban-swimlane-count' });
		countEl.textContent = `(${cardCount})`;

		// Make entire header clickable for collapse if collapsible is enabled
		if (boardConfig.swimlanesCollapsible !== false) {
			this.headerEl.addClass('is-collapsible');
			this.headerEl.addEventListener('click', () => this.toggleCollapse());
		}
	}

	/**
	 * Render the swimlane content (columns).
	 */
	private renderContent(): void {
		if (!this.element) return;

		const { isCollapsed } = this.config;

		this.contentEl = this.element.createDiv({ cls: 'spicy-kanban-swimlane-content' });

		// Hide content if collapsed
		if (isCollapsed) {
			this.contentEl.style.display = 'none';
		}

		// Render columns within the swimlane
		this.renderColumns();
	}

	/**
	 * Render all columns within the swimlane.
	 */
	private renderColumns(): void {
		if (!this.contentEl) return;

		const { swimlane, boardConfig, app, onCardMove, onCardReorder, onCardClick, onCardArchive, onAddCard } =
			this.config;

		// Create columns container
		const columnsContainer = this.contentEl.createDiv({ cls: 'spicy-kanban-columns' });

		// Render each column from the swimlane
		for (const column of swimlane.columns) {
			const columnComponent = new ColumnComponent({
				column,
				boardConfig,
				app,
				onCardMove: (card, fromColumn, toColumn, index) => onCardMove(card, fromColumn, toColumn, index),
				onCardReorder: (col, filename, index) => onCardReorder(col, filename, index),
				onCardClick: (card) => onCardClick(card),
				onCardArchive: (card) => onCardArchive(card),
				onAddCard: (col) => onAddCard(col),
			});

			columnComponent.render(columnsContainer);
			this.columnComponents.set(column.id, columnComponent);
		}
	}

	/**
	 * Toggle the collapsed state of the swimlane.
	 */
	toggleCollapse(): void {
		const { swimlane, onCollapse, boardConfig } = this.config;

		// Only toggle if collapsible is enabled
		if (boardConfig.swimlanesCollapsible === false) {
			return;
		}

		const newCollapsed = !this.config.isCollapsed;
		this.config.isCollapsed = newCollapsed;

		// Update visual state
		if (this.element) {
			if (newCollapsed) {
				this.element.addClass('is-collapsed');
			} else {
				this.element.removeClass('is-collapsed');
			}
		}

		// Update content visibility
		if (this.contentEl) {
			this.contentEl.style.display = newCollapsed ? 'none' : '';
		}

		// Update toggle icon
		const toggleEl = this.headerEl?.querySelector('.spicy-kanban-swimlane-toggle');
		if (toggleEl) {
			toggleEl.innerHTML = newCollapsed ? '&#9654;' : '&#9660;';
			(toggleEl as HTMLElement).setAttribute('title', newCollapsed ? 'Expand swimlane' : 'Collapse swimlane');
		}

		// Notify parent of collapse state change
		onCollapse(swimlane.id, newCollapsed);
	}

	/**
	 * Get the total count of cards across all columns in this swimlane.
	 */
	private getTotalCardCount(): number {
		const { swimlane } = this.config;
		return swimlane.columns.reduce((total, column) => total + column.cards.length, 0);
	}

	/**
	 * Update the card count display.
	 */
	updateCount(): void {
		const countEl = this.headerEl?.querySelector('.spicy-kanban-swimlane-count');
		if (countEl) {
			const cardCount = this.getTotalCardCount();
			countEl.textContent = `(${cardCount})`;
		}

		// Also update individual column counts
		for (const component of this.columnComponents.values()) {
			component.updateCount();
		}
	}

	/**
	 * Get the swimlane element.
	 */
	getElement(): HTMLElement | null {
		return this.element;
	}

	/**
	 * Get the current collapsed state.
	 */
	isCollapsed(): boolean {
		return this.config.isCollapsed;
	}

	/**
	 * Set the collapsed state programmatically (without triggering callback).
	 * Used by BoardView when restoring persisted state.
	 */
	setCollapsed(collapsed: boolean): void {
		const { boardConfig } = this.config;

		// Only allow if collapsible is enabled
		if (boardConfig.swimlanesCollapsible === false) {
			return;
		}

		this.config.isCollapsed = collapsed;

		// Update visual state
		if (this.element) {
			if (collapsed) {
				this.element.addClass('is-collapsed');
			} else {
				this.element.removeClass('is-collapsed');
			}
		}

		// Update content visibility
		if (this.contentEl) {
			this.contentEl.style.display = collapsed ? 'none' : '';
		}

		// Update toggle icon
		const toggleEl = this.headerEl?.querySelector('.spicy-kanban-swimlane-toggle');
		if (toggleEl) {
			toggleEl.innerHTML = collapsed ? '&#9654;' : '&#9660;';
			(toggleEl as HTMLElement).setAttribute('title', collapsed ? 'Expand swimlane' : 'Collapse swimlane');
		}
	}

	/**
	 * Clean up the component and all child column components.
	 */
	destroy(): void {
		// Destroy all column components
		for (const component of this.columnComponents.values()) {
			component.destroy();
		}
		this.columnComponents.clear();

		// Remove DOM elements
		if (this.element) {
			this.element.remove();
			this.element = null;
		}

		this.headerEl = null;
		this.contentEl = null;
	}
}
