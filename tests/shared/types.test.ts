/**
 * Tests for shared types and utilities.
 */

import { success, failure, ParseResult } from '../../src/shared/types';

describe('ParseResult utilities', () => {
	describe('success()', () => {
		it('creates a successful result with data', () => {
			const result = success({ foo: 'bar' });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({ foo: 'bar' });
			}
		});

		it('works with different data types', () => {
			expect(success('string').success).toBe(true);
			expect(success(42).success).toBe(true);
			expect(success([1, 2, 3]).success).toBe(true);
			expect(success(null).success).toBe(true);
		});
	});

	describe('failure()', () => {
		it('creates a failed result with error message', () => {
			const result = failure('Something went wrong');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe('Something went wrong');
			}
		});
	});

	describe('type narrowing', () => {
		it('allows type-safe access after checking success', () => {
			const goodResult: ParseResult<string> = success('hello');
			const badResult: ParseResult<string> = failure('error');

			// Type narrowing should work
			if (goodResult.success) {
				// TypeScript knows goodResult.data exists
				const data: string = goodResult.data;
				expect(data).toBe('hello');
			}

			if (!badResult.success) {
				// TypeScript knows badResult.error exists
				const error: string = badResult.error;
				expect(error).toBe('error');
			}
		});
	});
});
