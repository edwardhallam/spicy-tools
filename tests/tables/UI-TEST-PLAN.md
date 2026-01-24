# Table Dropdown UI Test Plan

This document describes the UI tests for the table dropdown feature using CDP/Playwright via the `mcp__obsidian-cdp__*` tools.

## Prerequisites

### 1. Test Vault Setup

Create a test vault (or use an existing development vault) with the following structure:

```
test-vault/
  _dropdowns.md       # Global dropdown definitions
  tables/
    _dropdowns.md     # Table-specific dropdown definitions (optional override)
    basic-table.md    # Simple table with dropdown column
    multi-table.md    # Multiple tables in one file
    edge-cases.md     # Tables with empty cells, special characters
```

### 2. Dropdown Definitions

Create `_dropdowns.md` in the vault root with dropdown definitions that match table column headers:

```markdown
# Dropdown Definitions

```yaml
status:
  options:
    - Todo
    - In Progress
    - Done
    - Blocked

priority:
  options:
    - High
    - Medium
    - Low

category:
  multi: true
  options:
    - Feature
    - Bug
    - Documentation
    - Testing
```
```

### 3. Test Files

#### `tables/basic-table.md`

```markdown
# Basic Table Test

| Task | Status | Priority |
|------|--------|----------|
| Task 1 | Todo | High |
| Task 2 | In Progress | Medium |
| Task 3 | Done | Low |
```

#### `tables/multi-table.md`

```markdown
# Multi-Table Test

## Tasks

| Task | Status |
|------|--------|
| Item A | Todo |
| Item B | Done |

## Other Data

| Name | Category |
|------|----------|
| Doc 1 | Feature |
| Doc 2 | Bug |
```

#### `tables/edge-cases.md`

```markdown
# Edge Cases

| Task | Status | Notes |
|------|--------|-------|
| Empty status | | Has no status |
| Special chars | Todo | Status with \| pipe |
| Long value | In Progress | Very long description here |
```

### 4. Environment Setup

1. **Install and enable the Spicy Tools plugin** in the test vault

2. **Launch Obsidian with CDP enabled:**
   ```bash
   /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222
   ```

3. **Open the test vault:**
   ```bash
   open "obsidian://open?vault=test-vault"
   ```

4. **Verify CDP connection:**
   ```bash
   curl -s http://127.0.0.1:9222/json/list
   ```
   Should return at least one "page" target.

5. **Verify MCP server is configured:**
   ```bash
   cat ~/.claude.json | grep -A5 obsidian-cdp
   ```

---

## Test Scenarios

### Scenario 1: Basic Dropdown Rendering

**Objective:** Verify that dropdowns appear in table cells for configured columns.

**Preconditions:**
- Spicy Tools plugin enabled
- `_dropdowns.md` defines `status` dropdown
- `basic-table.md` open in Reading View

**Steps:**

1. Navigate to test file:
   ```
   Action: Open Quick Switcher (Meta+o)
   Action: Type "tables/basic-table"
   Action: Press Enter
   ```

2. Switch to Reading View (if not already):
   ```
   Action: Press Meta+e to toggle to Reading View
   ```

3. Wait for rendering:
   ```
   Action: Wait 1 second for plugin to process tables
   ```

4. Take DOM snapshot:
   ```
   Action: browser_snapshot
   Look for: Elements with class containing "spicy-dropdown" or "table-dropdown"
   ```

5. Take screenshot:
   ```
   Action: browser_take_screenshot
   Verify: Table visible with dropdown styling in Status column
   ```

**Expected Results:**
- DOM snapshot contains dropdown elements in the Status column cells
- Screenshot shows dropdown triggers (not plain text) in Status cells
- Priority column also shows dropdowns (if configured)
- Task column (no dropdown definition) shows plain text

**Pass Criteria:**
- [ ] At least 3 dropdown elements found (one per Status cell)
- [ ] Dropdown triggers have appropriate styling (not just text)
- [ ] Non-dropdown columns remain as plain text

---

