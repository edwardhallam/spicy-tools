/**
 * UI Test: Table Dropdown Pill Styling
 *
 * Run with: node tests/ui/run-pill-test.mjs
 *
 * Requires: Obsidian running with --remote-debugging-port=9222
 */

import { chromium } from 'playwright';

async function runTest() {
	console.log('Connecting to Obsidian via CDP on port 9222...\n');

	let browser;
	try {
		browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
	} catch (error) {
		console.error('Failed to connect to CDP. Make sure Obsidian is running with:');
		console.error('/Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222');
		process.exit(1);
	}

	const contexts = browser.contexts();
	const page = contexts[0]?.pages()[0];

	if (!page) {
		console.error('No page found in browser context');
		process.exit(1);
	}

	console.log('Page title:', await page.title());
	console.log('');

	// Run test script
	const results = await page.evaluate(async () => {
		const results = { passed: [], failed: [], warnings: [] };

		function pass(test) {
			results.passed.push(test);
		}
		function fail(test, reason) {
			results.failed.push({ test, reason });
		}
		function warn(test, reason) {
			results.warnings.push({ test, reason });
		}

		// Step 1: Reload plugin
		console.log('Reloading plugin...');
		try {
			const app = window.app;
			await app.plugins.disablePlugin('spicy-tools');
			await new Promise((r) => setTimeout(r, 500));
			await app.plugins.enablePlugin('spicy-tools');
			await new Promise((r) => setTimeout(r, 1500)); // Wait for dropdowns to render
			pass('Plugin reloaded successfully');
		} catch (error) {
			fail('Plugin reload', error.message);
			return results;
		}

		// Step 2: Check for dropdowns
		const dropdowns = document.querySelectorAll('table td .spicy-dropdown');
		if (dropdowns.length > 0) {
			pass(`Found ${dropdowns.length} table dropdown(s)`);
		} else {
			fail('Find table dropdowns', 'No dropdowns found in table cells');
			warn(
				'File check',
				'Make sure Health/GERD-Event-2026-01.md is open in Reading View'
			);
			return results;
		}

		// Step 3: Check pill styling
		const trigger = document.querySelector('table td .spicy-dropdown-trigger');

		if (!trigger) {
			fail('Find dropdown trigger', 'No trigger element found');
			return results;
		}

		const styles = window.getComputedStyle(trigger);

		// Check border-radius (should be large for pill shape)
		const borderRadius = styles.borderRadius;
		const radiusValue = parseFloat(borderRadius);
		if (radiusValue >= 8) {
			pass(`Border radius is pill-shaped: ${borderRadius}`);
		} else {
			fail('Border radius check', `Expected >= 8px, got ${borderRadius}`);
		}

		// Check background color (should be tag-like purple/blue)
		const bgColor = styles.backgroundColor;
		if (
			bgColor &&
			bgColor !== 'transparent' &&
			bgColor !== 'rgba(0, 0, 0, 0)'
		) {
			pass(`Background color set: ${bgColor}`);
		} else {
			fail('Background color check', `Expected tag color, got ${bgColor}`);
		}

		// Check padding
		const padding = styles.padding;
		if (padding && padding !== '0px') {
			pass(`Padding present: ${padding}`);
		} else {
			fail('Padding check', `Expected padding, got ${padding}`);
		}

		// Step 4: Check cell padding (margin from edges)
		const cell = trigger.closest('td');
		if (cell) {
			const cellStyles = window.getComputedStyle(cell);
			const cellPadding = cellStyles.padding;
			if (cellPadding && cellPadding !== '0px') {
				pass(`Cell padding for spacing: ${cellPadding}`);
			} else {
				warn('Cell padding', `No explicit cell padding: ${cellPadding}`);
			}

			// Check if cell has our marker class
			if (cell.classList.contains('spicy-dropdown-cell')) {
				pass('Cell has spicy-dropdown-cell class');
			} else {
				warn('Cell class', 'Cell missing spicy-dropdown-cell class');
			}
		}

		// Step 5: Check dropdown arrow
		const arrow = trigger.querySelector('.spicy-dropdown-arrow');
		if (arrow) {
			pass(`Dropdown arrow visible: "${arrow.textContent}"`);
		} else {
			warn('Dropdown arrow', 'Arrow element not found');
		}

		// Step 6: Test interaction
		try {
			trigger.click();
			await new Promise((r) => setTimeout(r, 300));

			const menu = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
			if (menu) {
				pass('Dropdown menu opens on click');

				const options = menu.querySelectorAll('.spicy-dropdown-option');
				if (options.length > 0) {
					pass(`Menu has ${options.length} option(s)`);
				} else {
					fail('Menu options', 'No options found in menu');
				}

				// Close by clicking elsewhere
				document.body.click();
				await new Promise((r) => setTimeout(r, 300));
			} else {
				fail('Dropdown menu open', 'Menu did not appear after click');
			}
		} catch (error) {
			fail('Interaction test', error.message);
		}

		return results;
	});

	// Print results
	console.log('=== Test Results ===\n');

	console.log('PASSED:');
	for (const test of results.passed) {
		console.log(`  [OK] ${test}`);
	}

	if (results.warnings.length > 0) {
		console.log('\nWARNINGS:');
		for (const { test, reason } of results.warnings) {
			console.log(`  [!] ${test}: ${reason}`);
		}
	}

	if (results.failed.length > 0) {
		console.log('\nFAILED:');
		for (const { test, reason } of results.failed) {
			console.log(`  [X] ${test}: ${reason}`);
		}
	}

	console.log('\n=== Summary ===');
	console.log(`Passed: ${results.passed.length}`);
	console.log(`Warnings: ${results.warnings.length}`);
	console.log(`Failed: ${results.failed.length}`);

	// Take screenshot
	console.log('\nTaking screenshot...');
	await page.screenshot({
		path: '/Users/edwardhallam/code/spicy-tools/tests/ui/pill-styling-screenshot.png',
		fullPage: false,
	});
	console.log(
		'Screenshot saved to: tests/ui/pill-styling-screenshot.png'
	);

	await browser.close();

	// Exit with error if any tests failed
	if (results.failed.length > 0) {
		process.exit(1);
	}
}

runTest().catch((error) => {
	console.error('Test error:', error);
	process.exit(1);
});
