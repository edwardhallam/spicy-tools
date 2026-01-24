/**
 * Tests for TableDropdownCoordinator
 *
 * TableDropdownCoordinator is the coordination layer that manages table
 * dropdown functionality across different view types. It:
 * - Initializes both Reading View and Live Preview implementations
 * - Subscribes to DropdownManager events
 * - Provides refresh and destroy APIs
 *
 * Tests focus on:
 * - Lifecycle management (initialize, destroy)
 * - Event subscription and handling
 * - Refresh functionality
 * - Error handling
 */

import { TableDropdownCoordinator } from '../../src/tables/TableDropdownCoordinator';

// Mock the ReadingViewTableDropdowns module
jest.mock('../../src/tables/ReadingViewTableDropdowns', () => ({
	registerReadingViewTableDropdowns: jest.fn(),
	clearReadingViewAdapters: jest.fn(),
	refreshReadingViewDropdowns: jest.fn(),
}));

// Mock the LivePreviewTableDropdowns module
jest.mock('../../src/tables/LivePreviewTableDropdowns', () => ({
	registerLivePreviewTableDropdowns: jest.fn(() => ({
		stop: jest.fn(),
		refreshDefinitions: jest.fn().mockResolvedValue(undefined),
	})),
	LivePreviewTableDropdownManager: jest.fn(),
}));

// Import the mocked functions for assertions
import {
	registerReadingViewTableDropdowns,
	clearReadingViewAdapters,
	refreshReadingViewDropdowns,
} from '../../src/tables/ReadingViewTableDropdowns';
import { registerLivePreviewTableDropdowns } from '../../src/tables/LivePreviewTableDropdowns';

// Mock Obsidian types
function createMockPlugin() {
	return {
		app: {
			workspace: {
				getActiveFile: jest.fn(() => null),
				on: jest.fn(() => ({ id: 'test-event-ref' })),
				offref: jest.fn(),
				activeLeaf: null,
			},
			vault: {
				on: jest.fn(() => ({ id: 'test-vault-ref' })),
				offref: jest.fn(),
				getAbstractFileByPath: jest.fn(),
				read: jest.fn(),
			},
		},
		registerMarkdownPostProcessor: jest.fn(),
		registerEditorExtension: jest.fn(),
	};
}

// Mock DropdownManager
function createMockDropdownManager() {
	return {
		on: jest.fn(() => jest.fn()),
		getTableDefinitionsForFile: jest.fn(async () => null),
	};
}

