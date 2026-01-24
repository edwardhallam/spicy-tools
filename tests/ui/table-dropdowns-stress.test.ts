/**
 * Table Dropdowns Extended Stress Tests
 *
 * These tests focus on edge cases and stress scenarios that might cause
 * failures on repeated attempts. All tests run multiple iterations to
 * catch intermittent issues.
 *
 * Run with: npx playwright test tests/ui/table-dropdowns-stress.test.ts --config tests/ui/playwright.config.ts
 */

import { test, expect, Browser, Page } from '@playwright/test';
import {
	connectToObsidian,
	disconnectFromObsidian,
	reloadPlugin,
	switchToReadingView,
	switchToLivePreview,
	navigateToFile,
	getDropdownCount,
	waitForDropdowns,
	clickDropdown,
	selectOption,
	closeDropdownMenu,
	isDropdownMenuOpen,
	getDropdownOptions,
	getCellValue,
	resetTestState,
	closeActiveTab,
} from './helpers/obsidian-helpers';

const TEST_FILE = 'Health/GERD-Event-2026-01.md';

let browser: Browser;
let page: Page;

test.beforeAll(async () => {
	const connection = await connectToObsidian();
	browser = connection.browser;
	page = connection.page;
	await reloadPlugin(page);
});

test.afterAll(async () => {
	if (browser) {
		await disconnectFromObsidian(browser);
	}
});

test.beforeEach(async () => {
	await resetTestState(page);
});

