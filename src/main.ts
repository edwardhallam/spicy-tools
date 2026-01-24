import { Plugin, TFolder, TFile, Notice, MarkdownRenderChild, MarkdownView, WorkspaceLeaf, ViewState } from 'obsidian';
import { SpicyToolsSettings, SpicyToolsSettingTab, DEFAULT_SETTINGS } from './settings';
import { DropdownManager, PropertyDropdownRegistry } from './dropdowns';
import { BoardManagerFactory, BoardView, KANBAN_VIEW_TYPE, BOARD_CONFIG_FILENAME, BoardEmbed, parseBoardConfig } from './kanban';

export default class SpicyToolsPlugin extends Plugin {
	settings: SpicyToolsSettings;
	dropdownManager: DropdownManager | null = null;
	propertyRegistry: PropertyDropdownRegistry | null = null;
	boardManagerFactory: BoardManagerFactory | null = null;

	/**
	 * Track which files should be shown as kanban vs markdown.
	 * Key is file path or leaf ID, value is 'kanban' or 'markdown'.
	 * This allows users to toggle between views.
	 */
	private kanbanFileModes: Record<string, string> = {};

	async onload() {
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new SpicyToolsSettingTab(this.app, this));

		// Initialize features based on settings
		if (this.settings.enableDropdowns) {
			await this.initializeDropdowns();
		}

		if (this.settings.enableKanban) {
			this.initializeKanban();
		}