### Scenario 2: Click Interaction - Dropdown Opens

**Objective:** Verify clicking a dropdown opens the options menu.

**Preconditions:**
- Scenario 1 completed (file open in Reading View)
- Dropdowns rendered in Status column

**Steps:**

1. Get DOM snapshot to find dropdown reference:
   ```
   Action: browser_snapshot
   Find: Reference ID for first Status cell dropdown trigger
   ```

2. Click the dropdown trigger:
   ```
   Action: browser_click with element reference
   ```

3. Wait for menu animation:
   ```
   Action: Wait 300ms
   ```

4. Take DOM snapshot:
   ```
   Action: browser_snapshot
   Look for: Menu element with class "spicy-dropdown-menu" NOT having "hidden" class
   Look for: Option elements with text "Todo", "In Progress", "Done", "Blocked"
   ```

5. Take screenshot:
   ```
   Action: browser_take_screenshot
   Verify: Dropdown menu visible with all options
   ```

**Expected Results:**
- Dropdown menu appears below/near the trigger
- All 4 status options visible in menu
- Current value (e.g., "Todo") marked as selected

**Pass Criteria:**
- [ ] Menu element visible (no "hidden" class)
- [ ] All expected options present in menu
- [ ] Screenshot shows dropdown menu overlay

---

### Scenario 3: Value Selection Updates UI

**Objective:** Verify selecting an option updates the displayed value.

**Preconditions:**
- Scenario 2 completed (dropdown menu open)
- Current value is "Todo"

**Steps:**

1. Get DOM snapshot to find option reference:
   ```
   Action: browser_snapshot
   Find: Reference ID for "Done" option in open menu
   ```

2. Click the option:
   ```
   Action: browser_click with option reference
   ```

3. Wait for UI update:
   ```
   Action: Wait 500ms
   ```

4. Verify menu closed:
   ```
   Action: browser_snapshot
   Verify: Menu has "hidden" class or is removed from DOM
   ```

5. Verify trigger updated:
   ```
   Action: browser_snapshot
   Verify: Dropdown trigger text changed to "Done"
   ```

6. Take screenshot:
   ```
   Action: browser_take_screenshot
   Verify: Cell now shows "Done" instead of "Todo"
   ```

**Expected Results:**
- Dropdown menu closes after selection
- Trigger text updates to show "Done"
- Visual styling matches the new value

**Pass Criteria:**
- [ ] Menu closed after selection
- [ ] Trigger displays "Done"
- [ ] No console errors

---

### Scenario 4: File Persistence

**Objective:** Verify that value changes persist to the markdown file.

**Preconditions:**
- Scenario 3 completed (value changed from "Todo" to "Done")

**Steps:**

1. Switch to Source/Edit View:
   ```
   Action: Press Meta+e to toggle to Source View
   ```

2. Wait for view switch:
   ```
   Action: Wait 500ms
   ```

3. Take screenshot:
   ```
   Action: browser_take_screenshot
   Verify: Raw markdown visible
   ```

4. Get DOM snapshot:
   ```
   Action: browser_snapshot
   Look for: Editor content containing "| Done |" in the first data row
   ```

5. Alternative: Check via file read (if DOM inspection insufficient):
   ```
   Action: Use Read tool to check tables/basic-table.md content
   Verify: First data row Status column contains "Done"
   ```

**Expected Results:**
- Markdown source shows updated value
- File content on disk reflects the change
- Table structure preserved (alignment, other cells unchanged)

**Pass Criteria:**
- [ ] Source view shows "Done" in Status column of first row
- [ ] Other cells unchanged ("Task 1", "High")
- [ ] Table formatting preserved

---

### Scenario 5: Multi-Table Independence

**Objective:** Verify multiple tables in one file work independently.

**Preconditions:**
- `multi-table.md` prepared with two tables
- Different dropdown columns in each table

**Steps:**

1. Navigate to multi-table file:
   ```
   Action: Open Quick Switcher (Meta+o)
   Action: Type "tables/multi-table"
   Action: Press Enter
   ```

