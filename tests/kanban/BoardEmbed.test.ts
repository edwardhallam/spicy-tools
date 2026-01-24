/**
 * Tests for BoardEmbed
 *
 * Tests code block parsing, embed ID generation, and error handling
 * for embedded Kanban boards.
 */

import {
	parseSource,
	DEFAULT_EMBED_HEIGHT,
	generateEmbedId,
	resetEmbedIdCounter,
	BoardEmbed,
} from '../../src/kanban/BoardEmbed';
import { App, TFolder } from 'obsidian';
import { BoardManagerFactory } from '../../src/kanban/BoardManager';

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

	// createDiv() - creates a child div element
	(el as any).createDiv = function (options?: { cls?: string; text?: string }) {
		const div = document.createElement('div');
		addObsidianHTMLElementExtensions(div);
		if (options?.cls) {
			div.classList.add(options.cls);
		}
		if (options?.text) {
			div.textContent = options.text;
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

describe('BoardEmbed', () => {
	describe('parseSource', () => {
		describe('valid folder path parsing', () => {
			it('parses valid folder path', () => {
				const source = 'folder: Projects/Tasks';
				const result = parseSource(source);

				expect(result.folderPath).toBe('Projects/Tasks');
				expect(result.error).toBeUndefined();
			});

			it('parses folder path with spaces', () => {
				const source = 'folder: My Projects/Task Board';
				const result = parseSource(source);

				expect(result.folderPath).toBe('My Projects/Task Board');
			});

			it('trims whitespace around folder path', () => {
				const source = 'folder:   Projects/Tasks   ';
				const result = parseSource(source);

				expect(result.folderPath).toBe('Projects/Tasks');
			});

			it('handles folder at root level', () => {
				const source = 'folder: Tasks';
				const result = parseSource(source);

				expect(result.folderPath).toBe('Tasks');
			});
		});

		describe('height parsing', () => {
			it('parses height option', () => {
				const source = `folder: Tasks
height: 400`;
				const result = parseSource(source);

				expect(result.folderPath).toBe('Tasks');
				expect(result.options.height).toBe(400);
			});

			it('uses default height when not specified', () => {
				const source = 'folder: Tasks';
				const result = parseSource(source);

				expect(result.options.height).toBe(DEFAULT_EMBED_HEIGHT);
				expect(result.options.height).toBe(300);
			});

			it('ignores invalid height (non-numeric)', () => {
				const source = `folder: Tasks
height: abc`;
				const result = parseSource(source);

				expect(result.options.height).toBe(DEFAULT_EMBED_HEIGHT);
			});

			it('ignores zero height', () => {
				const source = `folder: Tasks
height: 0`;
				const result = parseSource(source);

				expect(result.options.height).toBe(DEFAULT_EMBED_HEIGHT);
			});

			it('ignores negative height', () => {
				const source = `folder: Tasks
height: -100`;
				const result = parseSource(source);

				expect(result.options.height).toBe(DEFAULT_EMBED_HEIGHT);
			});

			it('parses legacy maxHeight option', () => {
				const source = `folder: Tasks
maxHeight: 500`;
				const result = parseSource(source);

				expect(result.options.maxHeight).toBe(500);
			});
		});

		describe('other options parsing', () => {
			it('parses showTitle option', () => {
				const source = `folder: Tasks
showTitle: false`;
				const result = parseSource(source);

				expect(result.options.showTitle).toBe(false);
			});

			it('parses showTitle as true', () => {
				const source = `folder: Tasks
showTitle: true`;
				const result = parseSource(source);

				expect(result.options.showTitle).toBe(true);
			});

			it('parses compact option', () => {
				const source = `folder: Tasks
compact: true`;
				const result = parseSource(source);

				expect(result.options.compact).toBe(true);
			});

			it('parses multiple options together', () => {
				const source = `folder: Projects/Board
height: 450
showTitle: true
compact: true`;
				const result = parseSource(source);

				expect(result.folderPath).toBe('Projects/Board');
				expect(result.options.height).toBe(450);
				expect(result.options.showTitle).toBe(true);
				expect(result.options.compact).toBe(true);
			});
		});

		describe('error handling', () => {
			it('handles empty source', () => {
				const result = parseSource('');

				expect(result.folderPath).toBe('');
				expect(result.error).toBeDefined();
				expect(result.error).toContain('Empty source');
			});

			it('handles whitespace-only source', () => {
				const result = parseSource('   \n\t  ');

				expect(result.folderPath).toBe('');
				expect(result.error).toBeDefined();
			});

			it('handles missing folder path', () => {
				const source = 'height: 400';
				const result = parseSource(source);

				expect(result.folderPath).toBe('');
				expect(result.error).toBe('Missing folder path');
			});

			it('handles folder with empty value', () => {
				const source = 'folder:   ';
				const result = parseSource(source);

				expect(result.folderPath).toBe('');
				expect(result.error).toBe('Missing folder path');
			});

			it('ignores comment lines', () => {
				const source = `# This is a comment
folder: Tasks
# Another comment
height: 400`;
				const result = parseSource(source);

				expect(result.folderPath).toBe('Tasks');
				expect(result.options.height).toBe(400);
				expect(result.error).toBeUndefined();
			});

			it('ignores empty lines', () => {
				const source = `
folder: Tasks

height: 400

`;
				const result = parseSource(source);

				expect(result.folderPath).toBe('Tasks');
				expect(result.options.height).toBe(400);
			});

			it('ignores unknown options gracefully', () => {
				const source = `folder: Tasks
unknownOption: value
anotherUnknown: 123`;
				const result = parseSource(source);

				expect(result.folderPath).toBe('Tasks');
				expect(result.error).toBeUndefined();
			});
		});
	});

	describe('generateEmbedId', () => {
		beforeEach(() => {
			resetEmbedIdCounter();
		});

		it('generates unique IDs for each call', () => {
			const id1 = generateEmbedId();
			const id2 = generateEmbedId();
			const id3 = generateEmbedId();

			expect(id1).not.toBe(id2);
			expect(id2).not.toBe(id3);
			expect(id1).not.toBe(id3);
		});

		it('generates IDs suitable for DOM attributes', () => {
			const id = generateEmbedId();

			// DOM IDs should:
			// - Start with a letter
			// - Contain only letters, digits, hyphens, underscores
			// - Not contain spaces
			expect(id).toMatch(/^[a-z][a-z0-9-_]*$/i);
			expect(id).not.toContain(' ');
		});

		it('generates IDs with consistent prefix', () => {
			const id1 = generateEmbedId();
			const id2 = generateEmbedId();

			expect(id1).toMatch(/^spicy-board-embed-/);
			expect(id2).toMatch(/^spicy-board-embed-/);
		});

		it('generates sequential IDs after reset', () => {
			const id1 = generateEmbedId();
			resetEmbedIdCounter();
			const id2 = generateEmbedId();

			expect(id1).toBe(id2);
		});

		it('increments counter correctly', () => {
			const id1 = generateEmbedId();
			const id2 = generateEmbedId();

			expect(id1).toBe('spicy-board-embed-1');
			expect(id2).toBe('spicy-board-embed-2');
		});
	});

	describe('BoardEmbed class', () => {
		let mockApp: App;
		let mockBoardManagerFactory: BoardManagerFactory;
		let mockContainerEl: HTMLElement;

		beforeEach(() => {
			resetEmbedIdCounter();
			mockApp = new App();
			mockBoardManagerFactory = new BoardManagerFactory(mockApp);
			mockContainerEl = createMockElement();
		});

		describe('embedId property', () => {
			it('assigns unique embedId on construction', () => {
				const embed1 = new BoardEmbed(
					mockApp,
					mockBoardManagerFactory,
					mockContainerEl,
					'folder: Test'
				);
				const embed2 = new BoardEmbed(
					mockApp,
					mockBoardManagerFactory,
					createMockElement(),
					'folder: Test'
				);

				expect(embed1.embedId).toBeDefined();
				expect(embed2.embedId).toBeDefined();
				expect(embed1.embedId).not.toBe(embed2.embedId);
			});

			it('embedId is suitable for DOM attributes', () => {
				const embed = new BoardEmbed(
					mockApp,
					mockBoardManagerFactory,
					mockContainerEl,
					'folder: Test'
				);

				expect(embed.embedId).toMatch(/^[a-z][a-z0-9-_]*$/i);
			});
		});

		describe('render error handling', () => {
			it('renders error for empty source', async () => {
				const embed = new BoardEmbed(
					mockApp,
					mockBoardManagerFactory,
					mockContainerEl,
					''
				);

				await embed.render();

				expect(mockContainerEl.textContent).toContain('No folder specified');
			});

			it('renders error for missing folder', async () => {
				const embed = new BoardEmbed(
					mockApp,
					mockBoardManagerFactory,
					mockContainerEl,
					'height: 400'
				);

				await embed.render();

				expect(mockContainerEl.textContent).toContain('No folder specified');
			});

			it('renders error when board manager returns null (non-existent folder)', async () => {
				// Mock the getManager to return null (folder doesn't have _board.md)
				mockBoardManagerFactory.getManager = jest.fn().mockResolvedValue(null);

				const embed = new BoardEmbed(
					mockApp,
					mockBoardManagerFactory,
					mockContainerEl,
					'folder: NonExistent/Folder'
				);

				await embed.render();

				expect(mockContainerEl.textContent).toContain('No board found in');
			});

			it('adds error class on error', async () => {
				const embed = new BoardEmbed(
					mockApp,
					mockBoardManagerFactory,
					mockContainerEl,
					''
				);

				await embed.render();

				const errorEl = mockContainerEl.querySelector('.spicy-kanban-embed-error');
				expect(errorEl).not.toBeNull();
			});
		});

		describe('destroy', () => {
			it('cleans up container on destroy', async () => {
				const embed = new BoardEmbed(
					mockApp,
					mockBoardManagerFactory,
					mockContainerEl,
					'folder: Test'
				);

				// Add some content
				mockContainerEl.innerHTML = '<div>Test content</div>';

				embed.destroy();

				expect(mockContainerEl.innerHTML).toBe('');
			});
		});
	});

	describe('DEFAULT_EMBED_HEIGHT', () => {
		it('is 300 pixels', () => {
			expect(DEFAULT_EMBED_HEIGHT).toBe(300);
		});
	});
});