		console.log('Spicy Tools loaded');
	}

	onunload() {
		// Clean up property registry
		if (this.propertyRegistry) {
			this.propertyRegistry.stop();
			this.propertyRegistry = null;
		}

		// Clean up dropdown manager
		if (this.dropdownManager) {
			this.dropdownManager.destroy();
			this.dropdownManager = null;
		}

		// Clean up board manager factory
		if (this.boardManagerFactory) {
			this.boardManagerFactory.destroyAll();
			this.boardManagerFactory = null;
		}

		console.log('Spicy Tools unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// Update dropdown manager if global definitions changed
		if (this.dropdownManager) {
			this.dropdownManager.updateGlobalDefinitions(
				this.settings.globalDropdownDefinitions
			);
		}
	}

	/**
	 * Initialize the Spicy Dropdowns feature.
	 * Registers property renderers that replace native inputs with dropdowns
	 * for properties defined in _dropdowns.md files.
	 */
	private async initializeDropdowns() {
		// Create and initialize DropdownManager
		this.dropdownManager = new DropdownManager(this.app);
		await this.dropdownManager.initialize({
			globalDefinitionsYaml: this.settings.globalDropdownDefinitions,
		});

		// Subscribe to manager events for debugging
		this.dropdownManager.on((event) => {
			switch (event.type) {
				case 'definitions-loaded':
					console.log(`Spicy Tools: Loaded definitions from ${event.path}`);
					break;
				case 'definitions-error':
					console.error(`Spicy Tools: Error loading definitions from ${event.path}: ${event.error}`);
					break;
				case 'definitions-cleared':
					console.log('Spicy Tools: Definition cache cleared');
					break;
			}
		});

		// Initialize PropertyDropdownRegistry to watch for and replace property inputs
		this.propertyRegistry = new PropertyDropdownRegistry(this.app, this.dropdownManager);
		this.propertyRegistry.start();

		console.log('Dropdowns feature enabled');
	}

	/**
	 * Initialize the Kanban Boards feature.
	 * Registers custom view for board visualization and
	 * markdown code block processor for embedded boards.
	 *
	 * Uses monkey-patching on WorkspaceLeaf.prototype.setViewState to intercept
	 * view creation BEFORE it happens, avoiding race conditions that occur
	 * with file-open events.
	 */
	private initializeKanban() {
		// Create board manager factory
		this.boardManagerFactory = new BoardManagerFactory(this.app);

		// Register the custom view type
		this.registerView(KANBAN_VIEW_TYPE, (leaf) => new BoardView(leaf));

		// Monkey-patch setViewState to intercept _board.md files
		this.patchWorkspaceLeaf();

		// Register markdown code block processor for embedded boards
		this.registerMarkdownCodeBlockProcessor('kanban', async (source, el, ctx) => {
			const embed = new BoardEmbed(
				this.app,
				this.boardManagerFactory!,
				el,
				source
			);
			await embed.render();

			// Register cleanup when the embed is removed from the DOM
			const child = new MarkdownRenderChild(el);
			child.onunload = () => embed.destroy();
			ctx.addChild(child);
		});

		// Add command to open board from current folder
		this.addCommand({
			id: 'open-kanban-board',
			name: 'Open Kanban Board',
			checkCallback: (checking: boolean) => {
				// Get the active file's folder
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return false;

				const folderPath = activeFile.parent?.path || '';
				const configPath = folderPath ? `${folderPath}/${BOARD_CONFIG_FILENAME}` : BOARD_CONFIG_FILENAME;
				const hasBoard = !!this.app.vault.getAbstractFileByPath(configPath);

				if (checking) {
					return hasBoard;
				}

				if (hasBoard) {
					this.openBoard(folderPath);
				}

				return true;
			},
		});

		// Add command to open board picker
		this.addCommand({
			id: 'open-kanban-board-picker',
			name: 'Open Kanban Board...',
			callback: () => this.showBoardPicker(),
		});

		// Add ribbon icon
		this.addRibbonIcon('layout-dashboard', 'Open Kanban Board', () => {
			this.showBoardPicker();
		});

		// Add command to toggle between board and markdown view
		this.addCommand({
			id: 'toggle-kanban-markdown',
			name: 'Toggle Board/Markdown View',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || activeFile.name !== BOARD_CONFIG_FILENAME) return false;

				if (checking) return true;

				this.toggleBoardMarkdownView(activeFile);
				return true;
			},
		});

		console.log('Kanban feature enabled');
	}

	/**
	 * Monkey-patch WorkspaceLeaf.prototype.setViewState to intercept
	 * view creation for _board.md files.
	 *
	 * This is the same approach used by mgmeyers/obsidian-kanban plugin.
	 * It intercepts BEFORE the view is created, avoiding race conditions.
	 */
	private patchWorkspaceLeaf(): void {
		const self = this;

		// Store original setViewState
		const originalSetViewState = WorkspaceLeaf.prototype.setViewState;

		// Register cleanup to restore original on unload
		this.register(() => {
			WorkspaceLeaf.prototype.setViewState = originalSetViewState;
		});

		// Patch setViewState
		WorkspaceLeaf.prototype.setViewState = async function (
			state: ViewState,
			eState?: Record<string, unknown>
		): Promise<void> {
			// Only intercept markdown views for _board.md files
			if (
				state.type === 'markdown' &&
				state.state?.file &&
				typeof state.state.file === 'string'
			) {
				const filePath = state.state.file as string;
				const fileName = filePath.split('/').pop() || '';

				// Check if this is a _board.md file
				if (fileName === BOARD_CONFIG_FILENAME) {
					// Check if user explicitly requested markdown/source mode
					const leafId = (this as WorkspaceLeaf & { id?: string }).id || filePath;
					const explicitMode = self.kanbanFileModes[leafId] || self.kanbanFileModes[filePath];

					// Also check if the state explicitly requests source mode (e.g., from gear icon)
					const requestedMode = state.state?.mode as string | undefined;
					const wantsSourceMode = requestedMode === 'source';

					if (explicitMode !== 'markdown' && !wantsSourceMode) {
						// Validate the board config before opening as kanban
						const configFile = self.app.vault.getAbstractFileByPath(filePath);
						if (configFile && configFile instanceof TFile) {
							try {
								const content = await self.app.vault.read(configFile);
								const parseResult = parseBoardConfig(content, filePath);

								if (parseResult.success) {
									// Valid board config - open as kanban view
									console.log('Spicy Tools: Intercepting _board.md, opening as kanban:', filePath);

									// Store the mode
									self.kanbanFileModes[filePath] = KANBAN_VIEW_TYPE;

									// Create kanban view state
									const kanbanState: ViewState = {
										...state,
										type: KANBAN_VIEW_TYPE,
									};

									// Call original with kanban type
									const setViewResult = await originalSetViewState.call(this, kanbanState, eState);

									// Initialize the board view after it's created
									// Use requestAnimationFrame to ensure view is ready
									requestAnimationFrame(async () => {
										const view = (this as WorkspaceLeaf).view;
										if (view instanceof BoardView && self.boardManagerFactory) {
											const folderPath = filePath.replace(`/${BOARD_CONFIG_FILENAME}`, '').replace(BOARD_CONFIG_FILENAME, '');
											const manager = await self.boardManagerFactory.getManager(folderPath);
											if (manager) {
												await view.setBoard(manager, folderPath);
											}
										}
									});

									return setViewResult;
								} else {
									console.warn('Spicy Tools: Invalid board config, opening as markdown:', parseResult.error);
								}
							} catch (err) {
								console.error('Spicy Tools: Error reading board config:', err);
							}
						}
					}
				}
			}

			// Default: call original setViewState
			return originalSetViewState.call(this, state, eState);
		};
	}

	/**
	 * Toggle between board and markdown view for a _board.md file.
	 */
	private async toggleBoardMarkdownView(file: TFile): Promise<void> {
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf
			|| this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE).find(
				leaf => (leaf.view as BoardView).getFolderPath() === (file.parent?.path || '')
			);

		if (!activeLeaf) return;

		const currentView = activeLeaf.view;
		const filePath = file.path;

		if (currentView instanceof BoardView) {
			// Switch to markdown
			this.kanbanFileModes[filePath] = 'markdown';
			await activeLeaf.setViewState({
				type: 'markdown',
				state: { file: filePath },
			});
		} else if (currentView instanceof MarkdownView) {
			// Switch to kanban - clear the markdown mode override
			delete this.kanbanFileModes[filePath];
			await activeLeaf.setViewState({
				type: 'markdown',
				state: { file: filePath },
			});
		}
	}

	/**
	 * Open a Kanban board for a folder (creates new tab).
	 *
	 * @param folderPath - Path to the folder containing the board
	 */
	async openBoard(folderPath: string): Promise<void> {
		const leaf = this.app.workspace.getLeaf('tab');
		await this.openBoardInLeaf(folderPath, leaf);
	}

	/**
	 * Open a Kanban board in a specific leaf.
	 * This is the core method that handles view replacement.
	 *
	 * @param folderPath - Path to the folder containing the board
	 * @param leaf - The specific leaf to use (avoids race conditions)
	 */
	private async openBoardInLeaf(folderPath: string, leaf: WorkspaceLeaf): Promise<void> {
		if (!this.boardManagerFactory) return;

		const manager = await this.boardManagerFactory.getManager(folderPath);
		if (!manager) {
			new Notice(`No board found in ${folderPath || 'root'}`);
			return;
		}

		await leaf.setViewState({
			type: KANBAN_VIEW_TYPE,
			active: true,
		});

		// Wait for the view to be ready - setViewState is async but the view
		// instantiation happens after it resolves
		const view = await this.waitForBoardView(leaf);
		if (view) {
			await view.setBoard(manager, folderPath);
		}
	}

	/**
	 * Find existing BoardViews in the workspace.
	 * Returns both a board matching the specified folder and any uninitialized board.
	 *
	 * @param folderPath - Path to find a matching board for
	 * @returns Object with matchingBoard (exact match) and uninitializedBoard (empty folderPath)
	 */
	private findBoardViews(folderPath: string): {
		matchingBoard: WorkspaceLeaf | null;
		uninitializedBoard: WorkspaceLeaf | null;
	} {
		let matchingBoard: WorkspaceLeaf | null = null;
		let uninitializedBoard: WorkspaceLeaf | null = null;

		this.app.workspace.iterateAllLeaves((leaf) => {
			const isBoardView = leaf.view instanceof BoardView;
			if (!isBoardView) return;

			const viewFolderPath = (leaf.view as BoardView).getFolderPath();

			if (viewFolderPath === folderPath) {
				matchingBoard = leaf;
			} else if (viewFolderPath === '') {
				uninitializedBoard = leaf;
			}
		});

		return { matchingBoard, uninitializedBoard };
	}

	/**
	 * Wait for a leaf to have a BoardView ready.
	 * Obsidian's setViewState resolves before the view is fully instantiated.
	 */
	private waitForBoardView(leaf: WorkspaceLeaf, timeout = 1000): Promise<BoardView | null> {
		return new Promise((resolve) => {
			const startTime = Date.now();

			const check = () => {
				if (leaf.view instanceof BoardView) {
					resolve(leaf.view);
					return;
				}

				if (Date.now() - startTime > timeout) {
					console.error('Spicy Tools: Timeout waiting for BoardView');
					resolve(null);
					return;
				}

				// Check again on next frame
				requestAnimationFrame(check);
			};

			check();
		});
	}

	/**
	 * Show a picker to select which board to open.
	 * Validates boards before adding to picker - skips invalid configurations.
	 */
	private async showBoardPicker(): Promise<void> {
		// Find all folders with _board.md and validate them
		const validBoards: string[] = [];
		const invalidBoards: { path: string; error: string }[] = [];

		const checkFolder = async (folder: TFolder) => {
			const configPath = folder.path ? `${folder.path}/${BOARD_CONFIG_FILENAME}` : BOARD_CONFIG_FILENAME;
			const configFile = this.app.vault.getAbstractFileByPath(configPath);

			if (configFile && configFile instanceof TFile) {
				// Try to parse the board config to validate it
				try {
					const content = await this.app.vault.read(configFile);
					const result = parseBoardConfig(content, configPath);

					if (result.success) {
						validBoards.push(folder.path);
					} else {
						invalidBoards.push({ path: folder.path, error: result.error });
					}
				} catch (err) {
					invalidBoards.push({ path: folder.path, error: String(err) });
				}
			}

			// Check subfolders
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					await checkFolder(child);
				}
			}
		};

		await checkFolder(this.app.vault.getRoot());

		// Report invalid boards in console
		if (invalidBoards.length > 0) {
			console.warn('Spicy Tools: Found boards with invalid configuration:', invalidBoards);
		}

		if (validBoards.length === 0) {
			if (invalidBoards.length > 0) {
				new Notice(`Found ${invalidBoards.length} board(s) with invalid configuration. Check console for details.`);
			} else {
				new Notice('No Kanban boards found. Create a _board.md file in a folder to create a board.');
			}
			return;
		}

		if (validBoards.length === 1) {
			// Only one valid board, open it directly
			await this.openBoard(validBoards[0]);
			return;
		}

		// Multiple valid boards - show picker or open first
		// TODO: Add proper suggester modal
		await this.openBoard(validBoards[0]);
		new Notice(`Found ${validBoards.length} valid boards. Opening: ${validBoards[0] || 'root'}`);
	}

	/**
	 * Reload dropdown definitions from all _dropdowns.md files.
	 * Called when user clicks "Reload Definitions" in settings.
	 */
	async reloadDropdownDefinitions() {
		if (this.dropdownManager) {
			await this.dropdownManager.reloadAll();
			console.log('Spicy Tools: Dropdown definitions reloaded');
		}

		// Refresh the property registry to pick up new definitions
		if (this.propertyRegistry) {
			await this.propertyRegistry.refresh();
		}
	}
}
