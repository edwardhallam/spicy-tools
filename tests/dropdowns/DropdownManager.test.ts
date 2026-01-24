/**
 * Tests for DropdownManager
 */

import { DropdownManager } from '../../src/dropdowns/DropdownManager';
import { App, TFile } from '../__mocks__/obsidian';

describe('DropdownManager', () => {
	let app: App;
	let manager: DropdownManager;

	beforeEach(() => {
		app = new App();
		manager = new DropdownManager(app as any);
	});

	afterEach(() => {
		manager.destroy();
	});

	describe('getTableDefinitionsForFile', () => {
		it('returns null when no _dropdowns.md exists', async () => {
			// Mock getAbstractFileByPath to return null (file not found)
			app.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await manager.getTableDefinitionsForFile('Projects/tasks.md');

			expect(result).toBeNull();
		});

		it('returns table definitions from _dropdowns.md in same folder', async () => {
			const dropdownContent = `\`\`\`yaml
tables:
  Status:
    options:
      - Uncontrolled
      - Controlled
\`\`\``;

			// Mock file exists and has content
			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'Projects/_dropdowns.md') {
					return mockFile;
				}
				return null;
			});
			app.vault.read.mockResolvedValue(dropdownContent);

			const result = await manager.getTableDefinitionsForFile('Projects/tasks.md');

			expect(result).not.toBeNull();
			expect(result?.definitions.size).toBe(1);
			expect(result?.definitions.get('Status')).toBeDefined();
			expect(result?.definitions.get('Status')?.options).toEqual(['Uncontrolled', 'Controlled']);
			expect(result?.source).toBe('Projects/_dropdowns.md');
		});

		it('walks up folder tree to find table definitions', async () => {
			const dropdownContent = `\`\`\`yaml
tables:
  Priority:
    options: [Low, Medium, High]
\`\`\``;

			// Mock: nested file, but _dropdowns.md only exists at parent level
			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'Projects/_dropdowns.md') {
					return mockFile;
				}
				return null;
			});
			app.vault.read.mockResolvedValue(dropdownContent);

			const result = await manager.getTableDefinitionsForFile('Projects/2024/tasks.md');

			expect(result).not.toBeNull();
			expect(result?.definitions.get('Priority')).toBeDefined();
			expect(result?.source).toBe('Projects/_dropdowns.md');
		});

		it('returns null when _dropdowns.md has no tables section', async () => {
			const dropdownContent = `\`\`\`yaml
status:
  options: [draft, published]
\`\`\``;

			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'Projects/_dropdowns.md') {
					return mockFile;
				}
				return null;
			});
			app.vault.read.mockResolvedValue(dropdownContent);

			const result = await manager.getTableDefinitionsForFile('Projects/tasks.md');

			expect(result).toBeNull();
		});

		it('uses cached table definitions on second call', async () => {
			const dropdownContent = `\`\`\`yaml
tables:
  Status:
    options: [A, B]
\`\`\``;

			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'Projects/_dropdowns.md') {
					return mockFile;
				}
				return null;
			});
			app.vault.read.mockResolvedValue(dropdownContent);

			// First call
			await manager.getTableDefinitionsForFile('Projects/tasks.md');

			// Second call should use cache
			await manager.getTableDefinitionsForFile('Projects/tasks.md');

			// vault.read should only be called once due to caching
			expect(app.vault.read).toHaveBeenCalledTimes(1);
		});

		it('handles file at root level', async () => {
			const dropdownContent = `\`\`\`yaml
tables:
  Status:
    options: [Active, Inactive]
\`\`\``;

			const mockFile = new TFile('_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === '_dropdowns.md') {
					return mockFile;
				}
				return null;
			});
			app.vault.read.mockResolvedValue(dropdownContent);

			const result = await manager.getTableDefinitionsForFile('tasks.md');

			expect(result).not.toBeNull();
			expect(result?.definitions.get('Status')).toBeDefined();
		});

		it('prefers child folder definitions over parent', async () => {
			const childContent = `\`\`\`yaml
tables:
  Status:
    options: [Child-A, Child-B]
\`\`\``;

			const parentContent = `\`\`\`yaml
tables:
  Status:
    options: [Parent-A, Parent-B]
\`\`\``;

			const childFile = new TFile('Projects/2024/_dropdowns.md');
			(childFile as any).extension = 'md';
			const parentFile = new TFile('Projects/_dropdowns.md');
			(parentFile as any).extension = 'md';

			app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'Projects/2024/_dropdowns.md') {
					return childFile;
				}
				if (path === 'Projects/_dropdowns.md') {
					return parentFile;
				}
				return null;
			});

			app.vault.read.mockImplementation(async (file: any) => {
				if (file.path === 'Projects/2024/_dropdowns.md') {
					return childContent;
				}
				if (file.path === 'Projects/_dropdowns.md') {
					return parentContent;
				}
				return '';
			});

			const result = await manager.getTableDefinitionsForFile('Projects/2024/tasks.md');

			// Child definition should be used, not parent
			expect(result?.definitions.get('Status')?.options).toEqual(['Child-A', 'Child-B']);
		});

		it('handles multi: true in table definitions', async () => {
			const dropdownContent = `\`\`\`yaml
tables:
  Tags:
    options: [A, B, C]
    multi: true
\`\`\``;

			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === 'Projects/_dropdowns.md') {
					return mockFile;
				}
				return null;
			});
			app.vault.read.mockResolvedValue(dropdownContent);

			const result = await manager.getTableDefinitionsForFile('Projects/tasks.md');

			expect(result?.definitions.get('Tags')?.multi).toBe(true);
		});
	});

	describe('getTableDefinitionsForFolder', () => {
		it('returns null when folder has no _dropdowns.md', async () => {
			app.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await manager.getTableDefinitionsForFolder('Projects');

			expect(result).toBeNull();
		});

		it('returns table definitions when _dropdowns.md has tables section', async () => {
			const dropdownContent = `\`\`\`yaml
tables:
  Status:
    options: [Active, Done]
\`\`\``;

			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			app.vault.read.mockResolvedValue(dropdownContent);

			const result = await manager.getTableDefinitionsForFolder('Projects');

			expect(result).not.toBeNull();
			expect(result?.definitions.size).toBe(1);
		});

		it('returns empty definitions when _dropdowns.md has no tables section', async () => {
			const dropdownContent = `\`\`\`yaml
status:
  options: [draft]
\`\`\``;

			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			app.vault.read.mockResolvedValue(dropdownContent);

			const result = await manager.getTableDefinitionsForFolder('Projects');

			expect(result).not.toBeNull();
			expect(result?.definitions.size).toBe(0);
		});
	});

	describe('reloadAll', () => {
		it('clears both property and table caches', async () => {
			const dropdownContent = `\`\`\`yaml
status:
  options: [draft]
tables:
  Status:
    options: [A, B]
\`\`\``;

			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			app.vault.read.mockResolvedValue(dropdownContent);

			// Load table definitions to populate cache
			await manager.getTableDefinitionsForFile('Projects/tasks.md');
			expect(app.vault.read).toHaveBeenCalledTimes(1);

			// Reload all (clears caches)
			await manager.reloadAll();

			// Next call should read from disk again
			await manager.getTableDefinitionsForFile('Projects/tasks.md');
			expect(app.vault.read).toHaveBeenCalledTimes(2);
		});
	});

	describe('event emission', () => {
		it('emits definitions-error when table parsing fails', async () => {
			const invalidContent = `\`\`\`yaml
tables:
  Status:
    multi: true
\`\`\``;

			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			app.vault.read.mockResolvedValue(invalidContent);

			const events: any[] = [];
			manager.on((event) => events.push(event));

			await manager.getTableDefinitionsForFolder('Projects');

			expect(events).toContainEqual(
				expect.objectContaining({
					type: 'definitions-error',
					path: 'Projects/_dropdowns.md',
				})
			);
		});

		it('emits definitions-cleared when reloadAll is called', async () => {
			const events: any[] = [];
			manager.on((event) => events.push(event));

			await manager.reloadAll();

			expect(events).toContainEqual({ type: 'definitions-cleared' });
		});
	});

	describe('cache invalidation', () => {
		it('invalidates table cache when _dropdowns.md is modified', async () => {
			// Initialize manager to set up file watchers
			await manager.initialize({ globalDefinitionsYaml: '' });

			const dropdownContent = `\`\`\`yaml
tables:
  Status:
    options: [A]
\`\`\``;

			const mockFile = new TFile('Projects/_dropdowns.md');
			(mockFile as any).extension = 'md';
			app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			app.vault.read.mockResolvedValue(dropdownContent);

			// Load to cache
			await manager.getTableDefinitionsForFile('Projects/tasks.md');
			expect(app.vault.read).toHaveBeenCalledTimes(1);

			// Simulate file modification event
			const modifyCallback = app.vault.on.mock.calls.find(
				(call: any[]) => call[0] === 'modify'
			)?.[1];
			expect(modifyCallback).toBeDefined();
			modifyCallback({ name: '_dropdowns.md', path: 'Projects/_dropdowns.md' });

			// Next call should read from disk again (cache was invalidated)
			await manager.getTableDefinitionsForFile('Projects/tasks.md');
			expect(app.vault.read).toHaveBeenCalledTimes(2);
		});
	});
});
