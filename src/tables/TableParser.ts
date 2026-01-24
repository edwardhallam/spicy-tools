/**
 * TableParser - Parse markdown tables with cell position tracking
 *
 * Extracts table structure from markdown content, tracking exact character
 * positions for each cell to enable precise modifications.
 *
 * Key features:
 * - Parses all tables in a file
 * - Tracks cell positions (line, start/end character offsets)
 * - Handles edge cases (empty cells, escaped pipes, whitespace)
 * - Returns ParseResult<T> for error handling
 */

import { ParseResult, success, failure } from '@shared/types';
import { CellPosition, ParsedTable } from './types';

/**
 * Column alignment detected from the separator row.
 */
export type ColumnAlignment = 'left' | 'center' | 'right';

/**
 * Extended table info including alignment data.
 */
export interface ParsedTableWithAlignment extends ParsedTable {
	/** Column alignments parsed from separator row */
	alignments: ColumnAlignment[];
}

/**
 * Regex to detect a table row (starts with optional whitespace then pipe).
 */
const TABLE_ROW_REGEX = /^\s*\|/;

/**
 * Regex to detect a separator row (dashes with optional alignment colons).
 * Matches: |---|, |:---|, |---:|, |:---:|
 */
const SEPARATOR_CELL_REGEX = /^\s*:?-+:?\s*$/;

/**
 * Parse all tables from markdown content.
 *
 * @param content - Raw markdown content
 * @returns Array of ParsedTable with headers, cell positions, and line numbers
 */
export function parseTablesFromMarkdown(content: string): ParsedTable[] {
	const lines = content.split('\n');
	const tables: ParsedTable[] = [];
	let i = 0;

	while (i < lines.length) {
		// Look for potential table start (line starting with |)
		if (isTableRow(lines[i])) {
			const tableResult = parseTableAtLine(lines, i);

			if (tableResult.success) {
				tables.push(tableResult.data);
				// Skip past this table
				i = tableResult.data.endLine + 1;
				continue;
			}
		}
		i++;
	}

	return tables;
}

/**
 * Find the table containing a specific line number.
 *
 * @param content - Raw markdown content
 * @param lineNumber - 0-based line number to find
 * @returns ParsedTable if line is within a table, null otherwise
 */
export function findTableContainingLine(
	content: string,
	lineNumber: number
): ParsedTable | null {
	const tables = parseTablesFromMarkdown(content);

	for (const table of tables) {
		if (lineNumber >= table.startLine && lineNumber <= table.endLine) {
			return table;
		}
	}

	return null;
}

/**
 * Get a specific cell position from a parsed table.
 *
 * @param table - Parsed table
 * @param row - Row index (0 = first data row, not header)
 * @param column - Column index (0-based)
 * @returns CellPosition or null if out of bounds
 */
export function getCellPosition(
	table: ParsedTable,
	row: number,
	column: number
): CellPosition | null {
	if (row < 0 || row >= table.cells.length) {
		return null;
	}

	if (column < 0 || column >= table.cells[row].length) {
		return null;
	}

	return table.cells[row][column];
}

/**
 * Parse a table starting at a given line index.
 *
 * @param lines - All lines in the file
 * @param startIndex - Line index where table starts
 * @returns ParseResult with ParsedTable or error
 */
export function parseTableAtLine(
	lines: string[],
	startIndex: number
): ParseResult<ParsedTableWithAlignment> {
	// Validate we have at least header and separator rows
	if (startIndex + 1 >= lines.length) {
		return failure('Table must have at least header and separator rows');
	}

	const headerLine = lines[startIndex];
	const separatorLine = lines[startIndex + 1];

	// Parse header row
	const headerCells = parseCellsFromRow(headerLine, startIndex);
	if (headerCells.length === 0) {
		return failure('Header row has no cells');
	}

	// Validate separator row
	const separatorValidation = validateSeparatorRow(separatorLine, headerCells.length);
	if (!separatorValidation.success) {
		return failure(separatorValidation.error);
	}

	const alignments = separatorValidation.data;
	const headers = headerCells.map((cell) => cell.content);

	// Parse data rows
	const cells: CellPosition[][] = [];
	let endLine = startIndex + 1; // At minimum, ends at separator

	for (let i = startIndex + 2; i < lines.length; i++) {
		const line = lines[i];

		// Check if this is still a table row
		if (!isTableRow(line)) {
			break;
		}

		const rowCells = parseCellsFromRow(line, i);

		// Validate column count matches header
		if (rowCells.length !== headerCells.length) {
			// Be lenient: stop parsing but include rows so far
			// This handles tables that end abruptly or have irregular structure
			break;
		}

		cells.push(rowCells);
		endLine = i;
	}

	return success({
		startLine: startIndex,
		endLine,
		headers,
		cells,
		alignments,
	});
}

/**
 * Check if a line is a table row (starts with pipe).
 */
function isTableRow(line: string): boolean {
	return TABLE_ROW_REGEX.test(line);
}

/**
 * Validate and parse a separator row.
 *
 * @param line - The separator line
 * @param expectedColumns - Expected number of columns (from header)
 * @returns ParseResult with column alignments or error
 */