2. Switch to Reading View:
   ```
   Action: Press Meta+e if needed
   ```

3. Wait for rendering:
   ```
   Action: Wait 1 second
   ```

4. Take DOM snapshot:
   ```
   Action: browser_snapshot
   Count: Number of dropdown elements (should match expected)
   - Table 1 (Tasks): 2 Status dropdowns
   - Table 2 (Other): 2 Category dropdowns
   ```

5. Interact with first table dropdown:
   ```
   Action: Click first Status dropdown
   Verify: Status options appear (Todo, In Progress, Done, Blocked)
   Action: Press Escape to close
   ```

6. Interact with second table dropdown:
   ```
   Action: Click first Category dropdown
   Verify: Category options appear (Feature, Bug, Documentation, Testing)
   Action: Press Escape to close
   ```

7. Take screenshot:
   ```
   Action: browser_take_screenshot
   Verify: Both tables visible with appropriate dropdowns
   ```

**Expected Results:**
- Each table has independent dropdown configuration
- Clicking dropdown in Table 1 does not affect Table 2
- Different column types show correct options

**Pass Criteria:**
- [ ] Status dropdowns only in Tasks table
- [ ] Category dropdowns only in Other Data table
- [ ] Options match respective definitions

---

### Scenario 6: File Switching

**Objective:** Verify dropdowns work correctly when switching between files.

**Preconditions:**
- Currently viewing `multi-table.md`

**Steps:**

1. Navigate to different file:
   ```
   Action: Open Quick Switcher (Meta+o)
   Action: Type "tables/basic-table"
   Action: Press Enter
   ```

2. Wait for new file:
   ```
   Action: Wait 1 second
   ```

3. Verify dropdowns rendered:
   ```
   Action: browser_snapshot
   Verify: Dropdown elements present for Status column
   ```

4. Navigate back:
   ```
   Action: Open Quick Switcher (Meta+o)
   Action: Type "tables/multi-table"
   Action: Press Enter
   ```

5. Wait and verify:
   ```
   Action: Wait 1 second
   Action: browser_snapshot
   Verify: Both table types have dropdowns
   ```

6. Check for memory leaks (optional):
   ```
   Action: browser_console_messages
   Verify: No repeated "dropdown attached" or memory warnings
   ```

**Expected Results:**
- Dropdowns destroyed when leaving file
- Dropdowns recreated when returning
- No accumulated event listeners or DOM elements

**Pass Criteria:**
- [ ] Each file shows correct dropdowns
- [ ] No stale dropdowns from previous file
- [ ] No console errors on file switch

---

### Scenario 7: Edge Cases - Empty Cells

**Objective:** Verify dropdowns handle empty cell values.

**Preconditions:**
- `edge-cases.md` has row with empty Status

**Steps:**

1. Navigate to edge-cases file:
   ```
   Action: Open Quick Switcher (Meta+o)
   Action: Type "tables/edge-cases"
   Action: Press Enter
   ```

2. Switch to Reading View and wait:
   ```
   Action: Press Meta+e if needed
   Action: Wait 1 second
   ```

3. Find empty status cell:
   ```
   Action: browser_snapshot
   Find: Dropdown in row where Status is empty
   Verify: Shows placeholder text or empty state
   ```

4. Click empty dropdown:
   ```
   Action: browser_click on empty status dropdown
   ```

5. Verify options available:
   ```
   Action: browser_snapshot
   Verify: All status options available for selection
   ```

6. Select a value:
   ```
   Action: Click "Todo" option
   ```

7. Verify update:
   ```
   Action: browser_snapshot
   Verify: Cell now shows "Todo"
   ```

**Expected Results:**
- Empty cells show dropdown with placeholder/empty state
- User can select a value for empty cell
- Value persists correctly

**Pass Criteria:**
- [ ] Empty cell has dropdown trigger
- [ ] Selection updates empty cell
- [ ] Persistence works for previously-empty cell

---

### Scenario 8: Edge Cases - Special Characters

**Objective:** Verify cells with escaped pipes and special characters work.

