/**
 * Types for the Table Dropdowns feature.
 */

/**
 * Definition for a single table column dropdown.
 */
export interface TableDropdownDefinition {
	/** Column header name (case-sensitive match) */
	column: string;

	/** List of valid options for the dropdown */
	options: (string | number)[];

	/** If true, allows selecting multiple values (renders as checkboxes) */
	multi?: boolean;
}

/**
 * Collection of table dropdown definitions for a scope (folder or global).
 */
export interface TableDropdownDefinitions {
	/** Map of column name to definition */
	definitions: Map<string, TableDropdownDefinition>;

	/** Source file path (e.g., "Projects/_dropdowns.md") or "global" */
	source: string;
}

/**
 * Raw YAML structure for tables section in _dropdowns.md file.
 * This is what we parse before transforming to TableDropdownDefinition.
 */
export interface RawTableDropdownYAML {
	[column: string]: {
		options?: (string | number)[];
		multi?: boolean;
	};
}

/**
 * Context for a specific table cell being rendered as a dropdown.
 */
export interface TableCellContext {
	/** Path to the file containing the table */
	filePath: string;

	/** Index of this table within the file (0-based, for files with multiple tables) */
	tableIndex: number;

	/** Row index within the table (0-based, excluding header row) */
	rowIndex: number;

	/** Column index within the row (0-based) */
	columnIndex: number;

	/** Column header name for this cell */
	columnName: string;

	/** Current value of the cell */
	currentValue: string;
}

/**
 * Exact position of a cell within markdown source.
 */
export interface CellPosition {
	/** Line number in the file (0-based) */
	line: number;

	/** Start character offset within the line */
	startChar: number;

	/** End character offset within the line */
	endChar: number;

	/** Cell content (trimmed, without pipe delimiters) */
	content: string;
}

/**
 * Result of parsing a markdown table.
 */
export interface ParsedTable {
	/** First line of the table (0-based) */
	startLine: number;

	/** Last line of the table (0-based) */
	endLine: number;

	/** Column header names in order */
	headers: string[];

	/** Cell positions organized as [row][column] */
	cells: CellPosition[][];
}

/**
 * Events emitted by the TableDropdownManager.
 */
export type TableDropdownManagerEvent =
	| { type: 'definitions-loaded'; path: string }
	| { type: 'definitions-error'; path: string; error: string }
	| { type: 'definitions-cleared' };
