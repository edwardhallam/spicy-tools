/**
 * Obsidian CDP Helper Functions
 *
 * Utility functions for interacting with Obsidian via Chrome DevTools Protocol.
 * These helpers abstract common operations for table dropdown UI testing.
 *
 * IMPORTANT: All functions assume an active CDP connection to Obsidian
 * running on Mac Mini via SSH tunnel at localhost:9222.
 */

import { Page, Browser, chromium } from 'playwright';

// ═══════════════════════════════════════════════════════════════════════════
// CDP Connection
// ═══════════════════════════════════════════════════════════════════════════

const CDP_ENDPOINT = 'http://127.0.0.1:9222';

/**
 * Connect to Obsidian via CDP and return the browser and first page.
 * Throws if connection fails or no page is found.
 */
export async function connectToObsidian(): Promise<{ browser: Browser; page: Page }> {
	const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
	const contexts = browser.contexts();

	if (contexts.length === 0) {
		throw new Error('No browser contexts found. Is Obsidian running with CDP enabled?');
	}

	const pages = contexts[0].pages();
	if (pages.length === 0) {
		throw new Error('No pages found in browser context. Is a vault open?');
	}

	return { browser, page: pages[0] };
}

/**
 * Disconnect from the CDP browser instance.
 */
export async function disconnectFromObsidian(browser: Browser): Promise<void> {
	await browser.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// Plugin Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reload the spicy-tools plugin.
 * Waits for dropdowns to render after reload.
 */
export async function reloadPlugin(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const app = (window as any).app;
		await app.plugins.disablePlugin('spicy-tools');
		await new Promise((r) => setTimeout(r, 500));
		await app.plugins.enablePlugin('spicy-tools');
		await new Promise((r) => setTimeout(r, 1500));
	});
}

/**
 * Check if the spicy-tools plugin is enabled.
 */
