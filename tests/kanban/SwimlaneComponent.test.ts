/**
 * Tests for SwimlaneComponent
 *
 * Tests swimlane rendering, collapse toggle, card distribution,
 * and event propagation for horizontal grouping in Kanban boards.
 */

import { App } from 'obsidian';
import { Swimlane, Column, Card, BoardConfig } from '../../src/kanban/types';

/**
 * Expected interface for SwimlaneComponent.
 * This matches the pattern used in ColumnComponent.
 */
export interface SwimlaneComponentConfig {
	swimlane: Swimlane;
	boardConfig: BoardConfig;
	app: App;
	onCollapse?: (swimlaneId: string, collapsed: boolean) => void;
	onCardMove?: (card: Card, fromColumn: string, toColumn: string) => void;
	onCardReorder?: (column: string, filename: string, newIndex: number) => void;
	onCardClick?: (card: Card) => void;
	onCardArchive?: (card: Card) => void;
	onAddCard?: (column: string, swimlane: string) => void;
}

/**
 * Add Obsidian's HTMLElement extensions for testing.
 * These methods are added by Obsidian to HTMLElement prototype.
 */
function addObsidianHTMLElementExtensions(el: HTMLElement): void {
	// empty() - removes all child nodes
	(el as any).empty = function () {
		while (this.firstChild) {
			this.removeChild(this.firstChild);
		}
	};

	// addClass() - adds a CSS class
	(el as any).addClass = function (cls: string) {
		this.classList.add(cls);
	};

	// removeClass() - removes a CSS class
	(el as any).removeClass = function (cls: string) {
		this.classList.remove(cls);
	};

	// toggleClass() - toggles a CSS class
	(el as any).toggleClass = function (cls: string, force?: boolean) {
		this.classList.toggle(cls, force);
	};

	// hasClass() - checks if element has a class
	(el as any).hasClass = function (cls: string) {
		return this.classList.contains(cls);
	};

	// createDiv() - creates a child div element
	(el as any).createDiv = function (options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
		const div = document.createElement('div');
		addObsidianHTMLElementExtensions(div);
		if (options?.cls) {
			options.cls.split(' ').forEach((c) => div.classList.add(c));
		}
		if (options?.text) {
			div.textContent = options.text;
		}
		if (options?.attr) {
			Object.entries(options.attr).forEach(([key, value]) => {
				div.setAttribute(key, value);
			});
		}
		this.appendChild(div);
		return div;
	};

	// createSpan() - creates a child span element
	(el as any).createSpan = function (options?: { cls?: string; text?: string }) {
		const span = document.createElement('span');
		addObsidianHTMLElementExtensions(span);
		if (options?.cls) {
			span.classList.add(options.cls);
		}
		if (options?.text) {
			span.textContent = options.text;
		}
		this.appendChild(span);
		return span;
	};
}

/**
 * Create a mock HTMLElement with Obsidian extensions.
 */
function createMockElement(): HTMLElement {
	const el = document.createElement('div');
	addObsidianHTMLElementExtensions(el);
	return el;
}

/**
 * Create a mock card for testing.
 */
function createMockCard(overrides: Partial<Card> = {}): Card {
	return {
		filePath: 'test/task-1.md',
		filename: 'task-1',
		title: 'Task 1',
		labels: [],
		columnValue: 'todo',
		swimlaneValue: 'high',
		archived: false,
		...overrides,
	};
}

/**
 * Create a mock column for testing.
 */
function createMockColumn(id: string, cards: Card[] = []): Column {
	return {
		id,
		name: id.charAt(0).toUpperCase() + id.slice(1),
		cards,
	};
}

/**
 * Create a mock swimlane for testing.
 */
function createMockSwimlane(overrides: Partial<Swimlane> = {}): Swimlane {
	return {
		id: 'high-priority',
		name: 'High Priority',
		collapsed: false,
		columns: [
			createMockColumn('todo'),
			createMockColumn('in-progress'),
			createMockColumn('done'),
		],
		...overrides,
	};
}

/**
 * Create a mock board config for testing.
 */
function createMockBoardConfig(overrides: Partial<BoardConfig> = {}): BoardConfig {
	return {
		columnProperty: 'status',
		columns: ['todo', 'in-progress', 'done'],
		swimlaneProperty: 'priority',
		swimlanesCollapsible: true,
		...overrides,
	};
}

/**
 * Mock SwimlaneComponent implementation for testing.
 *
 * NOTE: This mock represents the expected behavior of SwimlaneComponent.
 * When the actual component is implemented, import it instead of using this mock.
 */
