/**
 * Tests for InheritanceResolver
 */

import {
	getFolderChain,
	getDefinitionFilePath,
	mergeDefinitions,
	DROPDOWN_DEFINITION_FILENAME,
} from '../../src/shared/InheritanceResolver';
import { DropdownDefinitions, DropdownDefinition } from '../../src/dropdowns/types';

describe('InheritanceResolver', () => {
	describe('DROPDOWN_DEFINITION_FILENAME', () => {
		it('is _dropdowns.md', () => {
			expect(DROPDOWN_DEFINITION_FILENAME).toBe('_dropdowns.md');
		});
	});

	describe('getFolderChain', () => {
		// Mock app with minimal structure
		const mockApp = {} as any;

		it('returns chain from nested folder to root', () => {
			const chain = getFolderChain('Health/Tracking/HealthLog/2026', mockApp);

			expect(chain).toEqual([
				'Health/Tracking/HealthLog/2026',
				'Health/Tracking/HealthLog',
				'Health/Tracking',
				'Health',
				'',
			]);
		});

		it('handles single-level folder', () => {
			const chain = getFolderChain('Health', mockApp);

			expect(chain).toEqual(['Health', '']);
		});

		it('handles root folder', () => {
			const chain = getFolderChain('', mockApp);

			expect(chain).toEqual(['']);
		});

		it('handles two-level folder', () => {
			const chain = getFolderChain('Health/Tracking', mockApp);

			expect(chain).toEqual([
				'Health/Tracking',
				'Health',
				'',
			]);
		});
	});

	describe('getDefinitionFilePath', () => {
		it('returns path for nested folder', () => {
			const path = getDefinitionFilePath('Health/Tracking');
			expect(path).toBe('Health/Tracking/_dropdowns.md');
		});

		it('returns path for root folder', () => {
			const path = getDefinitionFilePath('');
			expect(path).toBe('_dropdowns.md');
		});

		it('returns path for single folder', () => {
			const path = getDefinitionFilePath('Health');
			expect(path).toBe('Health/_dropdowns.md');
		});
	});

	describe('mergeDefinitions', () => {
		const createDefs = (
			defs: Record<string, Partial<DropdownDefinition>>,
			source: string
		): DropdownDefinitions => ({
			definitions: new Map(
				Object.entries(defs).map(([k, v]) => [
					k,
					{ property: k, options: [], ...v } as DropdownDefinition,
				])
			),
			source,
		});

		it('returns empty map for no sources', () => {
			const merged = mergeDefinitions();
			expect(merged.size).toBe(0);
		});

		it('returns empty map for null sources', () => {
			const merged = mergeDefinitions(null, null);
			expect(merged.size).toBe(0);
		});

		it('returns single source definitions', () => {
			const source = createDefs(
				{ status: { options: ['a', 'b'] } },
				'test'
			);

			const merged = mergeDefinitions(source);

			expect(merged.size).toBe(1);
			expect(merged.get('status')).toBeDefined();
		});

		it('first source takes priority over later sources', () => {
			const higher = createDefs(
				{ status: { options: ['high-a', 'high-b'] } },
				'higher'
			);
			const lower = createDefs(
				{ status: { options: ['low-a', 'low-b'] } },
				'lower'
			);

			const merged = mergeDefinitions(higher, lower);

			expect(merged.get('status')?.options).toEqual(['high-a', 'high-b']);
		});

		it('combines definitions from multiple sources', () => {
			const source1 = createDefs(
				{ status: { options: ['draft'] } },
				'source1'
			);
			const source2 = createDefs(
				{ priority: { options: ['high'] } },
				'source2'
			);

			const merged = mergeDefinitions(source1, source2);

			expect(merged.size).toBe(2);
			expect(merged.get('status')).toBeDefined();
			expect(merged.get('priority')).toBeDefined();
		});

		it('disabled: true removes property from merged result', () => {
			const child = createDefs(
				{ status: { options: [], disabled: true } },
				'child'
			);
			const parent = createDefs(
				{ status: { options: ['draft', 'published'] } },
				'parent'
			);

			const merged = mergeDefinitions(child, parent);

			// Disabled property should be removed
			expect(merged.has('status')).toBe(false);
		});

		it('child fully replaces parent (no option merging)', () => {
			const child = createDefs(
				{ status: { options: ['new-a', 'new-b'] } },
				'child'
			);
			const parent = createDefs(
				{ status: { options: ['old-a', 'old-b', 'old-c'] } },
				'parent'
			);

			const merged = mergeDefinitions(child, parent);

			// Should have child's options, not a merge
			expect(merged.get('status')?.options).toEqual(['new-a', 'new-b']);
			expect(merged.get('status')?.options).not.toContain('old-c');
		});
	});
});