export async function isPluginEnabled(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const app = (window as any).app;
		return app.plugins.enabledPlugins.has('spicy-tools');
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// View Mode Switching
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Switch the active pane to Reading View.
 * Uses Obsidian's command palette.
 */
export async function switchToReadingView(page: Page): Promise<void> {
	// Use keyboard shortcut for reliability
	await page.keyboard.press('Meta+e');
	await page.waitForTimeout(300);

	// Verify we're in Reading View by checking for .markdown-reading-view
	const isReadingView = await page.evaluate(() => {
		const readingView = document.querySelector('.workspace-leaf.mod-active .markdown-reading-view');
		const sourceView = document.querySelector('.workspace-leaf.mod-active .markdown-source-view');

		// In Reading View, reading-view is visible and source-view is hidden
		if (!readingView) return false;
		const readingStyle = getComputedStyle(readingView);
		return readingStyle.display !== 'none';
	});

	// If not in reading view, try again with explicit command
	if (!isReadingView) {
		await executeCommand(page, 'markdown:toggle-preview');
		await page.waitForTimeout(500);
	}
}

/**
 * Switch the active pane to Live Preview (editing mode).
 * Uses Obsidian's command palette.
 */
export async function switchToLivePreview(page: Page): Promise<void> {
	// Use keyboard shortcut for reliability
	await page.keyboard.press('Meta+e');
	await page.waitForTimeout(300);

	// Verify we're in Live Preview by checking for visible .markdown-source-view
	const isLivePreview = await page.evaluate(() => {
		const sourceView = document.querySelector('.workspace-leaf.mod-active .markdown-source-view');
		if (!sourceView) return false;
		const sourceStyle = getComputedStyle(sourceView);
		return sourceStyle.display !== 'none';
	});

	// If not in live preview, try again with explicit command
	if (!isLivePreview) {
		await executeCommand(page, 'markdown:toggle-preview');
		await page.waitForTimeout(500);
	}
}

/**
 * Get the current view mode of the active pane.
 */
export async function getCurrentViewMode(page: Page): Promise<'reading' | 'live-preview' | 'source' | 'unknown'> {
	return page.evaluate(() => {
		const activeLeaf = document.querySelector('.workspace-leaf.mod-active');
		if (!activeLeaf) return 'unknown';

		const sourceView = activeLeaf.querySelector('.markdown-source-view') as HTMLElement | null;
		const readingView = activeLeaf.querySelector('.markdown-reading-view') as HTMLElement | null;

		if (readingView && getComputedStyle(readingView).display !== 'none') {
			return 'reading';
		}

		if (sourceView && getComputedStyle(sourceView).display !== 'none') {
			// Check if it's source mode vs live preview
			if (sourceView.classList.contains('is-live-preview')) {
				return 'live-preview';
			}
			return 'source';
		}

		return 'unknown';
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Command Palette
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute an Obsidian command by ID.
 */
export async function executeCommand(page: Page, commandId: string): Promise<void> {
	await page.evaluate((cmdId) => {
		const app = (window as any).app;
		app.commands.executeCommandById(cmdId);
	}, commandId);
	await page.waitForTimeout(100);
}

/**
 * Open the command palette, type a query, and press Enter.
 */
export async function runCommandPaletteAction(page: Page, query: string): Promise<void> {
	// Open command palette
	await page.keyboard.press('Meta+p');
	await page.waitForTimeout(200);

	// Type the query
	await page.keyboard.type(query, { delay: 50 });
	await page.waitForTimeout(200);

	// Press Enter to execute
	await page.keyboard.press('Enter');
	await page.waitForTimeout(300);
}

// ═══════════════════════════════════════════════════════════════════════════
// File Navigation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Navigate to a file using Quick Switcher.
 * @param filename - Partial or full filename to navigate to
 */
export async function navigateToFile(page: Page, filename: string): Promise<void> {
	// Open Quick Switcher
	await page.keyboard.press('Meta+o');
	await page.waitForTimeout(300);

	// Type filename
	await page.keyboard.type(filename, { delay: 30 });
	await page.waitForTimeout(300);

	// Press Enter to open first match
	await page.keyboard.press('Enter');
	await page.waitForTimeout(500);

	// Wait for file to render
	await page.waitForSelector('.workspace-leaf.mod-active .view-content', { timeout: 5000 });
}

/**
 * Get the path of the currently active file.
 */
export async function getActiveFilePath(page: Page): Promise<string | null> {
	return page.evaluate(() => {
		const app = (window as any).app;
		const file = app.workspace.getActiveFile();
		return file?.path ?? null;
	});
}

/**
 * Close the active tab.
 */
export async function closeActiveTab(page: Page): Promise<void> {
	await page.keyboard.press('Meta+w');
	await page.waitForTimeout(200);
}

/**
 * Close all open tabs.
 */
export async function closeAllTabs(page: Page): Promise<void> {
	await runCommandPaletteAction(page, 'Close all tabs');
	await page.waitForTimeout(300);
}

// ═══════════════════════════════════════════════════════════════════════════
// Dropdown Verification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if table dropdowns are rendered in the current view.
 * Returns the count of dropdowns found.
 */
export async function getDropdownCount(page: Page): Promise<number> {
	return page.evaluate(() => {
		const dropdowns = document.querySelectorAll('table td .spicy-dropdown');
		return dropdowns.length;
	});
}

/**
 * Verify that dropdowns are rendered in the current view.
 * Throws if no dropdowns are found.
 */
export async function verifyDropdownsRendered(page: Page): Promise<void> {
	const count = await getDropdownCount(page);
	if (count === 0) {
		throw new Error('No table dropdowns found in the current view');
	}
}

/**
 * Wait for dropdowns to appear in the DOM.
 * @param minCount - Minimum number of dropdowns expected
 * @param timeout - Maximum time to wait in ms
 */
export async function waitForDropdowns(page: Page, minCount = 1, timeout = 5000): Promise<number> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const count = await getDropdownCount(page);
		if (count >= minCount) {
			return count;
		}
		await page.waitForTimeout(100);
	}

	throw new Error(`Timeout waiting for ${minCount} dropdown(s). Found: ${await getDropdownCount(page)}`);
}

/**
 * Get all dropdown triggers with their current values.
 */
export async function getDropdownValues(page: Page): Promise<Array<{ column: string; value: string }>> {
	return page.evaluate(() => {
		const results: Array<{ column: string; value: string }> = [];
		const tables = document.querySelectorAll('table');

		tables.forEach((table) => {
			// Get headers
			const headers: string[] = [];
			const headerCells = table.querySelectorAll('thead th, tr:first-child th');
			headerCells.forEach((cell) => headers.push(cell.textContent?.trim() || ''));

			// Get dropdown values from data rows
			const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
			rows.forEach((row) => {
				const cells = row.querySelectorAll('td');
				cells.forEach((cell, index) => {
					const dropdown = cell.querySelector('.spicy-dropdown');
					if (dropdown) {
						const trigger = dropdown.querySelector('.spicy-dropdown-trigger');
						const value = trigger?.querySelector('.spicy-dropdown-value')?.textContent?.trim() || '';
						results.push({
							column: headers[index] || `Column ${index}`,
							value,
						});
					}
				});
			});
		});

		return results;
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Dropdown Interaction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Click on a dropdown trigger by column name.
 * Opens the dropdown menu.
 * @param columnName - The column header text
 * @param rowIndex - Which row (0-indexed, defaults to first data row)
 */
export async function clickDropdown(page: Page, columnName: string, rowIndex = 0): Promise<void> {
	await page.evaluate(
		({ columnName, rowIndex }) => {
			const tables = document.querySelectorAll('table');

			for (const table of tables) {
				// Get headers
				const headers: string[] = [];
				const headerCells = table.querySelectorAll('thead th, tr:first-child th');
				headerCells.forEach((cell) => headers.push(cell.textContent?.trim() || ''));

				const colIndex = headers.indexOf(columnName);
				if (colIndex === -1) continue;

				// Find the row
				const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
				const targetRow = rows[rowIndex];
				if (!targetRow) continue;

				const cells = targetRow.querySelectorAll('td');
				const targetCell = cells[colIndex];
				if (!targetCell) continue;

				const trigger = targetCell.querySelector('.spicy-dropdown-trigger') as HTMLElement;
				if (trigger) {
					trigger.click();
					return;
				}
			}

			throw new Error(`Could not find dropdown for column "${columnName}" at row ${rowIndex}`);
		},
		{ columnName, rowIndex }
	);

	// Wait for menu to appear
	await page.waitForTimeout(300);
}

/**
 * Select an option from an open dropdown menu.
 * @param optionText - The option text to select
 */
export async function selectOption(page: Page, optionText: string): Promise<void> {
	await page.evaluate((text) => {
		const menu = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
		if (!menu) {
			throw new Error('No dropdown menu is open');
		}

		const options = menu.querySelectorAll('.spicy-dropdown-option');
		for (const option of options) {
			if (option.textContent?.trim() === text) {
				(option as HTMLElement).click();
				return;
			}
		}

		throw new Error(`Option "${text}" not found in dropdown menu`);
	}, optionText);

	// Wait for selection to register and menu to close
	await page.waitForTimeout(300);
}

/**
 * Combined helper: click dropdown and select an option.
 */
export async function selectDropdownOption(
	page: Page,
	columnName: string,
	optionText: string,
	rowIndex = 0
): Promise<void> {
	await clickDropdown(page, columnName, rowIndex);
	await selectOption(page, optionText);
}

/**
 * Close any open dropdown menu.
 */
export async function closeDropdownMenu(page: Page): Promise<void> {
	// Click elsewhere to close
	await page.evaluate(() => {
		document.body.click();
	});
	await page.waitForTimeout(200);
}

/**
 * Check if a dropdown menu is currently open.
 */
export async function isDropdownMenuOpen(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const menu = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
		return menu !== null;
	});
}

/**
 * Get the options available in an open dropdown menu.
 */
export async function getDropdownOptions(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const menu = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
		if (!menu) return [];

		const options: string[] = [];
		menu.querySelectorAll('.spicy-dropdown-option').forEach((opt) => {
			const text = opt.textContent?.trim();
			if (text) options.push(text);
		});
		return options;
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Cell Value Verification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the current displayed value in a dropdown by column name.
 */
export async function getCellValue(page: Page, columnName: string, rowIndex = 0): Promise<string> {
	return page.evaluate(
		({ columnName, rowIndex }) => {
			const tables = document.querySelectorAll('table');

			for (const table of tables) {
				// Get headers
				const headers: string[] = [];
				const headerCells = table.querySelectorAll('thead th, tr:first-child th');
				headerCells.forEach((cell) => headers.push(cell.textContent?.trim() || ''));

				const colIndex = headers.indexOf(columnName);
				if (colIndex === -1) continue;

				// Find the row
				const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
				const targetRow = rows[rowIndex];
				if (!targetRow) continue;

				const cells = targetRow.querySelectorAll('td');
				const targetCell = cells[colIndex];
				if (!targetCell) continue;

				// Check for dropdown value
				const valueEl = targetCell.querySelector('.spicy-dropdown-value');
				if (valueEl) {
					return valueEl.textContent?.trim() || '';
				}

				// Fallback to cell text
				return targetCell.textContent?.trim() || '';
			}

			throw new Error(`Could not find cell for column "${columnName}" at row ${rowIndex}`);
		},
		{ columnName, rowIndex }
	);
}

/**
 * Assert that a cell has a specific value.
 * Throws if the value doesn't match.
 */
export async function expectCellValue(
	page: Page,
	columnName: string,
	expectedValue: string,
	rowIndex = 0
): Promise<void> {
	const actualValue = await getCellValue(page, columnName, rowIndex);
	if (actualValue !== expectedValue) {
		throw new Error(
			`Cell value mismatch for "${columnName}". Expected "${expectedValue}", got "${actualValue}"`
		);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Styling Verification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify that dropdown triggers have pill styling.
 * Returns details about the styling for assertions.
 */
export async function getDropdownStyling(page: Page): Promise<{
	borderRadius: string;
	backgroundColor: string;
	padding: string;
	hasArrow: boolean;
}> {
	return page.evaluate(() => {
		const trigger = document.querySelector('table td .spicy-dropdown-trigger') as HTMLElement;
		if (!trigger) {
			throw new Error('No dropdown trigger found');
		}

		const styles = getComputedStyle(trigger);
		const arrow = trigger.querySelector('.spicy-dropdown-arrow');

		return {
			borderRadius: styles.borderRadius,
			backgroundColor: styles.backgroundColor,
			padding: styles.padding,
			hasArrow: arrow !== null,
		};
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Screenshot Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Take a screenshot with a descriptive name.
 * @param name - Base name for the screenshot
 * @param suffix - Optional suffix (e.g., 'before', 'after')
 */
export async function takeScreenshot(
	page: Page,
	name: string,
	suffix?: string
): Promise<string> {
	const filename = suffix ? `${name}-${suffix}.png` : `${name}.png`;
	const path = `/Users/edwardhallam/code/spicy-tools/tests/ui/screenshots/${filename}`;

	await page.screenshot({ path, fullPage: false });
	return path;
}

/**
 * Take a screenshot of a specific element.
 */
export async function takeElementScreenshot(
	page: Page,
	selector: string,
	name: string
): Promise<string> {
	const element = await page.$(selector);
	if (!element) {
		throw new Error(`Element not found: ${selector}`);
	}

	const path = `/Users/edwardhallam/code/spicy-tools/tests/ui/screenshots/${name}.png`;
	await element.screenshot({ path });
	return path;
}

// ═══════════════════════════════════════════════════════════════════════════
// Console Error Monitoring
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Collect console errors during test execution.
 * Call this at the start of a test, then check the returned array at the end.
 */
export function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = [];

	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			errors.push(msg.text());
		}
	});

	page.on('pageerror', (error) => {
		errors.push(error.message);
	});

	return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test State Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reset to a clean state before tests.
 * Closes modals, resets view mode, etc.
 */
export async function resetTestState(page: Page): Promise<void> {
	// Press Escape to close any open modals/menus
	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);

	// Close any open dropdown menus
	await closeDropdownMenu(page);
}

/**
 * Set up the test environment.
 * Navigates to a test file and ensures dropdowns are rendered.
 */
export async function setupTestFile(page: Page, filename: string): Promise<void> {
	await navigateToFile(page, filename);
	await waitForDropdowns(page);
	await resetTestState(page);
}
