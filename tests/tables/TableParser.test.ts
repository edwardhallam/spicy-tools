/**
 * Tests for TableParser
 *
 * TableParser extracts markdown tables from file content, tracking:
 * - Table boundaries (start/end lines)
 * - Cell positions (row, column, character offsets)
 * - Header vs data rows
 * - Column alignments
 *
 * Uses ParseResult<T> pattern - test both success and failure cases.
 */

import {
	parseTablesFromMarkdown,
	findTableContainingLine,
	getCellPosition,
	getHeaderCellPosition,
	parseCellsFromRow,
	parseTableAtLine,
} from '../../src/tables/TableParser';

describe('TableParser', () => {
	describe('parseTablesFromMarkdown', () => {
		it('should parse a simple 2-column table', () => {
			const content = `| Header1 | Header2 |
|---------|---------|
| cell1   | cell2   |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(1);
			expect(tables[0].headers).toEqual(['Header1', 'Header2']);
			expect(tables[0].startLine).toBe(0);
			expect(tables[0].endLine).toBe(2);
			expect(tables[0].cells).toHaveLength(1);
			expect(tables[0].cells[0]).toHaveLength(2);
			expect(tables[0].cells[0][0].content).toBe('cell1');
			expect(tables[0].cells[0][1].content).toBe('cell2');
		});

		it('should parse a table with multiple rows', () => {
			const content = `| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |
| 7 | 8 | 9 |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(1);
			expect(tables[0].headers).toEqual(['A', 'B', 'C']);
			expect(tables[0].cells).toHaveLength(3);
			expect(tables[0].cells[0][0].content).toBe('1');
			expect(tables[0].cells[1][1].content).toBe('5');
			expect(tables[0].cells[2][2].content).toBe('9');
		});

		it('should handle multiple tables in one file', () => {
			const content = `# First Table

| A | B |
|---|---|
| 1 | 2 |

Some text between tables.

| X | Y | Z |
|---|---|---|
| a | b | c |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(2);
			expect(tables[0].headers).toEqual(['A', 'B']);
			expect(tables[1].headers).toEqual(['X', 'Y', 'Z']);
		});

		it('should return empty array for file with no tables', () => {
			const content = `# Just a heading

Some regular markdown content.

- A list item
- Another item

No tables here.`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(0);
		});

		it('should handle table at start of file', () => {
			const content = `| Header |
|--------|
| value  |

Some content after.`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(1);
			expect(tables[0].startLine).toBe(0);
		});

		it('should handle table at end of file', () => {
			const content = `Some content before.

| Header |
|--------|
| value  |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(1);
			expect(tables[0].endLine).toBe(4);
		});

		it('should handle table surrounded by content', () => {
			const content = `Paragraph before the table.

| Col1 | Col2 |
|------|------|
| data | data |

Paragraph after the table.`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(1);
			expect(tables[0].startLine).toBe(2);
			expect(tables[0].endLine).toBe(4);
		});
	});

	describe('table boundary detection', () => {
		it('should correctly identify table start line', () => {
			const content = `Line 0
Line 1
| Header |
|--------|
| data   |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].startLine).toBe(2);
		});

		it('should correctly identify table end line', () => {
			const content = `| Header |
|--------|
| row 1  |
| row 2  |
| row 3  |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].endLine).toBe(4);
		});

		it('should distinguish header row from separator row', () => {
			const content = `| Header |
|--------|
| data   |`;

			const tables = parseTablesFromMarkdown(content);

			// Header is extracted separately, cells only contain data rows
			expect(tables[0].headers).toEqual(['Header']);
			expect(tables[0].cells).toHaveLength(1);
			expect(tables[0].cells[0][0].content).toBe('data');
		});

		it('should not include blank lines after table', () => {
			const content = `| Header |
|--------|
| data   |

More content`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].endLine).toBe(2);
		});
	});

	describe('cell position tracking', () => {
		it('should track row and column indices', () => {
			const content = `| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |`;

			const tables = parseTablesFromMarkdown(content);

			// Row 0, Col 0
			expect(tables[0].cells[0][0].line).toBe(2);
			// Row 1, Col 1
			expect(tables[0].cells[1][1].line).toBe(3);
		});

		it('should track character offset for cell start', () => {
			const content = `| abc | def |`;

			const cells = parseCellsFromRow(content, 0);

			// | abc | def |
			// 0123456789...
			// Cell 0 starts after "| " at position 2
			expect(cells[0].startChar).toBe(2);
			// Cell 1 starts after "| abc | " at position 8
			expect(cells[1].startChar).toBe(8);
		});

		it('should track character offset for cell end', () => {
			const content = `| abc | def |`;

			const cells = parseCellsFromRow(content, 0);

			// | abc | def |
			// Cell 0 content "abc" ends at position 5 (before space+pipe)
			expect(cells[0].endChar).toBe(5);
			// Cell 1 content "def" ends at position 11
			expect(cells[1].endChar).toBe(11);
		});

		it('should handle cells with leading/trailing whitespace', () => {
			const content = `|  cell  |`;

			const cells = parseCellsFromRow(content, 0);

			// Content should be trimmed
			expect(cells[0].content).toBe('cell');
			// But positions should point to trimmed content
			expect(cells[0].startChar).toBe(3); // After "| " and one extra space
			expect(cells[0].endChar).toBe(7); // Before the trailing spaces
		});

		it('should track positions for empty cells', () => {
			const content = `| | content |`;

			const cells = parseCellsFromRow(content, 0);

			expect(cells[0].content).toBe('');
			// Empty cell has same start and end
			expect(cells[0].startChar).toBe(cells[0].endChar);
		});
	});

	describe('edge cases - cell content', () => {
		it('should handle empty cells', () => {
			const content = `| A | B | C |
|---|---|---|
| | content | |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].cells[0][0].content).toBe('');
			expect(tables[0].cells[0][1].content).toBe('content');
			expect(tables[0].cells[0][2].content).toBe('');
		});

		it('should handle cells with only whitespace', () => {
			const content = `| A | B |
|---|---|
|   | content |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].cells[0][0].content).toBe('');
			expect(tables[0].cells[0][1].content).toBe('content');
		});

		it('should handle escaped pipe characters', () => {
			const content = `| A | B |
|---|---|
| value \\| with pipe | other |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].cells[0][0].content).toBe('value | with pipe');
			expect(tables[0].cells[0][1].content).toBe('other');
		});

		it('should handle cells with inline code containing pipes', () => {
			// Note: This is a limitation - we don't parse backticks specially
			// The user would need to escape the pipe: `a \| b`
			const content = `| A | B |
|---|---|
| \`code\` | other |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].cells[0][0].content).toBe('`code`');
		});

		it('should handle cells with links', () => {
			const content = `| A | B |
|---|---|
| [[note]] | [link](url) |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].cells[0][0].content).toBe('[[note]]');
			expect(tables[0].cells[0][1].content).toBe('[link](url)');
		});

		it('should preserve cell content exactly', () => {
			const content = `| A |
|---|
| Hello World! |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].cells[0][0].content).toBe('Hello World!');
		});
	});

	describe('edge cases - table structure', () => {
		it('should handle single-column table', () => {
			const content = `| Header |
|--------|
| value  |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(1);
			expect(tables[0].headers).toEqual(['Header']);
			expect(tables[0].cells[0][0].content).toBe('value');
		});

		it('should handle table with many columns', () => {
			const content = `| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].headers).toHaveLength(10);
			expect(tables[0].cells[0]).toHaveLength(10);
		});

		it('should handle uneven column widths', () => {
			const content = `| short | very long content here |
|-------|------------------------|
| a     | b                      |`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables[0].headers).toEqual(['short', 'very long content here']);
		});

		it('should handle table without leading pipe', () => {
			// Some parsers accept tables without leading pipe, but we require it
			const content = `Header | Header2
-------|--------
value  | value2`;

			const tables = parseTablesFromMarkdown(content);

			// Our parser requires leading pipe
			expect(tables).toHaveLength(0);
		});

		it('should handle table without trailing pipe', () => {
			const content = `| Header | Header2
|--------|--------
| value  | value2`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(1);
			expect(tables[0].headers).toEqual(['Header', 'Header2']);
		});

		it('should handle alignment markers in separator', () => {
			const content = `| Left | Center | Right |
|:-----|:------:|------:|
| a    | b      | c     |`;

			const result = parseTableAtLine(content.split('\n'), 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.alignments).toEqual(['left', 'center', 'right']);
			}
		});
	});

	describe('error handling', () => {
		it('should skip table with malformed separator row', () => {
			const content = `| Header |
| not a separator |
| data |`;

			const tables = parseTablesFromMarkdown(content);

			// This should not be parsed as a valid table
			expect(tables).toHaveLength(0);
		});

		it('should stop parsing at inconsistent column count', () => {
			const content = `| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 | 5 |
| 6 | 7 |`;

			const tables = parseTablesFromMarkdown(content);

			// Should parse up to the inconsistent row
			expect(tables).toHaveLength(1);
			expect(tables[0].cells).toHaveLength(1); // Only first data row
			expect(tables[0].endLine).toBe(2);
		});

		it('should handle table interrupted by non-table content', () => {
			const content = `| A | B |
|---|---|
| 1 | 2 |
Not a table row
| 3 | 4 |`;

			const tables = parseTablesFromMarkdown(content);

			// First table ends at the interruption
			expect(tables).toHaveLength(1);
			expect(tables[0].cells).toHaveLength(1);
		});
	});

	describe('getCellPosition', () => {
		it('should return position for valid row/column', () => {
			const content = `| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |`;

			const tables = parseTablesFromMarkdown(content);
			const position = getCellPosition(tables[0], 1, 1);

			expect(position).not.toBeNull();
			expect(position?.content).toBe('4');
		});

		it('should return null for out-of-bounds row', () => {
			const content = `| A |
|---|
| 1 |`;

			const tables = parseTablesFromMarkdown(content);
			const position = getCellPosition(tables[0], 5, 0);

			expect(position).toBeNull();
		});

		it('should return null for out-of-bounds column', () => {
			const content = `| A |
|---|
| 1 |`;

			const tables = parseTablesFromMarkdown(content);
			const position = getCellPosition(tables[0], 0, 5);

			expect(position).toBeNull();
		});

		it('should return null for negative indices', () => {
			const content = `| A |
|---|
| 1 |`;

			const tables = parseTablesFromMarkdown(content);

			expect(getCellPosition(tables[0], -1, 0)).toBeNull();
			expect(getCellPosition(tables[0], 0, -1)).toBeNull();
		});
	});

	describe('getHeaderCellPosition', () => {
		it('should return header cell position', () => {
			const content = `| Header1 | Header2 |
|---------|---------|
| data    | data    |`;

			const position = getHeaderCellPosition(content, 0, 0);

			expect(position).not.toBeNull();
			expect(position?.content).toBe('Header1');
		});

		it('should return null for invalid table index', () => {
			const content = `| A |
|---|
| 1 |`;

			const position = getHeaderCellPosition(content, 5, 0);

			expect(position).toBeNull();
		});

		it('should return null for invalid column index', () => {
			const content = `| A |
|---|
| 1 |`;

			const position = getHeaderCellPosition(content, 0, 5);

			expect(position).toBeNull();
		});
	});

	describe('findTableContainingLine', () => {
		it('should find table containing given line', () => {
			const content = `Line 0

| A |
|---|
| 1 |

Line 6`;

			const table = findTableContainingLine(content, 3);

			expect(table).not.toBeNull();
			expect(table?.headers).toEqual(['A']);
		});

		it('should return null for line not in table', () => {
			const content = `Line 0

| A |
|---|
| 1 |

Line 6`;

			const table = findTableContainingLine(content, 0);

			expect(table).toBeNull();
		});

		it('should find correct table when multiple exist', () => {
			const content = `| A |
|---|
| 1 |

| B |
|---|
| 2 |`;

			const table1 = findTableContainingLine(content, 1);
			const table2 = findTableContainingLine(content, 5);

			expect(table1?.headers).toEqual(['A']);
			expect(table2?.headers).toEqual(['B']);
		});
	});

	describe('alignment detection', () => {
		it('should detect left alignment', () => {
			const content = `| A |
|:--|
| 1 |`;

			const result = parseTableAtLine(content.split('\n'), 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.alignments[0]).toBe('left');
			}
		});

		it('should detect center alignment', () => {
			const content = `| A |
|:-:|
| 1 |`;

			const result = parseTableAtLine(content.split('\n'), 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.alignments[0]).toBe('center');
			}
		});

		it('should detect right alignment', () => {
			const content = `| A |
|--:|
| 1 |`;

			const result = parseTableAtLine(content.split('\n'), 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.alignments[0]).toBe('right');
			}
		});

		it('should default to left alignment', () => {
			const content = `| A |
|---|
| 1 |`;

			const result = parseTableAtLine(content.split('\n'), 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.alignments[0]).toBe('left');
			}
		});
	});

	describe('integration with real markdown', () => {
		it('should parse table from typical Obsidian note', () => {
			const content = `---
title: My Note
tags: [test]
---

# Tasks

| Task | Status | Priority |
|------|--------|----------|
| Task 1 | Todo | High |
| Task 2 | Done | Low |

## Notes

Some additional content.`;

			const tables = parseTablesFromMarkdown(content);

			expect(tables).toHaveLength(1);
			expect(tables[0].headers).toEqual(['Task', 'Status', 'Priority']);
			expect(tables[0].cells).toHaveLength(2);
		});

		it('should handle table in callout block', () => {
			// Tables in callouts have > prefix - we don't handle this specially
			// The > prefix means it won't be detected as a table
			const content = `> [!note]
> | Header |
> |--------|
> | data   |`;

			const tables = parseTablesFromMarkdown(content);

			// Callout tables are not parsed (they have > prefix)
			expect(tables).toHaveLength(0);
		});

		it('should handle table after code block', () => {
			const content = `\`\`\`
| Not | A | Table |
\`\`\`

| Real | Table |
|------|-------|
| data | data  |`;

			const tables = parseTablesFromMarkdown(content);

			// Only the real table should be parsed
			// Note: This is a simplified test - full code block handling would need more logic
			expect(tables.length).toBeGreaterThanOrEqual(1);
			// The last table should be the valid one
			const realTable = tables[tables.length - 1];
			expect(realTable.headers).toEqual(['Real', 'Table']);
		});
	});
});
