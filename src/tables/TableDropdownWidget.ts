/**
 * TableDropdownWidget - Pure UI Component for Table Cell Dropdowns
 *
 * A lightweight wrapper around DropdownUI specifically designed for table cells.
 * This component adapts DropdownUI for use in both Reading View (markdownPostProcessor)
 * and Live Preview (CodeMirror 6 ViewPlugin).
 *
 * Key design decisions:
 * - Pure UI component with no Obsidian dependencies
 * - Wraps DropdownUI for consistent behavior with property dropdowns
 * - Simplified API focused on table cell use case
 * - Compact styling via existing CSS (table td .spicy-dropdown selectors)
 */

import { DropdownUI, DropdownUIConfig, DropdownUIEvents, DropdownValue } from '@dropdowns/DropdownUI';

/**
 * Configuration for the TableDropdownWidget.
 */
export interface TableDropdownWidgetConfig {
	/** Available options to choose from */
	options: (string | number)[];

	/** Current selected value */
	currentValue: string;

	/** Whether multiple values can be selected */
	multi?: boolean;

	/** Called when value changes */
	onChange: (newValue: string) => void;
}

/**
 * Pure UI component for rendering dropdowns inside table cells.
 *
 * This widget wraps DropdownUI and adapts it for the table cell context:
 * - Converts string currentValue to appropriate DropdownValue type
 * - Converts DropdownValue changes back to string for persistence
 * - Handles multi-value serialization (comma-separated)
 */
export class TableDropdownWidget {
	private container: HTMLElement;
	private config: TableDropdownWidgetConfig;
	private dropdownUI: DropdownUI | null = null;
	private isDestroyed = false;

	constructor(container: HTMLElement, config: TableDropdownWidgetConfig) {
		this.container = container;
		this.config = config;
	}

	/**
	 * Render the dropdown widget into the container.
	 */
	render(): void {
		if (this.isDestroyed) return;

		// Parse current value into appropriate format
		const value = this.parseValue(this.config.currentValue);

		// Build DropdownUI config
		const dropdownConfig: DropdownUIConfig = {
			options: this.config.options,
			value: value,
			multi: this.config.multi ?? false,
			placeholder: 'Select...',
		};

		// Build event handlers
		const events: DropdownUIEvents = {
			onOpen: () => {
				// No-op for table dropdowns (no interaction lock needed)
			},
			onClose: () => {
				// No-op for table dropdowns
			},
			onChange: (newValue: DropdownValue) => {
				// Convert DropdownValue to string for persistence
				const stringValue = this.serializeValue(newValue);
				this.config.onChange(stringValue);
			},
		};

		// Create the underlying DropdownUI
		this.dropdownUI = new DropdownUI(this.container, dropdownConfig, events);
	}

	/**
	 * Clean up the widget and release resources.
	 */
	destroy(): void {
		if (this.isDestroyed) return;
		this.isDestroyed = true;

		if (this.dropdownUI) {
			this.dropdownUI.destroy();
			this.dropdownUI = null;
		}
	}

	/**
	 * Get the current value as a string.
	 */
	getValue(): string {
		if (!this.dropdownUI) return this.config.currentValue;
		return this.serializeValue(this.dropdownUI.getValue());
	}

	/**
	 * Set the current value from a string.
	 */
	setValue(value: string): void {
		if (!this.dropdownUI || this.isDestroyed) return;
		const parsedValue = this.parseValue(value);
		this.dropdownUI.setValue(parsedValue);
	}

	/**
	 * Check if the dropdown is currently interacting (open).
	 */
	isInteracting(): boolean {
		return this.dropdownUI?.isInteracting() ?? false;
	}

	/**
	 * Parse a string value into DropdownValue format.
	 * For multi-select, splits comma-separated values.
	 */
	private parseValue(value: string): DropdownValue {
		const trimmed = value.trim();

		if (trimmed === '') {
			return this.config.multi ? [] : null;
		}

		if (this.config.multi) {
			// Split by comma and trim each value
			const values = trimmed.split(',').map((v) => v.trim()).filter((v) => v !== '');

			// Convert to numbers if they match numeric options
			return values.map((v) => this.parseOptionValue(v));
		}

		// Single value - check if it should be a number
		return this.parseOptionValue(trimmed);
	}

	/**
	 * Serialize a DropdownValue back to a string for markdown persistence.
	 * Multi-values are joined with comma and space.
	 */
	private serializeValue(value: DropdownValue): string {
		if (value === null || value === undefined) {
			return '';
		}

		if (Array.isArray(value)) {
			return value.map((v) => String(v)).join(', ');
		}

		return String(value);
	}

	/**
	 * Parse a string value, preserving number type if it matches a numeric option.
	 */
	private parseOptionValue(value: string): string | number {
		// Check if any option is a number with this string representation
		const numericOption = this.config.options.find(
			(opt) => typeof opt === 'number' && String(opt) === value
		);

		if (numericOption !== undefined) {
			return numericOption as number;
		}

		return value;
	}
}
