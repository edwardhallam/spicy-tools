/**
 * Tests for CardOrderManager
 */

import { CardOrderManager } from '../../src/kanban/CardOrderManager';
import { App } from 'obsidian';

describe('CardOrderManager', () => {
	let mockApp: App;
	let manager: CardOrderManager;

	beforeEach(() => {
		mockApp = new App();
		manager = new CardOrderManager(mockApp, 'test/_board.md');
	});

	afterEach(() => {
		manager.destroy();
	});

	describe('getColumnOrder', () => {
		it('returns empty array for unknown column', () => {
			expect(manager.getColumnOrder('unknown')).toEqual([]);
		});

		it('returns order for known column', () => {
			const initialOrder = { todo: ['a.md', 'b.md'] };
			manager = new CardOrderManager(mockApp, 'test/_board.md', initialOrder);

			expect(manager.getColumnOrder('todo')).toEqual(['a.md', 'b.md']);
		});
	});

	describe('addCard', () => {
		it('adds card to end of column', () => {
			manager.addCard('todo', 'task-1.md');

			expect(manager.getColumnOrder('todo')).toEqual(['task-1.md']);
		});

		it('creates column if needed', () => {
			manager.addCard('new-column', 'task.md');

			expect(manager.getColumnOrder('new-column')).toEqual(['task.md']);
		});

		it('removes card from other columns first', () => {
			manager.addCard('todo', 'task.md');
			manager.addCard('done', 'task.md');

			expect(manager.getColumnOrder('todo')).toEqual([]);
			expect(manager.getColumnOrder('done')).toEqual(['task.md']);
		});
	});

	describe('moveCard', () => {
		beforeEach(() => {
			manager.addCard('todo', 'task-1.md');
			manager.addCard('todo', 'task-2.md');
		});

		it('moves card between columns', () => {
			manager.moveCard('task-1.md', 'todo', 'done');

			expect(manager.getColumnOrder('todo')).toEqual(['task-2.md']);
			expect(manager.getColumnOrder('done')).toEqual(['task-1.md']);
		});

		it('moves card to specific index', () => {
			manager.addCard('done', 'task-3.md');
			manager.moveCard('task-1.md', 'todo', 'done', 0);

			expect(manager.getColumnOrder('done')).toEqual(['task-1.md', 'task-3.md']);
		});
	});

	describe('reorderCard', () => {
		beforeEach(() => {
			manager.addCard('todo', 'task-1.md');
			manager.addCard('todo', 'task-2.md');
			manager.addCard('todo', 'task-3.md');
		});

		it('reorders card within column', () => {
			manager.reorderCard('todo', 'task-3.md', 0);

			expect(manager.getColumnOrder('todo')).toEqual([
				'task-3.md',
				'task-1.md',
				'task-2.md',
			]);
		});

		it('handles move to end', () => {
			manager.reorderCard('todo', 'task-1.md', 2);

			expect(manager.getColumnOrder('todo')).toEqual([
				'task-2.md',
				'task-3.md',
				'task-1.md',
			]);
		});

		it('handles move to same position (no-op)', () => {
			manager.reorderCard('todo', 'task-2.md', 1);

			expect(manager.getColumnOrder('todo')).toEqual([
				'task-1.md',
				'task-2.md',
				'task-3.md',
			]);
		});
	});

	describe('removeCardFromColumn', () => {
		it('removes card from column', () => {
			manager.addCard('todo', 'task.md');
			manager.removeCardFromColumn('task.md', 'todo');

			expect(manager.getColumnOrder('todo')).toEqual([]);
		});

		it('handles non-existent card gracefully', () => {
			manager.removeCardFromColumn('nonexistent.md', 'todo');
			// Should not throw
		});
	});

	describe('handleRename', () => {
		it('updates filename in order', () => {
			manager.addCard('todo', 'old-name.md');
			manager.handleRename('old-name.md', 'new-name.md');

			expect(manager.getColumnOrder('todo')).toEqual(['new-name.md']);
		});
	});

	describe('cleanupOrders', () => {
		it('removes files that no longer exist', () => {
			manager.addCard('todo', 'exists.md');
			manager.addCard('todo', 'deleted.md');

			manager.cleanupOrders(new Set(['exists.md']));

			expect(manager.getColumnOrder('todo')).toEqual(['exists.md']);
		});
	});

	describe('getSortedCards', () => {
		it('returns cards in stored order', () => {
			const initialOrder = { todo: ['b.md', 'a.md', 'c.md'] };
			manager = new CardOrderManager(mockApp, 'test/_board.md', initialOrder);

			const sorted = manager.getSortedCards('todo', ['a.md', 'b.md', 'c.md']);

			expect(sorted).toEqual(['b.md', 'a.md', 'c.md']);
		});

		it('appends cards not in order at the end', () => {
			const initialOrder = { todo: ['a.md'] };
			manager = new CardOrderManager(mockApp, 'test/_board.md', initialOrder);

			const sorted = manager.getSortedCards('todo', ['a.md', 'b.md', 'c.md']);

			expect(sorted).toEqual(['a.md', 'b.md', 'c.md']);
		});

		it('filters out cards not in allCards', () => {
			const initialOrder = { todo: ['a.md', 'deleted.md', 'b.md'] };
			manager = new CardOrderManager(mockApp, 'test/_board.md', initialOrder);

			const sorted = manager.getSortedCards('todo', ['a.md', 'b.md']);

			expect(sorted).toEqual(['a.md', 'b.md']);
		});
	});
});
