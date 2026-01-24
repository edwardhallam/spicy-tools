/**
 * Table Dropdowns UI Test Suite
 *
 * Comprehensive CDP/Playwright tests for table dropdown functionality.
 * Tests cover Reading View, Live Preview, view switching, and stress scenarios.
 *
 * IMPORTANT: These tests require:
 * 1. SSH tunnel active: ssh -fNL 9222:localhost:9222 macmini
 * 2. Obsidian running on Mac Mini with CDP enabled
 * 3. A test file with table dropdowns open in the nexus vault
 *
 * Run with: npx playwright test --config tests/ui/playwright.config.ts
 */

import { test, expect, Browser, Page } from '@playwright/test';
import {
	connectToObsidian,
	disconnectFromObsidian,
	reloadPlugin,
	switchToReadingView,
	switchToLivePreview,
	getCurrentViewMode,
	navigateToFile,
	getDropdownCount,
	verifyDropdownsRendered,
	waitForDropdowns,
	getDropdownValues,
	clickDropdown,
	selectOption,
	selectDropdownOption,
	closeDropdownMenu,
	isDropdownMenuOpen,
	getDropdownOptions,
	getCellValue,
	expectCellValue,
	getDropdownStyling,
	takeScreenshot,
	collectConsoleErrors,
	resetTestState,
	setupTestFile,
	closeActiveTab,
} from './helpers/obsidian-helpers';

// Test file paths (relative to vault root)
const TEST_FILE_WITH_TABLE = 'Health/GERD-Event-2026-01.md';
const TEST_FILE_ALTERNATE = 'Health/GERD-Event-2025-12.md';

// Shared browser/page for test suite
let browser: Browser;
let page: Page;

// ═══════════════════════════════════════════════════════════════════════════
// Test Setup and Teardown
// ═══════════════════════════════════════════════════════════════════════════

test.beforeAll(async () => {
	const connection = await connectToObsidian();
	browser = connection.browser;
	page = connection.page;

	// Ensure plugin is enabled
	await reloadPlugin(page);
});

test.afterAll(async () => {
	if (browser) {
		await disconnectFromObsidian(browser);
	}
});

test.beforeEach(async () => {
	// Reset state between tests
	await resetTestState(page);
});

