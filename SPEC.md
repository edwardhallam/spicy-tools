# Spicy Tools - Obsidian Plugin Specification

> Frontmatter Dropdowns + Kanban Boards in a single plugin

## Overview

Spicy Tools combines two complementary features for managing structured content in Obsidian:

1. **Spicy Dropdowns** - Render frontmatter properties as dropdown selectors
2. **Kanban Boards** - Visual board view of folder contents, with cards movable between columns

Both features can be independently enabled/disabled in plugin settings.

---

## Feature 1: Spicy Dropdowns

### Core Concept
- Definition files (`_dropdowns.md`) specify which frontmatter properties render as dropdowns
- Properties matching definitions display as dropdowns instead of text inputs
- Selecting an option immediately updates and saves the frontmatter

### Definition File

**Filename**: `_dropdowns.md` (underscore prefix, sorts to top)

**Format**: Markdown with YAML code block
```markdown
# Dropdown Definitions

These dropdowns apply to all files in this folder and subfolders.

```yaml
entry_type:
  options:
    - Symptom
    - Medication
    - Procedure
    - Observation

severity:
  options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

categories:
  options:
    - Throat
    - Respiratory
    - Digestive
    - Energy
    - Sleep
    - Mental
  multi: true  # allows multiple selection

# Disable inherited dropdown for this property
some_parent_property:
  disabled: true
```
```

### Scoping & Inheritance

1. **Global config**: Plugin settings panel defines global dropdowns (applies vault-wide)
2. **Folder definitions**: `_dropdowns.md` in any folder overrides/extends
3. **Auto-inheritance**: Walk up folder tree to vault root, then global
4. **Override behavior**: Child definitions **fully replace** parent (no option merging)
5. **Opt-out**: Use `disabled: true` to disable an inherited dropdown

**Example hierarchy**:
```
vault/
├── _dropdowns.md          # Vault-level definitions
├── Health/
│   ├── _dropdowns.md      # Overrides vault-level for Health/*
│   └── Tracking/
│       └── HealthLog/
│           └── 2026/      # Inherits from Health/_dropdowns.md
│               └── note.md
```

### UI Behavior

| Aspect | Behavior |
|--------|----------|
| Placement | Replace Obsidian's native property input |
| Save | Immediate on selection (file saved) |
| Multi-select | Checkboxes in dropdown list |
| Keyboard | Arrow keys navigate + type to filter + Enter selects + Escape closes |
| Click outside | Closes dropdown (no change if no selection made) |
| Cold start | Show native input, swap to dropdown when definitions loaded |
| Mismatch | Value doesn't match options → show with warning styling, preserve value |
| Undefined props | Properties without definitions use native Obsidian input |

### Error Handling

- **Invalid YAML in definition file**: Show error banner on affected files
- **Missing definition file**: Fall back to parent → global → native inputs
- **Reload**: Button in plugin settings to force-refresh definitions

### Mobile Support

Must work on Obsidian iOS/Android with touch-friendly dropdown interactions.

---

## Feature 2: Kanban Boards

### Core Concept
- A folder with `_board.md` becomes a Kanban board
- Each markdown file in the folder is a card
- Cards are grouped into columns based on a configurable frontmatter property
- Drag cards between columns to update that property

### Board Configuration File

**Filename**: `_board.md`

**Format**: Markdown with YAML code block
```markdown
# Project Board

```yaml
# Required
columnProperty: status          # Which frontmatter property determines column
columns:
  - todo
  - in-progress
  - review
  - done

# Card display (all optional)
cardTitle: title                # Property to show as card title (default: filename)
cardPreview: notes              # Property to show as preview text
cardPreviewLines: 2             # Max lines of preview

# Labels
labelProperty: tags             # Property containing labels
labelDisplay: chips             # 'chips' or 'stripe'
labelColors:
  bug: red
  feature: blue
  urgent: orange

# Swimlanes (optional)
swimlaneProperty: project       # Property for horizontal grouping
swimlanesCollapsible: true

# Templates
newCardTemplate: _template.md   # Template for "Add card" button
```
```

### Column Definitions

