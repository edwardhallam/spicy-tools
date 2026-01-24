/**
 * DefinitionParser - Parse _dropdowns.md files
 *
 * Extracts dropdown definitions from markdown files containing YAML code blocks.
 * Handles the hybrid markdown+YAML format specified in SPEC.md.
 */

import { ParseResult, success, failure } from '../shared/types';
import { DropdownDefinition, DropdownDefinitions, RawDropdownYAML } from './types';

/**
 * Custom error class for YAML syntax errors with line number information.
 */
class YamlSyntaxError extends Error {
	constructor(
		message: string,
		public line: number
	) {
		super(message);
		this.name = 'YamlSyntaxError';
	}
}

/**
 * Regex to match YAML code blocks in markdown.
 * Captures content between ```yaml and ``` (or ```yml).
 */
const YAML_CODE_BLOCK_REGEX = /```ya?ml\s*([\s\S]*?)```/gi;

/**
 * Parse a _dropdowns.md file content into dropdown definitions.
 *
 * @param content - Raw markdown content of the _dropdowns.md file
 * @param sourcePath - Path to the source file (for error messages and tracking)
 * @returns ParseResult containing definitions or error message
 */
export function parseDropdownDefinitions(
	content: string,
	sourcePath: string
): ParseResult<DropdownDefinitions> {
	// Extract all YAML code blocks
	const yamlBlocks = extractYamlBlocks(content);

	if (yamlBlocks.length === 0) {
		// Empty file or no YAML blocks is valid - just means no definitions
		return success({
			definitions: new Map(),
			source: sourcePath,
		});
	}

	// Parse and merge all YAML blocks
	const definitions = new Map<string, DropdownDefinition>();
	const errors: string[] = [];

	for (let i = 0; i < yamlBlocks.length; i++) {
		const block = yamlBlocks[i];
		const result = parseYamlBlock(block, i);

		if (!result.success) {
			errors.push(result.error);
			continue;
		}

		// Merge definitions from this block
		for (const [property, definition] of result.data) {
			definitions.set(property, definition);
		}
	}

	if (errors.length > 0) {
		return failure(`YAML parsing errors in ${sourcePath}:\n${errors.join('\n')}`);
	}

	return success({
		definitions,
		source: sourcePath,
	});
}

/**
 * Extract all YAML code block contents from markdown.
 *
 * @param content - Markdown content
 * @returns Array of YAML block contents (without the ``` markers)
 */
export function extractYamlBlocks(content: string): string[] {
	const blocks: string[] = [];
	let match: RegExpExecArray | null;

	// Reset regex state
	YAML_CODE_BLOCK_REGEX.lastIndex = 0;

	while ((match = YAML_CODE_BLOCK_REGEX.exec(content)) !== null) {
		const yamlContent = match[1].trim();
		if (yamlContent) {
			blocks.push(yamlContent);
		}
	}

	return blocks;
}

/**
 * Parse a single YAML block into dropdown definitions.
 *
 * @param yamlContent - YAML content (without ``` markers)
 * @param blockIndex - Index of the block (for error messages)
 * @returns ParseResult with Map of property name to definition
 */
export function parseYamlBlock(
	yamlContent: string,
	blockIndex: number
): ParseResult<Map<string, DropdownDefinition>> {
	try {
		const raw = parseSimpleYaml(yamlContent);

		if (raw === null || typeof raw !== 'object') {
			return failure(`Block ${blockIndex + 1}: Invalid YAML structure`);
		}

		const definitions = new Map<string, DropdownDefinition>();

		for (const [property, value] of Object.entries(raw as RawDropdownYAML)) {
			// Skip YAML comments that got parsed
			if (property.startsWith('#')) continue;

			// Skip empty property names with warning
			if (!property.trim()) {
				console.warn(`Block ${blockIndex + 1}: Skipping property with empty name`);
				continue;
			}

			const definition = parsePropertyDefinition(property, value);

			if (!definition.success) {
				return failure(`Block ${blockIndex + 1}, property "${property}": ${definition.error}`);
			}

			definitions.set(property, definition.data);
		}

		return success(definitions);
	} catch (error) {
		if (error instanceof YamlSyntaxError) {
			return failure(`Block ${blockIndex + 1}: Invalid YAML syntax at line ${error.line}: ${error.message}`);
		}
		const message = error instanceof Error ? error.message : String(error);
		return failure(`Block ${blockIndex + 1}: ${message}`);
	}
}

