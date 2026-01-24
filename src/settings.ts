import { App, PluginSettingTab, Setting } from 'obsidian';
import type SpicyToolsPlugin from './main';

export interface SpicyToolsSettings {
	// Feature toggles
	enableDropdowns: boolean;
	enableKanban: boolean;

	// Dropdown settings
	globalDropdownDefinitions: string;

	// Kanban settings
	defaultCardTemplate: string;
}

export const DEFAULT_SETTINGS: SpicyToolsSettings = {
	enableDropdowns: true,
	enableKanban: true,
	globalDropdownDefinitions: '',
	defaultCardTemplate: '',
};

export class SpicyToolsSettingTab extends PluginSettingTab {
	plugin: SpicyToolsPlugin;

	constructor(app: App, plugin: SpicyToolsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Features Section
		containerEl.createEl('h2', { text: 'Features' });

		new Setting(containerEl)
			.setName('Enable Dropdowns')
			.setDesc('Render frontmatter properties as dropdowns based on _dropdowns.md definitions')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDropdowns)
					.onChange(async (value) => {
						this.plugin.settings.enableDropdowns = value;
						await this.plugin.saveSettings();
						// Note: Full reload required to enable/disable feature
						this.showRestartNotice();
					})
			);

		new Setting(containerEl)
			.setName('Enable Kanban Boards')
			.setDesc('View folders with _board.md as Kanban boards')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableKanban)
					.onChange(async (value) => {
						this.plugin.settings.enableKanban = value;
						await this.plugin.saveSettings();
						// Note: Full reload required to enable/disable feature
						this.showRestartNotice();
					})
			);

		// Dropdowns Section
		containerEl.createEl('h2', { text: 'Dropdowns' });

		new Setting(containerEl)
			.setName('Reload Definitions')
			.setDesc('Force refresh of all dropdown definitions from _dropdowns.md files')
			.addButton((button) =>
				button
					.setButtonText('Reload')
					.setCta()
					.onClick(async () => {
						await this.plugin.reloadDropdownDefinitions();
						// Show notice
						const notice = containerEl.createEl('div', {
							text: 'Definitions reloaded',
							cls: 'spicy-tools-notice',
						});
						setTimeout(() => notice.remove(), 2000);
					})
			);

		new Setting(containerEl)
			.setName('Global Dropdown Definitions')
			.setDesc('YAML definitions that apply vault-wide (lowest priority, overridden by folder _dropdowns.md)')
			.addTextArea((text) =>
				text
					.setPlaceholder(
						`# Example:
status:
  options:
    - draft
    - review
    - published

priority:
  options: [low, medium, high]`
					)
					.setValue(this.plugin.settings.globalDropdownDefinitions)
					.onChange(async (value) => {
						this.plugin.settings.globalDropdownDefinitions = value;
						await this.plugin.saveSettings();
					})
			);

		// Make the textarea larger
		const textArea = containerEl.querySelector(
			'.setting-item:last-child textarea'
		) as HTMLTextAreaElement | null;
		if (textArea) {
			textArea.style.width = '100%';
			textArea.style.height = '200px';
			textArea.style.fontFamily = 'monospace';
		}

		// Kanban Section
		containerEl.createEl('h2', { text: 'Kanban Boards' });

		new Setting(containerEl)
			.setName('Default Card Template')
			.setDesc('Path to template file for new cards (relative to vault root). Leave empty for blank cards.')
			.addText((text) =>
				text
					.setPlaceholder('templates/card-template.md')
					.setValue(this.plugin.settings.defaultCardTemplate)
					.onChange(async (value) => {
						this.plugin.settings.defaultCardTemplate = value;
						await this.plugin.saveSettings();
					})
			);
	}

	/**
	 * Show notice that Obsidian restart is needed for feature toggle changes.
	 */
	private showRestartNotice() {
		const notice = this.containerEl.createEl('div', {
			text: 'Restart Obsidian to apply feature toggle changes',
			cls: 'spicy-tools-notice spicy-tools-notice-warning',
		});
		setTimeout(() => notice.remove(), 3000);
	}
}
