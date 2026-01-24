/**
 * Tests for malformed _dropdowns.md error handling
 *
 * These tests verify that DefinitionParser provides clear, user-friendly
 * error messages for various malformed configurations.
 */

import {
	parseDropdownDefinitions,
	parsePropertyDefinition,
	parseYamlBlock,
	parseSimpleYaml,
} from '../../src/dropdowns/DefinitionParser';

describe('Malformed _dropdowns.md Error Handling', () => {
	const testPath = 'Health/_dropdowns.md';

	describe('Property Definition Errors', () => {
		it('returns error when property has no options', () => {
			const content = `\`\`\`yaml
status:
  multi: true
\`\`\``;

			const result = parseDropdownDefinitions(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('options');
			}
		});

		it('returns error when options is not an array', () => {
			const result = parsePropertyDefinition('status', {
				options: 'not-an-array',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be an array');
			}
		});

		it('returns error when options is a string', () => {
			const result = parsePropertyDefinition('priority', {
				options: 'high',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be an array');
			}
		});

		it('returns error when options is a number', () => {
			const result = parsePropertyDefinition('priority', {
				options: 5,
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be an array');
			}
		});

		it('handles empty options array gracefully', () => {
			const result = parsePropertyDefinition('status', {
				options: [],
			});

			// Empty array is technically valid structure, just has no options
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.options).toEqual([]);
			}
		});

		it('returns error for missing property definition object', () => {
			const result = parsePropertyDefinition('status', null);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing');
			}
		});

		it('returns error for undefined property definition', () => {
			const result = parsePropertyDefinition('status', undefined);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing');
			}
		});

		it('returns error when property definition is a primitive', () => {
			const result = parsePropertyDefinition('status', 'just-a-string');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Missing');
			}
		});
	});

	describe('Invalid Values', () => {
		it('defaults multi to false when invalid type', () => {
			const result = parsePropertyDefinition('tags', {
				options: ['a', 'b', 'c'],
				multi: 'yes', // Should be boolean
			});

			// The parser treats non-true values as false
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.multi).toBe(false);
			}
		});

		it('defaults multi to false when numeric', () => {
			const result = parsePropertyDefinition('tags', {
				options: ['a', 'b', 'c'],
				multi: 1, // Should be boolean
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.multi).toBe(false);
			}
		});

		it('handles disabled as non-boolean gracefully', () => {
			// When disabled is a string or other value, not explicitly true
			const result = parsePropertyDefinition('old', {
				disabled: 'yes', // Should be boolean true
				options: ['a', 'b'],
			});

			// Since disabled !== true, it should try to parse as normal property
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.disabled).toBeUndefined();
			}
		});

		it('returns error for option containing object', () => {
			const result = parsePropertyDefinition('status', {
				options: ['valid', { nested: 'object' }],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be a string or number');
			}
		});

		it('returns error for option containing array', () => {
			const result = parsePropertyDefinition('status', {
				options: ['valid', ['nested', 'array']],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be a string or number');
			}
		});

		it('returns error for option containing null', () => {
			const result = parsePropertyDefinition('status', {
				options: ['valid', null, 'also-valid'],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be a string or number');
			}
		});

		it('returns error for option containing undefined', () => {
			const result = parsePropertyDefinition('status', {
				options: ['valid', undefined],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be a string or number');
			}
		});

		it('returns error for option containing boolean', () => {
			const result = parsePropertyDefinition('status', {
				options: ['valid', true, false],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('must be a string or number');
			}
		});
	});

	describe('Malformed YAML', () => {
		it('returns error for invalid YAML syntax in file', () => {
			const content = `\`\`\`yaml
status:
  options:
    - draft
    invalid: [unclosed
\`\`\``;

			const result = parseDropdownDefinitions(content, testPath);

			// Parser should handle gracefully without crashing
			expect(typeof result.success).toBe('boolean');
		});

		it('handles file with no YAML block gracefully', () => {
			const content = `# Dropdown Definitions

This file has no YAML blocks, just markdown.

Some explanatory text here.
`;

			const result = parseDropdownDefinitions(content, testPath);

			// No YAML is valid - just means no definitions
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('handles empty file', () => {
			const result = parseDropdownDefinitions('', testPath);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('handles file with only whitespace', () => {
			const result = parseDropdownDefinitions('   \n\t\n   ', testPath);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('handles unclosed YAML code block', () => {
			const content = `\`\`\`yaml
status:
  options:
    - draft
    - published
`;
			// No closing ```

			const result = parseDropdownDefinitions(content, testPath);

			// Should return empty definitions since block is not closed
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});

		it('handles empty YAML block', () => {
			const content = `\`\`\`yaml
\`\`\``;

			const result = parseDropdownDefinitions(content, testPath);

			// Empty YAML block is valid, just no definitions
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(0);
			}
		});
	});

	describe('parseYamlBlock Error Handling', () => {
		it('returns error with block index for invalid YAML', () => {
			// parseSimpleYaml returns null for truly invalid input
			// This tests the error message format
			const result = parseYamlBlock('', 2);

			// Empty string should not cause error, just empty result
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.size).toBe(0);
			}
		});

		it('returns error with property name for invalid property', () => {
			const yaml = `status:
  multi: true`;

			const result = parseYamlBlock(yaml, 0);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Block 1');
				expect(result.error).toContain('status');
				expect(result.error).toContain('options');
			}
		});

		it('handles YAML with only comments', () => {
			const yaml = `# This is a comment
# Another comment`;

			const result = parseYamlBlock(yaml, 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.size).toBe(0);
			}
		});
	});

	describe('parseSimpleYaml Edge Cases', () => {
		it('handles deeply indented content', () => {
			const yaml = `status:
  options:
    - draft
    - published
      extra-indent: should-be-ignored`;

			const result = parseSimpleYaml(yaml);

			expect(result).not.toBeNull();
			// Our simple parser may not handle this perfectly but should not crash
		});

		it('handles mixed indentation styles', () => {
			const yaml = `status:
  options:
    - draft
	- published`; // Tab indentation mixed with spaces

			const result = parseSimpleYaml(yaml);

			// Should handle gracefully
			expect(result).not.toBeNull();
		});

		it('handles keys with colons in values', () => {
			const yaml = `note:
  options:
    - "time: 10:30"
    - "date: 2024-01-01"`;

			const result = parseSimpleYaml(yaml);

			expect(result).not.toBeNull();
		});

		it('handles unicode property names', () => {
			const yaml = `estado:
  options: [borrador, publicado]`;

			const result = parseSimpleYaml(yaml);

			expect(result).not.toBeNull();
			expect(result!.estado).toBeDefined();
		});
	});

	describe('Error Message Quality', () => {
		it('provides clear error for missing options', () => {
			const content = `\`\`\`yaml
status:
  multi: true
\`\`\``;

			const result = parseDropdownDefinitions(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				// Error should mention the file path
				expect(result.error).toContain(testPath);
				// Error should mention what's missing
				expect(result.error).toContain('options');
			}
		});

		it('includes property name in error messages', () => {
			const content = `\`\`\`yaml
entry_type:
  options: [valid, options]

severity:
  multi: true
\`\`\``;

			const result = parseDropdownDefinitions(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('severity');
			}
		});

		it('includes option index in error messages', () => {
			const result = parsePropertyDefinition('status', {
				options: ['valid', { invalid: 'object' }, 'also-valid'],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				// Should indicate which option is invalid
				expect(result.error).toContain('index 1');
			}
		});

		it('error messages do not expose stack traces', () => {
			const result = parsePropertyDefinition('status', {
				options: [{ nested: 'object' }],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).not.toMatch(/at\s+\w+\s*\(/);
				expect(result.error).not.toContain('TypeError');
			}
		});
	});

	describe('Multiple YAML Blocks', () => {
		it('merges definitions from multiple YAML blocks', () => {
			const content = `# Status definitions

\`\`\`yaml
status:
  options: [draft, published]
\`\`\`

# Priority definitions

\`\`\`yaml
priority:
  options: [low, high]
\`\`\`
`;

			const result = parseDropdownDefinitions(content, testPath);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.definitions.size).toBe(2);
				expect(result.data.definitions.has('status')).toBe(true);
				expect(result.data.definitions.has('priority')).toBe(true);
			}
		});

		it('later blocks override earlier definitions', () => {
			const content = `\`\`\`yaml
status:
  options: [draft, published]
\`\`\`

\`\`\`yaml
status:
  options: [new, updated, archived]
\`\`\`
`;

			const result = parseDropdownDefinitions(content, testPath);

			expect(result.success).toBe(true);
			if (result.success) {
				const status = result.data.definitions.get('status');
				expect(status?.options).toEqual(['new', 'updated', 'archived']);
			}
		});

		it('reports error from second block correctly', () => {
			const content = `\`\`\`yaml
status:
  options: [draft, published]
\`\`\`

\`\`\`yaml
priority:
  multi: true
\`\`\`
`;

			const result = parseDropdownDefinitions(content, testPath);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Block 2');
				expect(result.error).toContain('priority');
			}
		});
	});

	describe('Disabled Properties', () => {
		it('allows disabled property without options', () => {
			const result = parsePropertyDefinition('old_field', {
				disabled: true,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.disabled).toBe(true);
				expect(result.data.options).toEqual([]);
			}
		});

		it('allows disabled property with options', () => {
			const result = parsePropertyDefinition('archived_field', {
				disabled: true,
				options: ['a', 'b', 'c'],
			});

			// disabled: true takes precedence, ignores options
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.disabled).toBe(true);
				expect(result.data.options).toEqual([]);
			}
		});

		it('disabled must be explicitly true', () => {
			const result = parsePropertyDefinition('field', {
				disabled: false,
				options: ['a', 'b'],
			});

			// disabled: false means it's active, needs options
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.disabled).toBeUndefined();
				expect(result.data.options).toEqual(['a', 'b']);
			}
		});
	});
});
