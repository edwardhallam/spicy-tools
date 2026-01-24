/**
 * Types for the Kanban Boards feature.
 */

/**
 * Configuration for a Kanban board, parsed from _board.md.
 */
export interface BoardConfig {
	// Required fields
	/** Frontmatter property that determines which column a card belongs to */
	columnProperty: string;

	/** Ordered list of column values */
	columns: string[];

	// Board metadata
	/** Display title for the board */
	title?: string;

	// Card display
	/** Property to show as card title (default: filename) */
	cardTitle?: string;

	/** Property to show as preview text below title */
	cardPreview?: string;

	/** Max lines of preview text (default: 2) */
	cardPreviewLines?: number;

	// Labels
	/** Property containing labels (e.g., "tags") */
	labelProperty?: string;

	/** How to display labels: 'chips' (colored pills) or 'stripe' (left border) */
	labelDisplay?: 'chips' | 'stripe';

	/** Map of label values to CSS color names or hex codes */
	labelColors?: Record<string, string>;

	// Swimlanes
	/** Property for horizontal grouping into swimlanes */
	swimlaneProperty?: string;

	/** Whether swimlanes can be collapsed */
	swimlanesCollapsible?: boolean;

	/** Swimlanes that are currently collapsed (managed by plugin) */
	collapsedSwimlanes?: string[];

	// Templates
	/** Path to template file for "Add card" button */
	newCardTemplate?: string;

	// Card order (managed by plugin)
	/** Persisted card order per column */
	cardOrder?: Record<string, string[]>;
}

/**
 * A card on the Kanban board (represents a markdown file).
 */
export interface Card {
	/** File path relative to vault root */
	filePath: string;

	/** Filename without extension */
	filename: string;

	/** Display title (from cardTitle property or filename) */
	title: string;

	/** Preview text (from cardPreview property) */
	preview?: string;

	/** Labels (from labelProperty) */
	labels: string[];

	/** Current column value (from columnProperty) */
	columnValue: string | null;

	/** Swimlane value (from swimlaneProperty) */
	swimlaneValue?: string | null;

	/** Whether the card is archived */
	archived: boolean;
}

/**
 * A column on the Kanban board.
 */
export interface Column {
	/** Column identifier (matches values in frontmatter) */
	id: string;

	/** Display name (same as id for now, could be configurable) */
	name: string;

	/** Cards in this column, in display order */
	cards: Card[];
}

/**
 * A swimlane (horizontal grouping) on the board.
 */
export interface Swimlane {
	/** Swimlane identifier (value from swimlaneProperty) */
	id: string;

	/** Display name */
	name: string;

	/** Whether currently collapsed */
	collapsed: boolean;

	/** Columns within this swimlane (same columns, filtered cards) */
	columns: Column[];
}

/**
 * Complete board state.
 */
export interface BoardState {
	/** Board configuration */
	config: BoardConfig;

	/** All columns (when not using swimlanes) */
	columns: Column[];

	/** Swimlanes (when swimlaneProperty is configured) */
	swimlanes?: Swimlane[];

	/** Uncategorized cards (column value doesn't match any defined column) */
	uncategorized: Card[];

	/** Source folder path */
	folderPath: string;
}

/**
 * Raw YAML structure from _board.md file.
 */
export interface RawBoardYAML {
	columnProperty: string;
	columns: string[];
	title?: string;
	cardTitle?: string;
	cardPreview?: string;
	cardPreviewLines?: number;
	labelProperty?: string;
	labelDisplay?: 'chips' | 'stripe';
	labelColors?: Record<string, string>;
	swimlaneProperty?: string;
	swimlanesCollapsible?: boolean;
	collapsedSwimlanes?: string[];
	newCardTemplate?: string;
	cardOrder?: Record<string, string[]>;
}

/**
 * Events emitted by the BoardManager.
 */
export type BoardManagerEvent =
	| { type: 'board-loaded'; path: string }
	| { type: 'board-error'; path: string; error: string }
	| { type: 'card-moved'; card: Card; fromColumn: string; toColumn: string }
	| { type: 'card-reordered'; column: string; order: string[] }
	| { type: 'card-created'; card: Card }
	| { type: 'card-archived'; card: Card }
	| { type: 'file-changed'; filePath: string }
	| { type: 'swimlane-toggled'; swimlaneId: string; collapsed: boolean };
