#!/usr/bin/env node
/**
 * Table Dropdowns UI Test Runner
 *
 * Standalone script to run the Playwright UI tests against Obsidian.
 * Verifies SSH tunnel and CDP connection before running tests.
 *
 * Usage:
 *   node tests/ui/run-tests.mjs           # Run all tests
 *   node tests/ui/run-tests.mjs --headed  # Run with headed browser (for debugging)
 *   node tests/ui/run-tests.mjs --grep "stress"  # Run only stress tests
 */

import { execSync, spawn } from 'child_process';

const CDP_ENDPOINT = 'http://127.0.0.1:9222';

/**
 * Check if SSH tunnel to Mac Mini is active.
 */
function checkTunnel() {
	try {
		const result = execSync(
			'pgrep -f "ssh -fNL 9222:localhost:9222 macmini"',
			{ encoding: 'utf-8' }
		);
		return result.trim().length > 0;
	} catch {
		return false;
	}
}

/**
 * Start SSH tunnel if not running.
 */
function startTunnel() {
	console.log('Starting SSH tunnel to Mac Mini...');
	try {
		execSync('ssh -fNL 9222:localhost:9222 macmini', { stdio: 'inherit' });
		// Wait for tunnel to establish
		execSync('sleep 2');
		return true;
	} catch (error) {
		console.error('Failed to start SSH tunnel:', error.message);
		return false;
	}
}

/**
 * Check if Obsidian CDP is responding.
 */
async function checkCDP() {
	try {
		const response = await fetch(`${CDP_ENDPOINT}/json/list`);
		const targets = await response.json();
		return targets.length > 0;
	} catch {
		return false;
	}
}

/**
 * Main entry point.
 */
async function main() {
	console.log('=== Table Dropdowns UI Test Runner ===\n');

	// Check SSH tunnel
	console.log('Checking SSH tunnel...');
	if (!checkTunnel()) {
		console.log('SSH tunnel not active.');
		if (!startTunnel()) {
			console.error('\nFailed to establish SSH tunnel.');
			console.error('Please run: ssh -fNL 9222:localhost:9222 macmini');
			process.exit(1);
		}
		console.log('SSH tunnel started.');
	} else {
		console.log('SSH tunnel is active.');
	}

	// Check CDP connection
	console.log('\nChecking CDP connection...');
	const cdpOk = await checkCDP();
	if (!cdpOk) {
		console.error('CDP is not responding.');
		console.error('Please ensure Obsidian is running on Mac Mini with:');
		console.error('  ssh macmini \'open "obsidian://open?vault=nexus"\'');
		process.exit(1);
	}
	console.log('CDP connection verified.\n');

	// Build Playwright command
	const args = process.argv.slice(2);
	const playwrightArgs = [
		'npx',
		'playwright',
		'test',
		'--config',
		'tests/ui/playwright.config.ts',
		...args,
	];

	console.log('Running:', playwrightArgs.join(' '));
	console.log('');

	// Run Playwright tests
	const playwright = spawn(playwrightArgs[0], playwrightArgs.slice(1), {
		stdio: 'inherit',
		cwd: process.cwd(),
	});

	playwright.on('close', (code) => {
		process.exit(code);
	});
}

main().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
