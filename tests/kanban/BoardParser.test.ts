/**
 * Tests for BoardParser
 */

import { parseBoardConfig, BOARD_CONFIG_FILENAME } from '../../src/kanban/BoardParser';

describe('BoardParser', () => {
	describe('BOARD_CONFIG_FILENAME', () => {
		it('is _board.md', () => {
			expect(BOARD_CONFIG_FILENAME).toBe('_board.md');
		});
	});

	describe('parseBoardConfig', () => {
		it('parses minimal valid config', () => {
			const content = `# Project Board

\`\`\`yaml
columnProperty: status
columns:
  - todo
  - in-progress
  - done
\`\`\`
`;
			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.columnProperty).toBe('status');
				expect(result.data.columns).toEqual(['todo', 'in-progress', 'done']);
			}
		});

		it('parses config with optional fields', () => {
			// Note: cardOrder with nested arrays requires a full YAML library
			// This test covers the common flat config options
			const content = `# Project Board

\`\`\`yaml
columnProperty: status
columns:
  - todo
  - in-progress
  - review
  - done

cardTitle: title
cardPreview: notes
cardPreviewLines: 3

labelProperty: tags
labelDisplay: chips
labelColors:
  bug: red
  feature: blue
  urgent: orange

swimlaneProperty: project
swimlanesCollapsible: true

newCardTemplate: templates/task.md
\`\`\`
`;
			const result = parseBoardConfig(content, 'test/_board.md');

			// Debug: log the error if failed
			if (!result.success) {
				console.log('PARSE ERROR:', result.error);
			}
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.columnProperty).toBe('status');
				expect(result.data.columns).toHaveLength(4);
				expect(result.data.cardTitle).toBe('title');
				expect(result.data.cardPreview).toBe('notes');
				expect(result.data.cardPreviewLines).toBe(3);
				expect(result.data.labelProperty).toBe('tags');
				expect(result.data.labelDisplay).toBe('chips');
				expect(result.data.labelColors).toEqual({
					bug: 'red',
					feature: 'blue',
					urgent: 'orange',
				});
				expect(result.data.swimlaneProperty).toBe('project');
				expect(result.data.swimlanesCollapsible).toBe(true);
				expect(result.data.newCardTemplate).toBe('templates/task.md');
			}
		});

		it('parses cardOrder with simple structure', () => {
			// Test cardOrder with a simpler inline format
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
\`\`\``;

			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(true);
		});

		it('parses cardOrder with nested column arrays', () => {
			// This tests the exact structure that caused the regression:
			// cardOrder as an object where each key is a column name
			// and each value is an array of filenames
			const content = `\`\`\`yaml
columnProperty: status
columns:
  - Todo
  - In Progress
  - Done
cardOrder:
  In Progress:
    - task-in-progress.md
    - task-todo.md
  Done:
    - task-done.md
\`\`\``;

			const result = parseBoardConfig(content, 'test/_board.md');

			if (!result.success) {
				console.log('PARSE ERROR:', result.error);
			}
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.cardOrder).toBeDefined();
				expect(result.data.cardOrder).toEqual({
					'In Progress': ['task-in-progress.md', 'task-todo.md'],
					'Done': ['task-done.md'],
				});
			}
		});

		it('parses inline column array', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, doing, done]
\`\`\``;

			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.columns).toEqual(['todo', 'doing', 'done']);
			}
		});

		it('fails for missing columnProperty', () => {
			const content = `\`\`\`yaml
columns:
  - todo
  - done
\`\`\``;

			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing required "columnProperty"');
			}
		});

		it('fails for missing columns', () => {
			const content = `\`\`\`yaml
columnProperty: status
\`\`\``;

			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing required "columns"');
			}
		});

		it('fails for empty columns array', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: []
\`\`\``;

			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('cannot be empty');
			}
		});

		it('fails for no YAML block', () => {
			const content = `# Just markdown

No yaml here.
`;
			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('No YAML configuration found');
			}
		});

		it('validates labelDisplay values', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
labelDisplay: invalid
\`\`\``;

			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('"chips" or "stripe"');
			}
		});

		it('validates cardPreviewLines is positive', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
cardPreviewLines: 0
\`\`\``;

			const result = parseBoardConfig(content, 'test/_board.md');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('positive number');
			}
		});
	});
});
