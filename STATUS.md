# Spicy Tools - Project Status

**Last Updated**: 2026-01-22
**Build Status**: ✅ Passing (268 tests)
**Test Vault**: `/Users/edwardhallam/obsidian/plugin-dev/`

## Overview

Spicy Tools is an Obsidian plugin combining two features:
1. **Spicy Dropdowns** - Frontmatter property selectors with folder-based inheritance
2. **Kanban Boards** - Visual card-based folder views

---

## Completed

### Phase 1: Project Setup ✅
- [x] Project scaffolding (manifest.json, package.json with pnpm)
- [x] TypeScript configuration with path aliases
- [x] Jest setup with Obsidian API mocks
- [x] esbuild configuration
- [x] Settings panel with feature toggles

### Phase 2: Dropdown Core ✅
- [x] `DefinitionParser.ts` - Parse `_dropdowns.md` YAML from markdown
- [x] `InheritanceResolver.ts` - Walk folder tree for definition inheritance
- [x] `DropdownManager.ts` - Cache definitions, watch for file changes
- [x] Unit tests (20+ tests)

### Phase 3: Dropdown UI ✅
- [x] `DropdownComponent.ts` - Reusable dropdown with keyboard navigation
- [x] `PropertyRenderer.ts` - MutationObserver integration with Properties panel
- [x] Single-select and multi-select modes
- [x] Type-to-filter for large option lists
- [x] Mismatch styling for invalid values
- [x] Unit tests (20 tests)

### Phase 4: Kanban Core ✅
- [x] `BoardParser.ts` - Parse `_board.md` configuration
- [x] `BoardManager.ts` - Track cards, columns, file watchers
- [x] `CardOrderManager.ts` - Persist card order in `_board.md`
- [x] Unit tests

### Phase 5: Kanban UI ✅
- [x] `BoardView.ts` - Custom Obsidian view (`registerView`)
- [x] `CardComponent.ts` - Card rendering with labels
- [x] `ColumnComponent.ts` - Column with drag-and-drop zones
- [x] HTML5 drag-and-drop between columns
- [x] Drop indicators and visual feedback
- [x] "Open Kanban Board" command (from current folder)
- [x] "Open Kanban Board..." command (picker)
- [x] Ribbon icon for quick access
- [x] "Add card" button with prompt modal
- [x] CSS styling for board, columns, cards

---

## Remaining

### Phase 6: Kanban Advanced 🔲

