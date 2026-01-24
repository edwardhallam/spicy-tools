/**
 * Mock implementation of the Obsidian API for testing.
 *
 * This file provides mock implementations of Obsidian's core APIs
 * so we can test plugin logic without a running Obsidian instance.
 */

// Plugin base class
export class Plugin {
	app: any;
	manifest: any;

	constructor(app: any, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	loadData = jest.fn().mockResolvedValue({});
	saveData = jest.fn().mockResolvedValue(undefined);
	addSettingTab = jest.fn();
	registerView = jest.fn();
	registerMarkdownCodeBlockProcessor = jest.fn();
	registerEditorExtension = jest.fn();
	registerEvent = jest.fn();
}

// PluginSettingTab
export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: HTMLElement;

	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement('div');
	}

	display() {}
	hide() {}
}

// Setting class for settings UI
export class Setting {
	settingEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = document.createElement('div');
		containerEl.appendChild(this.settingEl);
	}

	setName = jest.fn().mockReturnThis();
	setDesc = jest.fn().mockReturnThis();
	addToggle = jest.fn().mockReturnThis();
	addText = jest.fn().mockReturnThis();
	addTextArea = jest.fn().mockReturnThis();
	addButton = jest.fn().mockReturnThis();
	addDropdown = jest.fn().mockReturnThis();
}

// TFile - represents a file in the vault
export class TFile {
	path: string;
	name: string;
	basename: string;
	extension: string;
	parent: any;

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').pop() || '';
		this.basename = this.name.replace(/\.[^.]+$/, '');
		this.extension = this.name.split('.').pop() || '';
		this.parent = null;
	}
}

// TFolder - represents a folder in the vault
export class TFolder {
	path: string;
	name: string;
	parent: any;
	children: any[];

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').pop() || '';
		this.parent = null;
		this.children = [];
	}

	isRoot() {
		return this.path === '' || this.path === '/';
	}
}

// ItemView base class for custom views
export class ItemView {
	app: any;
	contentEl: HTMLElement;

	constructor() {
		this.contentEl = document.createElement('div');
	}

	getViewType() { return ''; }
	getDisplayText() { return ''; }
	onOpen = jest.fn().mockResolvedValue(undefined);
	onClose = jest.fn().mockResolvedValue(undefined);
}

// MarkdownView
export class MarkdownView {
	app: any;
	file: any;
	editor: any;

	getViewType() { return 'markdown'; }
}

// Utility functions
export function normalizePath(path: string) {
	return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Notice for user feedback
export class Notice {
	constructor(message: string, timeout?: number) {
		// Mock notice - in real Obsidian this shows a toast
	}
}

// Mock Vault
export class MockVault {
	adapter = {
		exists: jest.fn().mockResolvedValue(true),
		read: jest.fn().mockResolvedValue(''),
		write: jest.fn().mockResolvedValue(undefined),
	};

	getAbstractFileByPath = jest.fn();
	getMarkdownFiles = jest.fn().mockReturnValue([]);
	read = jest.fn().mockResolvedValue('');
	modify = jest.fn().mockResolvedValue(undefined);
	create = jest.fn().mockResolvedValue(undefined);
	delete = jest.fn().mockResolvedValue(undefined);
	on = jest.fn().mockReturnValue({ unsubscribe: jest.fn() });
	off = jest.fn();
	process = jest.fn();
}

// Mock Workspace
export class MockWorkspace {
	activeLeaf: any = null;

	getActiveFile = jest.fn().mockReturnValue(null);
	getLeaf = jest.fn();
	on = jest.fn().mockReturnValue({ unsubscribe: jest.fn() });
	off = jest.fn();
	getLeavesOfType = jest.fn().mockReturnValue([]);
	revealLeaf = jest.fn();
}

// Mock MetadataCache
export class MockMetadataCache {
	getFileCache = jest.fn().mockReturnValue(null);
	getCache = jest.fn().mockReturnValue(null);
	on = jest.fn().mockReturnValue({ unsubscribe: jest.fn() });
	off = jest.fn();
}

// Mock FileManager
export class MockFileManager {
	processFrontMatter = jest.fn().mockImplementation(
		async (file: any, fn: (fm: Record<string, any>) => void) => {
			const frontmatter: Record<string, any> = {};
			fn(frontmatter);
			return frontmatter;
		}
	);
	createNewMarkdownFile = jest.fn();
}

// App mock
export class App {
	vault: MockVault;
	workspace: MockWorkspace;
	metadataCache: MockMetadataCache;
	fileManager: MockFileManager;

	constructor() {
		this.vault = new MockVault();
		this.workspace = new MockWorkspace();
		this.metadataCache = new MockMetadataCache();
		this.fileManager = new MockFileManager();
	}
}
