/**
 * TablePersistence - Modify markdown table cells and persist to file
 *
 * Handles updating specific cells in markdown tables while preserving
 * table formatting and alignment. Uses the Obsidian Vault API for file
 * operations.
 *
 * Key features:
 * - Single cell updates
 * - Batch updates (multiple cells in one write)
 * - Alignment preservation (left, center, right)
 * - Special character escaping (pipes, newlines)
 * - Multi-value cell formatting (for multi-select dropdowns)
 */

import { App, TFile } from 'obsidian';
import { ParseResult, success, failure } from '@shared/types';
import {
	parseTablesFromMarkdown,
	getCellPosition,
	ParsedTableWithAlignment,
	parseTableAtLine,
	ColumnAlignment,
} from './TableParser';
import { CellPosition, ParsedTable } from './types';

/**
 * Cell update specification for batch operations.
 */
export interface CellUpdate {
	tableIndex: number;
	rowIndex: number;
	columnIndex: number;
	newValue: string;
}

/**
 * Update a specific cell in a markdown table.
 * Preserves table alignment and formatting.
 *
 * @param app - Obsidian App instance
 * @param file - File containing the table
 * @param tableIndex - Which table in file (0-based)
 * @param rowIndex - Data row (0-based, excludes header)
 * @param columnIndex - Column (0-based)
 * @param newValue - New cell value
 * @returns ParseResult indicating success or failure
 */
export async function updateTableCell(
	app: App,
	file: TFile,
	tableIndex: number,
	rowIndex: number,
	columnIndex: number,
	newValue: string
): Promise<ParseResult<void>> {
	return updateTableCells(app, file, [
		{ tableIndex, rowIndex, columnIndex, newValue },
	]);
}

/**
 * Update multiple cells in a single write operation.
 * More efficient than multiple single-cell updates.
 *
 * @param app - Obsidian App instance
 * @param file - File containing the table(s)
 * @param updates - Array of cell updates to apply
 * @returns ParseResult indicating success or failure
 */
export async function updateTableCells(
	app: App,
	file: TFile,
	updates: CellUpdate[]
): Promise<ParseResult<void>> {
	if (updates.length === 0) {
		return success(undefined);
	}

	// Read current file content
	let content: string;
	try {
		content = await app.vault.read(file);
	} catch (err) {
		return failure(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
	}

	// Parse all tables to get current structure
	const tables = parseTablesFromMarkdown(content);
	if (tables.length === 0) {
		return failure('File contains no tables');
	}

	// Validate all updates first
	for (const update of updates) {
		const validation = validateCellUpdate(tables, update);
		if (!validation.success) {
			return validation;
		}
	}

	// Apply updates to content
	// Process updates in reverse order by position to avoid offset issues
	const sortedUpdates = [...updates].sort((a, b) => {
		// Sort by table index descending, then row descending, then column descending
		if (a.tableIndex !== b.tableIndex) {
			return b.tableIndex - a.tableIndex;
		}
		if (a.rowIndex !== b.rowIndex) {
			return b.rowIndex - a.rowIndex;
		}
		return b.columnIndex - a.columnIndex;
	});

	let newContent = content;
	const lines = newContent.split('\n');

	for (const update of sortedUpdates) {
		const table = tables[update.tableIndex];
		const cellPosition = getCellPosition(table, update.rowIndex, update.columnIndex);

		if (!cellPosition) {
			return failure(
				`Cell not found at table ${update.tableIndex}, row ${update.rowIndex}, column ${update.columnIndex}`
			);
		}

		// Format the new value (escape pipes, handle special chars)
		const formattedValue = formatCellValue(update.newValue);

		// Update the line containing this cell
		const line = lines[cellPosition.line];
		const newLine = replaceInLine(
			line,
			cellPosition.startChar,
			cellPosition.endChar,
			formattedValue
		);
		lines[cellPosition.line] = newLine;
	}

	newContent = lines.join('\n');

	// Write back to file
	try {
		await app.vault.modify(file, newContent);
	} catch (err) {
		return failure(`Failed to write file: ${err instanceof Error ? err.message : String(err)}`);
	}

	return success(undefined);
}

/**
 * Format a cell value for insertion into a markdown table.
 * Escapes special characters and handles various value types.
 *
 * @param value - The value to format (string, number, array, or null/undefined)
 * @returns Formatted string safe for table cell
 */
export function formatCellValue(value: unknown): string {
	// Handle null/undefined
	if (value === null || value === undefined) {
		return '';
	}

	// Handle arrays (multi-select values)
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return '';
		}
		// Join with comma-space, each value individually escaped
		return value.map((v) => formatSingleValue(v)).join(', ');
	}

	return formatSingleValue(value);
}

/**
 * Format a single value (not an array).
 */
function formatSingleValue(value: unknown): string {
	// Handle null/undefined
	if (value === null || value === undefined) {
		return '';
	}

	// Handle booleans
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}

	// Handle numbers
	if (typeof value === 'number') {
		return String(value);
	}

	// Handle strings
	let str = String(value).trim();

	// Escape pipe characters (| -> \|)
	str = escapePipes(str);

	// Remove newlines (replace with space)
	str = str.replace(/[\r\n]+/g, ' ');

	return str;
}

/**
 * Escape pipe characters in a string.
 * Only escapes unescaped pipes.
 *
 * @param str - Input string
 * @returns String with pipes escaped
 */