#### BoardEmbed (embedded kanban blocks) ✅
- [x] Register markdown code block processor for ` ```kanban ` blocks
- [x] Parse folder path from code block content
- [x] Render interactive board inline in markdown
- [x] Handle drag-and-drop in embedded context (embed ID scoping)
- [x] Unit tests (34 tests)

**File created**: `src/kanban/BoardEmbed.ts`

```markdown
# Example usage in markdown:
```kanban
folder: Projects/Tasks
height: 400
showTitle: true
compact: false
```
```

#### SwimlaneComponent (horizontal grouping) ✅
- [x] Group cards by `swimlaneProperty` value
- [x] Render collapsible swimlane headers
- [x] Persist collapsed state (localStorage per-board)
- [x] Update `BoardView.ts` to use swimlanes when configured
- [x] Unit tests (30 tests)

**Files created/modified**:
- `src/kanban/SwimlaneComponent.ts` (new)
- `src/kanban/BoardManager.ts` (swimlane grouping)
- `src/kanban/BoardView.ts` (conditional rendering)
- `src/kanban/types.ts` (collapsedSwimlanes, swimlane-toggled event)

**File to create**: `src/kanban/SwimlaneComponent.ts`

#### Mobile Touch Support ✅
- [x] Add touch event handlers for drag-and-drop (CardComponent)
- [x] Implement long-press (350ms) to initiate drag
- [x] Touch drop detection (ColumnComponent)
- [x] Visual feedback (clone, highlights, haptic)
- [x] Touch-friendly CSS (44px targets, pointer:coarse media query)
- [x] Unit tests (43 tests)

**Files modified**:
- `src/kanban/CardComponent.ts` (touch handlers, clone creation)
- `src/kanban/ColumnComponent.ts` (touch drop zones)
- `src/styles/kanban.css` (touch states, mobile targets)

### Phase 7: Polish & Testing 🔄 IN PROGRESS

#### Completed ✅

**Unit Tests for Error Handling** (69 new tests added)
- [x] `tests/error-handling/MalformedBoardConfig.test.ts` - Tests for invalid board YAML
- [x] `tests/error-handling/MalformedDropdowns.test.ts` - Tests for invalid dropdown YAML
- [x] All 268 tests passing

**Test Fixtures Created** in `plugin-dev/Spicy Tools-Test-Data/`:
- [x] `valid-kanban/` - Basic kanban board (3 cards: Todo, In Progress, Done)
- [x] `valid-dropdowns/` - Dropdown definitions with single/multi-select
- [x] `valid-swimlanes/` - Swimlane grouping by epic property
- [x] `inheritance-test/` - Parent/child dropdown inheritance
- [x] `invalid-board-missing-columns/` - Error handling test case
- [x] `invalid-board-bad-yaml/` - Error handling test case
- [x] `invalid-dropdowns/` - Error handling test case

**Plugin Enhancements**
- [x] **Auto-render _board.md**: Opening a `_board.md` file auto-opens the board view
- [x] **Smart board picker**: Validates boards before showing, skips invalid configs
- [x] Imports added for `TFile`, `MarkdownView`, `parseBoardConfig`

**Monkey-Patching Fix (2026-01-22)**: Fixed flaky board loading when clicking `_board.md`:

*Root cause*: The `file-open` event approach had race conditions - the markdown view was already created before we could intercept it, leading to "Timeout waiting for BoardView" errors and raw YAML being shown instead of the board.

*Solution*: Replaced `file-open` event handler with monkey-patching of `WorkspaceLeaf.prototype.setViewState()`. This intercepts view creation *before* it happens, avoiding race conditions entirely. This is the same approach used by the popular [mgmeyers/obsidian-kanban](https://github.com/mgmeyers/obsidian-kanban) plugin.

*New command added*: "Toggle Board/Markdown View" - allows switching between the kanban view and raw YAML editing for `_board.md` files.

**UI Testing via CDP** ✅

See [[Obsidian/ui-testing-with-playwright/]] for the working approach.

The CDP (Chrome DevTools Protocol) method works reliably:
1. Launch Obsidian with `--remote-debugging-port=9222`
2. Connect via `@playwright/mcp` MCP server
3. Full access to screenshots, DOM inspection, keyboard automation

**Cleanup (2026-01-22)**: Removed broken Electron-based E2E code:
- Deleted `e2e/` directory (board-load.spec.ts, obsidian-launcher.ts)
- Deleted `e2e-setup.sh` and `playwright.config.ts`
- Removed `@electron/asar` and `electron-playwright-helpers` dependencies
- Removed `test:e2e` and `test:e2e:ui` scripts
- CDP via MCP is now the canonical testing approach

**CSS Layout Fixes (2026-01-22)**: Fixed critical layout issues via CDP exploratory testing:

*Root cause*: `styles.css` wasn't being regenerated when `src/styles/*.css` changed - esbuild only handles JS.

*Issues found and fixed*:
| Issue | Cause | Fix |
|-------|-------|-----|
| Columns stacking vertically | `.spicy-kanban-columns` missing from styles.css | Regenerated combined CSS |
| No gaps between columns | CSS rules not loaded | Regenerated combined CSS |
| Swimlanes container not flex | `.spicy-kanban-swimlanes` had no CSS | Added new rules |
| Column headers not sticky | `.spicy-kanban-column-headers` had no CSS | Added new rules |
| Collapse not hiding content | CSS used `.collapsed`, component uses `.is-collapsed` | Added both selectors |
| Swimlane title not styled | CSS had `-name`, component uses `-title` | Added both selectors |

*Prevention*: Added `scripts/build-css.js` to auto-concatenate CSS. Build scripts now run CSS build first:
- `pnpm run build:css` - CSS only
- `pnpm run dev` - CSS + esbuild watch
- `pnpm run build` - CSS + typecheck + production build

#### Remaining

**E2E Testing**
- [ ] Run CDP-based tests to capture visual issues
- [ ] Automate board load, drag-drop, and dropdown tests via CDP

**Manual Testing Checklist**
- [x] Board renders when opening `_board.md` (auto-render working, monkey-patch fix)
- [x] Board loads reliably after Obsidian reload (no flaky "shows YAML" issue)
- [x] Toggle Board/Markdown View command works
- [ ] Drag card between columns → frontmatter updates
- [ ] Drag card within column → order persists
- [ ] Add new card → file created with template
- [ ] Archive card → `archived: true` set
- [x] Board picker skips invalid boards
- [ ] Dropdown replaces property input
- [ ] Multi-select dropdown works
- [ ] Inheritance overrides work
- [ ] `disabled: true` removes inherited property
- [ ] Mobile touch interactions

**Visual Issue** ✅ (diagnosed and fixed 2026-01-22)
- [x] Layout issues caused by stale `styles.css` - see "CSS Layout Fixes" above

**Documentation**
- [ ] README.md with usage examples
- [ ] Example `_dropdowns.md` template
- [ ] Example `_board.md` template

---

## Known Limitations

1. ~~**Simple YAML Parser**: The custom YAML parser doesn't handle deeply nested structures (3+ levels). Complex `cardOrder` configurations may not parse correctly.~~ **FIXED (2026-01-22)**: Parser now handles nested `cardOrder` with per-column arrays.

2. **Board Picker**: Currently opens the first *valid* board alphabetically when multiple exist. Should implement a proper suggester modal.

3. **No Undo**: Card movements and archives don't have undo functionality.

4. **cardTemplate not supported**: The `cardTemplate` field in `_board.md` is not yet implemented. Including it (especially with `---` YAML markers) may cause parse errors.

5. **E2E Testing**: Uses CDP-based approach (launch Obsidian with `--remote-debugging-port=9222`). See [[Obsidian/ui-testing-with-playwright/]] for setup.

---

## File Structure

```
scripts/
└── build-css.js            # Concatenates src/styles/*.css → styles.css
src/
├── main.ts                 # Plugin entry point (monkey-patches setViewState for _board.md)
├── settings.ts             # Settings panel
├── dropdowns/
│   ├── types.ts            # DropdownDefinition types
│   ├── DefinitionParser.ts # Parse _dropdowns.md
│   ├── InheritanceResolver.ts
│   ├── DropdownManager.ts  # Cache and file watching
│   ├── DropdownComponent.ts # UI component
│   ├── PropertyRenderer.ts # Obsidian integration
│   └── index.ts
├── kanban/
│   ├── types.ts            # BoardConfig, Card, Column types
│   ├── BoardParser.ts      # Parse _board.md
│   ├── BoardManager.ts     # State management
│   ├── CardOrderManager.ts # Order persistence
│   ├── BoardView.ts        # Custom view
│   ├── CardComponent.ts    # Card UI
│   ├── ColumnComponent.ts  # Column UI
│   └── index.ts
├── shared/
│   ├── types.ts            # ParseResult<T>
│   ├── InheritanceResolver.ts
│   └── index.ts
└── styles/
    ├── dropdown.css        # Dropdown UI styles (source)
    └── kanban.css          # Kanban UI styles (source)
styles.css                  # Auto-generated - DO NOT EDIT (run build:css)
```

---

## Commands

```bash
cd /Users/edwardhallam/code/spicy-tools

pnpm install       # Install dependencies
pnpm run build:css # Rebuild styles.css from src/styles/*.css
pnpm run dev       # CSS build + watch mode
pnpm run build     # CSS build + typecheck + production build
pnpm test          # Run tests
pnpm test:watch    # Tests in watch mode
```

---

## Next Steps

1. **Test in Obsidian**: Symlink plugin to test vault and verify basic functionality
2. **Implement BoardEmbed**: Add embedded kanban support for markdown files
3. **Add SwimlaneComponent**: Enable horizontal grouping
4. **Mobile testing**: Verify touch interactions work