Columns are defined explicitly in `_board.md`. Order in config = order on board.

Cards with values not matching any column appear in an "Uncategorized" column (or hidden, configurable).

### Card Behavior

| Aspect | Behavior |
|--------|----------|
| Display | Configurable: filename, title property, preview text, labels |
| Drag between columns | Updates `columnProperty` in frontmatter immediately |
| Drag within column | Reorder cards (order stored in `_board.md`) |
| Click card | Opens the file in Obsidian |
| Create card | "Add card" button in column → creates file from template |
| Archive | Sets `archived: true` in frontmatter → card hidden from board |
| Unarchive | Manual: edit frontmatter to remove/false the property |
| File deleted/moved | Card disappears immediately (folder is watched) |

### Card Order Storage

Order within columns stored in `_board.md`:
```yaml
cardOrder:
  todo:
    - task-1.md
    - task-2.md
  in-progress:
    - task-3.md
```

### Labels

- Defined via `labelProperty` (e.g., `tags`, `categories`)
- Colors explicitly mapped in `labelColors`
- Display style: `chips` (colored pills with text) or `stripe` (left border color)

### Swimlanes

- Horizontal grouping based on `swimlaneProperty`
- Each unique value creates a swimlane
- Individually collapsible (state persisted)

### Rendering Modes

#### 1. Custom View Pane (Primary)
- Opens like Graph View in a separate pane
- Command palette: "Spicy Tools: Open board for current folder"
- Full interactivity: drag, create, archive

#### 2. Embedded Markdown Block
````markdown
```kanban
folder: Projects/Website
```
````
- Renders board inline in any markdown file
- **Fully interactive**: drag cards, change statuses
- Syncs with the actual `_board.md` configuration

### External Changes

Plugin watches for frontmatter changes from any source (Obsidian Sync, other plugins, manual edits) and updates board UI accordingly.

---

## Plugin Settings Panel

```
┌─────────────────────────────────────────────┐
│ Spicy Tools Settings                            │
├─────────────────────────────────────────────┤
│ Features                                    │
│ ├─ [x] Enable Dropdowns                     │
│ └─ [x] Enable Kanban Boards                 │
│                                             │
│ Dropdowns                                   │
│ ├─ [Reload Definitions]                     │
│ └─ Global Definitions:                      │
│    ┌────────────────────────────────────┐   │
│    │ (YAML editor for global dropdowns) │   │
│    └────────────────────────────────────┘   │
│                                             │
│ Kanban                                      │
│ └─ Default new card template: [         ]   │
└─────────────────────────────────────────────┘
```

---

## File Structure

```
spicy-tools/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── src/
│   ├── main.ts                    # Plugin entry point
│   ├── settings.ts                # Settings tab
│   │
│   ├── dropdowns/
│   │   ├── DropdownManager.ts     # Manages definition loading/caching
│   │   ├── DefinitionParser.ts    # Parses _dropdowns.md files
│   │   ├── PropertyRenderer.ts    # Renders dropdown UI in Properties
│   │   ├── DropdownComponent.ts   # Dropdown UI component
│   │   └── types.ts               # Dropdown-specific types
│   │
│   ├── kanban/
│   │   ├── BoardManager.ts        # Manages board state
│   │   ├── BoardParser.ts         # Parses _board.md files
│   │   ├── BoardView.ts           # Custom view pane
│   │   ├── BoardEmbed.ts          # Markdown code block processor
│   │   ├── CardComponent.ts       # Card UI component
│   │   ├── ColumnComponent.ts     # Column UI component
│   │   ├── SwimlaneComponent.ts   # Swimlane UI component
│   │   ├── DragManager.ts         # Drag-and-drop logic
│   │   └── types.ts               # Kanban-specific types
│   │
│   ├── shared/
│   │   ├── FrontmatterUtils.ts    # Read/write frontmatter
│   │   ├── FileWatcher.ts         # Watch for file changes
│   │   ├── InheritanceResolver.ts # Resolve definition inheritance
│   │   └── types.ts               # Shared types
│   │
│   └── styles/
│       ├── dropdown.css
│       └── kanban.css
│
└── tests/
    ├── setup.ts
    ├── dropdowns/
    │   ├── DefinitionParser.test.ts
    │   ├── InheritanceResolver.test.ts
    │   └── fixtures/
    └── kanban/
        ├── BoardParser.test.ts
        └── fixtures/
```

