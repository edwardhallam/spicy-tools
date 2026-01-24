/**
 * Jest setup file - Test utilities and global configuration
 *
 * The obsidian module mock is defined in tests/__mocks__/obsidian.ts
 * and mapped via jest.config.js moduleNameMapper.
 */

import { TFile, TFolder, App } from 'obsidian';

// Helper to create mock TFile
export function createMockTFile(path: string): TFile {
	return new TFile(path);
}

// Helper to create mock TFolder
export function createMockTFolder(path: string): TFolder {
	return new TFolder(path);
}

// Helper to create mock App
export function createMockApp(): App {
	return new App();
}

// Global test utilities
beforeEach(() => {
	jest.clearAllMocks();
});