class MockSwimlaneComponent {
	private config: SwimlaneComponentConfig;
	private element: HTMLElement | null = null;
	private headerEl: HTMLElement | null = null;
	private contentEl: HTMLElement | null = null;

	constructor(config: SwimlaneComponentConfig) {
		this.config = config;
	}

	render(container: HTMLElement): HTMLElement {
		const { swimlane, boardConfig } = this.config;

		// Create swimlane element
		this.element = (container as any).createDiv({
			cls: 'spicy-kanban-swimlane',
			attr: {
				'data-swimlane-id': swimlane.id,
			},
		});

		// Apply collapsed class if needed
		if (swimlane.collapsed) {
			this.element.classList.add('is-collapsed');
		}

		// Header
		this.headerEl = (this.element as any).createDiv({ cls: 'spicy-kanban-swimlane-header' });

		// Collapse toggle (chevron)
		const toggleEl = (this.headerEl as any).createDiv({ cls: 'spicy-kanban-swimlane-toggle' });
		toggleEl.textContent = swimlane.collapsed ? '>' : 'v';

		// Swimlane name
		const nameEl = (this.headerEl as any).createDiv({ cls: 'spicy-kanban-swimlane-name' });
		nameEl.textContent = swimlane.name;

		// Card count
		const totalCards = swimlane.columns.reduce((sum, col) => sum + col.cards.length, 0);
		const countEl = (this.headerEl as any).createDiv({ cls: 'spicy-kanban-swimlane-count' });
		countEl.textContent = String(totalCards);

		// Click handler for collapse toggle
		if (boardConfig.swimlanesCollapsible) {
			this.headerEl.addEventListener('click', () => this.handleHeaderClick());
		}

		// Content area (columns)
		this.contentEl = (this.element as any).createDiv({ cls: 'spicy-kanban-swimlane-content' });

		// Hide content if collapsed
		if (swimlane.collapsed) {
			this.contentEl.style.display = 'none';
		}

		// Render columns within swimlane
		for (const column of swimlane.columns) {
			this.renderColumn(column);
		}

		return this.element;
	}

	private renderColumn(column: Column): void {
		if (!this.contentEl) return;

		const columnEl = (this.contentEl as any).createDiv({
			cls: 'spicy-kanban-column',
			attr: {
				'data-column-id': column.id,
			},
		});

		// Column header
		const headerEl = (columnEl as any).createDiv({ cls: 'spicy-kanban-column-header' });
		const titleEl = (headerEl as any).createDiv({ cls: 'spicy-kanban-column-title' });
		titleEl.textContent = column.name;

		const countEl = (headerEl as any).createDiv({ cls: 'spicy-kanban-column-count' });
		countEl.textContent = String(column.cards.length);

		// Add card button
		const addBtn = (headerEl as any).createDiv({ cls: 'spicy-kanban-column-add' });
		addBtn.textContent = '+';
		addBtn.addEventListener('click', () => {
			if (this.config.onAddCard) {
				this.config.onAddCard(column.id, this.config.swimlane.id);
			}
		});

		// Cards container
		const cardsEl = (columnEl as any).createDiv({ cls: 'spicy-kanban-column-cards' });

		// Render cards
		for (const card of column.cards) {
			this.renderCard(cardsEl, card);
		}
	}

	private renderCard(container: HTMLElement, card: Card): void {
		const cardEl = (container as any).createDiv({
			cls: 'spicy-kanban-card',
			attr: {
				'data-file': card.filename,
				draggable: 'true',
			},
		});

		const titleEl = (cardEl as any).createDiv({ cls: 'spicy-kanban-card-title' });
		titleEl.textContent = card.title;

		// Click handler
		cardEl.addEventListener('click', () => {
			if (this.config.onCardClick) {
				this.config.onCardClick(card);
			}
		});

		// Drag start handler
		cardEl.addEventListener('dragstart', (e: DragEvent) => {
			if (e.dataTransfer) {
				e.dataTransfer.setData('text/plain', card.filename);
			}
		});
	}

	private handleHeaderClick(): void {
		const { swimlane, onCollapse } = this.config;
		const newCollapsed = !swimlane.collapsed;

		// Update visual state
		if (this.element) {
			this.element.classList.toggle('is-collapsed', newCollapsed);
		}
		if (this.contentEl) {
			this.contentEl.style.display = newCollapsed ? 'none' : '';
		}

		// Update config state
		swimlane.collapsed = newCollapsed;

		// Fire callback
		if (onCollapse) {
			onCollapse(swimlane.id, newCollapsed);
		}
	}

	getElement(): HTMLElement | null {
		return this.element;
	}

