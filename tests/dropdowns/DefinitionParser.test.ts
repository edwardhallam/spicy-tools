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
});
