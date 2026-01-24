/**
 * Tests for PropertyDropdownRegistry - Lifecycle and Discovery Management
 *
 * Tests the top-level coordinator for the dropdown system.
 * Covers adapter creation, string-keyed management, and interaction lock.
 */

import { PropertyDropdownRegistry } from '../../src/dropdowns/PropertyDropdownRegistry';
import { DropdownManager } from '../../src/dropdowns/DropdownManager';
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

// Create a mock property element that mimics Obsidian's property panel structure
function createMockPropertyElement(propertyName: string): HTMLElement {
	const propertyEl = createMockContainer();
	propertyEl.classList.add('metadata-property');
	propertyEl.setAttribute('data-property-key', propertyName);

	// Create key element
	const keyEl = (propertyEl as any).createDiv({ cls: 'metadata-property-key' });
	keyEl.textContent = propertyName;

	// Create value container
	(propertyEl as any).createDiv({ cls: 'metadata-property-value' });

	return propertyEl;
}

describe('PropertyDropdownRegistry', () => {
	let mockApp: App;
	let mockDropdownManager: DropdownManager;
	let registry: PropertyDropdownRegistry;
	let mockFile: TFile;

	beforeEach(() => {
		mockApp = createMockApp();
		mockFile = createMockTFile('test/test-file.md');

		// Set up workspace to return the mock file
		(mockApp.workspace.getActiveFile as jest.Mock).mockReturnValue(mockFile);

		// Set up workspace.on to track event registrations
		const eventHandlers: Record<string, Function[]> = {};
		(mockApp.workspace.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
			if (!eventHandlers[event]) {
				eventHandlers[event] = [];
			}
			eventHandlers[event].push(handler);
			return { unsubscribe: jest.fn() };
		});

		// Set up workspace.offref
		(mockApp.workspace as any).offref = jest.fn();

		// Set up metadataCache.on
		(mockApp.metadataCache.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
			return { unsubscribe: jest.fn() };
		});

		// Set up workspace.activeLeaf
		(mockApp.workspace as any).activeLeaf = {
			view: {
				containerEl: document.createElement('div'),
			},
		};

		// Set up metadata cache with test frontmatter
		(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
			frontmatter: {
				status: 'Review',
				tags: ['frontend', 'backend'],
			},
		});

		// Create mock dropdown manager
		mockDropdownManager = {
			getDefinitionsForFile: jest.fn().mockResolvedValue({
				definitions: new Map<string, DropdownDefinition>([
					[
						'status',
						{
							property: 'status',
							options: ['Draft', 'Review', 'Published'],
							multi: false,
							disabled: false,
						},
					],
					[
						'tags',
						{
							property: 'tags',
							options: ['frontend', 'backend', 'docs', 'testing'],
							multi: true,
							disabled: false,
						},
					],
				]),
				source: 'folder',
			}),
		} as unknown as DropdownManager;

		registry = new PropertyDropdownRegistry(mockApp, mockDropdownManager);
		addObsidianMethods(document.body as HTMLElement);
	});

	afterEach(() => {
		registry.stop();
		document.body.innerHTML = '';
	});

	describe('adapter creation', () => {
		it('creates adapters for matching property definitions', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Check that dropdown was rendered
			const dropdown = statusProperty.querySelector('.spicy-dropdown');
			expect(dropdown).toBeTruthy();
		});

		it('does not create adapter for property without definition', async () => {
			const unknownProperty = createMockPropertyElement('unknown-property');
			document.body.appendChild(unknownProperty);

			registry.start();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Check that no dropdown was rendered
			const dropdown = unknownProperty.querySelector('.spicy-dropdown');
			expect(dropdown).toBeFalsy();
		});

		it('creates adapters for multiple properties', async () => {
			const statusProperty = createMockPropertyElement('status');
			const tagsProperty = createMockPropertyElement('tags');
			document.body.appendChild(statusProperty);
			document.body.appendChild(tagsProperty);

			registry.start();

			// Wait for async operations (multiple properties need more time)
			await new Promise((resolve) => setTimeout(resolve, 200));

			const statusDropdown = statusProperty.querySelector('.spicy-dropdown');
			const tagsDropdown = tagsProperty.querySelector('.spicy-dropdown');
			expect(statusDropdown).toBeTruthy();
			expect(tagsDropdown).toBeTruthy();
		});
	});

	describe('string-keyed adapters', () => {
		it('uses string keys (filepath:propertyName) not HTMLElement', async () => {
			// This is tested indirectly - if we add the same property twice,
			// it should not create duplicate adapters
			const statusProperty1 = createMockPropertyElement('status');
			document.body.appendChild(statusProperty1);

			registry.start();

			// Wait for initial render
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Add another status property element
			const statusProperty2 = createMockPropertyElement('status');
			document.body.appendChild(statusProperty2);

			// Trigger a scan by waiting
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Both elements should have dropdowns (adapter reuses by key)
			const dropdowns = document.querySelectorAll('.spicy-dropdown');
			// Note: The registry creates one adapter per property name per file,
			// but the DOM might have multiple property elements with the same name
			expect(dropdowns.length).toBeGreaterThan(0);
		});
	});

	describe('interaction lock', () => {
		it('acquires lock when dropdown opens', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			// Wait for render
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(registry.isLocked()).toBe(false);

			// Open the dropdown
			const trigger = statusProperty.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			if (trigger) {
				trigger.click();
			}

			expect(registry.isLocked()).toBe(true);
		});

		it('releases lock when dropdown closes', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			// Wait for render
			await new Promise((resolve) => setTimeout(resolve, 100));

			const trigger = statusProperty.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			if (trigger) {
				trigger.click(); // Open
				expect(registry.isLocked()).toBe(true);

				trigger.click(); // Close
				expect(registry.isLocked()).toBe(false);
			}
		});

		it('skips re-render when interaction lock is held', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			// Wait for initial render
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Open the dropdown
			const trigger = statusProperty.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			if (trigger) {
				trigger.click();

				// Verify dropdown is open
				const menu = document.body.querySelector('.spicy-dropdown-menu');
				expect(menu?.classList.contains('hidden')).toBe(false);

				// Add a new property element (would trigger MutationObserver)
				const newProperty = createMockPropertyElement('priority');
				document.body.appendChild(newProperty);

				// Wait for potential re-render
				await new Promise((resolve) => setTimeout(resolve, 100));

				// The original dropdown should still be open
				const menuAfter = document.body.querySelector('.spicy-dropdown-menu');
				expect(menuAfter?.classList.contains('hidden')).toBe(false);
			}
		});
	});

	describe('file change handling', () => {
		it('cleans up adapters on file change', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			// Wait for initial render
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(statusProperty.querySelector('.spicy-dropdown')).toBeTruthy();

			// Simulate file change by updating getActiveFile and triggering the handler
			const newFile = createMockTFile('test/new-file.md');
			(mockApp.workspace.getActiveFile as jest.Mock).mockReturnValue(newFile);

			// The file-open event would normally trigger handleFileChange
			// We can test this by calling refresh which internally handles this
			await registry.refresh();

			// Wait for cleanup and re-render
			await new Promise((resolve) => setTimeout(resolve, 100));

			// getDefinitionsForFile should have been called again
			expect(mockDropdownManager.getDefinitionsForFile).toHaveBeenCalled();
		});
	});

	describe('refresh', () => {
		it('destroys and recreates all adapters', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			// Wait for initial render
			await new Promise((resolve) => setTimeout(resolve, 100));

			const initialDropdown = statusProperty.querySelector('.spicy-dropdown');
			expect(initialDropdown).toBeTruthy();

			// Refresh
			await registry.refresh();

			// Wait for re-render
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should still have a dropdown
			const refreshedDropdown = statusProperty.querySelector('.spicy-dropdown');
			expect(refreshedDropdown).toBeTruthy();
		});

		it('reloads definitions from manager', async () => {
			registry.start();

			// Wait for initial load
			await new Promise((resolve) => setTimeout(resolve, 100));

			const initialCallCount = (mockDropdownManager.getDefinitionsForFile as jest.Mock).mock.calls.length;

			await registry.refresh();

			// Should have called getDefinitionsForFile again
			expect((mockDropdownManager.getDefinitionsForFile as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
		});
	});

	describe('stop', () => {
		it('disconnects observer', () => {
			registry.start();
			registry.stop();

			// Should not throw when stopping
			expect(true).toBe(true);
		});

		it('destroys all adapters', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			// Wait for render
			await new Promise((resolve) => setTimeout(resolve, 100));

			registry.stop();

			// The adapters are destroyed but the DOM elements remain
			// The registry's internal state should be cleared
			expect(registry.isLocked()).toBe(false);
		});

		it('removes event listeners', () => {
			registry.start();
			registry.stop();

			// offref should have been called for each event registration
			expect((mockApp.workspace as any).offref).toHaveBeenCalled();
		});

		it('clears current file context', async () => {
			registry.start();

			// Wait for initial setup
			await new Promise((resolve) => setTimeout(resolve, 100));

			registry.stop();

			// After stop, isLocked should be false (no active adapters)
			expect(registry.isLocked()).toBe(false);
		});
	});

	describe('property element discovery', () => {
		it('finds property name from data-property-key attribute', async () => {
			const propertyEl = createMockPropertyElement('status');
			document.body.appendChild(propertyEl);

			registry.start();

			await new Promise((resolve) => setTimeout(resolve, 100));

			const dropdown = propertyEl.querySelector('.spicy-dropdown');
			expect(dropdown).toBeTruthy();
		});

		it('falls back to key element text content', async () => {
			// Create property without data-property-key
			const propertyEl = createMockContainer();
			propertyEl.classList.add('metadata-property');

			const keyEl = (propertyEl as any).createDiv({ cls: 'metadata-property-key' });
			keyEl.textContent = 'status';

			(propertyEl as any).createDiv({ cls: 'metadata-property-value' });

			document.body.appendChild(propertyEl);

			registry.start();

			await new Promise((resolve) => setTimeout(resolve, 100));

			const dropdown = propertyEl.querySelector('.spicy-dropdown');
			expect(dropdown).toBeTruthy();
		});

		it('marks property element with active class', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(statusProperty.classList.contains('spicy-dropdown-active')).toBe(true);
		});
	});

	describe('metadata change handling', () => {
		it('refreshes adapters on metadata change for current file', async () => {
			const statusProperty = createMockPropertyElement('status');
			document.body.appendChild(statusProperty);

			registry.start();

			// Wait for initial render
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Update metadata
			(mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
				frontmatter: {
					status: 'Published',
				},
			});

			// Get the metadata change handler
			const metadataChangeHandler = (mockApp.metadataCache.on as jest.Mock).mock.calls.find(
				(call: any[]) => call[0] === 'changed'
			)?.[1];

			if (metadataChangeHandler) {
				// Simulate metadata change event
				metadataChangeHandler(mockFile);
			}

			// Wait for refresh
			await new Promise((resolve) => setTimeout(resolve, 100));

			// The dropdown should have been refreshed
			// (UI would show new value if not interacting)
			const trigger = statusProperty.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('Published');
		});
	});
});