**Preconditions:**
- `edge-cases.md` has cells with special characters

**Steps:**

1. In edge-cases file, find row with escaped pipe:
   ```
   Action: browser_snapshot
   Find: Row with "Special chars" task
   ```

2. Verify dropdown renders correctly:
   ```
   Action: browser_snapshot
   Verify: Status dropdown shows "Todo" not corrupted
   ```

3. Verify Notes column (non-dropdown):
   ```
   Action: browser_snapshot
   Verify: Notes column shows "Status with | pipe" (unescaped in display)
   ```

4. Change status value:
   ```
   Action: Click Status dropdown
   Action: Select "In Progress"
   ```

5. Verify no corruption:
   ```
   Action: Switch to Source View (Meta+e)
   Action: browser_snapshot
   Verify: Row still has proper structure, escaped pipe preserved
   ```

**Expected Results:**
- Escaped characters in adjacent cells preserved
- Dropdown values don't contain escape sequences
- File structure maintained

**Pass Criteria:**
- [ ] Special characters displayed correctly
- [ ] Dropdown selection works
- [ ] File content not corrupted

---

## Running the Tests

### Interactive Testing Session

1. **Start Obsidian with CDP:**
   ```bash
   /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222
   ```

2. **Start Claude Code session:**
   ```bash
   claude
   ```

3. **Execute tests via natural language:**
   ```
   "Execute Scenario 1 from the table dropdown UI test plan"
   ```

4. **Document results** in this file under Results section.

### Automated Test Execution (Future)

Once patterns are established, tests can be scripted using:
- Playwright test files that connect via CDP
- Jest + Playwright integration
- Custom test runner using MCP tools

---

## Results

### Test Run: [DATE]

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Basic Dropdown Rendering | | |
| 2. Click Interaction | | |
| 3. Value Selection | | |
| 4. File Persistence | | |
| 5. Multi-Table Independence | | |
| 6. File Switching | | |
| 7. Empty Cells | | |
| 8. Special Characters | | |

### Screenshots

Screenshots saved to: `tests/tables/screenshots/[scenario]-[timestamp].png`

### Issues Found

| Issue | Severity | Scenario | Description |
|-------|----------|----------|-------------|
| | | | |

---

## Appendix: DOM Element Reference

### Expected Class Names

| Element | Class | Description |
|---------|-------|-------------|
| Dropdown wrapper | `spicy-dropdown` | Container for dropdown |
| Trigger button | `spicy-dropdown-trigger` | Clickable element |
| Options menu | `spicy-dropdown-menu` | Popup with options |
| Menu hidden | `hidden` | Class when menu closed |
| Option item | `spicy-dropdown-option` | Individual option |
| Selected option | `selected` | Currently selected |
| Table cell with dropdown | `spicy-table-dropdown-cell` | Modified td element |

### ARIA Attributes

| Attribute | Element | Values |
|-----------|---------|--------|
| `role="combobox"` | Trigger | Always |
| `aria-expanded` | Trigger | "true" / "false" |
| `aria-haspopup` | Trigger | "listbox" |
| `role="listbox"` | Menu | Always |
| `role="option"` | Option | Always |
| `aria-selected` | Option | "true" / "false" |

---

## Appendix: Troubleshooting

### Dropdowns Not Appearing

1. Verify plugin enabled: Settings > Community Plugins > Spicy Tools
2. Check `_dropdowns.md` syntax
3. Ensure column header matches definition key (case-insensitive)
4. Check console for errors: `browser_console_messages`

### CDP Connection Issues

1. Verify Obsidian running: `lsof -i :9222`
2. Check targets exist: `curl -s http://127.0.0.1:9222/json/list`
3. Ensure vault window open (not just background process)

### Menu Not Opening

1. Check if another dropdown is open (only one at a time)
2. Verify click target is the trigger element
3. Check for JavaScript errors in console

### Persistence Not Working

1. Verify file is not read-only
2. Check for file sync conflicts
3. Verify TablePersistence module loaded
