/**
 * DropdownUI - Pure UI Component
 *
 * A pure UI component with no Obsidian dependencies.
 * Handles rendering, event delegation, and state management.
 *
 * Key design decisions:
 * - Event delegation on menu container (single click listener)
 * - Click outside handled via single document listener
 * - Value is always what was last set via setValue()
 * - CSS classes for state: .is-open, .is-highlighted, .is-selected
 */

/**
 * Value types supported by the dropdown.
 * Includes mixed arrays since frontmatter may have heterogeneous data.
 */
export type DropdownValue = string | number | (string | number)[] | null;

/**
 * Configuration for the dropdown UI.
 */
export interface DropdownUIConfig {
	/** Available options to choose from */
	options: (string | number)[];

	/** Current selected value(s) */
	value: DropdownValue;

	/** Whether multiple values can be selected */
	multi: boolean;

	/** Placeholder text when no value selected */
	placeholder?: string;
}

/**
 * Event callbacks for the dropdown.
 */
export interface DropdownUIEvents {
	/** Called when dropdown opens */
	onOpen: () => void;

	/** Called when dropdown closes */
	onClose: () => void;

	/** Called when value changes */
	onChange: (value: DropdownValue) => void;
}

/**
 * Internal state of the dropdown.
 */
interface DropdownState {
	value: DropdownValue;
	highlightedIndex: number;
	filterText: string;
	filteredOptions: (string | number)[];
}

/**
 * Pure UI component for dropdown rendering and interaction.
 */
export class DropdownUI {
	private container: HTMLElement;
	private config: DropdownUIConfig;
	private events: DropdownUIEvents;
	private isOpen = false;
	private isDestroyed = false;

	private state: DropdownState;

	private elements: {
		wrapper: HTMLElement | null;
		trigger: HTMLElement | null;
		menu: HTMLElement | null;
		filterInput: HTMLInputElement | null;
	} = {
		wrapper: null,
		trigger: null,
		menu: null,
		filterInput: null,
	};

	// Bound event handlers for cleanup
	private boundHandleDocumentClick: (e: MouseEvent) => void;
	private boundHandleMenuClick: (e: MouseEvent) => void;
	private boundHandleTriggerClick: (e: MouseEvent) => void;
	private boundHandleKeydown: (e: KeyboardEvent) => void;
	private boundHandleFilterInput: (e: Event) => void;

	constructor(container: HTMLElement, config: DropdownUIConfig, events: DropdownUIEvents) {
		this.container = container;
		this.config = config;
		this.events = events;

		// Initialize state
		this.state = {
			value: config.value,
			highlightedIndex: -1,
			filterText: '',
			filteredOptions: [...config.options],
		};

		// Bind event handlers
		this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
		this.boundHandleMenuClick = this.handleMenuClick.bind(this);
		this.boundHandleTriggerClick = this.handleTriggerClick.bind(this);
		this.boundHandleKeydown = this.handleKeydown.bind(this);
		this.boundHandleFilterInput = this.handleFilterInput.bind(this);

		this.render();
		this.attachEventListeners();
	}

	/**
	 * Render the dropdown component.
	 */
	private render(): void {
		this.container.empty();

		// Wrapper
		this.elements.wrapper = this.container.createDiv({ cls: 'spicy-dropdown' });

		// Trigger button
		this.elements.trigger = this.elements.wrapper.createDiv({
			cls: 'spicy-dropdown-trigger',
		});
		this.elements.trigger.setAttribute('tabindex', '0');
		this.elements.trigger.setAttribute('role', 'combobox');
		this.elements.trigger.setAttribute('aria-expanded', 'false');
		this.elements.trigger.setAttribute('aria-haspopup', 'listbox');
		this.renderTriggerContent();

		// Dropdown menu - render to document.body to escape overflow:hidden containers
		this.elements.menu = document.body.createDiv({
			cls: 'spicy-dropdown-menu hidden',
		});
		this.elements.menu.setAttribute('role', 'listbox');

		// Filter input (for type-to-filter) - only if more than 5 options
		if (this.config.options.length > 5) {
			this.elements.filterInput = this.elements.menu.createEl('input', {
				cls: 'spicy-dropdown-filter',
				attr: {
					type: 'text',
					placeholder: 'Type to filter...',
					'aria-label': 'Filter options',
				},
			});
		}

		// Render options
		this.renderOptions();
	}

