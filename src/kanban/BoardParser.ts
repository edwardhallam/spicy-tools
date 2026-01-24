/**
 * BoardParser - Parse _board.md configuration files
 *
 * Extracts board configuration from markdown files containing YAML code blocks.
 * Similar to DefinitionParser but for Kanban board configuration.
 */

import { ParseResult, success, failure } from '../shared/types';
import { BoardConfig, RawBoardYAML } from './types';

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
 * Board configuration file name.
 */
export const BOARD_CONFIG_FILENAME = '_board.md';

/**
 * Regex to match YAML code blocks in markdown.
 */
const YAML_CODE_BLOCK_REGEX = /```ya?ml\s*([\s\S]*?)```/gi;

/**
 * Parse a _board.md file content into board configuration.
 *
 * @param content - Raw markdown content of the _board.md file
 * @param sourcePath - Path to the source file (for error messages)
 * @returns ParseResult containing BoardConfig or error message
 */
export function parseBoardConfig(
	content: string,
	sourcePath: string
): ParseResult<BoardConfig> {
	// Extract YAML code blocks
	const yamlBlocks = extractYamlBlocks(content);

	if (yamlBlocks.length === 0) {
		return failure(`No YAML configuration found in ${sourcePath}`);
	}

	// Use the first YAML block as the config
	const yamlContent = yamlBlocks[0];

	try {
		const raw = parseSimpleYaml(yamlContent);

		if (raw === null || typeof raw !== 'object') {
			return failure(`Invalid YAML structure in ${sourcePath}`);
		}

		return validateAndTransformConfig(raw as Partial<RawBoardYAML>, sourcePath);
	} catch (error) {
		if (error instanceof YamlSyntaxError) {
			return failure(`Invalid YAML syntax at line ${error.line}: ${error.message}`);
		}
		const message = error instanceof Error ? error.message : String(error);
		return failure(`Error parsing ${sourcePath}: ${message}`);
	}
}

/**
 * Extract all YAML code block contents from markdown.
 */