---

## Key Obsidian APIs

### For Dropdowns
- `Plugin.registerEditorExtension()` - Extend CodeMirror for Live Preview
- `Plugin.registerMarkdownPostProcessor()` - Modify Reading view
- `MetadataCache` - Read frontmatter efficiently
- `Vault.process()` - Modify file frontmatter
- `Workspace.on('file-open')` - React to file changes

### For Kanban
- `Plugin.registerView()` - Custom view type for board pane
- `Plugin.registerMarkdownCodeBlockProcessor()` - Embedded ```kanban``` blocks
- `Vault.on('modify')` - Watch for file changes
- `Vault.on('delete')`, `Vault.on('rename')` - Track file movements
- `FileManager.processFrontMatter()` - Atomic frontmatter updates

---

## Test Plan

### Test Environment

**Vault**: Copy of full nexus vault to `plugin-dev` vault
- Realistic data volume and folder structure
- Actual health log entries for dropdown testing
- Create sample kanban board folders for board testing

### Automated Tests (Jest)

```
tests/
├── dropdowns/
│   ├── DefinitionParser.test.ts
│   │   ├── parses valid YAML
│   │   ├── handles empty file
│   │   ├── handles invalid YAML (returns error)
│   │   ├── parses multi: true
│   │   ├── parses disabled: true
│   │   └── handles missing options array
│   │
│   ├── InheritanceResolver.test.ts
│   │   ├── returns global when no folder definitions
│   │   ├── folder definition overrides global
│   │   ├── walks up multiple parent levels
│   │   ├── stops at vault root
│   │   ├── child fully replaces parent (no merge)
│   │   ├── disabled: true removes inherited property
│   │   └── handles circular references gracefully
│   │
│   └── ValueMatcher.test.ts
│       ├── exact match returns valid
│       ├── case mismatch returns invalid (preserves value)
│       ├── empty value returns valid
│       └── value not in options returns invalid
│
├── kanban/
│   ├── BoardParser.test.ts
│   │   ├── parses minimal config
│   │   ├── parses full config with all options
│   │   ├── handles missing required fields
│   │   ├── handles invalid YAML
│   │   └── parses card order
│   │
│   ├── CardOrderManager.test.ts
│   │   ├── adds new card to end of column
│   │   ├── moves card between columns
│   │   ├── reorders within column
│   │   └── handles missing files in order
│   │
│   └── ArchiveManager.test.ts
│       ├── sets archived: true
│       ├── excludes archived from board
│       └── handles already archived files
│
└── shared/
    ├── FrontmatterUtils.test.ts
    │   ├── reads string property
    │   ├── reads array property
    │   ├── writes single property
    │   ├── preserves other properties on write
    │   └── handles empty frontmatter
    │
    └── FileWatcher.test.ts
        ├── detects frontmatter change
        ├── detects file deletion
        └── debounces rapid changes
```

### Manual Test Checklist

#### Dropdown Tests
- [ ] **Basic dropdown**: Open file with defined property → dropdown appears
- [ ] **Multi-select**: Categories field shows checkboxes, multiple selections work
- [ ] **Inheritance**: File in nested folder inherits parent definitions
- [ ] **Override**: Child `_dropdowns.md` replaces parent options
- [ ] **Disabled**: Property with `disabled: true` shows native input
- [ ] **Mismatch**: Type invalid value manually → shows warning styling
- [ ] **Invalid YAML**: Break `_dropdowns.md` syntax → error banner appears
- [ ] **Reload**: Change definition → click reload → dropdown updates
- [ ] **Keyboard**: Arrow keys, type-to-filter, Enter, Escape all work
- [ ] **Click outside**: Clicking outside closes dropdown without change
- [ ] **Mobile**: Test on iOS/Android (dropdowns respond to touch)
- [ ] **Save**: Select value → verify file saved immediately

