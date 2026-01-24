/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/tests'],
	testMatch: ['**/*.test.ts'],
	moduleNameMapper: {
		'^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
		'^@dropdowns/(.*)$': '<rootDir>/src/dropdowns/$1',
		'^@kanban/(.*)$': '<rootDir>/src/kanban/$1',
		'^@shared/(.*)$': '<rootDir>/src/shared/$1',
	},
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov'],
	transform: {
		'^.+\\.tsx?$': ['ts-jest', {
			tsconfig: {
				esModuleInterop: true,
			},
		}],
	},
};
