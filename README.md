# Spicy Tools

An Obsidian plugin adding Kanban boards, dropdowns, tagging to an Obsidian vault

## Features

### Spicy Dropdowns

Transform your frontmatter properties into dropdown selectors with:

- **Folder-based inheritance** - Define dropdowns in `_dropdowns.md` files, and child folders inherit parent definitions
- **Single and multi-select** - Support for both single values and arrays
- **Type preservation** - Numeric options stay numeric in frontmatter
- **Mismatch indicators** - Visual feedback when property values don't match available options

### Kanban Boards

Turn any folder into a visual Kanban board:

- **File-as-card** - Each markdown file in the folder becomes a card
- **Drag-and-drop** - Move cards between columns, reorder within columns
- **Swimlanes** - Group cards horizontally with collapsible sections
- **Frontmatter-driven** - Column assignment based on a configurable property
- **Embedded boards** - Use code blocks to embed boards in any note

## Installation

### BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. Open BRAT settings and click "Add Beta Plugin"
3. Enter: `edwardhallam/spicy-tools`
4. Enable "Spicy Tools" in Settings > Community Plugins

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/edwardhallam/spicy-tools/releases)
2. Create folder: `<your-vault>/.obsidian/plugins/spicy-tools/`
3. Copy the downloaded files into that folder
4. Restart Obsidian
5. Enable "Spicy Tools" in Settings > Community Plugins

## Usage

### Spicy Dropdowns

Create a `_dropdowns.md` file in any folder:

````markdown
```yaml
status:
  options:
    - Draft
    - Review
    - Published

priority:
  options:
    - 1
    - 2
    - 3

tags:
  multi: true
  options:
    - frontend
    - backend
    - docs
```
````

All markdown files in that folder (and subfolders) will show dropdown selectors for these properties in the Properties panel.

### Kanban Boards

Create a `_board.md` file in any folder:

````markdown
```yaml
property: status
columns:
  - name: To Do
    value: todo
  - name: In Progress
    value: in-progress
  - name: Done
    value: done
```
````

Opening `_board.md` will display the folder contents as a Kanban board. Cards can be dragged between columns, which updates the frontmatter property.

#### Embedded Boards

Embed a board in any note using a code block:

````markdown
```kanban
folder: Projects/MyProject
property: status
columns:
  - name: To Do
    value: todo
  - name: Done
    value: done
```
````

## Development

```bash
# Install dependencies
pnpm install

# Development mode (CSS build + esbuild watch)
pnpm run dev

# Run tests
pnpm test

# Production build
pnpm run build
```

## License

[MIT](LICENSE)
