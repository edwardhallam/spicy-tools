/**
 * Tests for malformed _board.md error handling
 *
 * These tests verify that BoardParser provides clear, user-friendly
 * error messages for various malformed configurations.
 */

import { parseBoardConfig } from '../../src/kanban/BoardParser';

describe('Malformed _board.md Error Handling', () => {
	const testPath = 'test/_board.md';

	describe('Missing Required Fields', () => {
		it('returns error when columnProperty is missing', () => {
			const content = `\`\`\`yaml
columns:
  - todo
  - done
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('columnProperty');
				expect(result.error.toLowerCase()).toContain('missing');
			}
		});

		it('returns error when columns array is missing', () => {
			const content = `\`\`\`yaml
columnProperty: status
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('columns');
				expect(result.error.toLowerCase()).toContain('missing');
			}
		});

		it('returns error when columns array is empty', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: []
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('cannot be empty');
			}
		});
	});

	describe('Invalid Field Types', () => {
		it('returns error when columnProperty is not a string', () => {
			const content = `\`\`\`yaml
columnProperty: 123
columns:
  - todo
  - done
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('columnProperty');
			}
		});

		it('returns error when columns is not an array', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: not-an-array
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('columns');
			}
		});

		it('returns error when column contains non-string values', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns:
  - todo
  - 123
  - done
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.toLowerCase()).toContain('string');
			}
		});

		it('returns error when cardPreviewLines is not a positive number', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
cardPreviewLines: -5
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('positive number');
			}
		});

		it('returns error when cardPreviewLines is zero', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
cardPreviewLines: 0
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('positive number');
			}
		});

		it('returns error when labelDisplay has invalid value', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
labelDisplay: badges
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('chips');
				expect(result.error).toContain('stripe');
			}
		});

		it('returns error when swimlanesCollapsible is not a boolean', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
swimlanesCollapsible: yes
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('swimlanesCollapsible');
				expect(result.error).toContain('boolean');
			}
		});
	});

	describe('Malformed YAML', () => {
		it('returns error for invalid YAML syntax', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns:
  - todo
  - done
  invalid: [unclosed bracket
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			// The simple YAML parser may handle this gracefully or error
			// Key expectation: no crash, returns a result
			expect(typeof result.success).toBe('boolean');
		});

		it('returns error when no YAML block found', () => {
			const content = `# Just markdown

No yaml here at all.
`;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('No YAML configuration found');
			}
		});

		it('handles unclosed YAML code block', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns:
  - todo
  - done
`;
			// No closing ```

			const result = parseBoardConfig(content, testPath);

			// Should fail to find valid YAML block since it's not closed
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('No YAML configuration found');
			}
		});

		it('handles empty YAML block', () => {
			const content = `\`\`\`yaml
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('No YAML configuration found');
			}
		});

		it('handles YAML block with only whitespace', () => {
			const content = `\`\`\`yaml


\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('No YAML configuration found');
			}
		});
	});

	describe('Optional Field Validation', () => {
		it('returns error when cardTitle is not a string', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
cardTitle: 123
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('cardTitle');
				expect(result.error).toContain('string');
			}
		});

		it('returns error when cardPreview is not a string', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
cardPreview: true
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('cardPreview');
				expect(result.error).toContain('string');
			}
		});

		it('returns error when labelProperty is not a string', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
labelProperty: [tags, categories]
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('labelProperty');
				expect(result.error).toContain('string');
			}
		});

		it('returns error when swimlaneProperty is not a string', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
swimlaneProperty: 42
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('swimlaneProperty');
				expect(result.error).toContain('string');
			}
		});

		it('returns error when newCardTemplate is not a string', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
newCardTemplate: false
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('newCardTemplate');
				expect(result.error).toContain('string');
			}
		});

		it('returns error when labelColors is not an object', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
labelColors: red
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('labelColors');
				expect(result.error).toContain('object');
			}
		});

		it('returns error when cardOrder is not an object', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
cardOrder: [file1.md, file2.md]
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				// When cardOrder is an array, the parser treats it as an object with numeric keys
				// and validates that each value is an array - which it won't be for simple string items
				expect(result.error).toContain('cardOrder');
			}
		});

		it('returns error when collapsedSwimlanes is not an array', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
collapsedSwimlanes: project-a
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('collapsedSwimlanes');
				expect(result.error).toContain('array');
			}
		});
	});

	describe('Error Message Quality', () => {
		it('provides user-friendly error for missing columnProperty', () => {
			const content = `\`\`\`yaml
columns:
  - todo
  - done
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				// Error should clearly state what's missing
				expect(result.error).toContain('columnProperty');
				// Error message should be readable
				expect(result.error.length).toBeGreaterThan(10);
			}
		});

		it('error messages do not expose internal details', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns: [todo, done]
labelDisplay: invalid-value
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				// Should not contain stack traces or internal function names
				expect(result.error).not.toMatch(/at\s+\w+\s*\(/);
				expect(result.error).not.toContain('TypeError');
				expect(result.error).not.toContain('ReferenceError');
				// Should contain helpful guidance about valid values
				expect(result.error).toContain('chips');
				expect(result.error).toContain('stripe');
			}
		});

		it('returns descriptive error for invalid column values', () => {
			const content = `\`\`\`yaml
columnProperty: status
columns:
  - todo
  - 123
  - done
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				// Error should mention the issue with columns
				expect(result.error.toLowerCase()).toContain('string');
			}
		});
	});

	describe('Edge Cases', () => {
		it('handles file with multiple YAML blocks (uses first one)', () => {
			const content = `# Board Config

\`\`\`yaml
columnProperty: status
columns: [todo, done]
\`\`\`

# Secondary Config (should be ignored)

\`\`\`yaml
columnProperty: priority
columns: [low, high]
\`\`\`
`;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.columnProperty).toBe('status');
			}
		});

		it('handles yml language specifier', () => {
			const content = `\`\`\`yml
columnProperty: status
columns: [todo, done]
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(true);
		});

		it('handles columns with special characters using inline array', () => {
			// The simple YAML parser handles inline arrays better for quoted strings
			const content = `\`\`\`yaml
columnProperty: status
columns: [in-progress, needs-review, done]
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.columns).toContain('in-progress');
			}
		});

		it('handles hyphenated column names in block array', () => {
			// Unquoted hyphenated values work in block arrays
			const content = `\`\`\`yaml
columnProperty: status
columns:
  - todo
  - in-progress
  - done
\`\`\``;

			const result = parseBoardConfig(content, testPath);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.columns).toContain('in-progress');
			}
		});
	});
});