	destroy(): void {
		if (this.element) {
			this.element.remove();
			this.element = null;
		}
	}
}

// Use the mock until real implementation exists
const SwimlaneComponent = MockSwimlaneComponent;

describe('SwimlaneComponent', () => {
	let mockApp: App;
	let mockConfig: SwimlaneComponentConfig;
	let container: HTMLElement;

	beforeEach(() => {
		mockApp = new App();
		container = createMockElement();
		mockConfig = {
			swimlane: createMockSwimlane(),
			boardConfig: createMockBoardConfig(),
			app: mockApp,
		};
	});

	describe('rendering', () => {
		it('should render header with swimlane name', () => {
			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const nameEl = container.querySelector('.spicy-kanban-swimlane-name');
			expect(nameEl).not.toBeNull();
			expect(nameEl?.textContent).toBe('High Priority');
		});

		it('should render card count in header', () => {
			// Add cards to columns
			const cards = [
				createMockCard({ filename: 'task-1', columnValue: 'todo' }),
				createMockCard({ filename: 'task-2', columnValue: 'todo' }),
				createMockCard({ filename: 'task-3', columnValue: 'in-progress' }),
			];

			mockConfig.swimlane = createMockSwimlane({
				columns: [
					createMockColumn('todo', [cards[0], cards[1]]),
					createMockColumn('in-progress', [cards[2]]),
					createMockColumn('done', []),
				],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const countEl = container.querySelector('.spicy-kanban-swimlane-count');
			expect(countEl).not.toBeNull();
			expect(countEl?.textContent).toBe('3');
		});

		it('should render zero card count when no cards', () => {
			mockConfig.swimlane = createMockSwimlane({
				columns: [
					createMockColumn('todo', []),
					createMockColumn('in-progress', []),
					createMockColumn('done', []),
				],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const countEl = container.querySelector('.spicy-kanban-swimlane-count');
			expect(countEl?.textContent).toBe('0');
		});

		it('should apply collapsed state on render', () => {
			mockConfig.swimlane = createMockSwimlane({ collapsed: true });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const swimlaneEl = container.querySelector('.spicy-kanban-swimlane');
			expect(swimlaneEl?.classList.contains('is-collapsed')).toBe(true);
		});

		it('should not apply collapsed class when expanded', () => {
			mockConfig.swimlane = createMockSwimlane({ collapsed: false });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const swimlaneEl = container.querySelector('.spicy-kanban-swimlane');
			expect(swimlaneEl?.classList.contains('is-collapsed')).toBe(false);
		});

		it('should contain columns within content area', () => {
			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const contentEl = container.querySelector('.spicy-kanban-swimlane-content');
			expect(contentEl).not.toBeNull();

			const columns = contentEl?.querySelectorAll('.spicy-kanban-column');
			expect(columns?.length).toBe(3);
		});

		it('should set data-swimlane-id attribute', () => {
			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const swimlaneEl = container.querySelector('.spicy-kanban-swimlane');
			expect(swimlaneEl?.getAttribute('data-swimlane-id')).toBe('high-priority');
		});

		it('should render toggle indicator', () => {
			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const toggleEl = container.querySelector('.spicy-kanban-swimlane-toggle');
			expect(toggleEl).not.toBeNull();
		});
	});

	describe('collapse toggle', () => {
		it('should toggle collapsed state on header click', () => {
			mockConfig.swimlane = createMockSwimlane({ collapsed: false });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const headerEl = container.querySelector('.spicy-kanban-swimlane-header') as HTMLElement;
			headerEl.click();

			const swimlaneEl = container.querySelector('.spicy-kanban-swimlane');
			expect(swimlaneEl?.classList.contains('is-collapsed')).toBe(true);
		});

		it('should expand when clicking collapsed swimlane header', () => {
			mockConfig.swimlane = createMockSwimlane({ collapsed: true });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const headerEl = container.querySelector('.spicy-kanban-swimlane-header') as HTMLElement;
			headerEl.click();

			const swimlaneEl = container.querySelector('.spicy-kanban-swimlane');
			expect(swimlaneEl?.classList.contains('is-collapsed')).toBe(false);
		});

		it('should fire onCollapse callback with correct arguments', () => {
			const onCollapse = jest.fn();
			mockConfig.onCollapse = onCollapse;
			mockConfig.swimlane = createMockSwimlane({ collapsed: false });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const headerEl = container.querySelector('.spicy-kanban-swimlane-header') as HTMLElement;
			headerEl.click();

			expect(onCollapse).toHaveBeenCalledTimes(1);
			expect(onCollapse).toHaveBeenCalledWith('high-priority', true);
		});

		it('should fire onCollapse callback when expanding', () => {
			const onCollapse = jest.fn();
			mockConfig.onCollapse = onCollapse;
			mockConfig.swimlane = createMockSwimlane({ collapsed: true });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const headerEl = container.querySelector('.spicy-kanban-swimlane-header') as HTMLElement;
			headerEl.click();

			expect(onCollapse).toHaveBeenCalledWith('high-priority', false);
		});

		it('should hide content when collapsed', () => {
			mockConfig.swimlane = createMockSwimlane({ collapsed: true });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const contentEl = container.querySelector('.spicy-kanban-swimlane-content') as HTMLElement;
			expect(contentEl.style.display).toBe('none');
		});

		it('should show content when expanded', () => {
			mockConfig.swimlane = createMockSwimlane({ collapsed: false });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const contentEl = container.querySelector('.spicy-kanban-swimlane-content') as HTMLElement;
			expect(contentEl.style.display).not.toBe('none');
		});

		it('should toggle content visibility on collapse', () => {
			mockConfig.swimlane = createMockSwimlane({ collapsed: false });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const headerEl = container.querySelector('.spicy-kanban-swimlane-header') as HTMLElement;
			headerEl.click();

			const contentEl = container.querySelector('.spicy-kanban-swimlane-content') as HTMLElement;
			expect(contentEl.style.display).toBe('none');
		});

		it('should not toggle when swimlanesCollapsible is false', () => {
			const onCollapse = jest.fn();
			mockConfig.onCollapse = onCollapse;
			mockConfig.boardConfig = createMockBoardConfig({ swimlanesCollapsible: false });
			mockConfig.swimlane = createMockSwimlane({ collapsed: false });

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const headerEl = container.querySelector('.spicy-kanban-swimlane-header') as HTMLElement;
			headerEl.click();

			// Should not fire callback when collapsible is disabled
			expect(onCollapse).not.toHaveBeenCalled();
		});
	});

	describe('card distribution', () => {
		it('should render cards in correct columns', () => {
			const cards = [
				createMockCard({ filename: 'task-1', title: 'Task 1', columnValue: 'todo' }),
				createMockCard({ filename: 'task-2', title: 'Task 2', columnValue: 'in-progress' }),
				createMockCard({ filename: 'task-3', title: 'Task 3', columnValue: 'done' }),
			];

			mockConfig.swimlane = createMockSwimlane({
				columns: [
					createMockColumn('todo', [cards[0]]),
					createMockColumn('in-progress', [cards[1]]),
					createMockColumn('done', [cards[2]]),
				],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			// Check todo column
			const todoColumn = container.querySelector('[data-column-id="todo"]');
			const todoCards = todoColumn?.querySelectorAll('.spicy-kanban-card');
			expect(todoCards?.length).toBe(1);

			// Check in-progress column
			const inProgressColumn = container.querySelector('[data-column-id="in-progress"]');
			const inProgressCards = inProgressColumn?.querySelectorAll('.spicy-kanban-card');
			expect(inProgressCards?.length).toBe(1);

			// Check done column
			const doneColumn = container.querySelector('[data-column-id="done"]');
			const doneCards = doneColumn?.querySelectorAll('.spicy-kanban-card');
			expect(doneCards?.length).toBe(1);
		});

		it('should render multiple cards in same column', () => {
			const cards = [
				createMockCard({ filename: 'task-1', title: 'Task 1', columnValue: 'todo' }),
				createMockCard({ filename: 'task-2', title: 'Task 2', columnValue: 'todo' }),
				createMockCard({ filename: 'task-3', title: 'Task 3', columnValue: 'todo' }),
			];

			mockConfig.swimlane = createMockSwimlane({
				columns: [
					createMockColumn('todo', cards),
					createMockColumn('in-progress', []),
					createMockColumn('done', []),
				],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const todoColumn = container.querySelector('[data-column-id="todo"]');
			const todoCards = todoColumn?.querySelectorAll('.spicy-kanban-card');
			expect(todoCards?.length).toBe(3);
		});

		it('should render empty columns', () => {
			mockConfig.swimlane = createMockSwimlane({
				columns: [
					createMockColumn('todo', []),
					createMockColumn('in-progress', []),
					createMockColumn('done', []),
				],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const columns = container.querySelectorAll('.spicy-kanban-column');
			expect(columns.length).toBe(3);

			columns.forEach((column) => {
				const cards = column.querySelectorAll('.spicy-kanban-card');
				expect(cards.length).toBe(0);
			});
		});

		it('should display correct count per column', () => {
			const cards = [
				createMockCard({ filename: 'task-1', columnValue: 'todo' }),
				createMockCard({ filename: 'task-2', columnValue: 'todo' }),
			];

			mockConfig.swimlane = createMockSwimlane({
				columns: [
					createMockColumn('todo', cards),
					createMockColumn('in-progress', []),
					createMockColumn('done', []),
				],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const todoColumn = container.querySelector('[data-column-id="todo"]');
			const countEl = todoColumn?.querySelector('.spicy-kanban-column-count');
			expect(countEl?.textContent).toBe('2');
		});
	});

	describe('uncategorized swimlane', () => {
		it('should handle cards without swimlane value', () => {
			const cards = [
				createMockCard({ filename: 'task-1', swimlaneValue: null }),
				createMockCard({ filename: 'task-2', swimlaneValue: undefined }),
			];

			mockConfig.swimlane = createMockSwimlane({
				id: '__uncategorized__',
				name: 'Uncategorized',
				columns: [createMockColumn('todo', cards)],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const swimlaneEl = container.querySelector('.spicy-kanban-swimlane');
			expect(swimlaneEl?.getAttribute('data-swimlane-id')).toBe('__uncategorized__');

			const nameEl = container.querySelector('.spicy-kanban-swimlane-name');
			expect(nameEl?.textContent).toBe('Uncategorized');
		});
	});

	describe('event propagation', () => {
		it('should propagate card click events to parent', () => {
			const onCardClick = jest.fn();
			mockConfig.onCardClick = onCardClick;

			const card = createMockCard({ filename: 'task-1', title: 'Task 1' });
			mockConfig.swimlane = createMockSwimlane({
				columns: [createMockColumn('todo', [card])],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const cardEl = container.querySelector('.spicy-kanban-card') as HTMLElement;
			cardEl.click();

			expect(onCardClick).toHaveBeenCalledTimes(1);
			expect(onCardClick).toHaveBeenCalledWith(card);
		});

		it('should propagate add card events to parent with swimlane context', () => {
			const onAddCard = jest.fn();
			mockConfig.onAddCard = onAddCard;
			mockConfig.swimlane = createMockSwimlane({
				id: 'high-priority',
				columns: [createMockColumn('todo', [])],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const addBtn = container.querySelector('.spicy-kanban-column-add') as HTMLElement;
			addBtn.click();

			expect(onAddCard).toHaveBeenCalledTimes(1);
			expect(onAddCard).toHaveBeenCalledWith('todo', 'high-priority');
		});

		it('should make cards draggable', () => {
			const card = createMockCard({ filename: 'task-1' });
			mockConfig.swimlane = createMockSwimlane({
				columns: [createMockColumn('todo', [card])],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const cardEl = container.querySelector('.spicy-kanban-card');
			expect(cardEl?.getAttribute('draggable')).toBe('true');
		});

		it('should set drag data with filename', () => {
			const card = createMockCard({ filename: 'task-1' });
			mockConfig.swimlane = createMockSwimlane({
				columns: [createMockColumn('todo', [card])],
			});

			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const cardEl = container.querySelector('.spicy-kanban-card') as HTMLElement;

			// Create a mock drag event using Event constructor (jsdom compatible)
			const dataTransferMock = {
				setData: jest.fn(),
				getData: jest.fn(),
			};

			const dragEvent = new Event('dragstart', {
				bubbles: true,
				cancelable: true,
			}) as any;
			dragEvent.dataTransfer = dataTransferMock;

			cardEl.dispatchEvent(dragEvent);

			expect(dataTransferMock.setData).toHaveBeenCalledWith('text/plain', 'task-1');
		});
	});

	describe('destroy', () => {
		it('should remove element from DOM on destroy', () => {
			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			expect(container.querySelector('.spicy-kanban-swimlane')).not.toBeNull();

			component.destroy();

			expect(container.querySelector('.spicy-kanban-swimlane')).toBeNull();
		});

		it('should return null element after destroy', () => {
			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			component.destroy();

			expect(component.getElement()).toBeNull();
		});

		it('should handle multiple destroy calls gracefully', () => {
			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			// Should not throw
			component.destroy();
			component.destroy();
		});
	});

	describe('getElement', () => {
		it('should return null before render', () => {
			const component = new SwimlaneComponent(mockConfig);
			expect(component.getElement()).toBeNull();
		});

		it('should return element after render', () => {
			const component = new SwimlaneComponent(mockConfig);
			component.render(container);

			const element = component.getElement();
			expect(element).not.toBeNull();
			expect(element?.classList.contains('spicy-kanban-swimlane')).toBe(true);
		});
	});
});