/**
 * Parse a single property definition from raw YAML.
 *
 * @param property - Property name
 * @param value - Raw YAML value for the property
 * @returns ParseResult with DropdownDefinition
 */
export function parsePropertyDefinition(
	property: string,
	value: unknown
): ParseResult<DropdownDefinition> {
	// Handle disabled property
	if (value && typeof value === 'object' && 'disabled' in value) {
		const obj = value as { disabled?: boolean; options?: unknown[]; multi?: boolean };

		if (obj.disabled === true) {
			return success({
				property,
				options: [],
				disabled: true,
			});
		}
	}

	// Must have options
	if (!value || typeof value !== 'object') {
		return failure('Missing property definition object');
	}

	const obj = value as { options?: unknown[]; multi?: unknown };

	if (!obj.options) {
		return failure('Missing "options" array');
	}

	if (!Array.isArray(obj.options)) {
		return failure('"options" must be an array');
	}

	// Validate options are strings or numbers
	const options: (string | number)[] = [];
	for (let i = 0; i < obj.options.length; i++) {
		const opt = obj.options[i];
		if (typeof opt === 'string' || typeof opt === 'number') {
			options.push(opt);
		} else {
			return failure(`Option at index ${i} must be a string or number`);
		}
	}

	// Handle multi field - warn if not boolean, default to false
	let multi = false;
	if (obj.multi !== undefined) {
		if (typeof obj.multi === 'boolean') {
			multi = obj.multi;
		} else {
			console.warn(`Property '${property}': 'multi' should be a boolean, defaulting to false`);
		}
	}

	return success({
		property,
		options,
		multi,
	});
}

/**
 * Check if a line has unclosed quotes.
 * Handles the case where one type of quote is nested inside another.
 * E.g., "won't-do" is valid (apostrophe inside double quotes).
 */
function hasUnclosedQuotes(line: string): boolean {
	let inDoubleQuote = false;
	let inSingleQuote = false;

	for (const char of line) {
		if (char === '"' && !inSingleQuote) {
			inDoubleQuote = !inDoubleQuote;
		} else if (char === "'" && !inDoubleQuote) {
			inSingleQuote = !inSingleQuote;
		}
	}

	return inDoubleQuote || inSingleQuote;
}

/**
 * Simple YAML parser for our specific use case.
 *
 * This handles the subset of YAML we need:
 * - Top-level properties with object values
 * - Arrays (both inline [...] and block - style)
 * - Simple scalar values (strings, numbers, booleans)
 *
 * We use a simple parser instead of a full YAML library to:
 * 1. Keep bundle size small (important for Obsidian plugins)
 * 2. Avoid dependency on external libraries
 * 3. Handle our specific format requirements
 *
 * Throws YamlSyntaxError for invalid YAML syntax.
 *
 * @param content - YAML content string
 * @returns Parsed object or null if invalid
 */