	/**
	 * Render the trigger button content.
	 */
	private renderTriggerContent(): void {
		if (!this.elements.trigger) return;

		const trigger = this.elements.trigger;
		trigger.empty();

		const values = this.normalizeToArray(this.state.value);
		const placeholder = this.config.placeholder || (this.config.multi ? 'Select options...' : 'Select...');

		if (this.config.multi) {
			// Multi-select: show pills
			if (values.length === 0) {
				trigger.addClass('empty');
				trigger.removeClass('mismatch');
				trigger.createSpan({ text: placeholder });
			} else {
				trigger.removeClass('empty');
				trigger.removeClass('mismatch');
				const pillsContainer = trigger.createDiv({ cls: 'spicy-dropdown-pills' });

				for (const val of values) {
					const pill = pillsContainer.createDiv({ cls: 'spicy-dropdown-pill' });
					pill.createSpan({ text: String(val) });

					pill.createSpan({
						cls: 'spicy-dropdown-pill-remove',
						text: '×',
						attr: {
							'aria-label': `Remove ${val}`,
							'data-value': String(val),
						},
					});
				}
			}
		} else {
			// Single-select: show value or placeholder
			if (values.length === 0) {
				trigger.addClass('empty');
				trigger.removeClass('mismatch');
				trigger.createSpan({ text: placeholder });
			} else {
				trigger.removeClass('empty');
				const value = values[0];
				const isValid = this.config.options.includes(value);

				if (!isValid) {
					trigger.addClass('mismatch');
				} else {
					trigger.removeClass('mismatch');
				}

				trigger.createSpan({ text: String(value) });
			}
		}

		// Dropdown arrow
		trigger.createSpan({ cls: 'spicy-dropdown-arrow', text: '▼' });
	}

	/**
	 * Render the options list.
	 */
	private renderOptions(): void {
		if (!this.elements.menu) return;

		// Clear existing options (keep filter input)
		const existingOptions = this.elements.menu.querySelectorAll('.spicy-dropdown-option');
		existingOptions.forEach((el) => el.remove());

		const selectedValues = this.normalizeToArray(this.state.value);

		for (let i = 0; i < this.state.filteredOptions.length; i++) {
			const option = this.state.filteredOptions[i];
			const isSelected = selectedValues.includes(option);
			const isHighlighted = i === this.state.highlightedIndex;

			const classes = ['spicy-dropdown-option'];
			if (isSelected) classes.push('selected');
			if (isHighlighted) classes.push('highlighted');

			const optionEl = this.elements.menu.createDiv({
				cls: classes.join(' '),
				attr: {
					'data-index': String(i),
					'data-value': String(option),
					role: 'option',
					'aria-selected': String(isSelected),
				},
			});

			if (this.config.multi) {
				// Multi-select: checkbox visual
				const checkbox = optionEl.createEl('input', {
					type: 'checkbox',
					attr: { tabindex: '-1' },
				});
				checkbox.checked = isSelected;
			}

			optionEl.createSpan({ text: String(option) });
		}
	}

	/**
	 * Attach event listeners using event delegation.
	 */
	private attachEventListeners(): void {
		if (!this.elements.trigger || !this.elements.menu) return;

		// Trigger click - toggle dropdown
		this.elements.trigger.addEventListener('click', this.boundHandleTriggerClick);

		// Keyboard navigation on trigger
		this.elements.trigger.addEventListener('keydown', this.boundHandleKeydown);

		// Event delegation: single click handler on menu
		this.elements.menu.addEventListener('click', this.boundHandleMenuClick);

		// Filter input
		if (this.elements.filterInput) {
			this.elements.filterInput.addEventListener('input', this.boundHandleFilterInput);
			this.elements.filterInput.addEventListener('keydown', this.boundHandleKeydown);
		}

		// Click outside to close - use capture phase for reliability
		// This ensures we catch the click before it propagates
		document.addEventListener('click', this.boundHandleDocumentClick, true);
	}

	/**
	 * Handle trigger click.
	 * Prevents default to stop Obsidian's native property autocomplete from triggering.
	 */
	private handleTriggerClick(e: MouseEvent): void {
		e.preventDefault();
		e.stopPropagation();

		// Check if click was on a pill remove button
		const target = e.target as HTMLElement;
		if (target.classList.contains('spicy-dropdown-pill-remove')) {
			const value = target.getAttribute('data-value');
			if (value !== null) {
				this.removeValue(value);
			}
			return;
		}

		this.toggle();
	}

	/**
	 * Handle menu click using event delegation.
	 * Prevents default to stop Obsidian's native behavior.
	 */
	private handleMenuClick(e: MouseEvent): void {
		e.preventDefault();
		e.stopPropagation();

		// Keep focus within our component to prevent Obsidian's focus management
		this.elements.trigger?.focus();

		const target = e.target as HTMLElement;
		const optionEl = target.closest('.spicy-dropdown-option') as HTMLElement | null;

		if (optionEl) {
			const value = optionEl.getAttribute('data-value');
			if (value !== null) {
				// Determine if this is a number or string based on options
				const parsedValue = this.parseOptionValue(value);
				this.selectOption(parsedValue);
			}
		}
	}

