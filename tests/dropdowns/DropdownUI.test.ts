/**
 * Tests for DropdownUI - Pure UI Component
 *
 * Tests the pure UI component with no Obsidian dependencies.
 * Covers rendering, event handling, keyboard navigation, and filtering.
 */

import { DropdownUI, DropdownUIConfig, DropdownUIEvents, DropdownValue } from '../../src/dropdowns/DropdownUI';

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = jest.fn();

// Add Obsidian's addClass/removeClass extension methods to Element prototype
if (!(Element.prototype as any).addClass) {
	(Element.prototype as any).addClass = function (cls: string) {
		this.classList.add(cls);
	};
}
if (!(Element.prototype as any).removeClass) {
	(Element.prototype as any).removeClass = function (cls: string) {
		this.classList.remove(cls);
	};
}

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

describe('DropdownUI', () => {
	let container: HTMLElement;
	let onOpenMock: jest.Mock;
	let onCloseMock: jest.Mock;
	let onChangeMock: jest.Mock;

	beforeEach(() => {
		container = createMockContainer();
		document.body.appendChild(container);
		addObsidianMethods(document.body as HTMLElement);
		onOpenMock = jest.fn();
		onCloseMock = jest.fn();
		onChangeMock = jest.fn();
	});

	afterEach(() => {
		document.body.querySelectorAll('.spicy-dropdown-menu').forEach(el => el.remove());
		document.body.removeChild(container);
	});

	const createConfig = (overrides: Partial<DropdownUIConfig> = {}): DropdownUIConfig => ({
		options: ['todo', 'in-progress', 'done'],
		value: null,
		multi: false,
		placeholder: 'Select...',
		...overrides,
	});

	const createEvents = (): DropdownUIEvents => ({
		onOpen: onOpenMock,
		onClose: onCloseMock,
		onChange: onChangeMock,
	});

	describe('rendering', () => {
		it('creates dropdown structure', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const wrapper = container.querySelector('.spicy-dropdown');
			expect(wrapper).toBeTruthy();

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger).toBeTruthy();

			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu).toBeTruthy();
			expect(menu?.classList.contains('hidden')).toBe(true);
		});

		it('renders trigger with placeholder when empty', () => {
			new DropdownUI(container, createConfig({ value: null }), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('Select...');
			expect(trigger?.classList.contains('empty')).toBe(true);
		});

		it('renders trigger with selected value for single-select', () => {
			new DropdownUI(container, createConfig({ value: 'todo' }), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('todo');
			expect(trigger?.classList.contains('empty')).toBe(false);
		});

		it('shows mismatch styling for invalid single-select value', () => {
			new DropdownUI(container, createConfig({ value: 'invalid-option' }), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.classList.contains('mismatch')).toBe(true);
		});

		it('renders all options in menu', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			expect(options.length).toBe(3);
		});

		it('adds filter input when options > 5', () => {
			const config = createConfig({
				options: ['a', 'b', 'c', 'd', 'e', 'f'],
			});
			new DropdownUI(container, config, createEvents());

			const filterInput = document.body.querySelector('.spicy-dropdown-filter');
			expect(filterInput).toBeTruthy();
		});

		it('does not add filter input when options <= 5', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const filterInput = document.body.querySelector('.spicy-dropdown-filter');
			expect(filterInput).toBeFalsy();
		});

		it('has proper ARIA attributes', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.getAttribute('role')).toBe('combobox');
			expect(trigger?.getAttribute('aria-expanded')).toBe('false');
			expect(trigger?.getAttribute('aria-haspopup')).toBe('listbox');
			expect(trigger?.getAttribute('tabindex')).toBe('0');

			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu?.getAttribute('role')).toBe('listbox');
		});
	});

	describe('multi-select mode', () => {
		it('renders pills for multi-select values', () => {
			const config = createConfig({
				multi: true,
				value: ['todo', 'done'],
			});
			new DropdownUI(container, config, createEvents());

			const pills = container.querySelectorAll('.spicy-dropdown-pill');
			expect(pills.length).toBe(2);
		});

		it('shows placeholder when no values selected in multi-select', () => {
			const config = createConfig({
				multi: true,
				value: [],
				placeholder: 'Select options...',
			});
			new DropdownUI(container, config, createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('Select options...');
			expect(trigger?.classList.contains('empty')).toBe(true);
		});

		it('renders checkboxes in multi-select options', () => {
			const config = createConfig({ multi: true });
			new DropdownUI(container, config, createEvents());

			const checkboxes = document.body.querySelectorAll('.spicy-dropdown-option input[type="checkbox"]');
			expect(checkboxes.length).toBe(3);
		});

		it('removes value via pill X button', () => {
			const config = createConfig({
				multi: true,
				value: ['todo', 'done'],
			});
			new DropdownUI(container, config, createEvents());

			const removeButton = container.querySelector('.spicy-dropdown-pill-remove') as HTMLElement;
			expect(removeButton).toBeTruthy();

			removeButton.click();

			expect(onChangeMock).toHaveBeenCalledWith(['done']);
		});
	});

	describe('open/close behavior', () => {
		it('opens when trigger clicked', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu?.classList.contains('hidden')).toBe(false);
			expect(onOpenMock).toHaveBeenCalledTimes(1);
		});

		it('closes when trigger clicked again', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open
			trigger.click(); // Close

			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu?.classList.contains('hidden')).toBe(true);
			expect(onCloseMock).toHaveBeenCalledTimes(1);
		});

		it('closes when clicking outside', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open

			expect(document.body.querySelector('.spicy-dropdown-menu')?.classList.contains('hidden')).toBe(false);

			// Click outside
			const outsideElement = document.createElement('div');
			document.body.appendChild(outsideElement);
			outsideElement.click();

			expect(document.body.querySelector('.spicy-dropdown-menu')?.classList.contains('hidden')).toBe(true);
			expect(onCloseMock).toHaveBeenCalledTimes(1);

			document.body.removeChild(outsideElement);
		});

		it('updates aria-expanded when opening/closing', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			expect(trigger.getAttribute('aria-expanded')).toBe('false');

			trigger.click(); // Open
			expect(trigger.getAttribute('aria-expanded')).toBe('true');

			trigger.click(); // Close
			expect(trigger.getAttribute('aria-expanded')).toBe('false');
		});
	});

	describe('single-select behavior', () => {
		it('selects option and closes', () => {
			new DropdownUI(container, createConfig(), createEvents());

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Click an option
			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click(); // 'in-progress'

			expect(onChangeMock).toHaveBeenCalledWith('in-progress');

			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu?.classList.contains('hidden')).toBe(true);
			expect(onCloseMock).toHaveBeenCalledTimes(1);
		});
	});

	describe('multi-select behavior', () => {
		it('toggles option and stays open', () => {
			const config = createConfig({
				multi: true,
				value: ['todo'],
			});
			new DropdownUI(container, config, createEvents());

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Click 'done' to add it
			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[2] as HTMLElement).click(); // 'done'

			expect(onChangeMock).toHaveBeenCalledWith(expect.arrayContaining(['todo', 'done']));

			// Dropdown should STILL be open
			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu?.classList.contains('hidden')).toBe(false);
			expect(onCloseMock).not.toHaveBeenCalled();
		});

		it('removes value when clicking selected option', () => {
			const config = createConfig({
				multi: true,
				value: ['todo', 'done'],
			});
			new DropdownUI(container, config, createEvents());

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Click 'todo' to remove it
			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[0] as HTMLElement).click(); // 'todo'

			expect(onChangeMock).toHaveBeenCalledWith(['done']);
		});
	});

	describe('keyboard navigation', () => {
		it('opens dropdown on Enter when closed', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu?.classList.contains('hidden')).toBe(false);
		});

		it('opens dropdown on ArrowDown when closed', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu?.classList.contains('hidden')).toBe(false);
		});

		it('closes dropdown on Escape', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open

			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

			const menu = document.body.querySelector('.spicy-dropdown-menu');
			expect(menu?.classList.contains('hidden')).toBe(true);
		});

		it('navigates options with ArrowDown', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open

			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			expect(options[0].classList.contains('highlighted')).toBe(true);
		});

		it('navigates options with ArrowUp', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open

			// Move down twice
			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

			// Move up once
			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			expect(options[0].classList.contains('highlighted')).toBe(true);
			expect(options[1].classList.contains('highlighted')).toBe(false);
		});

		it('selects highlighted option on Enter', () => {
			new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open

			// Navigate to first option
			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

			// Select it
			trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

			expect(onChangeMock).toHaveBeenCalledWith('todo');
		});
	});

	describe('filtering', () => {
		it('filters options when typing', () => {
			const config = createConfig({
				options: ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig'],
			});
			new DropdownUI(container, config, createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open

			const filterInput = document.body.querySelector('.spicy-dropdown-filter') as HTMLInputElement;
			filterInput.value = 'an';
			filterInput.dispatchEvent(new Event('input', { bubbles: true }));

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			expect(options.length).toBe(1); // Only 'banana' matches 'an'
		});

		it('resets filter on close', () => {
			const config = createConfig({
				options: ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig'],
			});
			new DropdownUI(container, config, createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click(); // Open

			const filterInput = document.body.querySelector('.spicy-dropdown-filter') as HTMLInputElement;
			filterInput.value = 'an';
			filterInput.dispatchEvent(new Event('input', { bubbles: true }));

			// Close
			trigger.click();

			// Re-open
			trigger.click();

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			expect(options.length).toBe(6); // All options should be visible again
			expect(filterInput.value).toBe('');
		});
	});

	describe('setValue', () => {
		it('updates displayed value', () => {
			const dropdown = new DropdownUI(container, createConfig({ value: 'todo' }), createEvents());

			dropdown.setValue('done');

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('done');
		});

		it('updates multi-select pills', () => {
			const config = createConfig({
				multi: true,
				value: ['todo'],
			});
			const dropdown = new DropdownUI(container, config, createEvents());

			dropdown.setValue(['todo', 'done']);

			const pills = container.querySelectorAll('.spicy-dropdown-pill');
			expect(pills.length).toBe(2);
		});
	});

	describe('getValue', () => {
		it('returns current value', () => {
			const dropdown = new DropdownUI(container, createConfig({ value: 'todo' }), createEvents());

			expect(dropdown.getValue()).toBe('todo');
		});

		it('returns updated value after selection', () => {
			const dropdown = new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click();

			expect(dropdown.getValue()).toBe('in-progress');
		});
	});

	describe('isInteracting', () => {
		it('returns false when dropdown is closed', () => {
			const dropdown = new DropdownUI(container, createConfig(), createEvents());

			expect(dropdown.isInteracting()).toBe(false);
		});

		it('returns true when dropdown is open', () => {
			const dropdown = new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			expect(dropdown.isInteracting()).toBe(true);
		});

		it('returns false after dropdown is closed', () => {
			const dropdown = new DropdownUI(container, createConfig(), createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();
			trigger.click();

			expect(dropdown.isInteracting()).toBe(false);
		});
	});

	describe('destroy', () => {
		it('removes event listeners', () => {
			const dropdown = new DropdownUI(container, createConfig(), createEvents());
			const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

			dropdown.destroy();

			expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), true);
			removeEventListenerSpy.mockRestore();
		});

		it('clears container', () => {
			const dropdown = new DropdownUI(container, createConfig(), createEvents());

			dropdown.destroy();

			expect(container.children.length).toBe(0);
		});

		it('prevents further operations after destroy', () => {
			const dropdown = new DropdownUI(container, createConfig(), createEvents());

			dropdown.destroy();
			dropdown.setValue('new-value');

			// Should not throw, should just no-op
			expect(container.children.length).toBe(0);
		});
	});

	describe('numeric options', () => {
		it('handles numeric option values', () => {
			const config = createConfig({
				options: [1, 2, 3, 4, 5],
				value: 3,
			});
			new DropdownUI(container, config, createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('3');
		});

		it('calls onChange with numeric value', () => {
			const config = createConfig({
				options: [1, 2, 3],
			});
			new DropdownUI(container, config, createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click(); // 2

			expect(onChangeMock).toHaveBeenCalledWith(2);
		});

		it('handles mixed string and numeric options', () => {
			const config = createConfig({
				options: ['low', 'medium', 'high', 1, 2, 3],
				value: 2,
			});
			new DropdownUI(container, config, createEvents());

			const trigger = container.querySelector('.spicy-dropdown-trigger');
			expect(trigger?.textContent).toContain('2');
		});
	});
});