// ═══════════════════════════════════════════════════════════════════════════
// Rapid View Switching Stress Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Stress: Rapid View Switching', () => {
	test('50x view switches with verification every 10', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		const initialCount = await getDropdownCount(page);

		for (let i = 0; i < 50; i++) {
			await switchToLivePreview(page);
			await page.waitForTimeout(200);

			await switchToReadingView(page);
			await page.waitForTimeout(200);

			// Verify every 10 iterations
			if ((i + 1) % 10 === 0) {
				const count = await waitForDropdowns(page, 1, 5000);
				expect(count).toBe(initialCount);
				console.log(`Completed ${i + 1}/50 view switches, dropdown count: ${count}`);
			}
		}

		// Final verification with interaction
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		expect(options.length).toBeGreaterThan(0);
		await closeDropdownMenu(page);
	});

	test('ultra-rapid switching (100ms intervals)', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Very rapid switches - 20 iterations at 100ms
		for (let i = 0; i < 20; i++) {
			await switchToLivePreview(page);
			await page.waitForTimeout(100);

			await switchToReadingView(page);
			await page.waitForTimeout(100);
		}

		// Allow system to settle
		await page.waitForTimeout(1000);

		// Verify recovery
		const count = await waitForDropdowns(page);
		expect(count).toBeGreaterThan(0);
	});

	test('alternating view modes with dropdown interaction', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		const iterations = 10;

		for (let i = 0; i < iterations; i++) {
			// Reading View: open dropdown, select, close
			await clickDropdown(page, 'Status');
			const options = await getDropdownOptions(page);
			if (options.length > 1) {
				await selectOption(page, options[i % options.length]);
			} else {
				await closeDropdownMenu(page);
			}
			await page.waitForTimeout(300);

			// Switch to Live Preview
			await switchToLivePreview(page);
			await page.waitForTimeout(500);
			await waitForDropdowns(page);

			// Live Preview: open dropdown, close without selecting
			await clickDropdown(page, 'Status');
			await page.waitForTimeout(100);
			await closeDropdownMenu(page);

			// Switch back
			await switchToReadingView(page);
			await page.waitForTimeout(500);
			await waitForDropdowns(page);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Rapid Dropdown Interaction Stress Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Stress: Rapid Dropdown Interactions', () => {
	test('20x rapid selection changes', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Get available options
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		await closeDropdownMenu(page);

		if (options.length < 2) {
			console.warn('Skipping: need at least 2 options');
			return;
		}

		for (let i = 0; i < 20; i++) {
			const targetOption = options[i % options.length];

			await clickDropdown(page, 'Status');
			await selectOption(page, targetOption);
			await page.waitForTimeout(150);

			// Verify value
			const value = await getCellValue(page, 'Status');
			expect(value).toBe(targetOption);
		}
	});

	test('30x open/close without selection', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		for (let i = 0; i < 30; i++) {
			await clickDropdown(page, 'Status');

			// Random close method
			if (i % 3 === 0) {
				await page.keyboard.press('Escape');
			} else if (i % 3 === 1) {
				await closeDropdownMenu(page);
			} else {
				await page.click('body', { position: { x: 10, y: 10 } });
			}

			await page.waitForTimeout(100);
		}

		// Verify dropdown still works
		await clickDropdown(page, 'Status');
		expect(await isDropdownMenuOpen(page)).toBe(true);
		await closeDropdownMenu(page);
	});

	test('rapid keyboard navigation', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		for (let i = 0; i < 10; i++) {
			await clickDropdown(page, 'Status');

			// Rapid arrow key navigation
			for (let j = 0; j < 5; j++) {
				await page.keyboard.press('ArrowDown');
				await page.waitForTimeout(50);
			}

			for (let j = 0; j < 3; j++) {
				await page.keyboard.press('ArrowUp');
				await page.waitForTimeout(50);
			}

			// Select with Enter on some iterations
			if (i % 2 === 0) {
				await page.keyboard.press('Enter');
			} else {
				await page.keyboard.press('Escape');
			}

			await page.waitForTimeout(200);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// File Navigation Stress Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Stress: File Navigation', () => {
	test('10x file close and reopen', async () => {
		for (let i = 0; i < 10; i++) {
			await navigateToFile(page, TEST_FILE);
			await switchToReadingView(page);
			await waitForDropdowns(page);

			// Interact with dropdown
			await clickDropdown(page, 'Status');
			await page.waitForTimeout(100);
			await closeDropdownMenu(page);

			// Close file
			await closeActiveTab(page);
			await page.waitForTimeout(300);
		}

		// Final verification
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		const count = await waitForDropdowns(page);
		expect(count).toBeGreaterThan(0);
	});

	test('rapid file switches preserve dropdown state', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Set a known value
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		const testValue = options[0];
		await selectOption(page, testValue);
		await page.waitForTimeout(500);

		// Navigate away and back 5 times
		for (let i = 0; i < 5; i++) {
			// Navigate to a different file
			await navigateToFile(page, 'Health');
			await page.waitForTimeout(300);

			// Navigate back
			await navigateToFile(page, TEST_FILE);
			await switchToReadingView(page);
			await waitForDropdowns(page);

			// Verify value persisted
			const currentValue = await getCellValue(page, 'Status');
			expect(currentValue).toBe(testValue);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Plugin Lifecycle Stress Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Stress: Plugin Lifecycle', () => {
	test('5x plugin reload with dropdown verification', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		const initialCount = await getDropdownCount(page);

		for (let i = 0; i < 5; i++) {
			await reloadPlugin(page);

			// Wait for dropdowns to reappear
			const count = await waitForDropdowns(page, initialCount, 5000);
			expect(count).toBe(initialCount);

			// Verify functionality
			await clickDropdown(page, 'Status');
			const options = await getDropdownOptions(page);
			expect(options.length).toBeGreaterThan(0);
			await closeDropdownMenu(page);

			console.log(`Plugin reload ${i + 1}/5 successful`);
		}
	});

	test('plugin reload during view switch', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		for (let i = 0; i < 3; i++) {
			// Start view switch
			await switchToLivePreview(page);
			await page.waitForTimeout(200);

			// Reload plugin mid-transition
			await reloadPlugin(page);

			// Verify recovery
			await waitForDropdowns(page);

			// Switch back and verify
			await switchToReadingView(page);
			await page.waitForTimeout(500);
			await waitForDropdowns(page);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Concurrent Operation Stress Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Stress: Concurrent Operations', () => {
	test('dropdown interaction immediately after view switch', async () => {
		await navigateToFile(page, TEST_FILE);

		for (let i = 0; i < 10; i++) {
			// Switch view and immediately try to interact
			await switchToLivePreview(page);
			await page.waitForTimeout(300);

			// Try to interact immediately
			try {
				await waitForDropdowns(page, 1, 2000);
				await clickDropdown(page, 'Status');
				await page.waitForTimeout(100);
				await closeDropdownMenu(page);
			} catch {
				// Some iterations may not find dropdowns immediately - that's ok
			}

			await switchToReadingView(page);
			await page.waitForTimeout(300);

			// Verify dropdowns are functional
			await waitForDropdowns(page);
			await clickDropdown(page, 'Status');
			expect(await isDropdownMenuOpen(page)).toBe(true);
			await closeDropdownMenu(page);
		}
	});

	test('multiple dropdown opens in quick succession', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Get dropdown count to know how many we have
		const values = await page.evaluate(() => {
			const dropdowns: { column: string; rowIndex: number }[] = [];
			const tables = document.querySelectorAll('table');

			tables.forEach((table) => {
				const headers: string[] = [];
				table.querySelectorAll('thead th, tr:first-child th').forEach((cell) => {
					headers.push(cell.textContent?.trim() || '');
				});

				const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
				rows.forEach((row, rowIndex) => {
					row.querySelectorAll('td').forEach((cell, colIndex) => {
						if (cell.querySelector('.spicy-dropdown')) {
							dropdowns.push({
								column: headers[colIndex] || `Column ${colIndex}`,
								rowIndex,
							});
						}
					});
				});
			});

			return dropdowns;
		});

		// Click through each dropdown rapidly
		for (const dropdown of values) {
			await clickDropdown(page, dropdown.column, dropdown.rowIndex);
			await page.waitForTimeout(50);
			await closeDropdownMenu(page);
			await page.waitForTimeout(50);
		}

		// Verify first dropdown still works
		if (values.length > 0) {
			await clickDropdown(page, values[0].column, values[0].rowIndex);
			expect(await isDropdownMenuOpen(page)).toBe(true);
			await closeDropdownMenu(page);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Memory and Performance Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Stress: Memory and Performance', () => {
	test('no DOM accumulation after 25 view switches', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		const initialDropdownCount = await getDropdownCount(page);
		const initialMenuCount = await page.evaluate(() => {
			return document.querySelectorAll('.spicy-dropdown-menu').length;
		});

		// Perform many view switches
		for (let i = 0; i < 25; i++) {
			await switchToLivePreview(page);
			await page.waitForTimeout(200);
			await switchToReadingView(page);
			await page.waitForTimeout(200);
		}

		// Check that we don't have accumulated elements
		const finalDropdownCount = await getDropdownCount(page);
		const finalMenuCount = await page.evaluate(() => {
			return document.querySelectorAll('.spicy-dropdown-menu').length;
		});

		// Should have same number of dropdowns (not accumulating)
		expect(finalDropdownCount).toBe(initialDropdownCount);

		// Menu count should be similar (might vary by 1-2 during transitions)
		expect(finalMenuCount).toBeLessThanOrEqual(initialMenuCount + 2);
	});

	test('event handlers cleaned up after destroy', async () => {
		await navigateToFile(page, TEST_FILE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Open and close many menus
		for (let i = 0; i < 20; i++) {
			await clickDropdown(page, 'Status');
			await page.waitForTimeout(100);
			await closeDropdownMenu(page);
			await page.waitForTimeout(100);
		}

		// Switch views to trigger cleanup
		await switchToLivePreview(page);
		await page.waitForTimeout(500);
		await switchToReadingView(page);
		await page.waitForTimeout(500);

		// Verify no orphaned menus
		const orphanedMenus = await page.evaluate(() => {
			const menus = document.querySelectorAll('.spicy-dropdown-menu');
			let orphaned = 0;
			menus.forEach((menu) => {
				// A menu is orphaned if it's not hidden and not near a trigger
				if (!menu.classList.contains('hidden')) {
					orphaned++;
				}
			});
			return orphaned;
		});

		expect(orphanedMenus).toBe(0);
	});
});
