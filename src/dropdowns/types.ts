/**
 * Types for the Spicy Dropdowns feature.
 */

/**
 * Definition for a single dropdown property.
 */
export interface DropdownDefinition {
	/** Property name in frontmatter (e.g., "status", "entry_type") */
	property: string;

	/** List of valid options for the dropdown */
	options: (string | number)[];

	/** If true, allows selecting multiple values (renders as checkboxes) */
	multi?: boolean;

	/** If true, this property should use native input (disables inherited dropdown) */
	disabled?: boolean;
}

/**
 * Collection of dropdown definitions for a scope (folder or global).
 */
export interface DropdownDefinitions {
	/** Map of property name to definition */
	definitions: Map<string, DropdownDefinition>;

	/** Source file path (e.g., "Health/_dropdowns.md") or "global" */
	source: string;
}

/**
 * Raw YAML structure from _dropdowns.md file.
 * This is what we parse before transforming to DropdownDefinition.
 */
export interface RawDropdownYAML {
	[property: string]: {
		options?: (string | number)[];
		multi?: boolean;
		disabled?: boolean;
	};
}

/**
 * State of a dropdown property value.
 */
export interface DropdownValueState {
	/** Current value(s) from frontmatter */
	value: string | string[] | number | number[] | null;

	/** Whether the value matches one of the defined options */
	isValid: boolean;

	/** For multi-select, which options are currently selected */
	selectedOptions: (string | number)[];
}

/**
 * Events emitted by the DropdownManager.
 */
export type DropdownManagerEvent =
	| { type: 'definitions-loaded'; path: string }
	| { type: 'definitions-error'; path: string; error: string }
	| { type: 'definitions-cleared' };