	/**
	 * Handle document click to close dropdown.
	 */
	private handleDocumentClick(e: MouseEvent): void {
		if (!this.isOpen || !this.elements.wrapper) return;

		const target = e.target as Node;

		// Check if click is inside wrapper (trigger) OR inside menu (which is in document.body)
		const isInsideWrapper = this.elements.wrapper.contains(target);
		const isInsideMenu = this.elements.menu?.contains(target) ?? false;

		if (!isInsideWrapper && !isInsideMenu) {
			this.close();
		}
	}

	/**
	 * Handle keyboard navigation.
	 */
	private handleKeydown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'Enter':
				e.preventDefault();
				if (this.isOpen && this.state.highlightedIndex >= 0) {
					this.selectOption(this.state.filteredOptions[this.state.highlightedIndex]);
				} else {
					this.toggle();
				}
				break;

			case 'Escape':
				e.preventDefault();
				this.close();
				break;

			case 'ArrowDown':
				e.preventDefault();
				if (!this.isOpen) {
					this.open();
				} else {
					this.highlightNext();
				}
				break;

			case 'ArrowUp':
				e.preventDefault();
				if (this.isOpen) {
					this.highlightPrevious();
				}
				break;

			default:
				// Type to filter (if not in filter input)
				if (e.key.length === 1 && !this.elements.filterInput?.matches(':focus')) {
					if (!this.isOpen) {
						this.open();
					}
					if (this.elements.filterInput) {
						this.elements.filterInput.focus();
						this.elements.filterInput.value += e.key;
						this.state.filterText = this.elements.filterInput.value;
						this.filterOptions();
					}
				}
		}
	}

	/**
	 * Handle filter input.
	 */
	private handleFilterInput(e: Event): void {
		const input = e.target as HTMLInputElement;
		this.state.filterText = input.value;
		this.filterOptions();
	}

	/**
	 * Toggle the dropdown open/closed.
	 */
	toggle(): void {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	/**
	 * Open the dropdown.
	 */
	open(): void {
		if (this.isDestroyed || this.isOpen) return;

		this.isOpen = true;

		// CRITICAL: Notify parent FIRST to acquire interaction lock
		// This prevents Obsidian's re-renders from destroying us mid-open
		this.events.onOpen();

		// Position menu relative to trigger (menu is in document.body)
		this.positionMenu();

		this.elements.menu?.removeClass('hidden');
		this.elements.trigger?.setAttribute('aria-expanded', 'true');
		this.state.highlightedIndex = -1;

		// Focus management: prevent Obsidian from moving focus elsewhere
		if (this.elements.filterInput) {
			// Focus filter input if present (for many options)
			this.elements.filterInput.focus();
		} else {
			// Keep focus on trigger to prevent Obsidian's focus management
			// from moving focus to adjacent property fields
			this.elements.trigger?.focus();
		}
	}

	/**
	 * Position the dropdown menu relative to the trigger.
	 * Menu is rendered to document.body, so we need fixed positioning.
	 */
	private positionMenu(): void {
		if (!this.elements.trigger || !this.elements.menu) return;

		const triggerRect = this.elements.trigger.getBoundingClientRect();

		this.elements.menu.style.position = 'fixed';
		this.elements.menu.style.top = `${triggerRect.bottom + 4}px`;
		this.elements.menu.style.left = `${triggerRect.left}px`;
		this.elements.menu.style.width = `${triggerRect.width}px`;
		this.elements.menu.style.zIndex = '9999';
	}

	/**
	 * Close the dropdown.
	 */
	close(): void {
		if (this.isDestroyed || !this.isOpen) return;

		this.isOpen = false;
		this.elements.menu?.addClass('hidden');
		this.elements.trigger?.setAttribute('aria-expanded', 'false');

		// Reset filter
		this.state.filterText = '';
		if (this.elements.filterInput) {
			this.elements.filterInput.value = '';
		}
		this.state.filteredOptions = [...this.config.options];
		this.renderOptions();

		this.events.onClose();
	}

	/**
	 * Select an option.
	 */
	private selectOption(option: string | number): void {
		if (this.config.multi) {
			// Multi-select: toggle the option
			const currentValues = this.normalizeToArray(this.state.value);
			const index = currentValues.indexOf(option);

			let newValues: (string | number)[];
			if (index >= 0) {
				// Remove
				newValues = currentValues.filter((v) => v !== option);
			} else {
				// Add
				newValues = [...currentValues, option];
			}

			this.state.value = newValues;
			this.renderTriggerContent();
			this.renderOptions();
			this.events.onChange(newValues.length > 0 ? newValues : []);
			// Dropdown stays open for multi-select
		} else {
			// Single-select: set the value and close
			this.state.value = option;
			this.renderTriggerContent();
			this.events.onChange(option);
			this.close();
		}
	}

	/**
	 * Remove a value (for multi-select pills).
	 */
	private removeValue(valueToRemove: string): void {
		const currentValues = this.normalizeToArray(this.state.value);
		const parsedValue = this.parseOptionValue(valueToRemove);
		const newValues = currentValues.filter((v) => v !== parsedValue);

		this.state.value = newValues;
		this.renderTriggerContent();
		this.renderOptions();
		this.events.onChange(newValues.length > 0 ? newValues : []);
	}

	/**
	 * Highlight the next option.
	 */
	private highlightNext(): void {
		if (this.state.highlightedIndex < this.state.filteredOptions.length - 1) {
			this.state.highlightedIndex++;
			this.updateHighlight();
		}
	}

	/**
	 * Highlight the previous option.
	 */
	private highlightPrevious(): void {
		if (this.state.highlightedIndex > 0) {
			this.state.highlightedIndex--;
			this.updateHighlight();
		}
	}

	/**
	 * Update the highlight styling.
	 */
	private updateHighlight(): void {
		if (!this.elements.menu) return;

		const options = this.elements.menu.querySelectorAll('.spicy-dropdown-option');
		options.forEach((el, i) => {
			if (i === this.state.highlightedIndex) {
				el.addClass('highlighted');
				el.scrollIntoView({ block: 'nearest' });
			} else {
				el.removeClass('highlighted');
			}
		});
	}

	/**
	 * Filter options based on filter text.
	 */
	private filterOptions(): void {
		const filter = this.state.filterText.toLowerCase();

		this.state.filteredOptions = this.config.options.filter((opt) =>
			String(opt).toLowerCase().includes(filter)
		);

		this.state.highlightedIndex = this.state.filteredOptions.length > 0 ? 0 : -1;
		this.renderOptions();
	}

	/**
	 * Parse option value, preserving number type if original was number.
	 */
	private parseOptionValue(value: string): string | number {
		// Check if any original option is a number with this string representation
		const numericOption = this.config.options.find(
			(opt) => typeof opt === 'number' && String(opt) === value
		);
		if (numericOption !== undefined) {
			return numericOption as number;
		}
		return value;
	}

	/**
	 * Normalize value to array for consistent handling.
	 */
	private normalizeToArray(value: DropdownValue): (string | number)[] {
		if (value === null || value === undefined) {
			return [];
		}
		if (Array.isArray(value)) {
			return value.filter((v): v is string | number =>
				typeof v === 'string' || typeof v === 'number'
			);
		}
		if (typeof value === 'string' || typeof value === 'number') {
			return [value];
		}
		return [];
	}

	// ═══════════════════════════════════════════════════════════════════
	// Public API
	// ═══════════════════════════════════════════════════════════════════

	/**
	 * Update the dropdown value externally.
	 */
	setValue(newValue: DropdownValue): void {
		if (this.isDestroyed) return;

		this.state.value = newValue;
		this.renderTriggerContent();

		if (this.isOpen) {
			this.renderOptions();
		}
	}

	/**
	 * Get the current value.
	 */
	getValue(): DropdownValue {
		return this.state.value;
	}

	/**
	 * Check if the dropdown is currently open (interacting).
	 */
	isInteracting(): boolean {
		return this.isOpen;
	}

	/**
	 * Clean up event listeners and DOM.
	 */
	destroy(): void {
		if (this.isDestroyed) return;
		this.isDestroyed = true;

		// Remove document-level listener
		document.removeEventListener('click', this.boundHandleDocumentClick, true);

		// Remove element-level listeners
		if (this.elements.trigger) {
			this.elements.trigger.removeEventListener('click', this.boundHandleTriggerClick);
			this.elements.trigger.removeEventListener('keydown', this.boundHandleKeydown);
		}

		if (this.elements.menu) {
			this.elements.menu.removeEventListener('click', this.boundHandleMenuClick);
			// Menu is appended to document.body, so we need to remove it explicitly
			this.elements.menu.remove();
		}

		if (this.elements.filterInput) {
			this.elements.filterInput.removeEventListener('input', this.boundHandleFilterInput);
			this.elements.filterInput.removeEventListener('keydown', this.boundHandleKeydown);
		}

		// Clear container (wrapper and trigger)
		this.container.empty();

		// Clear element references
		this.elements = {
			wrapper: null,
			trigger: null,
			menu: null,
			filterInput: null,
		};
	}
}