export function escapePipes(str: string): string {
	// Use a regex that matches | not preceded by \
	// We need to be careful not to double-escape
	const result: string[] = [];
	let i = 0;

	while (i < str.length) {
		const char = str[i];

		if (char === '\\' && i + 1 < str.length && str[i + 1] === '|') {
			// Already escaped pipe, keep as is
			result.push('\\|');
			i += 2;
		} else if (char === '|') {
			// Unescaped pipe, escape it
			result.push('\\|');
			i++;
		} else {
			result.push(char);
			i++;
		}
	}

	return result.join('');
}

/**
 * Parse a multi-value cell into an array.
 * Values are comma-separated.
 *
 * @param cellContent - The cell content to parse
 * @returns Array of individual values
 */
export function parseMultiValue(cellContent: string): string[] {
	if (!cellContent || cellContent.trim() === '') {
		return [];
	}

	// Split by comma, but respect escaped commas
	// For now, simple split - commas inside values would need escaping
	return cellContent
		.split(',')
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
}

/**
 * Replace a portion of a line with new content.
 *
 * @param line - Original line
 * @param startChar - Start position (inclusive)
 * @param endChar - End position (exclusive)
 * @param replacement - Replacement text
 * @returns Modified line
 */
function replaceInLine(
	line: string,
	startChar: number,
	endChar: number,
	replacement: string
): string {
	// Handle empty cell case where startChar === endChar
	// In this case, we're inserting at that position
	const before = line.substring(0, startChar);
	const after = line.substring(endChar);

	// Add padding around the replacement for readability
	// Only if we're replacing actual cell content (not just inserting)
	const needsSpacing = replacement.length > 0;
	const paddedReplacement = needsSpacing ? ` ${replacement} ` : ' ';

	// Check if there's already spacing around the cell
	const hasLeadingSpace = before.endsWith(' ') || before.endsWith('|');
	const hasTrailingSpace = after.startsWith(' ') || after.startsWith('|');

	// Build the replacement with appropriate spacing
	let finalReplacement = replacement;
	if (!hasLeadingSpace && replacement.length > 0) {
		finalReplacement = ' ' + finalReplacement;
	}
	if (!hasTrailingSpace && replacement.length > 0) {
		finalReplacement = finalReplacement + ' ';
	}

	// For empty replacement, ensure at least one space between pipes
	if (replacement.length === 0) {
		const afterPipe = before.endsWith('|');
		const beforePipe = after.startsWith('|');
		if (afterPipe && beforePipe) {
			finalReplacement = ' ';
		}
	}

	return before + finalReplacement + after;
}

/**
 * Validate that a cell update is valid for the given tables.
 *
 * @param tables - Parsed tables from the file
 * @param update - The update to validate
 * @returns ParseResult indicating success or validation error
 */
function validateCellUpdate(
	tables: ParsedTable[],
	update: CellUpdate
): ParseResult<void> {
	// Validate table index
	if (update.tableIndex < 0 || update.tableIndex >= tables.length) {
		return failure(
			`Invalid table index ${update.tableIndex}. File has ${tables.length} table(s).`
		);
	}

	const table = tables[update.tableIndex];

	// Validate row index
	if (update.rowIndex < 0 || update.rowIndex >= table.cells.length) {
		return failure(
			`Invalid row index ${update.rowIndex}. Table has ${table.cells.length} data row(s).`
		);
	}

	// Validate column index
	if (update.columnIndex < 0 || update.columnIndex >= table.headers.length) {
		return failure(
			`Invalid column index ${update.columnIndex}. Table has ${table.headers.length} column(s).`
		);
	}

	return success(undefined);
}

/**
 * Preserve column alignment when updating a cell.
 * Pads the value according to the column's alignment.
 *
 * @param value - The value to pad
 * @param width - Target width
 * @param alignment - Column alignment
 * @returns Padded value
 */
export function preserveAlignment(
	value: string,
	width: number,
	alignment: ColumnAlignment
): string {
	if (value.length >= width) {
		return value;
	}

	const padding = width - value.length;

	switch (alignment) {
		case 'right':
			return ' '.repeat(padding) + value;
		case 'center': {
			const leftPad = Math.floor(padding / 2);
			const rightPad = padding - leftPad;
			return ' '.repeat(leftPad) + value + ' '.repeat(rightPad);
		}
		case 'left':
		default:
			return value + ' '.repeat(padding);
	}
}

/**
 * Get the current content of a cell from a file.
 *
 * @param app - Obsidian App instance
 * @param file - File containing the table
 * @param tableIndex - Which table in file (0-based)
 * @param rowIndex - Data row (0-based, excludes header)
 * @param columnIndex - Column (0-based)
 * @returns ParseResult with cell content or error
 */
export async function getCellContent(
	app: App,
	file: TFile,
	tableIndex: number,
	rowIndex: number,
	columnIndex: number
): Promise<ParseResult<string>> {
	let content: string;
	try {
		content = await app.vault.read(file);
	} catch (err) {
		return failure(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
	}

	const tables = parseTablesFromMarkdown(content);

	if (tableIndex < 0 || tableIndex >= tables.length) {
		return failure(`Invalid table index ${tableIndex}. File has ${tables.length} table(s).`);
	}

	const table = tables[tableIndex];
	const cellPosition = getCellPosition(table, rowIndex, columnIndex);

	if (!cellPosition) {
		return failure(
			`Cell not found at row ${rowIndex}, column ${columnIndex}`
		);
	}

	return success(cellPosition.content);
}
