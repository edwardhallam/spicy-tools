/**
 * Tests for DefinitionParser
 */

import {
	parseDropdownDefinitions,
	extractYamlBlocks,
	parseYamlBlock,
	parsePropertyDefinition,
	parseSimpleYaml,
	parseGlobalDefinitions,
	parseTableDropdownDefinitions,
	parseTableYamlBlock,
	parseColumnDefinition,
} from '../../src/dropdowns/DefinitionParser';

describe('DefinitionParser', () => {
	describe('extractYamlBlocks', () => {
		it('extracts single YAML block', () => {
			const content = `# Dropdown Definitions

\`\`\`yaml
status:
  options:
    - draft
    - published
\`\`\`
`;
			const blocks = extractYamlBlocks(content);
			expect(blocks).toHaveLength(1);
			expect(blocks[0]).toContain('status:');
		});

		it('extracts multiple YAML blocks', () => {
			const content = `# Block 1

\`\`\`yaml
status:
  options: [draft, published]
\`\`\`

# Block 2

\`\`\`yml
priority:
  options: [low, high]
\`\`\`
`;
			const blocks = extractYamlBlocks(content);
			expect(blocks).toHaveLength(2);
		});

		it('returns empty array for no YAML blocks', () => {
			const content = `# Just markdown

No yaml here.
`;
			const blocks = extractYamlBlocks(content);
			expect(blocks).toHaveLength(0);
		});

		it('ignores empty YAML blocks', () => {
			const content = `\`\`\`yaml
\`\`\``;
			const blocks = extractYamlBlocks(content);
			expect(blocks).toHaveLength(0);
		});
	});

	describe('parseSimpleYaml', () => {
		it('parses simple property with options array', () => {
			const yaml = `status:
  options:
    - draft
    - review
    - published`;

			const result = parseSimpleYaml(yaml);
			expect(result).not.toBeNull();
			expect(result!.status).toEqual({
				options: ['draft', 'review', 'published'],
			});
		});

		it('parses inline array syntax', () => {
			const yaml = `priority:
  options: [low, medium, high]`;

			const result = parseSimpleYaml(yaml);
			expect(result).not.toBeNull();
			expect(result!.priority).toEqual({
				options: ['low', 'medium', 'high'],
			});
		});

		it('parses numeric options', () => {
			const yaml = `severity:
  options: [1, 2, 3, 4, 5]`;

			const result = parseSimpleYaml(yaml);
			expect(result).not.toBeNull();
			expect(result!.severity).toEqual({
				options: [1, 2, 3, 4, 5],
			});
		});

		it('parses multi: true', () => {
			const yaml = `categories:
  options:
    - Throat
    - Respiratory
    - Digestive
  multi: true`;

			const result = parseSimpleYaml(yaml);
			expect(result).not.toBeNull();
			expect(result!.categories).toEqual({
				options: ['Throat', 'Respiratory', 'Digestive'],
				multi: true,
			});
		});

		it('parses disabled: true', () => {
			const yaml = `old_property:
  disabled: true`;

			const result = parseSimpleYaml(yaml);
			expect(result).not.toBeNull();
			expect(result!.old_property).toEqual({
				disabled: true,
			});
		});

		it('ignores YAML comments', () => {
			const yaml = `# This is a comment
status:
  # Another comment
  options:
    - draft`;

			const result = parseSimpleYaml(yaml);
			expect(result).not.toBeNull();
			expect(result!.status).toBeDefined();
		});

		it('handles multiple properties', () => {
			const yaml = `status:
  options: [draft, published]

priority:
  options: [low, high]`;

			const result = parseSimpleYaml(yaml);
			expect(result).not.toBeNull();
			expect(result!.status).toBeDefined();
			expect(result!.priority).toBeDefined();
		});
	});

	describe('parsePropertyDefinition', () => {
		it('parses valid property with options', () => {
			const result = parsePropertyDefinition('status', {
				options: ['draft', 'published'],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.property).toBe('status');
				expect(result.data.options).toEqual(['draft', 'published']);
				expect(result.data.multi).toBe(false);
			}
		});

		it('parses property with multi: true', () => {
			const result = parsePropertyDefinition('tags', {
				options: ['a', 'b', 'c'],
				multi: true,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.multi).toBe(true);
			}
		});

		it('parses disabled property', () => {
			const result = parsePropertyDefinition('old', { disabled: true });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.disabled).toBe(true);
				expect(result.data.options).toEqual([]);
			}
		});

		it('fails for missing options', () => {
			const result = parsePropertyDefinition('status', {});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing "options"');
			}
		});

		it('fails for non-array options', () => {
			const result = parsePropertyDefinition('status', {
				options: 'not-an-array',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be an array');
			}
		});

		it('fails for invalid option types', () => {
			const result = parsePropertyDefinition('status', {
				options: [{ nested: 'object' }],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be a string or number');
			}
		});
	});

	describe('parseDropdownDefinitions', () => {
		it('parses valid _dropdowns.md content', () => {
			const content = `# Dropdown Definitions

These dropdowns apply to all files in this folder.

\`\`\`yaml
entry_type:
  options:
    - Symptom
    - Medication
    - Observation

severity:
  options: [1, 2, 3, 4, 5]

categories:
  options:
    - Throat
    - Respiratory
  multi: true
\`\`\`
`;

			const result = parseDropdownDefinitions(content, 'Health/_dropdowns.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(3);
				expect(result.data.definitions.get('entry_type')).toBeDefined();
				expect(result.data.definitions.get('severity')).toBeDefined();
				expect(result.data.definitions.get('categories')?.multi).toBe(true);
				expect(result.data.source).toBe('Health/_dropdowns.md');
			}
		});

		it('handles empty file', () => {
			const result = parseDropdownDefinitions('', 'test.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('handles file with only markdown (no YAML)', () => {
			const result = parseDropdownDefinitions('# Just a heading\n\nSome text.', 'test.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('handles invalid property structure gracefully', () => {
			// A property with an invalid structure (options containing non-primitive)
			const content = `\`\`\`yaml
status:
  options:
    - draft
    - nested:
        invalid: structure
\`\`\``;

			const result = parseDropdownDefinitions(content, 'test.md');

			// Our simple parser won't catch deeply nested issues, but it shouldn't crash
			// The key behavior is: no exceptions thrown
			expect(typeof result.success).toBe('boolean');
		});

		it('returns error for missing options in property', () => {
			const content = `\`\`\`yaml
status:
  multi: true
\`\`\``;

			const result = parseDropdownDefinitions(content, 'test.md');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing "options"');
			}
		});
	});

	describe('parseGlobalDefinitions', () => {
		it('parses valid YAML', () => {
			const yaml = `status:
  options: [draft, published]`;

			const result = parseGlobalDefinitions(yaml);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(1);
				expect(result.data.source).toBe('global');
			}
		});

		it('handles empty string', () => {
			const result = parseGlobalDefinitions('');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('handles whitespace-only string', () => {
			const result = parseGlobalDefinitions('   \n\t  ');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});
	});

	describe('parseColumnDefinition', () => {
		it('parses valid column with options', () => {
			const result = parseColumnDefinition('Status', {
				options: ['Uncontrolled', 'Controlled'],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.column).toBe('Status');
				expect(result.data.options).toEqual(['Uncontrolled', 'Controlled']);
				expect(result.data.multi).toBe(false);
			}
		});

		it('parses column with multi: true', () => {
			const result = parseColumnDefinition('Tags', {
				options: ['A', 'B', 'C'],
				multi: true,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.multi).toBe(true);
			}
		});

		it('parses column with numeric options', () => {
			const result = parseColumnDefinition('Priority', {
				options: [1, 2, 3, 4, 5],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.options).toEqual([1, 2, 3, 4, 5]);
			}
		});

		it('fails for missing options', () => {
			const result = parseColumnDefinition('Status', {});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing "options"');
			}
		});

		it('fails for empty options array', () => {
			const result = parseColumnDefinition('Status', {
				options: [],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must not be empty');
			}
		});

		it('fails for non-array options', () => {
			const result = parseColumnDefinition('Status', {
				options: 'not-an-array',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be an array');
			}
		});

		it('fails for invalid option types', () => {
			const result = parseColumnDefinition('Status', {
				options: [{ nested: 'object' }],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be a string or number');
			}
		});

		it('fails for missing definition object', () => {
			const result = parseColumnDefinition('Status', null);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing column definition object');
			}
		});
	});

	describe('parseTableYamlBlock', () => {
		it('parses tables section with multiple columns', () => {
			const yaml = `tables:
  Status:
    options:
      - Uncontrolled
      - Controlled
  Priority:
    options: [Low, Medium, High]`;

			const result = parseTableYamlBlock(yaml, 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.size).toBe(2);
				expect(result.data.get('Status')).toBeDefined();
				expect(result.data.get('Priority')).toBeDefined();
			}
		});

		it('returns empty map when no tables section exists', () => {
			const yaml = `status:
  options: [draft, published]`;

			const result = parseTableYamlBlock(yaml, 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.size).toBe(0);
			}
		});

		it('preserves column name case sensitivity', () => {
			const yaml = `tables:
  Status:
    options: [A]
  status:
    options: [B]
  STATUS:
    options: [C]`;

			const result = parseTableYamlBlock(yaml, 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.size).toBe(3);
				expect(result.data.get('Status')?.options).toEqual(['A']);
				expect(result.data.get('status')?.options).toEqual(['B']);
				expect(result.data.get('STATUS')?.options).toEqual(['C']);
			}
		});

		it('fails for invalid column definition', () => {
			const yaml = `tables:
  Status:
    options: []`;

			const result = parseTableYamlBlock(yaml, 0);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Status');
				expect(result.error).toContain('must not be empty');
			}
		});

		it('handles empty yaml gracefully', () => {
			const result = parseTableYamlBlock('', 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.size).toBe(0);
			}
		});
	});

	describe('parseTableDropdownDefinitions', () => {
		it('parses valid _dropdowns.md with tables section', () => {
			const content = `# Dropdown Definitions

These dropdowns apply to all files in this folder.

\`\`\`yaml
status:
  options:
    - draft
    - published

tables:
  Status:
    options:
      - Uncontrolled
      - Controlled
      - Slightly Controlled
  Priority:
    options: [Low, Medium, High]
    multi: true
\`\`\`
`;

			const result = parseTableDropdownDefinitions(content, 'Projects/_dropdowns.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(2);
				expect(result.data.definitions.get('Status')).toBeDefined();
				expect(result.data.definitions.get('Status')?.options).toEqual([
					'Uncontrolled',
					'Controlled',
					'Slightly Controlled',
				]);
				expect(result.data.definitions.get('Priority')?.multi).toBe(true);
				expect(result.data.source).toBe('Projects/_dropdowns.md');
			}
		});

		it('handles empty file', () => {
			const result = parseTableDropdownDefinitions('', 'test.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('handles file with only property dropdowns (no tables)', () => {
			const content = `\`\`\`yaml
status:
  options: [draft, published]
\`\`\``;

			const result = parseTableDropdownDefinitions(content, 'test.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('merges tables from multiple YAML blocks', () => {
			const content = `# Block 1

\`\`\`yaml
tables:
  Status:
    options: [A, B]
\`\`\`

# Block 2

\`\`\`yaml
tables:
  Priority:
    options: [Low, High]
\`\`\`
`;

			const result = parseTableDropdownDefinitions(content, 'test.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(2);
				expect(result.data.definitions.get('Status')).toBeDefined();
				expect(result.data.definitions.get('Priority')).toBeDefined();
			}
		});

		it('later block overrides earlier block for same column', () => {
			const content = `\`\`\`yaml
tables:
  Status:
    options: [Old, Values]
\`\`\`

\`\`\`yaml
tables:
  Status:
    options: [New, Values]
\`\`\`
`;

			const result = parseTableDropdownDefinitions(content, 'test.md');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.get('Status')?.options).toEqual(['New', 'Values']);
			}
		});

		it('returns error for invalid table column definition', () => {
			const content = `\`\`\`yaml
tables:
  Status:
    multi: true
\`\`\``;

			const result = parseTableDropdownDefinitions(content, 'test.md');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing "options"');
			}
		});
	});
});