export function parseSimpleYaml(content: string): Record<string, unknown> | null {
	const result: Record<string, unknown> = {};
	const lines = content.split('\n');
	let currentKey: string | null = null;
	let currentObject: Record<string, unknown> | null = null;
	let currentArray: unknown[] | null = null;
	let isCollectingArray = false;

	for (let i = 0; i < lines.length; i++) {
		const lineNumber = i + 1; // 1-indexed for user-friendly error messages
		const rawLine = lines[i];
		const line = rawLine.trimEnd();

		// Skip empty lines and comments
		if (!line || line.trim().startsWith('#')) {
			continue;
		}

		// Check indentation level
		const indent = rawLine.length - rawLine.trimStart().length;
		const trimmed = line.trim();

		// Check for tabs (common YAML issue) - warn but continue
		if (rawLine.includes('\t')) {
			console.warn(`YAML warning at line ${lineNumber}: Tabs are not recommended in YAML, use spaces`);
		}

		// Check for unclosed brackets in inline arrays
		if (trimmed.includes('[') && !trimmed.includes(']')) {
			throw new YamlSyntaxError('Unclosed bracket in inline array', lineNumber);
		}

		// Check for unclosed quotes (more carefully to handle nested quotes)
		if (hasUnclosedQuotes(trimmed)) {
			throw new YamlSyntaxError('Unclosed quote', lineNumber);
		}

		// Top-level key (no indentation)
		if (indent === 0 && trimmed.includes(':')) {
			// Save previous key's data
			if (currentKey !== null) {
				if (currentArray !== null) {
					if (currentObject === null) {
						result[currentKey] = currentArray;
					} else {
						currentObject.options = currentArray;
						result[currentKey] = currentObject;
					}
				} else if (currentObject !== null) {
					result[currentKey] = currentObject;
				}
			}

			// Parse new key
			const colonIndex = trimmed.indexOf(':');
			currentKey = trimmed.substring(0, colonIndex).trim();
			const afterColon = trimmed.substring(colonIndex + 1).trim();

			currentObject = null;
			currentArray = null;
			isCollectingArray = false;

			// Check for inline value
			if (afterColon) {
				// Inline array: [a, b, c]
				if (afterColon.startsWith('[') && afterColon.endsWith(']')) {
					currentArray = parseInlineArray(afterColon);
					currentObject = { options: currentArray };
				} else {
					// Simple value (unusual at top level for our format)
					result[currentKey] = parseScalar(afterColon);
					currentKey = null;
				}
			}
			continue;
		}

		// Indented content without a current key is an error
		if (indent > 0 && currentKey === null) {
			throw new YamlSyntaxError('Unexpected indented content without a parent key', lineNumber);
		}

		// Indented content (belongs to current key)
		if (currentKey !== null && indent > 0) {
			// Array item
			if (trimmed.startsWith('- ')) {
				if (currentArray === null) {
					currentArray = [];
					isCollectingArray = true;
				}
				const value = trimmed.substring(2).trim();
				currentArray.push(parseScalar(value));
				continue;
			}

			// Nested key-value
			if (trimmed.includes(':')) {
				if (currentObject === null) {
					currentObject = {};
				}

				const colonIndex = trimmed.indexOf(':');
				const nestedKey = trimmed.substring(0, colonIndex).trim();
				const nestedValue = trimmed.substring(colonIndex + 1).trim();

				if (nestedValue) {
					// Inline array
					if (nestedValue.startsWith('[') && nestedValue.endsWith(']')) {
						currentObject[nestedKey] = parseInlineArray(nestedValue);
					} else {
						currentObject[nestedKey] = parseScalar(nestedValue);
					}
				} else {
					// Will collect array items on next lines
					if (nestedKey === 'options') {
						currentArray = [];
						isCollectingArray = true;
					}
				}
			}
		}
	}

	// Don't forget the last key
	if (currentKey !== null) {
		if (currentArray !== null) {
			if (currentObject === null) {
				result[currentKey] = currentArray;
			} else {
				currentObject.options = currentArray;
				result[currentKey] = currentObject;
			}
		} else if (currentObject !== null) {
			result[currentKey] = currentObject;
		}
	}

	return result;
}

/**
 * Parse an inline YAML array: [a, b, c]
 */
function parseInlineArray(content: string): unknown[] {
	// Remove brackets
	const inner = content.slice(1, -1).trim();
	if (!inner) return [];

	// Split by comma, handling quoted strings
	const items: unknown[] = [];
	let current = '';
	let inQuotes = false;
	let quoteChar = '';

	for (const char of inner) {
		if ((char === '"' || char === "'") && !inQuotes) {
			inQuotes = true;
			quoteChar = char;
		} else if (char === quoteChar && inQuotes) {
			inQuotes = false;
			quoteChar = '';
		} else if (char === ',' && !inQuotes) {
			items.push(parseScalar(current.trim()));
			current = '';
			continue;
		}
		current += char;
	}

	if (current.trim()) {
		items.push(parseScalar(current.trim()));
	}

	return items;
}

/**
 * Parse a YAML scalar value.
 */
function parseScalar(value: string): string | number | boolean | null {
	// Remove quotes
	if ((value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}

	// Boolean
	if (value === 'true') return true;
	if (value === 'false') return false;

	// Null
	if (value === 'null' || value === '~') return null;

	// Number
	const num = Number(value);
	if (!isNaN(num) && value !== '') {
		return num;
	}

	// String
	return value;
}

/**
 * Parse global dropdown definitions from plugin settings.
 * This is pure YAML (no markdown wrapper).
 *
 * @param yamlContent - Raw YAML string from settings
 * @returns ParseResult with definitions
 */
export function parseGlobalDefinitions(
	yamlContent: string
): ParseResult<DropdownDefinitions> {
	if (!yamlContent.trim()) {
		return success({
			definitions: new Map(),
			source: 'global',
		});
	}

	const blockResult = parseYamlBlock(yamlContent, 0);

	if (!blockResult.success) {
		return failure(blockResult.error);
	}

	return success({
		definitions: blockResult.data,
		source: 'global',
	});
}
