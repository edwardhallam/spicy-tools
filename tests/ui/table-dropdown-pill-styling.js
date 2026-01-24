/**
 * UI Test Script: Table Dropdown Pill Styling
 *
 * Run this script in Obsidian's DevTools Console (Ctrl+Shift+I)
 * after opening the test file: Health/GERD-Event-2026-01.md
 *
 * Expected: Dropdowns in the "Potential Triggers" table Status column
 * should appear as rounded purple pills similar to Obsidian's tags.
 *
 * This script can also be executed via CDP/Playwright browser_evaluate.
 */

(async function testTableDropdownPillStyling() {
	console.log('=== Table Dropdown Pill Styling Test ===\n');

	const results = {
		passed: [],
		failed: [],
		warnings: [],
	};

	// Helper to add result
	function pass(test) {
		results.passed.push(test);
		console.log('PASS:', test);
	}

	function fail(test, reason) {
		results.failed.push({ test, reason });
		console.log('FAIL:', test, '-', reason);
	}

	function warn(test, reason) {
		results.warnings.push({ test, reason });
		console.log('WARN:', test, '-', reason);
	}

	// Step 1: Reload plugin
	console.log('\n--- Step 1: Reloading plugin ---');
	try {
		const app = window.app;
		await app.plugins.disablePlugin('spicy-tools');
		await new Promise((r) => setTimeout(r, 500));
		await app.plugins.enablePlugin('spicy-tools');
		await new Promise((r) => setTimeout(r, 1000)); // Wait for dropdowns to render
		pass('Plugin reloaded successfully');
	} catch (error) {
		fail('Plugin reload', error.message);
		return results;
	}

	// Step 2: Verify dropdowns exist
	console.log('\n--- Step 2: Checking for table dropdowns ---');
	const dropdowns = document.querySelectorAll('table td .spicy-dropdown');
	if (dropdowns.length > 0) {
		pass(`Found ${dropdowns.length} table dropdown(s)`);
	} else {
		fail('Find table dropdowns', 'No dropdowns found in table cells');
		warn('Verify file is open', 'Make sure Health/GERD-Event-2026-01.md is open in Reading View');
		return results;
	}

	// Step 3: Check pill styling
	console.log('\n--- Step 3: Verifying pill styling ---');
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
	if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
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
	console.log('\n--- Step 4: Checking cell padding ---');
	const cell = trigger.closest('td');
	if (cell) {
		const cellStyles = window.getComputedStyle(cell);
		const cellPadding = cellStyles.padding;
		if (cellPadding && cellPadding !== '0px') {
			pass(`Cell padding for spacing: ${cellPadding}`);
		} else {
			warn('Cell padding', `No explicit cell padding found: ${cellPadding}`);
		}

		// Check if cell has our marker class
		if (cell.classList.contains('spicy-dropdown-cell')) {
			pass('Cell has spicy-dropdown-cell class');
		} else {
			warn('Cell class', 'Cell missing spicy-dropdown-cell class');
		}
	}

	// Step 5: Test interaction
	console.log('\n--- Step 5: Testing dropdown interaction ---');
	try {
		trigger.click();
		await new Promise((r) => setTimeout(r, 300));

		const menu = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
		if (menu) {
			pass('Dropdown menu opens on click');

			// Check for options
			const options = menu.querySelectorAll('.spicy-dropdown-option');
			if (options.length > 0) {
				pass(`Menu has ${options.length} option(s)`);
			} else {
				fail('Menu options', 'No options found in menu');
			}

			// Close by pressing Escape
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			await new Promise((r) => setTimeout(r, 300));

			const menuAfterEsc = document.querySelector('.spicy-dropdown-menu:not(.hidden)');
			if (!menuAfterEsc) {
				pass('Dropdown closes on Escape');
			} else {
				warn('Close on Escape', 'Menu may still be open');
			}
		} else {
			fail('Dropdown menu open', 'Menu did not appear after click');
		}
	} catch (error) {
		fail('Interaction test', error.message);
	}

	// Step 6: Check dropdown arrow
	console.log('\n--- Step 6: Checking dropdown arrow ---');
	const arrow = trigger.querySelector('.spicy-dropdown-arrow');
	if (arrow) {
		const arrowStyles = window.getComputedStyle(arrow);
		pass(`Dropdown arrow visible: "${arrow.textContent}"`);
		if (arrowStyles.color) {
			pass(`Arrow color: ${arrowStyles.color}`);
		}
	} else {
		warn('Dropdown arrow', 'Arrow element not found');
	}

	// Summary
	console.log('\n=== Test Summary ===');
	console.log(`Passed: ${results.passed.length}`);
	console.log(`Failed: ${results.failed.length}`);
	console.log(`Warnings: ${results.warnings.length}`);

	if (results.failed.length === 0) {
		console.log('\nAll critical tests PASSED!');
	} else {
		console.log('\nSome tests FAILED - review results above.');
	}

	return results;
})();