function extractYamlBlocks(content: string): string[] {
	const blocks: string[] = [];
	let match: RegExpExecArray | null;

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
 * Validate and transform raw YAML into BoardConfig.
 */
function validateAndTransformConfig(
	raw: Partial<RawBoardYAML>,
	sourcePath: string
): ParseResult<BoardConfig> {
	// Required: columnProperty
	if (!raw.columnProperty || typeof raw.columnProperty !== 'string') {
		return failure(`Missing required "columnProperty" in ${sourcePath}`);
	}

	// Required: columns
	if (!raw.columns || !Array.isArray(raw.columns)) {
		return failure(`Missing required "columns" array in ${sourcePath}`);
	}

	if (raw.columns.length === 0) {
		return failure(`"columns" array cannot be empty in ${sourcePath}`);
	}

	// Validate columns are strings
	for (let i = 0; i < raw.columns.length; i++) {
		if (typeof raw.columns[i] !== 'string') {
			return failure(`Column at index ${i} must be a string in ${sourcePath}`);
		}
	}

	// Build the config
	const config: BoardConfig = {
		columnProperty: raw.columnProperty,
		columns: raw.columns,
	};

	// Optional: cardTitle
	if (raw.cardTitle !== undefined) {
		if (typeof raw.cardTitle !== 'string') {
			return failure(`"cardTitle" must be a string in ${sourcePath}`);
		}
		config.cardTitle = raw.cardTitle;
	}

	// Optional: cardPreview
	if (raw.cardPreview !== undefined) {
		if (typeof raw.cardPreview !== 'string') {
			return failure(`"cardPreview" must be a string in ${sourcePath}`);
		}
		config.cardPreview = raw.cardPreview;
	}

	// Optional: cardPreviewLines
	if (raw.cardPreviewLines !== undefined) {
		if (typeof raw.cardPreviewLines !== 'number' || raw.cardPreviewLines < 1) {
			return failure(`"cardPreviewLines" must be a positive number in ${sourcePath}`);
		}
		config.cardPreviewLines = raw.cardPreviewLines;
	}

	// Optional: labelProperty
	if (raw.labelProperty !== undefined) {
		if (typeof raw.labelProperty !== 'string') {
			return failure(`"labelProperty" must be a string in ${sourcePath}`);
		}
		config.labelProperty = raw.labelProperty;
	}

	// Optional: labelDisplay
	if (raw.labelDisplay !== undefined) {
		if (raw.labelDisplay !== 'chips' && raw.labelDisplay !== 'stripe') {
			return failure(`"labelDisplay" must be "chips" or "stripe" in ${sourcePath}`);
		}
		config.labelDisplay = raw.labelDisplay;
	}

	// Optional: labelColors
	if (raw.labelColors !== undefined) {
		if (typeof raw.labelColors !== 'object' || raw.labelColors === null) {
			return failure(`"labelColors" must be an object in ${sourcePath}`);
		}
		config.labelColors = raw.labelColors;
	}

	// Optional: swimlaneProperty
	if (raw.swimlaneProperty !== undefined) {
		if (typeof raw.swimlaneProperty !== 'string') {
			return failure(`"swimlaneProperty" must be a string in ${sourcePath}`);
		}
		config.swimlaneProperty = raw.swimlaneProperty;
	}

	// Optional: swimlanesCollapsible
	if (raw.swimlanesCollapsible !== undefined) {
		if (typeof raw.swimlanesCollapsible !== 'boolean') {
			return failure(`"swimlanesCollapsible" must be a boolean in ${sourcePath}`);
		}
		config.swimlanesCollapsible = raw.swimlanesCollapsible;
	}

	// Optional: newCardTemplate
	if (raw.newCardTemplate !== undefined) {
		if (typeof raw.newCardTemplate !== 'string') {
			return failure(`"newCardTemplate" must be a string in ${sourcePath}`);
		}
		config.newCardTemplate = raw.newCardTemplate;
	}

	// Optional: cardOrder
	if (raw.cardOrder !== undefined) {
		if (typeof raw.cardOrder !== 'object' || raw.cardOrder === null) {
			return failure(`"cardOrder" must be an object in ${sourcePath}`);
		}
		// Validate structure: column -> array of filenames
		for (const [column, files] of Object.entries(raw.cardOrder)) {
			if (!Array.isArray(files)) {
				return failure(`"cardOrder.${column}" must be an array in ${sourcePath}`);
			}
		}
		config.cardOrder = raw.cardOrder;
	}

	// Optional: collapsedSwimlanes
	if (raw.collapsedSwimlanes !== undefined) {
		if (!Array.isArray(raw.collapsedSwimlanes)) {
			return failure(`"collapsedSwimlanes" must be an array in ${sourcePath}`);
		}
		for (let i = 0; i < raw.collapsedSwimlanes.length; i++) {
			if (typeof raw.collapsedSwimlanes[i] !== 'string') {
				return failure(`"collapsedSwimlanes[${i}]" must be a string in ${sourcePath}`);
			}
		}
		config.collapsedSwimlanes = raw.collapsedSwimlanes;
	}

	return success(config);
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
 * Simple YAML parser (reused from DefinitionParser pattern).
 * Handles the subset of YAML we need for board configs.
 * Throws YamlSyntaxError for invalid YAML syntax.
 */
function parseSimpleYaml(content: string): Record<string, unknown> | null {
	const result: Record<string, unknown> = {};
	const lines = content.split('\n');
	let currentKey: string | null = null;
	let currentObject: Record<string, unknown> | null = null;
	let currentArray: unknown[] | null = null;
	let nestedObjectKey: string | null = null;
	let nestedObject: Record<string, unknown> | null = null;

	for (let i = 0; i < lines.length; i++) {
		const lineNumber = i + 1; // 1-indexed for user-friendly error messages
		const rawLine = lines[i];
		const line = rawLine.trimEnd();

		if (!line || line.trim().startsWith('#')) {
			continue;
		}

		const indent = rawLine.length - rawLine.trimStart().length;
		const trimmed = line.trim();

		// Check for tabs (common YAML error)
		if (rawLine.includes('\t')) {
			throw new YamlSyntaxError('Tabs are not allowed in YAML, use spaces', lineNumber);
		}

		// Check for unclosed brackets in inline arrays
		if (trimmed.includes('[') && !trimmed.includes(']')) {
			throw new YamlSyntaxError('Unclosed bracket in inline array', lineNumber);
		}

		// Check for unclosed quotes (more carefully to handle nested quotes)
		// Only check for unmatched quotes at the value level, not embedded quotes
		if (hasUnclosedQuotes(trimmed)) {
			throw new YamlSyntaxError('Unclosed quote', lineNumber);
		}

		// Top-level key (no indentation)
		if (indent === 0 && trimmed.includes(':')) {
			// Save previous key's data
			if (currentKey !== null) {
				saveCurrentKey(result, currentKey, currentObject, currentArray, nestedObjectKey, nestedObject);
			}

			const colonIndex = trimmed.indexOf(':');
			currentKey = trimmed.substring(0, colonIndex).trim();
			const afterColon = trimmed.substring(colonIndex + 1).trim();

			currentObject = null;
			currentArray = null;
			nestedObjectKey = null;
			nestedObject = null;

			if (afterColon) {
				if (afterColon.startsWith('[') && afterColon.endsWith(']')) {
					result[currentKey] = parseInlineArray(afterColon);
					currentKey = null;
				} else {
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

		// Indented content
		if (currentKey !== null && indent > 0) {
			// Array item
			if (trimmed.startsWith('- ')) {
				const value = trimmed.substring(2).trim();

				// Check if we're inside a nested object context (e.g., cardOrder.columnName)
				// If so, the array belongs to the nested key, not the top-level key
				if (nestedObjectKey !== null && indent >= 4) {
					// Ensure currentObject exists
					if (currentObject === null) {
						currentObject = {};
					}
					// Get or create the array for this nested key
					if (!currentObject[nestedObjectKey]) {
						currentObject[nestedObjectKey] = [];
					}
					(currentObject[nestedObjectKey] as unknown[]).push(parseScalar(value));
				} else {
					// Top-level array (e.g., columns)
					if (currentArray === null) {
						currentArray = [];
					}
					currentArray.push(parseScalar(value));
				}
				continue;
			}

			// Nested key-value (for objects like labelColors or cardOrder)
			if (trimmed.includes(':')) {
				const colonIndex = trimmed.indexOf(':');
				const nestedKey = trimmed.substring(0, colonIndex).trim();
				const nestedValue = trimmed.substring(colonIndex + 1).trim();

				// Handle keys at first indentation level (indent 2)
				// These are direct children of currentKey (e.g., column names under cardOrder)
				if (indent === 2) {
					if (currentObject === null) {
						currentObject = {};
					}

					if (nestedValue) {
						// Key with inline value
						if (nestedValue.startsWith('[') && nestedValue.endsWith(']')) {
							currentObject[nestedKey] = parseInlineArray(nestedValue);
						} else {
							currentObject[nestedKey] = parseScalar(nestedValue);
						}
					} else {
						// Key without value - prepare for nested content (array or object)
						nestedObjectKey = nestedKey;
						nestedObject = {};
					}
				} else if (indent >= 4 && nestedObjectKey !== null) {
					// Deeper nesting - content inside nestedObjectKey
					if (nestedObject === null) {
						nestedObject = {};
					}
					if (nestedValue) {
						nestedObject[nestedKey] = nestedValue.startsWith('[')
							? parseInlineArray(nestedValue)
							: parseScalar(nestedValue);
					}
				}
			}
		}
	}

	// Save the last key
	if (currentKey !== null) {
		saveCurrentKey(result, currentKey, currentObject, currentArray, nestedObjectKey, nestedObject);
	}

	return result;
}

/**
 * Helper to save current key's accumulated data to result.
 */
function saveCurrentKey(
	result: Record<string, unknown>,
	key: string,
	obj: Record<string, unknown> | null,
	arr: unknown[] | null,
	nestedKey: string | null,
	nestedObj: Record<string, unknown> | null
): void {
	if (nestedKey !== null && nestedObj !== null && Object.keys(nestedObj).length > 0) {
		if (obj === null) {
			obj = {};
		}
		obj[nestedKey] = nestedObj;
	}

	if (arr !== null) {
		result[key] = arr;
	} else if (obj !== null) {
		result[key] = obj;
	}
}

/**
 * Parse an inline YAML array: [a, b, c]
 */
function parseInlineArray(content: string): unknown[] {
	const inner = content.slice(1, -1).trim();
	if (!inner) return [];

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
	if ((value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}

	if (value === 'true') return true;
	if (value === 'false') return false;
	if (value === 'null' || value === '~') return null;

	const num = Number(value);
	if (!isNaN(num) && value !== '') {
		return num;
	}

	return value;
}

/**
 * Serialize board config back to YAML for saving.
 * Only serializes cardOrder - other config is managed by user.
 *
 * @param content - Original file content
 * @param cardOrder - New card order to save
 * @returns Updated file content
 */
export function updateCardOrderInContent(
	content: string,
	cardOrder: Record<string, string[]>
): string {
	// Find the YAML block
	const match = YAML_CODE_BLOCK_REGEX.exec(content);
	YAML_CODE_BLOCK_REGEX.lastIndex = 0;

	if (!match) {
		return content;
	}

	const yamlStart = match.index + match[0].indexOf('\n') + 1;
	const yamlEnd = match.index + match[0].lastIndexOf('```');
	const beforeYaml = content.substring(0, yamlStart);
	const afterYaml = content.substring(yamlEnd);
	const existingYaml = match[1];

	// Parse existing YAML
	const parsed = parseSimpleYaml(existingYaml);
	if (!parsed) {
		return content;
	}

	// Update cardOrder
	parsed.cardOrder = cardOrder;

	// Serialize back (simple serialization for our use case)
	const newYaml = serializeToYaml(parsed);

	return beforeYaml + newYaml + '\n' + afterYaml;
}

/**
 * Update collapsedSwimlanes in the _board.md content.
 *
 * @param content - Original file content
 * @param collapsedSwimlanes - Array of collapsed swimlane IDs
 * @returns Updated file content
 */
export function updateCollapsedSwimlanesInContent(
	content: string,
	collapsedSwimlanes: string[]
): string {
	// Find the YAML block
	const match = YAML_CODE_BLOCK_REGEX.exec(content);
	YAML_CODE_BLOCK_REGEX.lastIndex = 0;

	if (!match) {
		return content;
	}

	const yamlStart = match.index + match[0].indexOf('\n') + 1;
	const yamlEnd = match.index + match[0].lastIndexOf('```');
	const beforeYaml = content.substring(0, yamlStart);
	const afterYaml = content.substring(yamlEnd);
	const existingYaml = match[1];

	// Parse existing YAML
	const parsed = parseSimpleYaml(existingYaml);
	if (!parsed) {
		return content;
	}

	// Update collapsedSwimlanes (only if non-empty, otherwise remove)
	if (collapsedSwimlanes.length > 0) {
		parsed.collapsedSwimlanes = collapsedSwimlanes;
	} else {
		delete parsed.collapsedSwimlanes;
	}

	// Serialize back
	const newYaml = serializeToYaml(parsed);

	return beforeYaml + newYaml + '\n' + afterYaml;
}

/**
 * Simple YAML serializer for our config structure.
 */
function serializeToYaml(obj: Record<string, unknown>, indent = 0): string {
	const lines: string[] = [];
	const prefix = '  '.repeat(indent);

	for (const [key, value] of Object.entries(obj)) {
		if (value === null || value === undefined) {
			continue;
		}

		if (Array.isArray(value)) {
			if (value.length === 0) {
				continue;
			}
			// Check if simple array (all primitives)
			if (value.every((v) => typeof v !== 'object')) {
				lines.push(`${prefix}${key}:`);
				for (const item of value) {
					lines.push(`${prefix}  - ${item}`);
				}
			} else {
				lines.push(`${prefix}${key}: [${value.join(', ')}]`);
			}
		} else if (typeof value === 'object') {
			lines.push(`${prefix}${key}:`);
			lines.push(serializeToYaml(value as Record<string, unknown>, indent + 1));
		} else if (typeof value === 'string') {
			lines.push(`${prefix}${key}: ${value}`);
		} else {
			lines.push(`${prefix}${key}: ${value}`);
		}
	}

	return lines.join('\n');
}
