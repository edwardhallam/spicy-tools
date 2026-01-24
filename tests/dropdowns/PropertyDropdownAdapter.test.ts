/**
 * Tests for PropertyDropdownAdapter - Bridge between DropdownUI and Obsidian
 *
 * Tests the adapter that bridges UI events to frontmatter updates.
 * Covers metadata reading, debounced writes, and refresh queuing.
 */

import { PropertyDropdownAdapter } from '../../src/dropdowns/PropertyDropdownAdapter';
import { DropdownDefinition } from '../../src/dropdowns/types';
import { App, TFile } from 'obsidian';
import { createMockApp, createMockTFile } from '../setup';

// Helper to create a mock container with Obsidian-like methods
function createMockContainer(): HTMLElement {
	const container = document.createElement('div');
	addObsidianMethods(container);
	return container;
}

function addObsidianMethods(el: HTMLElement): void {
	(el as any).empty = function () {
		while (this.firstChild) {
			this.removeChild(this.firstChild);
		}
	};
	(el as any).createDiv = function (options?: { cls?: string; text?: string; attr?: Record<string, any> }) {
		const div = document.createElement('div');
		if (options?.cls) {
			div.className = options.cls;
		}
		if (options?.text) {
			div.textContent = options.text;
		}
		if (options?.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				if (value !== null && value !== undefined) {
					div.setAttribute(key, String(value));
				}
			}
		}
		addObsidianMethods(div);
		this.appendChild(div);
		return div;
	};
	(el as any).createSpan = function (options?: { cls?: string; text?: string; attr?: Record<string, any> }) {
		const span = document.createElement('span');
		if (options?.cls) {
			span.className = options.cls;
		}
		if (options?.text) {
			span.textContent = options.text;
		}
		if (options?.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				if (value !== null && value !== undefined) {
					span.setAttribute(key, String(value));
				}
			}
		}
		this.appendChild(span);
		return span;
	};
	(el as any).createEl = function (
		tag: string,
		options?: { cls?: string; type?: string; attr?: Record<string, any> }
	) {
		const newEl = document.createElement(tag);
		if (options?.cls) {
			newEl.className = options.cls;
		}
		if (options?.type) {
			(newEl as HTMLInputElement).type = options.type;
		}
		if (options?.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				if (value !== null && value !== undefined) {
					newEl.setAttribute(key, String(value));
				}
			}
		}
		this.appendChild(newEl);
		return newEl;
	};
	(el as any).addClass = function (cls: string) {
		this.classList.add(cls);
	};
	(el as any).removeClass = function (cls: string) {
		this.classList.remove(cls);
	};
}

