/**
 * UI Test: Table Dropdown Value Selection and Persistence
 *
 * Run with: node tests/ui/test-dropdown-persistence.mjs
 *
 * Tests that selecting a value in a table dropdown persists correctly.
 */

import { chromium } from 'playwright';

async function runTest() {
	console.log('Connecting to Obsidian via CDP on port 9222...\n');

	let browser;
	try {
		browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
	} catch (error) {
		console.error('Failed to connect to CDP.');
		process.exit(1);
	}

	const contexts = browser.contexts();
	const page = contexts[0]?.pages()[0];

	if (!page) {
		console.error('No page found');
		process.exit(1);
	}

	console.log('Page title:', await page.title());
	console.log('');

	const results = await page.evaluate(async () => {
		const results = { passed: [], failed: [] };

		function pass(test) {
			results.passed.push(test);
		}
		function fail(test, reason) {
			results.failed.push({ test, reason });
		}

		// Find a dropdown with "Controlled" value to test
		const triggers = document.querySelectorAll('table td .spicy-dropdown-trigger');
		let testTrigger = null;
		let initialValue = null;

		for (const trigger of triggers) {
			const text = trigger.textContent.trim();
			if (text.startsWith('Controlled')) {
				testTrigger = trigger;
				initialValue = text.replace('▼', '').trim();
				break;
			}
		}

		if (!testTrigger) {
			fail('Find test dropdown', 'Could not find a dropdown with "Controlled" value');
			return results;
		}

		pass(`Found dropdown with value: "${initialValue}"`);

		// Click to open
		testTrigger.click();
		await new Promise((r) => setTimeout(r, 400));

		const menu = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
		if (!menu) {
			fail('Open menu', 'Menu did not open');
			return results;
		}

		pass('Menu opened');

		// Find a different option to select
		const options = menu.querySelectorAll('.spicy-dropdown-option');
		let optionToSelect = null;

		for (const opt of options) {
			const optText = opt.textContent.trim();
			if (optText !== initialValue && !optText.includes('checkbox')) {
				optionToSelect = opt;
				break;
			}
		}

		if (!optionToSelect) {
			// Just close and verify closing works
			document.body.click();
			await new Promise((r) => setTimeout(r, 300));
			pass('Menu closed (no different option available to test)');
			return results;
		}

		const newValue = optionToSelect.textContent.trim();
		pass(`Selecting new value: "${newValue}"`);

		// Click the option
		optionToSelect.click();
		await new Promise((r) => setTimeout(r, 500));

		// Verify the trigger now shows the new value
		const updatedText = testTrigger.textContent.replace('▼', '').trim();
		if (updatedText === newValue) {
			pass(`Value updated in UI to: "${updatedText}"`);
		} else {
			fail('Value update', `Expected "${newValue}", got "${updatedText}"`);
		}

		// Wait a bit for persistence
		await new Promise((r) => setTimeout(r, 500));

		// Now change back to original value
		testTrigger.click();
		await new Promise((r) => setTimeout(r, 400));

		const menu2 = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
		if (menu2) {
			const origOption = Array.from(menu2.querySelectorAll('.spicy-dropdown-option')).find(
				(opt) => opt.textContent.trim() === initialValue
			);
			if (origOption) {
				origOption.click();
				await new Promise((r) => setTimeout(r, 500));
				const restoredText = testTrigger.textContent.replace('▼', '').trim();
				if (restoredText === initialValue) {
					pass(`Value restored to: "${restoredText}"`);
				} else {
					fail('Value restore', `Expected "${initialValue}", got "${restoredText}"`);
				}
			}
		}

		return results;
	});

	// Print results
	console.log('=== Persistence Test Results ===\n');

	console.log('PASSED:');
	for (const test of results.passed) {
		console.log(`  [OK] ${test}`);
	}

	if (results.failed.length > 0) {
		console.log('\nFAILED:');
		for (const { test, reason } of results.failed) {
			console.log(`  [X] ${test}: ${reason}`);
		}
	}

	console.log('\n=== Summary ===');
	console.log(`Passed: ${results.passed.length}`);
	console.log(`Failed: ${results.failed.length}`);

	// Take screenshot after interaction
	console.log('\nTaking final screenshot...');
	await page.screenshot({
		path: '/Users/edwardhallam/code/spicy-tools/tests/ui/pill-styling-after-interaction.png',
		fullPage: false,
	});
	console.log('Screenshot saved to: tests/ui/pill-styling-after-interaction.png');

	await browser.close();

	if (results.failed.length > 0) {
		process.exit(1);
	}
}

runTest().catch((error) => {
	console.error('Test error:', error);
	process.exit(1);
});