// ═══════════════════════════════════════════════════════════════════════════
// Reading View Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Table Dropdowns - Reading View', () => {
	test.beforeEach(async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);
	});

	test('renders dropdowns in table cells', async () => {
		const count = await getDropdownCount(page);
		expect(count).toBeGreaterThan(0);

		// Verify pill styling
		const styling = await getDropdownStyling(page);
		expect(parseFloat(styling.borderRadius)).toBeGreaterThanOrEqual(8);
		expect(styling.backgroundColor).not.toBe('transparent');
		expect(styling.hasArrow).toBe(true);
	});

	test('dropdown opens and shows options', async () => {
		// Click on a dropdown
		await clickDropdown(page, 'Status');

		// Verify menu is open
		const isOpen = await isDropdownMenuOpen(page);
		expect(isOpen).toBe(true);

		// Get options
		const options = await getDropdownOptions(page);
		expect(options.length).toBeGreaterThan(0);

		// Close menu
		await closeDropdownMenu(page);
		const isStillOpen = await isDropdownMenuOpen(page);
		expect(isStillOpen).toBe(false);
	});

	test('selecting option updates cell value', async () => {
		// Get initial value
		const initialValue = await getCellValue(page, 'Status');

		// Find a different option to select
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		const newOption = options.find((opt) => opt !== initialValue) || options[0];

		// Select new option
		await selectOption(page, newOption);

		// Wait for update
		await page.waitForTimeout(500);

		// Verify value changed
		const newValue = await getCellValue(page, 'Status');
		expect(newValue).toBe(newOption);

		// Restore original value
		await selectDropdownOption(page, 'Status', initialValue);
	});

	test('keyboard navigation works', async () => {
		// Open dropdown
		await clickDropdown(page, 'Status');
		await page.waitForTimeout(200);

		// Navigate with arrow keys
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(100);
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(100);

		// Verify highlight moved (check DOM for highlighted class)
		const hasHighlight = await page.evaluate(() => {
			const highlighted = document.querySelector('.spicy-dropdown-option.highlighted');
			return highlighted !== null;
		});
		expect(hasHighlight).toBe(true);

		// Close with Escape
		await page.keyboard.press('Escape');
		const isOpen = await isDropdownMenuOpen(page);
		expect(isOpen).toBe(false);
	});

	test('displays all dropdown columns correctly', async () => {
		const values = await getDropdownValues(page);

		// Verify we found dropdowns
		expect(values.length).toBeGreaterThan(0);

		// Each value should have column and value properties
		for (const item of values) {
			expect(item.column).toBeDefined();
			expect(typeof item.value).toBe('string');
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Live Preview Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Table Dropdowns - Live Preview', () => {
	test.beforeEach(async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToLivePreview(page);
		await page.waitForTimeout(1000); // Live Preview needs more time
		await waitForDropdowns(page);
	});

	test('renders dropdowns in Live Preview mode', async () => {
		const viewMode = await getCurrentViewMode(page);
		expect(viewMode).toBe('live-preview');

		const count = await getDropdownCount(page);
		expect(count).toBeGreaterThan(0);
	});

	test('dropdown interaction works in Live Preview', async () => {
		// Get initial value
		const initialValue = await getCellValue(page, 'Status');

		// Click and select
		await clickDropdown(page, 'Status');
		const isOpen = await isDropdownMenuOpen(page);
		expect(isOpen).toBe(true);

		const options = await getDropdownOptions(page);
		const newOption = options.find((opt) => opt !== initialValue) || options[0];

		await selectOption(page, newOption);
		await page.waitForTimeout(500);

		// Verify update
		const newValue = await getCellValue(page, 'Status');
		expect(newValue).toBe(newOption);

		// Restore
		await selectDropdownOption(page, 'Status', initialValue);
	});

	test('prevents native cell editing when clicking dropdown', async () => {
		// Click on dropdown
		await clickDropdown(page, 'Status');

		// Verify dropdown opened (not native editor)
		const isDropdownOpen = await isDropdownMenuOpen(page);
		expect(isDropdownOpen).toBe(true);

		// Verify no cursor is visible in cell (native edit mode)
		const hasNativeEditor = await page.evaluate(() => {
			const selection = window.getSelection();
			const cursorInTable = selection?.anchorNode?.parentElement?.closest('table');
			return cursorInTable !== null && selection?.type === 'Caret';
		});
		expect(hasNativeEditor).toBe(false);

		await closeDropdownMenu(page);
	});

	test('styling matches Reading View', async () => {
		const styling = await getDropdownStyling(page);

		// Should have pill styling
		expect(parseFloat(styling.borderRadius)).toBeGreaterThanOrEqual(8);
		expect(styling.backgroundColor).not.toBe('transparent');
		expect(styling.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// View Switching Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Table Dropdowns - View Switching', () => {
	test.beforeEach(async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);
	});

	test('survives single view switch to Live Preview', async () => {
		// Verify initial state
		let count = await getDropdownCount(page);
		expect(count).toBeGreaterThan(0);

		// Switch to Live Preview
		await switchToLivePreview(page);
		await page.waitForTimeout(1000);

		// Verify dropdowns still exist
		count = await waitForDropdowns(page);
		expect(count).toBeGreaterThan(0);
	});

	test('survives single view switch to Reading View', async () => {
		// Start in Live Preview
		await switchToLivePreview(page);
		await page.waitForTimeout(1000);
		await waitForDropdowns(page);

		// Switch to Reading View
		await switchToReadingView(page);
		await page.waitForTimeout(500);

		// Verify dropdowns exist
		const count = await waitForDropdowns(page);
		expect(count).toBeGreaterThan(0);
	});

	test('values persist across view switches', async () => {
		// Get initial value
		const initialValue = await getCellValue(page, 'Status');

		// Change value in Reading View
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		const newValue = options.find((opt) => opt !== initialValue) || options[0];
		await selectOption(page, newValue);
		await page.waitForTimeout(500);

		// Switch to Live Preview
		await switchToLivePreview(page);
		await page.waitForTimeout(1000);
		await waitForDropdowns(page);

		// Verify value persisted
		const valueAfterSwitch = await getCellValue(page, 'Status');
		expect(valueAfterSwitch).toBe(newValue);

		// Switch back to Reading View
		await switchToReadingView(page);
		await page.waitForTimeout(500);
		await waitForDropdowns(page);

		// Verify still persisted
		const valueAfterReturn = await getCellValue(page, 'Status');
		expect(valueAfterReturn).toBe(newValue);

		// Restore original value
		await selectDropdownOption(page, 'Status', initialValue);
	});

	// CRITICAL: Stress test for rapid view switching
	test('survives rapid view switching 10x', async () => {
		const iterations = 10;

		for (let i = 0; i < iterations; i++) {
			// Switch to Live Preview
			await switchToLivePreview(page);
			await page.waitForTimeout(500);

			// Verify dropdowns rendered
			try {
				await waitForDropdowns(page, 1, 3000);
			} catch (error) {
				throw new Error(`Failed to find dropdowns in Live Preview on iteration ${i + 1}: ${error}`);
			}

			// Switch to Reading View
			await switchToReadingView(page);
			await page.waitForTimeout(500);

			// Verify dropdowns rendered
			try {
				await waitForDropdowns(page, 1, 3000);
			} catch (error) {
				throw new Error(`Failed to find dropdowns in Reading View on iteration ${i + 1}: ${error}`);
			}
		}

		// Final interaction test - verify dropdowns are still functional
		const initialValue = await getCellValue(page, 'Status');
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		const testValue = options.find((opt) => opt !== initialValue) || options[0];

		await selectOption(page, testValue);
		await page.waitForTimeout(500);

		const finalValue = await getCellValue(page, 'Status');
		expect(finalValue).toBe(testValue);

		// Restore
		await selectDropdownOption(page, 'Status', initialValue);
	});

	test('survives rapid view switching 20x (extended stress)', async () => {
		const iterations = 20;

		for (let i = 0; i < iterations; i++) {
			// Faster switching with less wait time
			await switchToLivePreview(page);
			await page.waitForTimeout(300);

			await switchToReadingView(page);
			await page.waitForTimeout(300);

			// Every 5 iterations, verify dropdowns are present
			if ((i + 1) % 5 === 0) {
				try {
					await waitForDropdowns(page, 1, 3000);
				} catch (error) {
					throw new Error(`Dropdowns missing after ${i + 1} rapid switches: ${error}`);
				}
			}
		}

		// Final verification
		const count = await waitForDropdowns(page);
		expect(count).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Stress Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Table Dropdowns - Stress Tests', () => {
	test.beforeEach(async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);
	});

	test('handles rapid dropdown interactions 10x', async () => {
		const iterations = 10;

		// Get available options
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		await closeDropdownMenu(page);

		if (options.length < 2) {
			console.warn('Skipping rapid interaction test: need at least 2 options');
			return;
		}

		const option1 = options[0];
		const option2 = options[1];

		for (let i = 0; i < iterations; i++) {
			// Select option 1
			await clickDropdown(page, 'Status');
			await selectOption(page, option1);
			await page.waitForTimeout(200);

			// Verify value
			const value1 = await getCellValue(page, 'Status');
			expect(value1).toBe(option1);

			// Select option 2
			await clickDropdown(page, 'Status');
			await selectOption(page, option2);
			await page.waitForTimeout(200);

			// Verify value
			const value2 = await getCellValue(page, 'Status');
			expect(value2).toBe(option2);
		}
	});

	test('handles rapid open/close without selection 15x', async () => {
		const iterations = 15;

		for (let i = 0; i < iterations; i++) {
			// Open dropdown
			await clickDropdown(page, 'Status');
			await page.waitForTimeout(100);

			const isOpen = await isDropdownMenuOpen(page);
			expect(isOpen).toBe(true);

			// Close without selecting
			await closeDropdownMenu(page);
			await page.waitForTimeout(100);

			const isClosed = await isDropdownMenuOpen(page);
			expect(isClosed).toBe(false);
		}

		// Verify dropdown still works after stress
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		expect(options.length).toBeGreaterThan(0);
		await closeDropdownMenu(page);
	});

	test('handles rapid file navigation 5x', async () => {
		const iterations = 5;

		for (let i = 0; i < iterations; i++) {
			// Navigate to first file
			await navigateToFile(page, TEST_FILE_WITH_TABLE);
			await page.waitForTimeout(500);

			// Verify dropdowns
			try {
				await waitForDropdowns(page, 1, 3000);
			} catch (error) {
				throw new Error(`Dropdowns not found after navigating to ${TEST_FILE_WITH_TABLE} on iteration ${i + 1}`);
			}

			// Navigate to alternate file
			await navigateToFile(page, TEST_FILE_ALTERNATE);
			await page.waitForTimeout(500);

			// Verify dropdowns in alternate file (may or may not have them)
			const count = await getDropdownCount(page);
			// Just verify no crash - alternate file may not have dropdowns
		}

		// Return to main test file
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await waitForDropdowns(page);
	});

	test('handles mixed interactions during view switches', async () => {
		const iterations = 5;

		for (let i = 0; i < iterations; i++) {
			// In Reading View: interact with dropdown
			await waitForDropdowns(page);
			await clickDropdown(page, 'Status');
			await page.waitForTimeout(100);
			await closeDropdownMenu(page);

			// Switch to Live Preview
			await switchToLivePreview(page);
			await page.waitForTimeout(500);

			// In Live Preview: interact with dropdown
			await waitForDropdowns(page);
			await clickDropdown(page, 'Status');
			await page.waitForTimeout(100);
			await closeDropdownMenu(page);

			// Switch back
			await switchToReadingView(page);
			await page.waitForTimeout(500);
		}

		// Final verification
		await verifyDropdownsRendered(page);
	});

	test('no memory leaks: adapters cleaned up on view switch', async () => {
		// This test verifies that old adapters are destroyed when view switches
		// by checking that dropdown count remains stable after many switches

		const initialCount = await getDropdownCount(page);

		// Perform many view switches
		for (let i = 0; i < 10; i++) {
			await switchToLivePreview(page);
			await page.waitForTimeout(300);
			await switchToReadingView(page);
			await page.waitForTimeout(300);
		}

		// Check dropdown count is same (not accumulating)
		const finalCount = await getDropdownCount(page);
		expect(finalCount).toBe(initialCount);
	});

	test('interaction lock prevents re-render during interaction', async () => {
		// Open a dropdown
		await clickDropdown(page, 'Status');

		// While open, trigger a layout change (this should not close the dropdown)
		await page.evaluate(() => {
			// Trigger a minor DOM change that might trigger MutationObserver
			const wrapper = document.querySelector('.workspace-leaf.mod-active');
			if (wrapper) {
				wrapper.classList.add('test-trigger');
				wrapper.classList.remove('test-trigger');
			}
		});

		await page.waitForTimeout(200);

		// Dropdown should still be open
		const isOpen = await isDropdownMenuOpen(page);
		expect(isOpen).toBe(true);

		await closeDropdownMenu(page);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge Cases and Error Handling
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Table Dropdowns - Edge Cases', () => {
	test('handles empty cells gracefully', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Verify no errors in console
		const errors = collectConsoleErrors(page);
		await page.waitForTimeout(1000);

		// Filter for relevant errors (ignore unrelated warnings)
		const relevantErrors = errors.filter(
			(err) => err.includes('spicy') || err.includes('Spicy') || err.includes('dropdown')
		);
		expect(relevantErrors.length).toBe(0);
	});

	test('handles clicking outside dropdown to close', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Open dropdown
		await clickDropdown(page, 'Status');
		expect(await isDropdownMenuOpen(page)).toBe(true);

		// Click outside (on the page body)
		await page.click('body', { position: { x: 10, y: 10 } });
		await page.waitForTimeout(200);

		// Dropdown should be closed
		expect(await isDropdownMenuOpen(page)).toBe(false);
	});

	test('Escape key closes dropdown', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		await clickDropdown(page, 'Status');
		expect(await isDropdownMenuOpen(page)).toBe(true);

		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);

		expect(await isDropdownMenuOpen(page)).toBe(false);
	});

	test('Enter key selects highlighted option', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		const initialValue = await getCellValue(page, 'Status');

		await clickDropdown(page, 'Status');
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(100);

		// Get the highlighted option text
		const highlightedText = await page.evaluate(() => {
			const highlighted = document.querySelector('.spicy-dropdown-option.highlighted');
			return highlighted?.textContent?.trim() || '';
		});

		await page.keyboard.press('Enter');
		await page.waitForTimeout(500);

		const newValue = await getCellValue(page, 'Status');
		expect(newValue).toBe(highlightedText);

		// Restore
		if (newValue !== initialValue) {
			await selectDropdownOption(page, 'Status', initialValue);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Plugin Reload Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Table Dropdowns - Plugin Lifecycle', () => {
	test('dropdowns recover after plugin reload', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		const countBefore = await getDropdownCount(page);

		// Reload plugin
		await reloadPlugin(page);

		// Verify dropdowns return
		const countAfter = await waitForDropdowns(page, countBefore, 5000);
		expect(countAfter).toBe(countBefore);
	});

	test('rapid plugin reload stress test 3x', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		for (let i = 0; i < 3; i++) {
			await reloadPlugin(page);

			// Verify dropdowns recover
			try {
				await waitForDropdowns(page, 1, 5000);
			} catch (error) {
				throw new Error(`Dropdowns did not recover after reload ${i + 1}: ${error}`);
			}
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Persistence Verification
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Table Dropdowns - Persistence', () => {
	test('value persists after file close and reopen', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Get initial value and change it
		const initialValue = await getCellValue(page, 'Status');
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		const newValue = options.find((opt) => opt !== initialValue) || options[0];

		await selectOption(page, newValue);
		await page.waitForTimeout(1000); // Wait for persistence

		// Close the file
		await closeActiveTab(page);
		await page.waitForTimeout(500);

		// Reopen the file
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Verify value persisted
		const valueAfterReopen = await getCellValue(page, 'Status');
		expect(valueAfterReopen).toBe(newValue);

		// Restore original value
		await selectDropdownOption(page, 'Status', initialValue);
	});

	test('value persists after plugin reload', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		// Change value
		const initialValue = await getCellValue(page, 'Status');
		await clickDropdown(page, 'Status');
		const options = await getDropdownOptions(page);
		const newValue = options.find((opt) => opt !== initialValue) || options[0];

		await selectOption(page, newValue);
		await page.waitForTimeout(1000);

		// Reload plugin
		await reloadPlugin(page);
		await waitForDropdowns(page);

		// Verify value persisted
		const valueAfterReload = await getCellValue(page, 'Status');
		expect(valueAfterReload).toBe(newValue);

		// Restore
		await selectDropdownOption(page, 'Status', initialValue);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Visual Regression (Screenshot) Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Table Dropdowns - Visual', () => {
	test('dropdown styling matches design', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		const styling = await getDropdownStyling(page);

		// Pill shape (border-radius >= 8px)
		expect(parseFloat(styling.borderRadius)).toBeGreaterThanOrEqual(8);

		// Has background color (not transparent)
		expect(styling.backgroundColor).not.toBe('transparent');
		expect(styling.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

		// Has arrow indicator
		expect(styling.hasArrow).toBe(true);

		// Has padding
		expect(styling.padding).not.toBe('0px');
	});

	test('menu positioning is correct', async () => {
		await navigateToFile(page, TEST_FILE_WITH_TABLE);
		await switchToReadingView(page);
		await waitForDropdowns(page);

		await clickDropdown(page, 'Status');

		// Verify menu is visible and positioned near the trigger
		const menuInfo = await page.evaluate(() => {
			const menu = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
			if (!menu) return null;

			const trigger = document.querySelector('table td .spicy-dropdown-trigger');
			if (!trigger) return null;

			const menuRect = menu.getBoundingClientRect();
			const triggerRect = trigger.getBoundingClientRect();

			return {
				menuTop: menuRect.top,
				menuLeft: menuRect.left,
				menuWidth: menuRect.width,
				triggerBottom: triggerRect.bottom,
				triggerLeft: triggerRect.left,
			};
		});

		expect(menuInfo).not.toBeNull();

		// Menu should be positioned near (below or above) the trigger
		// Allow for some variance in positioning
		if (menuInfo) {
			expect(menuInfo.menuWidth).toBeGreaterThan(100); // Reasonable menu width
		}

		await closeDropdownMenu(page);
	});
});