describe('PropertyDropdownAdapter', () => {
	let mockApp: App;
	let mockFile: TFile;
	let container: HTMLElement;

	const createDefinition = (overrides: Partial<DropdownDefinition> = {}): DropdownDefinition => ({
		property: 'status',
		options: ['todo', 'in-progress', 'done'],
		multi: false,
		disabled: false,
		...overrides,
	});

	beforeEach(() => {
		mockApp = createMockApp();
		mockFile = createMockTFile('test/test-file.md');
		container = createMockContainer();
		document.body.appendChild(container);
		addObsidianMethods(document.body as HTMLElement);

		// Set up default metadata cache response
		(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
			frontmatter: {
				status: 'todo',
			},
		});
	});

	afterEach(() => {
		document.body.querySelectorAll('.spicy-dropdown-menu').forEach(el => el.remove());
		document.body.removeChild(container);
		jest.clearAllMocks();
	});

	describe('initialization', () => {
		it('creates adapter with correct property name', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			expect(adapter.getPropertyName()).toBe('status');
		});

		it('stores file reference', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			expect(adapter.getFile()).toBe(mockFile);
		});
	});

	describe('mount', () => {
		it('renders dropdown UI in container', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			const dropdown = container.querySelector('.spicy-dropdown');
			expect(dropdown).toBeTruthy();
		});

		it('reads initial value from metadata cache', () => {
			(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
				frontmatter: {
					status: 'in-progress',
				},
			});

			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('in-progress');
		});

		it('shows null value when property is missing', () => {
			(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
				frontmatter: {},
			});

			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.classList.contains('empty')).toBe(true);
		});

		it('shows null value when frontmatter is missing', () => {
			(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);

			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.classList.contains('empty')).toBe(true);
		});

		it('handles array values for multi-select', () => {
			(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
				frontmatter: {
					tags: ['frontend', 'backend'],
				},
			});

			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'tags',
				createDefinition({
					property: 'tags',
					options: ['frontend', 'backend', 'docs'],
					multi: true,
				})
			);

			adapter.mount(container);

			const pills = container.querySelectorAll('.spicy-dropdown-pill');
			expect(pills.length).toBe(2);
		});
	});

	describe('onChange callback', () => {
		it('calls onChange when value changes', async () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			// Open and select an option
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click(); // 'in-progress'

			// Wait for debounce
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();
		});
	});

	describe('debounced frontmatter writes', () => {
		it('debounces rapid changes', async () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Rapidly click options
			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[0] as HTMLElement).click();

			// In single-select, dropdown closes after selection, so reopen
			trigger.click();
			(options[1] as HTMLElement).click();

			trigger.click();
			(options[2] as HTMLElement).click();

			// Wait for debounce to settle
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Should have been called 3 times (once per selection after debounce period)
			// The debounce timer is 50ms and each selection triggers its own debounced write
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();
		});

		it('writes correct value to frontmatter', async () => {
			let capturedFrontmatter: Record<string, any> = {};

			(mockApp.fileManager.processFrontMatter as jest.Mock).mockImplementation(
				async (file: any, fn: (fm: Record<string, any>) => void) => {
					const fm: Record<string, any> = {};
					fn(fm);
					capturedFrontmatter = fm;
				}
			);

			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			// Open and select
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click(); // 'in-progress'

			// Wait for debounce
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(capturedFrontmatter.status).toBe('in-progress');
		});
	});

	describe('refresh', () => {
		it('updates UI from metadata cache', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			// Update metadata cache
			(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
				frontmatter: {
					status: 'done',
				},
			});

			adapter.refresh();

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('done');
		});

		it('queues refresh when UI is open', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Update metadata cache
			(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
				frontmatter: {
					status: 'done',
				},
			});

			// Call refresh while open - should be queued
			adapter.refresh();

			// Value should NOT have changed yet (still shows original)
			const triggerAfterRefresh = container.querySelector('.spicy-dropdown-trigger');
			expect(triggerAfterRefresh?.textContent).toContain('todo');
		});

		it('processes pending refresh on close', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Update metadata cache
			(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
				frontmatter: {
					status: 'done',
				},
			});

			// Call refresh while open
			adapter.refresh();

			// Close the dropdown
			trigger.click();

			// Now the pending refresh should have been processed
			const triggerAfterClose = container.querySelector('.spicy-dropdown-trigger');
			expect(triggerAfterClose?.textContent).toContain('done');
		});
	});

	describe('interaction state', () => {
		it('reports not interacting when closed', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			expect(adapter.isInteracting()).toBe(false);
		});

		it('reports interacting when open', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			expect(adapter.isInteracting()).toBe(true);
		});

		it('calls interaction callback on open', () => {
			const interactionCallback = jest.fn();

			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.setInteractionCallback(interactionCallback);
			adapter.mount(container);

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			expect(interactionCallback).toHaveBeenCalledWith(true);
		});

		it('calls interaction callback on close', () => {
			const interactionCallback = jest.fn();

			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.setInteractionCallback(interactionCallback);
			adapter.mount(container);

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open
			trigger.click(); // Close

			expect(interactionCallback).toHaveBeenCalledWith(false);
		});
	});

	describe('updateFile', () => {
		it('updates file reference', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			const newFile = createMockTFile('test/renamed-file.md');
			adapter.updateFile(newFile);

			expect(adapter.getFile()).toBe(newFile);
		});
	});

	describe('destroy', () => {
		it('clears container', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);
			adapter.destroy();

			expect(container.children.length).toBe(0);
		});

		it('clears pending debounce timers', async () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);

			// Trigger a change
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click();

			// Destroy immediately (before debounce completes)
			adapter.destroy();

			// Wait for what would have been the debounce
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should not have written to frontmatter after destroy
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it('prevents further operations after destroy', () => {
			const adapter = new PropertyDropdownAdapter(
				mockApp,
				mockFile,
				'status',
				createDefinition()
			);

			adapter.mount(container);
			adapter.destroy();

			// These should not throw
			adapter.refresh();
			expect(container.children.length).toBe(0);
		});
	});
});