function validateSeparatorRow(
	line: string,
	expectedColumns: number
): ParseResult<ColumnAlignment[]> {
	if (!isTableRow(line)) {
		return failure('Separator row must start with pipe');
	}

	// Extract cells from separator row
	const cells = extractRawCells(line);

	if (cells.length !== expectedColumns) {
		return failure(
			`Separator row has ${cells.length} columns, expected ${expectedColumns}`
		);
	}

	const alignments: ColumnAlignment[] = [];

	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i].trim();

		if (!SEPARATOR_CELL_REGEX.test(cell)) {
			return failure(`Invalid separator cell at column ${i}: "${cell}"`);
		}

		alignments.push(parseAlignment(cell));
	}

	return success(alignments);
}

/**
 * Parse alignment from a separator cell.
 */
function parseAlignment(cell: string): ColumnAlignment {
	const trimmed = cell.trim();
	const startsWithColon = trimmed.startsWith(':');
	const endsWithColon = trimmed.endsWith(':');

	if (startsWithColon && endsWithColon) {
		return 'center';
	}
	if (endsWithColon) {
		return 'right';
	}
	return 'left';
}

/**
 * Parse cells from a table row, tracking exact positions.
 *
 * Handles:
 * - Escaped pipes: \|
 * - Empty cells: ||
 * - Whitespace trimming for content while preserving position
 *
 * @param line - The table row line
 * @param lineNumber - 0-based line number in the file
 * @returns Array of CellPosition for each cell
 */
export function parseCellsFromRow(line: string, lineNumber: number): CellPosition[] {
	const cells: CellPosition[] = [];
	const rawCells = extractRawCellsWithPositions(line);

	for (const rawCell of rawCells) {
		const content = rawCell.content.trim();

		// Calculate trimmed content positions
		const leadingWhitespace = rawCell.content.length - rawCell.content.trimStart().length;
		const trailingWhitespace =
			rawCell.content.length - rawCell.content.trimEnd().length;

		// Adjust positions to point to trimmed content
		// If cell is empty or all whitespace, positions point to the space between pipes
		let startChar = rawCell.startChar + leadingWhitespace;
		let endChar = rawCell.endChar - trailingWhitespace;

		// Handle empty cell case - ensure valid range
		if (startChar >= endChar) {
			// For empty cells, point to the position after the leading pipe
			startChar = rawCell.startChar;
			endChar = rawCell.startChar;
		}

		cells.push({
			line: lineNumber,
			startChar,
			endChar,
			content,
		});
	}

	return cells;
}

/**
 * Raw cell data before position calculation.
 */
interface RawCellWithPosition {
	content: string; // Raw content without pipe delimiters
	startChar: number; // Character position where content starts
	endChar: number; // Character position where content ends
}

/**
 * Extract raw cell contents with their positions from a table row.
 * Handles escaped pipes (\|) within cell content.
 */
function extractRawCellsWithPositions(line: string): RawCellWithPosition[] {
	const cells: RawCellWithPosition[] = [];

	// Track state for parsing
	let inCell = false;
	let cellStart = 0;
	let cellContent = '';
	let i = 0;

	while (i < line.length) {
		const char = line[i];

		// Handle escaped pipe
		if (char === '\\' && i + 1 < line.length && line[i + 1] === '|') {
			if (inCell) {
				cellContent += '|'; // Add the escaped pipe to content
			}
			i += 2; // Skip both backslash and pipe
			continue;
		}

		// Handle pipe delimiter
		if (char === '|') {
			if (inCell) {
				// End of cell
				cells.push({
					content: cellContent,
					startChar: cellStart,
					endChar: i,
				});
				cellContent = '';
			}
			// Start of next cell
			inCell = true;
			cellStart = i + 1;
			i++;
			continue;
		}

		// Regular character
		if (inCell) {
			cellContent += char;
		}
		i++;
	}

	// Handle trailing content (row without trailing pipe)
	if (inCell && cellContent.length > 0) {
		cells.push({
			content: cellContent,
			startChar: cellStart,
			endChar: line.length,
		});
	}

	return cells;
}

/**
 * Extract raw cell contents from a table row (without position tracking).
 * Used for separator row validation.
 */
function extractRawCells(line: string): string[] {
	const cellsWithPositions = extractRawCellsWithPositions(line);
	return cellsWithPositions.map((c) => c.content);
}

/**
 * Get the header cell position for a column.
 *
 * @param content - Markdown content
 * @param tableIndex - Index of the table in the file (0-based)
 * @param columnIndex - Column index (0-based)
 * @returns CellPosition for the header cell or null
 */
export function getHeaderCellPosition(
	content: string,
	tableIndex: number,
	columnIndex: number
): CellPosition | null {
	const tables = parseTablesFromMarkdown(content);

	if (tableIndex < 0 || tableIndex >= tables.length) {
		return null;
	}

	const table = tables[tableIndex];
	const lines = content.split('\n');
	const headerLine = lines[table.startLine];

	const headerCells = parseCellsFromRow(headerLine, table.startLine);

	if (columnIndex < 0 || columnIndex >= headerCells.length) {
		return null;
	}

	return headerCells[columnIndex];
}