#### Kanban Tests
- [ ] **Board loads**: Folder with `_board.md` shows cards in columns
- [ ] **Drag between columns**: Drag card → property updates in frontmatter
- [ ] **Drag within column**: Reorder cards → order persisted in `_board.md`
- [ ] **Create card**: Click "Add card" → file created from template
- [ ] **Card display**: Title, preview, labels show as configured
- [ ] **Labels**: Colors match config, display style (chips/stripe) works
- [ ] **Swimlanes**: Cards grouped correctly, collapsible
- [ ] **Archive**: Archive card → `archived: true` set → card hidden
- [ ] **External change**: Edit frontmatter in source → board updates
- [ ] **File deleted**: Delete file → card disappears
- [ ] **Embed**: `\`\`\`kanban` block renders and is interactive
- [ ] **Custom view**: "Open board" command works
- [ ] **Mobile**: Board renders, touch drag works

#### Integration Tests
- [ ] **Dropdown + Kanban**: Board folder has dropdowns → both work
- [ ] **Large vault**: Performance acceptable with full nexus copy
- [ ] **Sync**: Changes sync correctly via Obsidian Sync

---

## Implementation Phases

### Phase 1: Project Setup
1. Initialize Obsidian plugin from sample template
2. Set up TypeScript, esbuild, Jest
3. Create test vault (copy of nexus)
4. Implement plugin shell with settings panel

### Phase 2: Dropdown Core
1. `DefinitionParser` - Parse `_dropdowns.md` files
2. `InheritanceResolver` - Walk folder tree, merge definitions
3. `DropdownManager` - Cache definitions, watch for changes
4. Unit tests for parsing and inheritance

### Phase 3: Dropdown UI
1. `DropdownComponent` - Dropdown UI element
2. `PropertyRenderer` - Replace native inputs in Properties panel
3. Keyboard navigation
4. Multi-select support
5. Mobile touch support
6. Manual testing in test vault

### Phase 4: Kanban Core
1. `BoardParser` - Parse `_board.md` files
2. `BoardManager` - Track cards, columns, order
3. `CardOrderManager` - Persist card order
4. Unit tests for parsing and order management

### Phase 5: Kanban UI
1. `BoardView` - Custom view pane
2. `CardComponent`, `ColumnComponent` - Card/column rendering
3. `DragManager` - Drag-and-drop between and within columns
4. Card creation with templates
5. Archive functionality

### Phase 6: Kanban Advanced
1. Labels (configurable property, colors)
2. Swimlanes (configurable, collapsible)
3. `BoardEmbed` - Embedded ```kanban``` blocks
4. Mobile touch support

### Phase 7: Polish & Testing
1. Error handling refinement
2. Performance optimization (if needed)
3. Full manual test checklist
4. Documentation

---

## Critical Files to Modify/Create

### New Files (Plugin)
- `src/main.ts` - Plugin entry, register features
- `src/settings.ts` - Settings panel
- `src/dropdowns/*.ts` - Dropdown feature
- `src/kanban/*.ts` - Kanban feature
- `src/shared/*.ts` - Shared utilities
- `src/styles/*.css` - Styling

### Test Vault Files
- Copy entire nexus vault to `~/obsidian/plugin-dev`
- Create sample `_dropdowns.md` files
- Create sample `_board.md` with test folder
- Create test cards for kanban

---

## Verification

### How to Test End-to-End

1. **Build plugin**: `npm run build`
2. **Install in test vault**: Copy to `plugin-dev/.obsidian/plugins/spicy-tools/`
3. **Enable in Obsidian**: Settings → Community Plugins → Enable Spicy Tools
4. **Test dropdowns**:
   - Open `Health/Tracking/HealthLog/` file
   - Verify `entry_type` shows as dropdown
   - Change value, verify file saved
5. **Test kanban**:
   - Create `Projects/TestBoard/` with `_board.md`
   - Add test files with `status` property
   - Open board view, drag cards, verify changes
