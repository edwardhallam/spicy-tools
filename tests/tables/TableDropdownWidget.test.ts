/**
 * Tests for TableDropdownWidget
 *
 * TableDropdownWidget is a pure UI component that wraps DropdownUI
 * for use in table cells. It adapts the string-based table cell values
 * to/from the DropdownValue format used by DropdownUI.
 */

import { TableDropdownWidget, TableDropdownWidgetConfig } from '../../src/tables/TableDropdownWidget';

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

// Helper to add Obsidian-like methods to an element
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

// Helper to create a mock container with Obsidian-like methods
function createMockContainer(): HTMLElement {
	const container = document.createElement('td');
	addObsidianMethods(container);
	return container;
}

describe('TableDropdownWidget', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createMockContainer();
		document.body.appendChild(container);
		addObsidianMethods(document.body as HTMLElement);
	});

	afterEach(() => {
		// Clean up menus that are appended to document.body
		document.body.querySelectorAll('.spicy-dropdown-menu').forEach(el => el.remove());
		container.remove();
	});

	describe('construction and rendering', () => {
		it('should render without errors', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['Option A', 'Option B'],
				currentValue: 'Option A',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(container.querySelector('.spicy-dropdown')).not.toBeNull();

			widget.destroy();
		});

		it('should render with empty current value', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['Option A', 'Option B'],
				currentValue: '',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(container.querySelector('.spicy-dropdown')).not.toBeNull();

			widget.destroy();
		});

		it('should render with numeric options', () => {
			const config: TableDropdownWidgetConfig = {
				options: [1, 2, 3, 4, 5],
				currentValue: '3',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(container.querySelector('.spicy-dropdown')).not.toBeNull();

			widget.destroy();
		});

		it('should render with mixed string and numeric options', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['Low', 1, 2, 3, 'High'],
				currentValue: '2',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(container.querySelector('.spicy-dropdown')).not.toBeNull();

			widget.destroy();
		});
	});

	describe('getValue and setValue', () => {
		it('should return current value via getValue', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: 'B',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(widget.getValue()).toBe('B');

			widget.destroy();
		});

		it('should return empty string for null value', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: '',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(widget.getValue()).toBe('');

			widget.destroy();
		});

		it('should update value via setValue', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: 'A',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			widget.setValue('C');

			expect(widget.getValue()).toBe('C');

			widget.destroy();
		});

		it('should handle setValue with empty string', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: 'A',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			widget.setValue('');

			expect(widget.getValue()).toBe('');

			widget.destroy();
		});
	});

	describe('multi-select mode', () => {
		it('should parse comma-separated values for multi-select', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C', 'D'],
				currentValue: 'A, C',
				multi: true,
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			// getValue returns comma-separated string
			expect(widget.getValue()).toBe('A, C');

			widget.destroy();
		});

		it('should handle empty multi-select value', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: '',
				multi: true,
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(widget.getValue()).toBe('');

			widget.destroy();
		});

		it('should serialize multi-select values with comma and space', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: 'A,B,C',
				multi: true,
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			// Should normalize to "A, B, C" with spaces
			expect(widget.getValue()).toBe('A, B, C');

			widget.destroy();
		});

		it('should handle whitespace in multi-select input', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: '  A  ,  B  ',
				multi: true,
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(widget.getValue()).toBe('A, B');

			widget.destroy();
		});
	});

	describe('numeric value handling', () => {
		it('should preserve numeric type for matching options', () => {
			const onChange = jest.fn();
			const config: TableDropdownWidgetConfig = {
				options: [1, 2, 3],
				currentValue: '2',
				onChange,
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			// The internal value should be the number 2, but getValue returns string
			expect(widget.getValue()).toBe('2');

			widget.destroy();
		});

		it('should handle numeric multi-select values', () => {
			const config: TableDropdownWidgetConfig = {
				options: [1, 2, 3, 4, 5],
				currentValue: '1, 3, 5',
				multi: true,
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(widget.getValue()).toBe('1, 3, 5');

			widget.destroy();
		});
	});

	describe('destroy', () => {
		it('should clean up DOM on destroy', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B'],
				currentValue: 'A',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(container.querySelector('.spicy-dropdown')).not.toBeNull();

			widget.destroy();

			expect(container.querySelector('.spicy-dropdown')).toBeNull();
		});

		it('should be safe to call destroy multiple times', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B'],
				currentValue: 'A',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(() => {
				widget.destroy();
				widget.destroy();
				widget.destroy();
			}).not.toThrow();
		});

		it('should not render after destroy', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B'],
				currentValue: 'A',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.destroy();
			widget.render();

			// Should not render anything
			expect(container.querySelector('.spicy-dropdown')).toBeNull();
		});
	});

	describe('isInteracting', () => {
		it('should return false when not rendered', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B'],
				currentValue: 'A',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);

			expect(widget.isInteracting()).toBe(false);

			widget.destroy();
		});

		it('should return false when dropdown is closed', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B'],
				currentValue: 'A',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(widget.isInteracting()).toBe(false);

			widget.destroy();
		});
	});

	describe('edge cases', () => {
		it('should handle options with special characters', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['Option, with comma', 'Option | with pipe', 'Option & with amp'],
				currentValue: 'Option, with comma',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(widget.getValue()).toBe('Option, with comma');

			widget.destroy();
		});

		it('should handle very long option lists', () => {
			const options = Array.from({ length: 100 }, (_, i) => `Option ${i + 1}`);
			const config: TableDropdownWidgetConfig = {
				options,
				currentValue: 'Option 50',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(widget.getValue()).toBe('Option 50');

			widget.destroy();
		});

		it('should handle empty options array', () => {
			const config: TableDropdownWidgetConfig = {
				options: [],
				currentValue: '',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			expect(container.querySelector('.spicy-dropdown')).not.toBeNull();

			widget.destroy();
		});

		it('should handle value not in options', () => {
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: 'Unknown',
				onChange: jest.fn(),
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			// Should still display the value even if not in options
			expect(widget.getValue()).toBe('Unknown');

			widget.destroy();
		});
	});

	describe('onChange callback', () => {
		it('should call onChange when option is selected', () => {
			const onChange = jest.fn();
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: 'A',
				onChange,
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Click an option
			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click(); // 'B'

			expect(onChange).toHaveBeenCalledWith('B');

			widget.destroy();
		});

		it('should call onChange with serialized multi-select value', () => {
			const onChange = jest.fn();
			const config: TableDropdownWidgetConfig = {
				options: ['A', 'B', 'C'],
				currentValue: 'A',
				multi: true,
				onChange,
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Click 'B' to add it
			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click(); // 'B'

			// Should be serialized as comma-separated string
			expect(onChange).toHaveBeenCalledWith('A, B');

			widget.destroy();
		});

		it('should call onChange with numeric value as string', () => {
			const onChange = jest.fn();
			const config: TableDropdownWidgetConfig = {
				options: [1, 2, 3],
				currentValue: '1',
				onChange,
			};

			const widget = new TableDropdownWidget(container, config);
			widget.render();

			// Open the dropdown
			const trigger = container.querySelector('.spicy-dropdown-trigger') as HTMLElement;
			trigger.click();

			// Click option '2'
			const options = document.body.querySelectorAll('.spicy-dropdown-option');
			(options[1] as HTMLElement).click(); // 2

			// Should be serialized as string
			expect(onChange).toHaveBeenCalledWith('2');

			widget.destroy();
		});
	});
});