describe('TableDropdownCoordinator', () => {
	let mockPlugin: ReturnType<typeof createMockPlugin>;
	let mockDropdownManager: ReturnType<typeof createMockDropdownManager>;

	beforeEach(() => {
		mockPlugin = createMockPlugin();
		mockDropdownManager = createMockDropdownManager();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('construction', () => {
		it('should create coordinator instance', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			expect(coordinator).toBeInstanceOf(TableDropdownCoordinator);
		});

		it('should not be initialized on construction', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			expect(coordinator.isInitialized()).toBe(false);
		});
	});

	describe('initialize', () => {
		it('should register Reading View implementation', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			expect(registerReadingViewTableDropdowns).toHaveBeenCalledTimes(1);
			expect(registerReadingViewTableDropdowns).toHaveBeenCalledWith(
				mockPlugin,
				mockDropdownManager
			);
		});

		it('should register Live Preview implementation', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			expect(registerLivePreviewTableDropdowns).toHaveBeenCalledTimes(1);
			expect(registerLivePreviewTableDropdowns).toHaveBeenCalledWith(
				mockPlugin,
				mockDropdownManager
			);
		});

		it('should subscribe to DropdownManager events', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			expect(mockDropdownManager.on).toHaveBeenCalledTimes(1);
			expect(mockDropdownManager.on).toHaveBeenCalledWith(expect.any(Function));
		});

		it('should report initialized after initialize()', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			expect(coordinator.isInitialized()).toBe(true);
		});

		it('should be idempotent - not register twice on multiple calls', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			coordinator.initialize();
			coordinator.initialize();

			// Should only register once
			expect(registerReadingViewTableDropdowns).toHaveBeenCalledTimes(1);
			expect(registerLivePreviewTableDropdowns).toHaveBeenCalledTimes(1);
			expect(mockDropdownManager.on).toHaveBeenCalledTimes(1);
		});
	});

	describe('destroy', () => {
		it('should unsubscribe from DropdownManager events', () => {
			const unsubscribe = jest.fn();
			mockDropdownManager.on.mockReturnValue(unsubscribe);

			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			coordinator.destroy();

			expect(unsubscribe).toHaveBeenCalledTimes(1);
		});

		it('should clear Reading View adapters', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			coordinator.destroy();

			expect(clearReadingViewAdapters).toHaveBeenCalledTimes(1);
		});

		it('should stop Live Preview manager', () => {
			const mockLivePreviewManager = {
				stop: jest.fn(),
				refreshDefinitions: jest.fn().mockResolvedValue(undefined),
			};
			(registerLivePreviewTableDropdowns as jest.Mock).mockReturnValue(mockLivePreviewManager);

			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			coordinator.destroy();

			expect(mockLivePreviewManager.stop).toHaveBeenCalledTimes(1);
		});

		it('should report not initialized after destroy', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			coordinator.destroy();

			expect(coordinator.isInitialized()).toBe(false);
		});

		it('should be safe to call destroy multiple times', () => {
			const unsubscribe = jest.fn();
			mockDropdownManager.on.mockReturnValue(unsubscribe);

			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			expect(() => {
				coordinator.destroy();
				coordinator.destroy();
				coordinator.destroy();
			}).not.toThrow();

			// Unsubscribe should only be called once
			expect(unsubscribe).toHaveBeenCalledTimes(1);
		});

		it('should be safe to call destroy without initialize', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			expect(() => {
				coordinator.destroy();
			}).not.toThrow();
		});
	});

	describe('refresh', () => {
		it('should refresh Reading View dropdowns', async () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			await coordinator.refresh();

			expect(refreshReadingViewDropdowns).toHaveBeenCalledTimes(1);
		});

		it('should refresh Live Preview manager', async () => {
			const mockLivePreviewManager = {
				stop: jest.fn(),
				refreshDefinitions: jest.fn().mockResolvedValue(undefined),
			};
			(registerLivePreviewTableDropdowns as jest.Mock).mockReturnValue(mockLivePreviewManager);

			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			await coordinator.refresh();

			expect(mockLivePreviewManager.refreshDefinitions).toHaveBeenCalledTimes(1);
		});

		it('should handle refresh when not initialized', async () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			// Should not throw when not initialized
			await expect(coordinator.refresh()).resolves.toBeUndefined();
		});

		it('should handle refresh after destroy', async () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			coordinator.destroy();

			// Should not throw after destroy
			await expect(coordinator.refresh()).resolves.toBeUndefined();
		});
	});

	describe('event handling', () => {
		it('should refresh on definitions-cleared event', async () => {
			let eventCallback: ((event: any) => void) | null = null;

			mockDropdownManager.on.mockImplementation((callback) => {
				eventCallback = callback;
				return jest.fn();
			});

			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			// Clear initialization calls
			(refreshReadingViewDropdowns as jest.Mock).mockClear();

			// Simulate the event
			if (eventCallback) {
				eventCallback({ type: 'definitions-cleared' });
			}

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(refreshReadingViewDropdowns).toHaveBeenCalled();
		});

		it('should not refresh on definitions-loaded event', async () => {
			let eventCallback: ((event: any) => void) | null = null;

			mockDropdownManager.on.mockImplementation((callback) => {
				eventCallback = callback;
				return jest.fn();
			});

			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			// Clear initialization calls
			(refreshReadingViewDropdowns as jest.Mock).mockClear();

			// Simulate the event
			if (eventCallback) {
				eventCallback({ type: 'definitions-loaded', path: 'test/_dropdowns.md' });
			}

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10));

			// definitions-loaded should not trigger refresh (only definitions-cleared does)
			expect(refreshReadingViewDropdowns).not.toHaveBeenCalled();
		});

		it('should not refresh on definitions-error event', async () => {
			let eventCallback: ((event: any) => void) | null = null;

			mockDropdownManager.on.mockImplementation((callback) => {
				eventCallback = callback;
				return jest.fn();
			});

			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			// Clear initialization calls
			(refreshReadingViewDropdowns as jest.Mock).mockClear();

			// Simulate the event
			if (eventCallback) {
				eventCallback({ type: 'definitions-error', path: 'test/_dropdowns.md', error: 'parse error' });
			}

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(refreshReadingViewDropdowns).not.toHaveBeenCalled();
		});
	});

	describe('isInitialized', () => {
		it('should return false before initialization', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			expect(coordinator.isInitialized()).toBe(false);
		});

		it('should return true after initialization', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();

			expect(coordinator.isInitialized()).toBe(true);
		});

		it('should return false after destroy', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			coordinator.initialize();
			coordinator.destroy();

			expect(coordinator.isInitialized()).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle rapid initialize/destroy cycles', () => {
			const coordinator = new TableDropdownCoordinator(
				mockPlugin as any,
				mockPlugin.app as any,
				mockDropdownManager as any
			);

			for (let i = 0; i < 5; i++) {
				coordinator.initialize();
				coordinator.destroy();
			}

			expect(coordinator.isInitialized()).toBe(false);
		});
	});
});