6. **Run automated tests**: `npm test`
7. **Complete manual checklist** above

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Plugin name | Spicy Tools |
| Separate or combined | Combined (dropdowns + kanban) |
| Definition format | Markdown with YAML code block |
| Inheritance | Auto-walk to vault root, global fallback |
| Merge behavior | Child fully replaces parent |
| Save timing | Immediate on selection |
| Mobile support | Required |
| Test approach | Automated (Jest) + Manual checklist |
| Test data | Copy of full nexus vault |

---

## Dependencies

```json
{
  "devDependencies": {
    "@types/node": "^16.0.0",
    "builtin-modules": "^3.3.0",
    "esbuild": "^0.17.0",
    "obsidian": "latest",
    "typescript": "^5.0.0",
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

---

## AI Development Team

Configuration: `.claude/agents/`

### Team Members

| Agent | Specialty | Primary Responsibilities |
|-------|-----------|-------------------------|
| **test-engineer** | QA & Validation | Jest tests, manual test checklist, validation at every phase |
| **documentation-writer** | Documentation | Lean PRDs per iteration, user guides, API docs |
| **obsidian-plugin-developer** | Obsidian APIs | Plugin lifecycle, Vault/MetadataCache, views, frontmatter |
| **frontend-developer** | UI Components | Dropdowns, kanban board, drag-and-drop, mobile touch |
| **code-reviewer** | Code Quality | TypeScript patterns, error handling, performance |

### Parallel Work Streams

Agents can work in parallel on independent components:

```
Stream A: Dropdown Feature          Stream B: Kanban Feature
─────────────────────────          ─────────────────────────
obsidian-plugin-developer          obsidian-plugin-developer
  → DefinitionParser                 → BoardParser
  → InheritanceResolver              → BoardManager
  → DropdownManager                  → CardOrderManager

frontend-developer                 frontend-developer
  → DropdownComponent                → BoardView, CardComponent
  → PropertyRenderer                 → ColumnComponent, DragManager

test-engineer                      test-engineer
  → Parser unit tests                → Board parser tests
  → Inheritance tests                → Order management tests
```

### Collaboration Workflow

**Vertical Slice Development** - Each iteration delivers a complete, testable feature.

```
┌─────────────────────────────────────────────────────────────┐
│  ITERATION CYCLE (repeat for each feature)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. PLAN         documentation-writer creates lean PRD      │
│                  (single feature, clear acceptance criteria)│
│                                                             │
│  2. BUILD        obsidian-plugin-developer + frontend-dev   │
│                  work in parallel on API + UI               │
│                                                             │
│  3. TEST         test-engineer writes tests DURING build,   │
│                  not after (shift-left testing)             │
│                                                             │
│  4. REVIEW       code-reviewer validates before merge       │
│                                                             │
│  5. DEPLOY       Install in test vault, run manual tests    │
│                                                             │
│  6. ITERATE      Fix issues, gather feedback, next feature  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase-to-Agent Mapping

| Implementation Phase | Lead Agent | Supporting Agents |
|---------------------|------------|-------------------|
| Phase 1: Project Setup | obsidian-plugin-developer | test-engineer |
| Phase 2: Dropdown Core | obsidian-plugin-developer | test-engineer |
| Phase 3: Dropdown UI | frontend-developer | test-engineer |
| Phase 4: Kanban Core | obsidian-plugin-developer | test-engineer |
| Phase 5: Kanban UI | frontend-developer | test-engineer |
| Phase 6: Kanban Advanced | frontend-developer | obsidian-plugin-developer |
| Phase 7: Polish | code-reviewer | test-engineer |

### Handoff Points

Clear handoffs between agents:

1. **obsidian-plugin-developer → frontend-developer**
   - Parser complete with types exported
   - Manager APIs documented
   - Unit tests passing

2. **frontend-developer → test-engineer**
   - Component implemented
   - Manual test scenarios identified
   - Edge cases documented

3. **Any agent → code-reviewer**
   - Feature complete and tested
   - No TypeScript errors
   - Ready for quality gate

### Communication Protocol

- **SPEC.md** is the source of truth for requirements
- **PRDs** (created by documentation-writer) define iteration scope
- **Test results** gate progression to next phase
- **Code review** required before marking phase complete
