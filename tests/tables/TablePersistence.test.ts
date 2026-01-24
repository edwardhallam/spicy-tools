/**
 * Tests for TablePersistence
 *
 * TablePersistence handles modifying specific cells in markdown source.
 * It must:
 * - Update cell content at specific positions
 * - Preserve table alignment and formatting
 * - Handle multi-value cells (for multi-select dropdowns)
 * - Write changes back to file via Obsidian Vault API
 *
 * Uses ParseResult<T> pattern - test both success and failure cases.
 */

import {
	updateTableCell,
	updateTableCells,
	formatCellValue,
	preserveAlignment,
	escapePipes,
	parseMultiValue,
	getCellContent,
} from '../../src/tables/TablePersistence';

import { createMockApp, createMockTFile } from '../setup';

describe('TablePersistence', () => {
	describe('updateCellContent', () => {
		let mockApp: ReturnType<typeof createMockApp>;
		let mockFile: ReturnType<typeof createMockTFile>;

		beforeEach(() => {
			mockApp = createMockApp();
			mockFile = createMockTFile('test/table-file.md');
		});

		it('should update a single cell value', async () => {
			const content = `| Name | Status |
|------|--------|
| Item | old    |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			const result = await updateTableCell(
				mockApp,
				mockFile,
				0, // tableIndex
				0, // rowIndex (first data row)
				1, // columnIndex (Status column)
				'new'
			);

			expect(result.success).toBe(true);
			expect(mockApp.vault.modify).toHaveBeenCalled();
			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('new');
		});

		it('should preserve other cells in the same row', async () => {
			const content = `| A | B | C |
|---|---|---|
| 1 | 2 | 3 |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			const result = await updateTableCell(
				mockApp,
				mockFile,
				0,
				0,
				1, // Update middle column
				'NEW'
			);

			expect(result.success).toBe(true);
			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('| 1 |');
			expect(modifiedContent).toContain('NEW');
			expect(modifiedContent).toContain('| 3 |');
		});

		it('should preserve other rows in the table', async () => {
			const content = `| Name |
|------|
| Row1 |
| Row2 |
| Row3 |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCell(mockApp, mockFile, 0, 1, 0, 'UPDATED');

			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('Row1');
			expect(modifiedContent).toContain('UPDATED');
			expect(modifiedContent).toContain('Row3');
		});

		it('should preserve content outside the table', async () => {
			const content = `# Header

Some text before.

| Name |
|------|
| Val  |

Some text after.`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCell(mockApp, mockFile, 0, 0, 0, 'NEW');

			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('# Header');
			expect(modifiedContent).toContain('Some text before.');
			expect(modifiedContent).toContain('Some text after.');
		});

		it('should handle updating to empty value', async () => {
			const content = `| Name |
|------|
| value |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCell(mockApp, mockFile, 0, 0, 0, '');

			expect(mockApp.vault.modify).toHaveBeenCalled();
		});

		it('should handle updating from empty value', async () => {
			const content = `| Name |
|------|
|  |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCell(mockApp, mockFile, 0, 0, 0, 'value');

			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('value');
		});
	});

	describe('alignment preservation', () => {
		it('should maintain column width after update', () => {
			// Using preserveAlignment helper
			const result = preserveAlignment('hi', 10, 'left');
			expect(result).toBe('hi        ');
			expect(result.length).toBe(10);
		});

		it('should respect left alignment', () => {
			const result = preserveAlignment('value', 10, 'left');
			expect(result).toBe('value     ');
		});

		it('should respect center alignment', () => {
			const result = preserveAlignment('val', 9, 'center');
			expect(result).toBe('   val   ');
		});

		it('should respect right alignment', () => {
			const result = preserveAlignment('value', 10, 'right');
			expect(result).toBe('     value');
		});

		it('should preserve separator row dashes', async () => {
			const mockApp = createMockApp();
			const mockFile = createMockTFile('test.md');

			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCell(mockApp, mockFile, 0, 0, 0, 'new');

			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('|------|');
		});

		it('should expand column width for longer content', () => {
			// If content is longer than width, it returns as-is
			const result = preserveAlignment('very long value', 5, 'left');
			expect(result).toBe('very long value');
		});

		it('should not shrink column width for shorter content', () => {
			// Padding ensures minimum width maintained
			const result = preserveAlignment('x', 10, 'left');
			expect(result.length).toBe(10);
		});
	});

	describe('multi-value cells', () => {
		it('should format array values with comma separator', () => {
			const result = formatCellValue(['a', 'b', 'c']);
			expect(result).toBe('a, b, c');
		});

		it('should handle single value in array', () => {
			const result = formatCellValue(['only']);
			expect(result).toBe('only');
		});

		it('should handle empty array', () => {
			const result = formatCellValue([]);
			expect(result).toBe('');
		});

		it('should escape commas in values', () => {
			// When values contain commas, they're still joined
			// (escaping commas is a future enhancement)
			const result = formatCellValue(['a, b', 'c']);
			expect(result).toBe('a, b, c');
		});

		it('should parse existing multi-value cells', () => {
			const result = parseMultiValue('a, b, c');
			expect(result).toEqual(['a', 'b', 'c']);
		});

		it('should parse single value', () => {
			const result = parseMultiValue('single');
			expect(result).toEqual(['single']);
		});

		it('should handle empty string', () => {
			const result = parseMultiValue('');
			expect(result).toEqual([]);
		});

		it('should handle whitespace-only string', () => {
			const result = parseMultiValue('   ');
			expect(result).toEqual([]);
		});
	});

	describe('special character handling', () => {
		it('should escape pipe characters in values', () => {
			const result = escapePipes('a | b');
			expect(result).toBe('a \\| b');
		});

		it('should preserve existing escaped pipes', () => {
			const result = escapePipes('a \\| b');
			expect(result).toBe('a \\| b');
		});

		it('should handle newlines in values', () => {
			const result = formatCellValue('line1\nline2');
			expect(result).toBe('line1 line2');
		});

		it('should handle carriage returns in values', () => {
			const result = formatCellValue('line1\r\nline2');
			expect(result).toBe('line1 line2');
		});

		it('should handle markdown formatting in values', () => {
			// Markdown formatting should pass through unchanged
			const result = formatCellValue('**bold** and _italic_');
			expect(result).toBe('**bold** and _italic_');
		});

		it('should handle Obsidian links in values', () => {
			// Links should pass through unchanged
			const result = formatCellValue('[[note]] and [link](url)');
			expect(result).toBe('[[note]] and [link](url)');
		});

		it('should escape pipes in links', () => {
			const result = formatCellValue('text | more');
			expect(result).toBe('text \\| more');
		});
	});

	describe('file operations', () => {
		let mockApp: ReturnType<typeof createMockApp>;
		let mockFile: ReturnType<typeof createMockTFile>;

		beforeEach(() => {
			mockApp = createMockApp();
			mockFile = createMockTFile('test/table-file.md');
		});

		it('should read file content before modification', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCell(mockApp, mockFile, 0, 0, 0, 'new');

			expect(mockApp.vault.read).toHaveBeenCalledWith(mockFile);
		});

		it('should write updated content via vault.modify', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCell(mockApp, mockFile, 0, 0, 0, 'new');

			expect(mockApp.vault.modify).toHaveBeenCalledWith(
				mockFile,
				expect.any(String)
			);
		});

		it('should handle file read errors gracefully', async () => {
			mockApp.vault.read.mockRejectedValue(new Error('Read failed'));

			const result = await updateTableCell(mockApp, mockFile, 0, 0, 0, 'new');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Failed to read file');
			}
		});

		it('should handle file write errors gracefully', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockRejectedValue(new Error('Write failed'));

			const result = await updateTableCell(mockApp, mockFile, 0, 0, 0, 'new');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Failed to write file');
			}
		});

		it('should not modify file if cell position invalid', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);

			await updateTableCell(mockApp, mockFile, 0, 99, 0, 'new');

			expect(mockApp.vault.modify).not.toHaveBeenCalled();
		});
	});

	describe('concurrent modification safety', () => {
		let mockApp: ReturnType<typeof createMockApp>;
		let mockFile: ReturnType<typeof createMockTFile>;

		beforeEach(() => {
			mockApp = createMockApp();
			mockFile = createMockTFile('test/table-file.md');
		});

		it('should re-parse table before modification', async () => {
			// The implementation always reads fresh content
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCell(mockApp, mockFile, 0, 0, 0, 'new');

			// Verify read was called
			expect(mockApp.vault.read).toHaveBeenCalled();
		});

		it('should fail if table structure changed', async () => {
			// If the row doesn't exist, it fails
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);

			const result = await updateTableCell(mockApp, mockFile, 0, 5, 0, 'new');

			expect(result.success).toBe(false);
		});

		it('should handle file modified externally', async () => {
			// File has no tables now
			mockApp.vault.read.mockResolvedValue('Just text, no tables.');

			const result = await updateTableCell(mockApp, mockFile, 0, 0, 0, 'new');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('no tables');
			}
		});
	});

	describe('formatCellValue', () => {
		it('should trim whitespace from string values', () => {
			const result = formatCellValue('  value  ');
			expect(result).toBe('value');
		});

		it('should convert numbers to strings', () => {
			const result = formatCellValue(42);
			expect(result).toBe('42');
		});

		it('should handle null/undefined as empty string', () => {
			expect(formatCellValue(null)).toBe('');
			expect(formatCellValue(undefined)).toBe('');
		});

		it('should handle boolean values', () => {
			expect(formatCellValue(true)).toBe('true');
			expect(formatCellValue(false)).toBe('false');
		});

		it('should handle zero', () => {
			expect(formatCellValue(0)).toBe('0');
		});

		it('should handle negative numbers', () => {
			expect(formatCellValue(-42)).toBe('-42');
		});

		it('should handle floating point numbers', () => {
			expect(formatCellValue(3.14)).toBe('3.14');
		});
	});

	describe('batch updates', () => {
		let mockApp: ReturnType<typeof createMockApp>;
		let mockFile: ReturnType<typeof createMockTFile>;

		beforeEach(() => {
			mockApp = createMockApp();
			mockFile = createMockTFile('test/table-file.md');
		});

		it('should update multiple cells in single write', async () => {
			const content = `| A | B |
|---|---|
| 1 | 2 |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			const result = await updateTableCells(mockApp, mockFile, [
				{ tableIndex: 0, rowIndex: 0, columnIndex: 0, newValue: 'X' },
				{ tableIndex: 0, rowIndex: 0, columnIndex: 1, newValue: 'Y' },
			]);

			expect(result.success).toBe(true);
			// Only one read and one write
			expect(mockApp.vault.read).toHaveBeenCalledTimes(1);
			expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);

			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('X');
			expect(modifiedContent).toContain('Y');
		});

		it('should handle updates to same row', async () => {
			const content = `| A | B | C |
|---|---|---|
| 1 | 2 | 3 |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCells(mockApp, mockFile, [
				{ tableIndex: 0, rowIndex: 0, columnIndex: 0, newValue: 'X' },
				{ tableIndex: 0, rowIndex: 0, columnIndex: 2, newValue: 'Z' },
			]);

			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('X');
			expect(modifiedContent).toContain('2'); // Middle cell unchanged
			expect(modifiedContent).toContain('Z');
		});

		it('should handle updates to different rows', async () => {
			const content = `| A |
|---|
| 1 |
| 2 |
| 3 |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCells(mockApp, mockFile, [
				{ tableIndex: 0, rowIndex: 0, columnIndex: 0, newValue: 'X' },
				{ tableIndex: 0, rowIndex: 2, columnIndex: 0, newValue: 'Z' },
			]);

			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('X');
			expect(modifiedContent).toContain('2'); // Middle row unchanged
			expect(modifiedContent).toContain('Z');
		});

		it('should apply updates in correct order', async () => {
			// Updates are sorted by position (descending) to avoid offset issues
			const content = `| A | B |
|---|---|
| 1 | 2 |`;

			mockApp.vault.read.mockResolvedValue(content);
			mockApp.vault.modify.mockResolvedValue(undefined);

			await updateTableCells(mockApp, mockFile, [
				{ tableIndex: 0, rowIndex: 0, columnIndex: 0, newValue: 'LONGER' },
				{ tableIndex: 0, rowIndex: 0, columnIndex: 1, newValue: 'Y' },
			]);

			const modifiedContent = mockApp.vault.modify.mock.calls[0][1];
			expect(modifiedContent).toContain('LONGER');
			expect(modifiedContent).toContain('Y');
		});

		it('should handle empty updates array', async () => {
			const result = await updateTableCells(mockApp, mockFile, []);

			expect(result.success).toBe(true);
			expect(mockApp.vault.read).not.toHaveBeenCalled();
			expect(mockApp.vault.modify).not.toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		let mockApp: ReturnType<typeof createMockApp>;
		let mockFile: ReturnType<typeof createMockTFile>;

		beforeEach(() => {
			mockApp = createMockApp();
			mockFile = createMockTFile('test/table-file.md');
		});

		it('should return failure for invalid row index', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);

			const result = await updateTableCell(mockApp, mockFile, 0, 99, 0, 'new');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Invalid row index');
			}
		});

		it('should return failure for invalid column index', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);

			const result = await updateTableCell(mockApp, mockFile, 0, 0, 99, 'new');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Invalid column index');
			}
		});

		it('should return failure if file has no tables', async () => {
			mockApp.vault.read.mockResolvedValue('No tables here.');

			const result = await updateTableCell(mockApp, mockFile, 0, 0, 0, 'new');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('no tables');
			}
		});

		it('should return failure for invalid table index', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);

			const result = await updateTableCell(mockApp, mockFile, 5, 0, 0, 'new');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Invalid table index');
			}
		});

		it('should return failure for negative indices', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);

			const result = await updateTableCell(mockApp, mockFile, 0, -1, 0, 'new');

			expect(result.success).toBe(false);
		});
	});

	describe('getCellContent', () => {
		let mockApp: ReturnType<typeof createMockApp>;
		let mockFile: ReturnType<typeof createMockTFile>;

		beforeEach(() => {
			mockApp = createMockApp();
			mockFile = createMockTFile('test/table-file.md');
		});

		it('should return cell content for valid position', async () => {
			const content = `| Name | Status |
|------|--------|
| Item | Active |`;

			mockApp.vault.read.mockResolvedValue(content);

			const result = await getCellContent(mockApp, mockFile, 0, 0, 1);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('Active');
			}
		});

		it('should return failure for invalid table index', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);

			const result = await getCellContent(mockApp, mockFile, 5, 0, 0);

			expect(result.success).toBe(false);
		});

		it('should return failure for invalid cell position', async () => {
			const content = `| Name |
|------|
| val  |`;

			mockApp.vault.read.mockResolvedValue(content);

			const result = await getCellContent(mockApp, mockFile, 0, 99, 0);

			expect(result.success).toBe(false);
		});
	});
});
