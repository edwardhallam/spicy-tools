/**
 * Playwright configuration for Obsidian CDP UI testing.
 *
 * Connects to Obsidian running on Mac Mini via SSH tunnel at localhost:9222.
 * See CLAUDE.md for tunnel setup instructions.
 *
 * Run tests with: npx playwright test --config tests/ui/playwright.config.ts
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: '.',
	testMatch: '**/*.test.ts',

	// Each test gets generous time for CDP interactions
	timeout: 60_000,

	// Expect assertions timeout
	expect: {
		timeout: 10_000,
	},

	// Fail the build if test.only is left in source
	forbidOnly: !!process.env.CI,

	// Retry failed tests once (flaky CDP connections)
	retries: process.env.CI ? 2 : 1,

	// Run tests serially - we're using a single Obsidian instance
	workers: 1,

	// Reporter configuration
	reporter: [
		['list'],
		['html', { outputFolder: 'playwright-report', open: 'never' }],
	],

	// Shared settings for all tests
	use: {
		// CDP connection to Obsidian via SSH tunnel
		// The SSH tunnel forwards localhost:9222 to Mac Mini's localhost:9222
		// where Obsidian is running with --remote-debugging-port=9222
		connectOptions: {
			wsEndpoint: '', // Will be set dynamically via CDP
		},

		// Collect trace on failure for debugging
		trace: 'on-first-retry',

		// Take screenshot on failure
		screenshot: 'only-on-failure',

		// Slow down actions for visual debugging (optional)
		// slowMo: 100,
	},

	// Projects for different test scenarios
	projects: [
		{
			name: 'obsidian-cdp',
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],

	// Output directory for test artifacts
	outputDir: 'test-results',
});
